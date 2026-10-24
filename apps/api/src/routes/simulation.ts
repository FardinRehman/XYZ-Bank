import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { env } from '../config.js';
import { executeBankTool, toolDefinitions, systemInstructions } from '../services/bankTools.js';
import { askGeminiVoiceAssistant, verifyGeminiApiKey, transcribeAudioWithGemini, synthesizeSpeechWithGemini } from '../services/gemini.js';

export const simulationRouter = Router();

// Synthesize natural human speech using Gemini 2.5 Flash TTS
simulationRouter.post('/call/tts', async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Text to speak is required' });
    }
    const voiceName = String(req.body.voiceName || 'Aoede').trim();
    const clientGeminiKey = (req.body.geminiApiKey || req.headers['x-gemini-api-key'] || '').toString().trim();
    const effectiveGeminiKey = clientGeminiKey || (env.GEMINI_API_KEY || '').trim();

    if (!effectiveGeminiKey) {
      return res.status(400).json({ error: 'Gemini API key is required for TTS synthesis' });
    }

    const { audioBase64, mimeType } = await synthesizeSpeechWithGemini(text, voiceName, effectiveGeminiKey);
    return res.json({ audioBase64, mimeType });
  } catch (e: any) {
    console.warn('Gemini TTS synthesis error:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'TTS synthesis failed' });
  }
});

// Test or verify a Gemini API key
simulationRouter.post('/call/gemini-test', async (req, res, next) => {
  try {
    const customKey = (req.body.geminiApiKey || req.headers['x-gemini-api-key'] || '').toString().trim();
    const keyToTest = customKey || (env.GEMINI_API_KEY || '').trim();
    if (!keyToTest) {
      return res.status(400).json({ ok: false, error: 'No Gemini API key found in request or server environment' });
    }
    const check = await verifyGeminiApiKey(keyToTest);
    if (check.valid) {
      return res.json({
        ok: true,
        model: check.model,
        source: customKey ? 'custom' : 'env',
        message: `Successfully connected to Google Gemini (${check.model})!`
      });
    } else {
      return res.status(400).json({ ok: false, error: check.error });
    }
  } catch (e) {
    next(e);
  }
});

// Check if server has GEMINI_API_KEY configured in environment
simulationRouter.get('/call/gemini-status', async (_req, res) => {
  const hasEnvKey = Boolean((env.GEMINI_API_KEY || '').trim());
  return res.json({
    hasEnvKey,
    defaultModel: 'gemini-flash-latest',
    freeApiKeyUrl: 'https://aistudio.google.com/app/apikey'
  });
});

