import OpenAI from 'openai';
import WebSocket from 'ws';
import { env } from '../config.js';
import { pool } from '../db/pool.js';
import { executeBankTool, systemInstructions, toolDefinitions } from './bankTools.js';
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY || 'not-configured', webhookSecret: env.OPENAI_WEBHOOK_SECRET || undefined });
const apiBase='https://api.openai.com/v1';
export async function acceptIncomingCall(callId:string):Promise<void>{
 if(!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
 const response=await fetch(`${apiBase}/realtime/calls/${encodeURIComponent(callId)}/accept`,{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({type:'realtime',model:env.OPENAI_REALTIME_MODEL,instructions:systemInstructions(),audio:{output:{voice:env.OPENAI_REALTIME_VOICE}},tools:toolDefinitions,tool_choice:'auto'})});
 if(!response.ok)throw new Error(`OpenAI accept call failed (${response.status}): ${(await response.text()).slice(0,500)}`);
 await pool.query(`UPDATE calls SET status='IN_PROGRESS',answered_at=NOW() WHERE provider_call_id=$1`,[callId]);
 attachSideband(callId).catch(async e=>{console.error('Sideband session failed',e);await pool.query(`UPDATE calls SET resolution='AI_CONTROL_CHANNEL_FAILED',escalation_reason='AI control channel unavailable' WHERE provider_call_id=$1`,[callId]).catch(()=>{});});
}
export async function rejectIncomingCall(callId:string,statusCode=486){
 if(!env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is not configured');
 const r=await fetch(`${apiBase}/realtime/calls/${encodeURIComponent(callId)}/reject`,{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({status_code:statusCode})});if(!r.ok)throw new Error(`OpenAI reject call failed (${r.status})`);
}
async function attachSideband(callId:string){
 const ws=new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`,{headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'OpenAI-Beta':'realtime=v1'}});
 ws.on('open',()=>{console.info('OpenAI sideband connected for call',callId);ws.send(JSON.stringify({type:'response.create',response:{instructions:'Greet the caller now: Thank you for calling XYZ Bank. I am the bank’s AI support assistant. How may I help you today?'}}));});
 ws.on('message',async raw=>{
  let event:any;try{event=JSON.parse(raw.toString());}catch{return;}
  if(event.type==='response.function_call_arguments.done'){
   const name=String(event.name??'');let args:Record<string,unknown>={};try{args=JSON.parse(event.arguments||'{}');}catch{}
   try{
    const row=await pool.query(`SELECT id FROM calls WHERE provider_call_id=$1`,[callId]);if(!row.rowCount)throw new Error('Call record not found');
    const result=await executeBankTool(name,args,{callId:row.rows[0].id,providerCallId:callId});
    await pool.query(`INSERT INTO call_events(call_id,event_type,outcome,detail) VALUES($1,$2,'SUCCESS',$3)`,[row.rows[0].id,`AI_TOOL_${name}`,JSON.stringify({tool:name,argumentsRedacted:true,resultSummary:JSON.stringify(result).slice(0,500)})]);
    ws.send(JSON.stringify({type:'conversation.item.create',item:{type:'function_call_output',call_id:event.call_id,output:JSON.stringify(result)}}));ws.send(JSON.stringify({type:'response.create'}));
   }catch(e){console.error('AI tool execution failed',e);ws.send(JSON.stringify({type:'conversation.item.create',item:{type:'function_call_output',call_id:event.call_id,output:JSON.stringify({error:'Tool unavailable. Offer a human agent.'})}}));ws.send(JSON.stringify({type:'response.create'}));}
  }
  if(event.type==='error')console.error('Realtime event error',JSON.stringify(event).slice(0,500));
  if(event.type==='session.ended'||event.type==='call.ended'){
   await pool.query(`UPDATE calls SET status='COMPLETED',ended_at=COALESCE(ended_at,NOW()),duration_seconds=GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(ended_at,NOW())-started_at))::int) WHERE provider_call_id=$1`,[callId]).catch(()=>{});ws.close();
  }
 });
 ws.on('error',e=>console.error('Sideband WebSocket error',e.message));
 ws.on('close',()=>console.info('OpenAI sideband closed for call',callId));
}
export async function verifyOpenAIWebhook(rawBody:Buffer,headers:Record<string,string|string[]|undefined>):Promise<any>{
 const id=headers['webhook-id'];const timestamp=headers['webhook-timestamp'];const signature=headers['webhook-signature'];
 if(typeof id!=='string'||typeof timestamp!=='string'||typeof signature!=='string'||!env.OPENAI_WEBHOOK_SECRET)throw new Error('Missing webhook signature headers or secret');
 // Official OpenAI SDK verifies signature and timestamp against the raw request body.
 const parsed=await client.webhooks.unwrap(rawBody.toString('utf8'),{ 'webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':signature } as any);
 return parsed;
}
