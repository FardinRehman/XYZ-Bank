import { Router } from 'express';
import { env } from '../config.js';
import { pool } from '../db/pool.js';
import { acceptIncomingCall, rejectIncomingCall, verifyOpenAIWebhook } from '../services/openaiSip.js';
export const telephonyRouter=Router();
// Keep raw body for signature verification; this router is mounted before express.json().
telephonyRouter.post('/openai/webhook', async(req,res)=>{
 let event:any;
 try{event=await verifyOpenAIWebhook(req.body as Buffer,req.headers as Record<string,string|string[]|undefined>);}catch(e){console.warn('Rejected invalid OpenAI webhook:',e instanceof Error?e.message:'verification failed');return res.status(401).json({error:'Invalid webhook signature'});}
 const eventId=String(event.id??'');const type=String(event.type??'');const callId=String(event.data?.call_id??event.data?.session_id??'');
 if(!eventId||!type)return res.status(400).json({error:'Malformed event'});
 const claim=await pool.query(`INSERT INTO processed_webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id`,[eventId,type]);
 if(!claim.rowCount)return res.status(200).json({received:true,deduplicated:true});
 try{
  if(type==='realtime.call.incoming'){
   if(!callId)return res.status(400).json({error:'Missing call/session id'});
   await pool.query(`INSERT INTO calls(provider_call_id,provider,status,from_number_masked,to_number_masked,metadata) VALUES($1,'openai_sip','RINGING',$2,$3,$4) ON CONFLICT(provider_call_id) DO NOTHING`,[callId,maskSipHeader(event.data?.sip_headers,'From'),maskSipHeader(event.data?.sip_headers,'To'),JSON.stringify({eventId,type})]);
   if(!env.OPENAI_API_KEY){await pool.query(`UPDATE calls SET status='FAILED',ended_at=NOW(),resolution='OPENAI_CREDENTIALS_MISSING' WHERE provider_call_id=$1`,[callId]);await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'FAILURE',$3) ON CONFLICT DO NOTHING`,[eventId,type,JSON.stringify({reason:'OpenAI credentials missing'})]);await pool.query(`DELETE FROM processed_webhook_events WHERE event_id=$1`,[eventId]);return res.status(503).json({error:'Voice integration is not configured'});}
   if(env.OPENAI_SIP_ENABLED!=='true'){await rejectIncomingCall(callId,503);await pool.query(`UPDATE calls SET status='REJECTED',ended_at=NOW(),resolution='SIP_NOT_ENABLED' WHERE provider_call_id=$1`,[callId]);await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'FAILURE',$3) ON CONFLICT DO NOTHING`,[eventId,type,JSON.stringify({reason:'SIP disabled'})]);return res.status(200).json({received:true,accepted:false,reason:'SIP integration disabled'});}
   await acceptIncomingCall(callId);await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3) ON CONFLICT DO NOTHING`,[eventId,type,JSON.stringify({callId})]);
  } else if(type.includes('call.ended')||type.includes('session.ended')||type.includes('call.failed')){
   if(callId)await pool.query(`UPDATE calls SET status=CASE WHEN status='TRANSFERRED' THEN status ELSE 'COMPLETED'::call_status END,ended_at=COALESCE(ended_at,NOW()),duration_seconds=GREATEST(0,EXTRACT(EPOCH FROM (NOW()-started_at))::int) WHERE provider_call_id=$1`,[callId]);
   await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3) ON CONFLICT DO NOTHING`,[eventId,type,JSON.stringify({callId})]);
  } else {
   await pool.query(`INSERT INTO call_events(provider_event_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3) ON CONFLICT DO NOTHING`,[eventId,type,JSON.stringify({callId:callId||null,unhandled:true})]);
  }
  return res.status(200).json({received:true});
 }catch(e){console.error('Webhook handling failed',e);await pool.query(`DELETE FROM processed_webhook_events WHERE event_id=$1`,[eventId]).catch(()=>{});return res.status(500).json({error:'Webhook handling failed'});}
});
function maskSipHeader(headers:unknown,key:string){if(!Array.isArray(headers))return null;const found=headers.find((h:any)=>String(h.name).toLowerCase()===key.toLowerCase());const value=String(found?.value??'');const number=value.match(/\+?\d{5,}/)?.[0];return number?`${number.slice(0,2)}***${number.slice(-2)}`:null;}