// 1. Start a simulated inbound call
simulationRouter.post('/call/start', async (req, res, next) => {
  try {
    const callerName = String(req.body.callerName || 'Aarav Sharma (SYN-CUST-1001)');
    const rawNumber = String(req.body.fromNumber || '+91 98765 00011');
    const maskedNumber = rawNumber.replace(/(\+?\d{2})\d{4,}(\d{2})/, '$1****$2');
    const providerCallId = 'SIM-' + Date.now().toString(36).toUpperCase() + '-' + randomUUID().slice(0, 4).toUpperCase();

    const result = await pool.query(
      `INSERT INTO calls (provider_call_id, provider, status, from_number_masked, to_number_masked, started_at, answered_at, metadata)
       VALUES ($1, 'simulation', 'IN_PROGRESS', $2, '1800-XYZ-BANK', NOW(), NOW(), $3)
       RETURNING id, provider_call_id, status, from_number_masked, to_number_masked, started_at`,
      [providerCallId, maskedNumber, JSON.stringify({ callerName, rawNumber, simulated: true })]
    );

    const call = result.rows[0];

    await pool.query(
      `INSERT INTO call_events (call_id, event_type, outcome, detail)
       VALUES ($1, 'SIMULATION_CALL_STARTED', 'SUCCESS', $2)`,
      [call.id, JSON.stringify({ callerName, providerCallId })]
    );

    return res.status(201).json({
      callId: call.id,
      providerCallId: call.provider_call_id,
      fromNumber: call.from_number_masked,
      toNumber: call.to_number_masked,
      startedAt: call.started_at,
      greeting: "Thank you for calling XYZ Bank customer care. I am your AI banking assistant. How may I help you today?"
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Common pipeline for processing caller inquiries with security guards and Gemini function tools
 */
async function processUserCallMessage(call: any, userMessage: string, effectiveGeminiKey: string, history?: any[]) {
  const ctx = { callId: call.id, providerCallId: call.provider_call_id };

  // Record caller speech in audit/events
  await pool.query(
    `INSERT INTO call_events (call_id, event_type, outcome, detail)
     VALUES ($1, 'CALLER_SPEECH', 'SUCCESS', $2)`,
    [call.id, JSON.stringify({ message: userMessage.slice(0, 500) })]
  );

  const lower = userMessage.toLowerCase();

  // MANDATORY SAFETY POLICY: Immediately intercept PIN, CVV, OTP, or password requests
  if (/\b(pin|cvv|otp|password|passcode|secret code|transfer money|send money|unblock my card)\b/i.test(lower)) {
    await pool.query(
      `INSERT INTO call_events (call_id, event_type, outcome, detail)
       VALUES ($1, 'SAFETY_BOUNDARY_TRIGGERED', 'SUCCESS', $2)`,
      [call.id, JSON.stringify({ reason: 'Caller queried sensitive security credential or monetary transfer' })]
    );

    return {
      reply: "For your safety, XYZ Bank policies strictly prohibit disclosing or processing PINs, CVVs, passwords, or OTPs over telephone calls. The AI assistant cannot move funds or change security credentials. Please use our secure mobile banking app or visit your home branch.",
      tool: 'security_boundary',
      toolResult: { policy: 'SENSITIVE_CREDENTIAL_GUARD' },
      transferred: false,
      callStatus: call.status,
      engine: effectiveGeminiKey ? 'Gemini 1.5 Flash (Safety Policy Enforced)' : 'local-safety-boundary'
    };
  }

  // Try Google Gemini (Free API Key) if available
  let geminiErrorNote: string | undefined;
  if (effectiveGeminiKey) {
    try {
      const geminiRes = await askGeminiVoiceAssistant(
        userMessage,
        {
          callId: call.id,
          providerCallId: call.provider_call_id,
          history: Array.isArray(history) ? history : undefined
        },
        effectiveGeminiKey
      );

      if (geminiRes.transferred) {
        await pool.query(
          `UPDATE calls SET status = 'TRANSFERRED', escalation_reason = 'Caller requested human handoff via Gemini' WHERE id = $1`,
          [call.id]
        );
        await pool.query(
          `INSERT INTO call_events (call_id, event_type, outcome, detail)
           VALUES ($1, 'HUMAN_TRANSFER_REQUESTED', 'SUCCESS', $2)`,
          [call.id, JSON.stringify({ trigger: 'Gemini tool: request_human_transfer' })]
        );
      }

      return {
        reply: geminiRes.reply,
        tool: geminiRes.tool,
        toolResult: geminiRes.toolResult,
        transferred: geminiRes.transferred,
        callStatus: geminiRes.transferred ? 'TRANSFERRED' : call.status,
        engine: `Google Gemini (${geminiRes.model})`
      };
    } catch (err: any) {
      console.warn('Gemini Assistant error, using local fallback:', err?.message || err);
      geminiErrorNote = err?.message || 'Gemini request failed';
    }
  }

  // LOCAL ENGINE FALLBACK
  // SCENARIO 1: Caller requests human transfer / supervisor
  if (/\b(human|agent|operator|person|representative|supervisor|speak to someone)\b/i.test(lower)) {
    await pool.query(
      `UPDATE calls SET status = 'TRANSFERRED', escalation_reason = 'Caller requested human handoff' WHERE id = $1`,
      [call.id]
    );
    await pool.query(
      `INSERT INTO call_events (call_id, event_type, outcome, detail)
       VALUES ($1, 'HUMAN_TRANSFER_REQUESTED', 'SUCCESS', $2)`,
      [call.id, JSON.stringify({ trigger: 'Caller requested human escalation' })]
    );

    return {
      reply: "I understand you would like to speak with a human support specialist. I am initiating a transfer to our senior banking desk now. Please stay on the line.",
      tool: 'human_transfer',
      toolResult: null,
      transferred: true,
      callStatus: 'TRANSFERRED',
      engine: geminiErrorNote ? 'Local Fallback Engine' : 'Local Banking Engine',
      geminiError: geminiErrorNote
    };
  }

  // SCENARIO 2: PIN / CVV / OTP Guard
  if (/\b(pin|cvv|otp|password|passcode|secret code|mpin)\b/i.test(lower)) {
    return {
      reply: "For your security, XYZ Bank policies strictly prohibit disclosing, requesting, or processing PINs, CVVs, passwords, or OTPs over telephone calls.",
      tool: 'security_boundary',
      toolResult: { policy: 'SENSITIVE_CREDENTIAL_GUARD' },
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 3: Freeze / Lock Debit Card
  if (/\b(block|freeze|lost|stolen|misplaced|hotlist)\b/i.test(lower) && /\b(card|debit|credit|atm)\b/i.test(lower)) {
    const toolResult = await executeBankTool('freeze_debit_card', { cardEnding: '7712', reason: 'Caller voice instruction' }, ctx);
    return {
      reply: "I have immediately placed a security freeze on your Titanium Debit Card ending in 7712. A confirmation notification has been dispatched to your mobile.",
      tool: 'freeze_debit_card',
      toolResult,
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 4: Account Balance Inquiry
  if (/\b(balance|how much money|funds available|check balance|account balance|savings balance)\b/i.test(lower)) {
    const toolResult = await executeBankTool('check_account_balance', {}, ctx);
    return {
      reply: "Your primary Savings Account ending in 4892 has an available balance of ₹1,48,250.00 as of today.",
      tool: 'check_account_balance',
      toolResult,
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 5: Branch IFSC & SWIFT Code
  if (/\b(ifsc|swift|branch code|micr)\b/i.test(lower)) {
    return {
      reply: "The IFSC code for XYZ Bank Mumbai Main Branch is XYZB0001001. For international wires, our SWIFT code is XYZBINBB.",
      tool: 'search_bank_faq',
      toolResult: { ifsc: 'XYZB0001001', swift: 'XYZBINBB' },
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 6: Branch Timings & Working Hours
  if (/\b(timing|hours|open|close|saturday|sunday|holiday)\b/i.test(lower)) {
    return {
      reply: "Our branches are open Monday through Saturday from 9:30 AM to 4:30 PM. All branches are closed on 2nd and 4th Saturdays, Sundays, and public bank holidays.",
      tool: 'search_bank_faq',
      toolResult: { timings: 'Mon-Sat 9:30 AM - 4:30 PM' },
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 7: Daily ATM & POS Limits
  if (/\b(limit|withdrawal|daily limit|atm limit|max cash)\b/i.test(lower)) {
    return {
      reply: "Your Titanium Debit Card features a default daily ATM cash withdrawal limit of ₹1,00,000 and a POS or online purchase limit of ₹3,00,000.",
      tool: 'search_bank_faq',
      toolResult: { atmLimit: 100000, posLimit: 300000 },
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 8: Cheque Book Order
  if (/\b(cheque|check book|cheque book|leaves)\b/i.test(lower)) {
    const toolResult = await executeBankTool('order_cheque_book', { leaves: 25 }, ctx);
    return {
      reply: "I have successfully submitted an order for a new 25-leaf personalized cheque book for your Savings Account ending in 4892. It will be dispatched in 3 to 5 business days.",
      tool: 'order_cheque_book',
      toolResult,
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 9: UPI Failed Payment / Reversal
  if (/\b(upi|failed payment|deducted|refund|money cut)\b/i.test(lower)) {
    return {
      reply: "For failed UPI transactions where money was deducted from your account, the amount is automatically refunded within 24 to 48 hours as mandated by RBI.",
      tool: 'search_bank_faq',
      toolResult: { reversalWindow: '24-48 hours' },
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 10: Savings & Fixed Deposit Rates
  if (/\b(interest|rate|fixed deposit|fd)\b/i.test(lower)) {
    return {
      reply: "XYZ Bank Savings Accounts earn up to 4.0% annual interest. Fixed Deposits offer 7.10% annually, with an extra 0.50% rate for Senior Citizens.",
      tool: 'search_bank_faq',
      toolResult: { savingsRate: '4.0%', fdRate: '7.1%' },
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 11: Greetings
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|namaste)\b/i.test(lower)) {
    return {
      reply: "Hello Aarav! Welcome to XYZ Bank customer care. I am your AI banking assistant Sofia. How can I help you today?",
      tool: null,
      toolResult: null,
      transferred: false,
      callStatus: call.status,
      engine: 'Sofia AI Engine'
    };
  }

  // SCENARIO 12: Complaint / Support Ticket creation
  if (/\b(ticket|complaint|dispute|grievance|raise a request|file a report|issue report|unauthorized transaction|fraud)\b/i.test(lower)) {
    let category = 'general';
    if (lower.includes('upi') || lower.includes('payment') || lower.includes('transaction')) category = 'payments';
    else if (lower.includes('card') || lower.includes('atm')) category = 'cards';

    const subject = userMessage.length > 50 ? userMessage.slice(0, 47) + '...' : userMessage;
    const toolResult = await executeBankTool('create_support_ticket', {
      category,
      subject: `Voice Support: ${subject}`,
      description: `Logged via simulated voice call: ${userMessage}`
    }, ctx);

    return {
      reply: `I have registered official support ticket ${toolResult.referenceCode} for you under category '${category}'. Our customer care team has received your request and will follow up. Is there anything else I can assist you with?`,
      tool: 'create_support_ticket',
      toolResult,
      transferred: false,
      callStatus: call.status,
      engine: geminiErrorNote ? 'Local Fallback Engine' : 'Local Banking Engine',
      geminiError: geminiErrorNote
    };
  }

  // SCENARIO 13: Approved Knowledge Base FAQ lookup
  let faqResult = await executeBankTool('search_bank_faq', { query: userMessage }, ctx);
  if (!faqResult.found) {
    const stopWords = new Set(['what','should','do','if','my','the','is','are','was','where','how','can','could','would','please','tell','about','with','for','i','to','and','of','a','an','in','on','at','yesterday','today','tomorrow']);
    const words = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    for (const word of words) {
      const testRes = await executeBankTool('search_bank_faq', { query: word }, ctx);
      if (testRes.found && Array.isArray(testRes.articles) && testRes.articles.length > 0) {
        faqResult = testRes;
        break;
      }
    }
  }

  if (faqResult.found && Array.isArray(faqResult.articles) && faqResult.articles.length > 0) {
    const top = faqResult.articles[0];
    return {
      reply: `According to XYZ Bank policy for ${top.title}: ${top.content} Can I help you with anything else today?`,
      tool: 'search_bank_faq',
      toolResult: faqResult,
      transferred: false,
      callStatus: call.status,
      engine: geminiErrorNote ? 'Local Fallback Engine' : 'Local Banking Engine',
      geminiError: geminiErrorNote
    };
  }

  // SCENARIO 14: Default conversational banking response with safety boundaries
  return {
    reply: "I can help you check your account balance, lock a lost card, check IFSC codes, find branch timings, or connect you to an agent. How can I assist you?",
    tool: null,
    toolResult: null,
    transferred: false,
    callStatus: call.status,
    engine: 'Sofia AI Engine'
  };
}

// 2. Send caller text message
simulationRouter.post('/call/:id/message', async (req, res, next) => {
  try {
    const callId = String(req.params.id);
    const userMessage = String(req.body.message || '').trim();

    if (!userMessage) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const found = await pool.query(
      `SELECT id, provider_call_id, status FROM calls WHERE id = $1`,
      [callId]
    );

    if (!found.rowCount) {
      return res.status(404).json({ error: 'Call session not found' });
    }

    const clientGeminiKey = (req.body.geminiApiKey || req.headers['x-gemini-api-key'] || '').toString().trim();
    const effectiveGeminiKey = clientGeminiKey || (env.GEMINI_API_KEY || '').trim();

    const result = await processUserCallMessage(found.rows[0], userMessage, effectiveGeminiKey, req.body.history);
    return res.json(result);
  } catch (e) {
    next(e);
  }
});

// 3. Send caller audio recording (transcribed via Gemini Multimodal)
simulationRouter.post('/call/:id/audio', async (req, res, next) => {
  try {
    const callId = String(req.params.id);
    const audioBase64 = String(req.body.audioBase64 || '').trim();
    const mimeType = String(req.body.mimeType || 'audio/webm').trim();

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio recording data is required' });
    }

    const found = await pool.query(
      `SELECT id, provider_call_id, status FROM calls WHERE id = $1`,
      [callId]
    );

    if (!found.rowCount) {
      return res.status(404).json({ error: 'Call session not found' });
    }

    const clientGeminiKey = (req.body.geminiApiKey || req.headers['x-gemini-api-key'] || '').toString().trim();
    const effectiveGeminiKey = clientGeminiKey || (env.GEMINI_API_KEY || '').trim();

    if (!effectiveGeminiKey) {
      return res.status(400).json({ error: 'Gemini API key is required to transcribe voice audio recordings' });
    }

    let text = '';
    let usedModel = 'gemini-3.5-flash-lite';
    try {
      const res = await transcribeAudioWithGemini(audioBase64, mimeType, effectiveGeminiKey);
      text = res.text;
      usedModel = res.model;
    } catch (transcribeErr: any) {
      console.warn('Audio transcribe failed with Gemini, using conversational fallback:', transcribeErr?.message || transcribeErr);
    }

    if (!text) {
      const isManual = Boolean(req.body.manual);
      if (!isManual) {
        return res.json({
          transcribedText: '',
          reply: '',
          ignored: true,
          tool: null,
          toolResult: null,
          transferred: false,
          callStatus: found.rows[0].status,
          engine: `Google Gemini (${usedModel})`
        });
      }

      return res.json({
        transcribedText: '',
        reply: "I didn't catch that clearly. Could you please speak into your microphone or type your banking question below?",
        tool: null,
        toolResult: null,
        transferred: false,
        callStatus: found.rows[0].status,
        engine: `Google Gemini (${usedModel})`
      });
    }

    const result = await processUserCallMessage(found.rows[0], text, effectiveGeminiKey, req.body.history);
    return res.json({
      transcribedText: text,
      ...result
    });
  } catch (e) {
    next(e);
  }
});

// 3. End simulated call
simulationRouter.post('/call/:id/end', async (req, res, next) => {
  try {
    const callId = String(req.params.id);
    const result = await pool.query(
      `UPDATE calls
       SET status = CASE WHEN status = 'TRANSFERRED' THEN status ELSE 'COMPLETED'::call_status END,
           ended_at = NOW(),
           duration_seconds = GREATEST(1, EXTRACT(EPOCH FROM (NOW() - started_at))::int),
           resolution = COALESCE(resolution, 'AI_ASSISTED_SIMULATION')
       WHERE id = $1
       RETURNING id, status, duration_seconds, resolution, from_number_masked`,
      [callId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = result.rows[0];

    await pool.query(
      `INSERT INTO call_events (call_id, event_type, outcome, detail)
       VALUES ($1, 'SIMULATION_CALL_ENDED', 'SUCCESS', $2)`,
      [call.id, JSON.stringify({ durationSeconds: call.duration_seconds, status: call.status })]
    );

    return res.json({
      ok: true,
      callId: call.id,
      status: call.status,
      durationSeconds: call.duration_seconds,
      resolution: call.resolution
    });
  } catch (e) {
    next(e);
  }
});
