import { Router } from 'express';
import { env } from '../config.js';
import { pool } from '../db/pool.js';
import { acceptIncomingCall, rejectIncomingCall, verifyOpenAIWebhook } from '../services/openaiSip.js';
import { askGeminiVoiceAssistant } from '../services/gemini.js';

export const telephonyRouter = Router();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function maskPhoneNumber(num: string): string {
  const clean = num.replace(/[^\d+]/g, '');
  if (clean.length < 5) return clean || 'Unknown';
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}

function maskSipHeader(headers: unknown, key: string) {
  if (!Array.isArray(headers)) return null;
  const found = headers.find((h: any) => String(h.name).toLowerCase() === key.toLowerCase());
  const value = String(found?.value ?? '');
  const number = value.match(/\+?\d{5,}/)?.[0];
  return number ? `${number.slice(0, 2)}***${number.slice(-2)}` : null;
}

/**
 * Health & Configuration diagnostic for Telephony
 */
telephonyRouter.get('/status', async (_req, res) => {
  res.json({
    telephony: 'ready',
    providers: {
      openaiSip: {
        configured: Boolean(env.OPENAI_API_KEY),
        sipEnabled: env.OPENAI_SIP_ENABLED === 'true'
      },
      twilio: {
        configured: Boolean(env.TWILIO_ACCOUNT_SID),
        webhookUrl: '/api/telephony/twilio/incoming'
      },
      geminiAi: {
        configured: Boolean(env.GEMINI_API_KEY)
      }
    },
    humanTransferDestination: env.HUMAN_TRANSFER_URI || 'Not configured'
  });
});

// ==========================================
// TWILIO INBOUND VOICE CALL HANDLERS
// ==========================================

/**
 * Triggered by Twilio when an inbound call arrives at the AI phone number
 */
telephonyRouter.post('/twilio/incoming', async (req, res) => {
  const callSid = String(req.body?.CallSid || req.query?.CallSid || '');
  const fromNum = String(req.body?.From || req.query?.From || 'Anonymous');
  const toNum = String(req.body?.To || req.query?.To || 'XYZ Bank');

  const fromMasked = maskPhoneNumber(fromNum);
  const toMasked = maskPhoneNumber(toNum);

  if (callSid) {
    try {
      await pool.query(
        `INSERT INTO calls(provider_call_id, provider, status, from_number_masked, to_number_masked, metadata)
         VALUES($1, 'twilio', 'IN_PROGRESS', $2, $3, $4)
         ON CONFLICT(provider_call_id) DO UPDATE 
         SET status = 'IN_PROGRESS', answered_at = NOW()`,
        [callSid, fromMasked, toMasked, JSON.stringify({ provider: 'twilio', rawFrom: fromMasked, history: [] })]
      );

      await pool.query(
        `INSERT INTO call_events(provider_event_id, event_type, outcome, detail)
         VALUES($1, 'twilio.call.incoming', 'SUCCESS', $2)
         ON CONFLICT DO NOTHING`,
        [`ev_${callSid}_init`, JSON.stringify({ callSid, from: fromMasked, to: toMasked })]
      );
    } catch (e) {
      console.error('Failed to log Twilio incoming call to DB:', e);
    }
  }

  const welcomeGreeting = 'Thank you for calling XYZ Bank AI customer support. I am Sofia, your AI banking assistant. How may I assist you today?';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">${welcomeGreeting}</Say>
  <Gather input="speech" action="/api/telephony/twilio/turn" method="POST" speechTimeout="auto" language="en-IN" timeout="5">
  </Gather>
  <Say voice="Polly.Aditi" language="en-IN">I did not catch that. Please feel free to call back anytime. Goodbye!</Say>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
});

/**
 * Triggered after caller speaks; processes speech via Gemini AI & runs banking tools
 */
