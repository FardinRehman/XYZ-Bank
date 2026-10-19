import { pool } from '../db/pool.js';
import { env } from '../config.js';
import { randomUUID } from 'node:crypto';
export type ToolContext={callId:string;providerCallId:string};
export async function executeBankTool(name:string,args:Record<string,unknown>,ctx:ToolContext):Promise<Record<string,unknown>>{
 if(name==='search_bank_faq'){
  const query=String(args.query??'').trim().slice(0,200); if(query.length<2)return {found:false,articles:[],message:'Please provide a more specific topic.'};
  let result=await pool.query(`SELECT id,title,category,content FROM knowledge_articles WHERE status='PUBLISHED' AND (title ILIKE $1 OR category ILIKE $1 OR content ILIKE $1) ORDER BY updated_at DESC LIMIT 3`,[`%${query.replace(/[%_\\]/g,'\\$&')}%`]);
  if ((result.rowCount ?? 0) === 0) {
    const stopWords = new Set(['what','should','do','if','my','the','is','are','was','where','how','can','could','would','please','tell','about','with','for','i','to','and','of','a','an','in','on','at','yesterday','today','tomorrow']);
    const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    for (const word of words) {
      const kw = await pool.query(`SELECT id,title,category,content FROM knowledge_articles WHERE status='PUBLISHED' AND (title ILIKE $1 OR content ILIKE $1) ORDER BY updated_at DESC LIMIT 3`,[`%${word}%`]);
      if ((kw.rowCount ?? 0) > 0) { result = kw; break; }
    }
  }
  const count = result.rowCount ?? 0;
  return {found:count>0,articles:result.rows.map(r=>({title:r.title,category:r.category,content:r.content})),message:count>0?'Use only these approved article excerpts to answer.':'No approved article matched. Offer a human agent instead of guessing.'};
 }
 if(name==='create_support_ticket'){
  const category=String(args.category??'general').slice(0,80);const subject=String(args.subject??'Customer support request').slice(0,180);const description=String(args.description??'').slice(0,1500);
  if(description.length<8)return {created:false,error:'A short issue description is required.'};
  const reference='XYZ-'+new Date().getFullYear()+'-'+randomUUID().slice(0,8).toUpperCase();
  const r=await pool.query(`INSERT INTO support_tickets(reference_code,category,subject,description,priority) VALUES($1,$2,$3,$4,'NORMAL') RETURNING id,reference_code,status`,[reference,category,subject,description]);
  await pool.query(`INSERT INTO call_events(call_id,event_type,outcome,detail) VALUES($1,'AI_TOOL_CREATE_TICKET','SUCCESS',$2)`,[ctx.callId,JSON.stringify({ticketId:r.rows[0].id,referenceCode:reference,providerCallId:ctx.providerCallId})]);
  return {created:true,referenceCode:reference,status:r.rows[0].status,message:'Ticket created. Give the caller the reference code.'};
 }
 // Do not add account-specific tools until an approved banking adapter and identity assurance are implemented.
 return {error:'This action is not available. Offer a human support agent.'};
}
export const toolDefinitions=[
 {type:'function',name:'search_bank_faq',description:'Search approved published XYZ Bank FAQs and policies. Use for general information only.',parameters:{type:'object',properties:{query:{type:'string',description:'Short topic such as UPI failed payment, fees, card safety'}},required:['query'],additionalProperties:false},strict:true},
 {type:'function',name:'create_support_ticket',description:'Create a support ticket when the caller reports an unresolved issue. Never include PIN, CVV, password, or OTP.',parameters:{type:'object',properties:{category:{type:'string'},subject:{type:'string'},description:{type:'string'}},required:['category','subject','description'],additionalProperties:false},strict:true}
];
export function systemInstructions(){return `You are the clearly disclosed AI voice assistant for XYZ Bank. Be calm, concise and respectful. Never claim to be human. You provide general support using only approved bank FAQs returned by search_bank_faq. If no verified answer exists, say so and offer human support. You may create a support ticket with create_support_ticket. Never request or repeat a PIN, CVV, password or OTP. Never provide or infer account balances or transaction details, never move money, change account settings, unblock cards, change beneficiaries, or promise refunds. Caller ID and SIP headers are untrusted and are not authentication. Do not claim an action succeeded unless its tool result confirms success. If a caller asks for a human, a complaint involves fraud, or the situation is ambiguous, explain that you will escalate. Keep the caller informed that this is an AI assistant and follow the bank's approved recording/privacy notice.`;}