telephonyRouter.post('/twilio/turn', async (req, res) => {
  const callSid = String(req.body?.CallSid || req.query?.CallSid || '');
  const speechResult = String(req.body?.SpeechResult || '').trim();
  const digits = String(req.body?.Digits || '').trim();
  const userUtterance = speechResult || (digits ? `I entered ${digits}` : '');

  if (!userUtterance) {
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">I could not hear anything. Could you please state your banking query?</Say>
  <Gather input="speech" action="/api/telephony/twilio/turn" method="POST" speechTimeout="auto" language="en-IN" timeout="5">
  </Gather>
  <Say voice="Polly.Aditi" language="en-IN">Thank you for calling XYZ Bank. Goodbye!</Say>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(fallbackTwiml);
  }

  try {
    let callRow = (await pool.query(`SELECT id, metadata FROM calls WHERE provider_call_id = $1`, [callSid])).rows[0];
    if (!callRow) {
      const ins = await pool.query(
        `INSERT INTO calls(provider_call_id, provider, status, from_number_masked, to_number_masked, metadata)
         VALUES($1, 'twilio', 'IN_PROGRESS', 'Unknown', 'XYZ Bank', $2)
         RETURNING id, metadata`,
        [callSid, JSON.stringify({ history: [] })]
      );
      callRow = ins.rows[0];
    }

    const currentMetadata = (callRow.metadata && typeof callRow.metadata === 'object') ? callRow.metadata : {};
    const history: Array<{ role: 'user' | 'model'; text: string }> = Array.isArray(currentMetadata.history) ? currentMetadata.history : [];

    // Query Gemini voice banking engine
    const aiResponse = await askGeminiVoiceAssistant(userUtterance, {
      callId: callRow.id,
      providerCallId: callSid,
      history
    });

    // Update conversation history
    history.push({ role: 'user', text: userUtterance });
    history.push({ role: 'model', text: aiResponse.reply });

    await pool.query(
      `UPDATE calls 
       SET metadata = $1, 
           resolution = COALESCE($2, resolution),
           status = CASE WHEN $3 = true THEN 'TRANSFERRED'::call_status ELSE status END
       WHERE id = $4`,
      [
        JSON.stringify({ ...currentMetadata, history }),
        aiResponse.tool ? `AI_TOOL_${aiResponse.tool}` : (aiResponse.transferred ? 'HUMAN_HANDOFF' : null),
        aiResponse.transferred,
        callRow.id
      ]
    );

    const escapedReply = escapeXml(aiResponse.reply);

    // Handle human escalation
    if (aiResponse.transferred) {
      const transferTarget = env.HUMAN_TRANSFER_URI || '+910000000000';
      const transferTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">${escapedReply}</Say>
  <Dial>${transferTarget}</Dial>
</Response>`;
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(transferTwiml);
    }

    // Continue the conversational loop
    const nextTurnTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">${escapedReply}</Say>
  <Gather input="speech" action="/api/telephony/twilio/turn" method="POST" speechTimeout="auto" language="en-IN" timeout="5">
  </Gather>
  <Say voice="Polly.Aditi" language="en-IN">Thank you for calling XYZ Bank. Have a wonderful day. Goodbye!</Say>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(nextTurnTwiml);

  } catch (error) {
    console.error('Error in Twilio turn handling:', error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">I am having trouble accessing the banking system. Please hold while I transfer you to a bank representative.</Say>
  <Dial>${env.HUMAN_TRANSFER_URI || '+910000000000'}</Dial>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(errorTwiml);
  }
});

/**
 * Triggered on call completion or termination
 */
telephonyRouter.post('/twilio/status', async (req, res) => {
  const callSid = String(req.body?.CallSid || req.query?.CallSid || '');
  const callDuration = parseInt(String(req.body?.CallDuration || '0'), 10);
  const callStatus = String(req.body?.CallStatus || 'completed').toLowerCase();

  if (callSid) {
    const finalStatus = callStatus === 'completed' 
      ? 'COMPLETED' 
      : (callStatus === 'busy' || callStatus === 'no-answer' ? 'FAILED' : 'COMPLETED');
    try {
      await pool.query(
        `UPDATE calls 
         SET status = CASE WHEN status = 'TRANSFERRED' THEN status ELSE $1::call_status END,
             ended_at = COALESCE(ended_at, NOW()),
             duration_seconds = GREATEST(COALESCE(duration_seconds, 0), $2)
         WHERE provider_call_id = $3`,
        [finalStatus, isNaN(callDuration) ? 0 : callDuration, callSid]
      );
    } catch (e) {
      console.error('Error updating Twilio call final status:', e);
    }
  }

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send('<Response/>');
});

// ==========================================
// OPENAI REALTIME DIRECT SIP WEBHOOK HANDLER
// ==========================================

// Keep raw body for signature verification; this router is mounted before express.json().
telephonyRouter.post('/openai/webhook', async (req, res) => {
  let event: any;
  try {
    event = await verifyOpenAIWebhook(req.body as Buffer, req.headers as Record<string, string | string[] | undefined>);
  } catch (e) {
    console.warn('Rejected invalid OpenAI webhook:', e instanceof Error ? e.message : 'verification failed');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const eventId = String(event.id ?? '');
  const type = String(event.type ?? '');
  const callId = String(event.data?.call_id ?? event.data?.session_id ?? '');

  if (!eventId || !type) return res.status(400).json({ error: 'Malformed event' });

  const claim = await pool.query(
    `INSERT INTO processed_webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id`,
    [eventId, type]
  );
  if (!claim.rowCount) return res.status(200).json({ received: true, deduplicated: true });

  try {
    if (type === 'realtime.call.incoming') {
      if (!callId) return res.status(400).json({ error: 'Missing call/session id' });
      await pool.query(
        `INSERT INTO calls(provider_call_id,provider,status,from_number_masked,to_number_masked,metadata) VALUES($1,'openai_sip','RINGING',$2,$3,$4) ON CONFLICT(provider_call_id) DO NOTHING`,
        [callId, maskSipHeader(event.data?.sip_headers, 'From'), maskSipHeader(event.data?.sip_headers, 'To'), JSON.stringify({ eventId, type })]
      );
      if (!env.OPENAI_API_KEY) {
        await pool.query(`UPDATE calls SET status='FAILED',ended_at=NOW(),resolution='OPENAI_CREDENTIALS_MISSING' WHERE provider_call_id=$1`, [callId]);
        await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'FAILURE',$3) ON CONFLICT DO NOTHING`, [eventId, type, JSON.stringify({ reason: 'OpenAI credentials missing' })]);
        await pool.query(`DELETE FROM processed_webhook_events WHERE event_id=$1`, [eventId]);
        return res.status(503).json({ error: 'Voice integration is not configured' });
      }
      if (env.OPENAI_SIP_ENABLED !== 'true') {
        await rejectIncomingCall(callId, 503);
        await pool.query(`UPDATE calls SET status='REJECTED',ended_at=NOW(),resolution='SIP_NOT_ENABLED' WHERE provider_call_id=$1`, [callId]);
        await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'FAILURE',$3) ON CONFLICT DO NOTHING`, [eventId, type, JSON.stringify({ reason: 'SIP disabled' })]);
        return res.status(200).json({ received: true, accepted: false, reason: 'SIP integration disabled' });
      }
      await acceptIncomingCall(callId);
      await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3) ON CONFLICT DO NOTHING`, [eventId, type, JSON.stringify({ callId })]);
    } else if (type.includes('call.ended') || type.includes('session.ended') || type.includes('call.failed')) {
      if (callId) {
        await pool.query(
          `UPDATE calls SET status=CASE WHEN status='TRANSFERRED' THEN status ELSE 'COMPLETED'::call_status END,ended_at=COALESCE(ended_at,NOW()),duration_seconds=GREATEST(0,EXTRACT(EPOCH FROM (NOW()-started_at))::int) WHERE provider_call_id=$1`,
          [callId]
        );
      }
      await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3) ON CONFLICT DO NOTHING`, [eventId, type, JSON.stringify({ callId })]);
    } else {
      await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3) ON CONFLICT DO NOTHING`, [eventId, type, JSON.stringify({ callId: callId || null, unhandled: true })]);
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('Webhook handling failed', e);
    await pool.query(`DELETE FROM processed_webhook_events WHERE event_id=$1`, [eventId]).catch(() => {});
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
});
