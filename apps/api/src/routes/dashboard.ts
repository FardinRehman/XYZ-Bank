import { Router } from 'express';
import { pool } from '../db/pool.js';
import { env } from '../config.js';
import { audit } from '../services/audit.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/summary', async (_req,res,next) => { try {
 const [calls,tickets,articles,events] = await Promise.all([
  pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('RINGING','IN_PROGRESS'))::int AS active, COUNT(*) FILTER (WHERE started_at >= NOW()-INTERVAL '24 hours')::int AS last24h, COUNT(*) FILTER (WHERE status='TRANSFERRED')::int AS transferred FROM calls`),
  pool.query(`SELECT COUNT(*)::int AS open FROM support_tickets WHERE status IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER')`),
  pool.query(`SELECT COUNT(*)::int AS published FROM knowledge_articles WHERE status='PUBLISHED'`),
  pool.query(`SELECT COUNT(*)::int AS failures FROM call_events WHERE outcome='FAILURE' AND created_at >= NOW()-INTERVAL '24 hours'`)
 ]);
 res.json({calls:calls.rows[0],tickets:tickets.rows[0],knowledge:articles.rows[0],failures:events.rows[0],dataMode:'synthetic-until-bank-integration'});
 } catch(e){next(e);} });
dashboardRouter.get('/calls', async (req,res,next) => { try {
  const limit = Math.min(Math.max(Number(req.query.limit)||50,1),100);
  const r = await pool.query(`SELECT id,provider_call_id,provider,status,from_number_masked,to_number_masked,language,started_at,answered_at,ended_at,duration_seconds,resolution,escalation_reason FROM calls ORDER BY started_at DESC LIMIT $1`,[limit]); res.json({calls:r.rows});
 } catch(e){next(e);} });
dashboardRouter.get('/tickets', async (req,res,next) => { try {
  const status = typeof req.query.status==='string' ? req.query.status : null;
  const valid = ['OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'];
  if(status && !valid.includes(status)) return res.status(400).json({error:'Invalid ticket status'});
  const r = await pool.query(`SELECT t.id,t.reference_code,t.customer_reference,t.category,t.subject,t.description,t.status,t.priority,t.created_at,t.updated_at,u.display_name AS assigned_to FROM support_tickets t LEFT JOIN staff_users u ON u.id=t.assigned_to WHERE ($1::ticket_status IS NULL OR t.status=$1) ORDER BY t.created_at DESC LIMIT 100`,[status]); res.json({tickets:r.rows});
 } catch(e){next(e);} });
dashboardRouter.get('/audit', allowRoles('SUPER_ADMIN','SUPERVISOR','AUDITOR'), async (_req,res,next) => { try { const r=await pool.query(`SELECT a.id,a.actor_type,a.action,a.resource_type,a.resource_id,a.outcome,a.details,a.created_at,u.email AS actor_email FROM audit_logs a LEFT JOIN staff_users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 100`); res.json({events:r.rows}); } catch(e){next(e);} });

// Human handoff is supervisor/admin controlled. The target is configured server-side,
// not accepted from arbitrary browser input.
dashboardRouter.post('/calls/:id/transfer', allowRoles('SUPER_ADMIN','SUPERVISOR'), async (req,res,next) => {
 try {
  if (!env.OPENAI_API_KEY || !env.HUMAN_TRANSFER_URI || !/^(tel:\+?[0-9]{5,20}|sip:[^\s@]+@[^\s@]+)$/i.test(env.HUMAN_TRANSFER_URI)) {
   return res.status(503).json({error:'Human transfer destination is not configured or is invalid'});
  }
  const found=await pool.query(`SELECT id,provider_call_id,status FROM calls WHERE id=$1`,[req.params.id]);
  if(!found.rowCount)return res.status(404).json({error:'Call not found'});
  const call=found.rows[0];
  if(!call.provider_call_id || !['IN_PROGRESS','RINGING'].includes(call.status))return res.status(409).json({error:'Call is not active or cannot be transferred'});
  const upstream=await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(call.provider_call_id)}/refer`,{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({target_uri:env.HUMAN_TRANSFER_URI})});
  if(!upstream.ok){await audit(req,'CALL_TRANSFER_FAILED','call',call.id,'FAILURE',{providerStatus:upstream.status});return res.status(502).json({error:'Telephony provider could not transfer the call'});}
  await pool.query(`UPDATE calls SET status='TRANSFERRED',escalation_reason='Human handoff requested' WHERE id=$1`,[call.id]);
  await pool.query(`INSERT INTO call_events(call_id,event_type,outcome,detail) VALUES($1,'HUMAN_TRANSFER_REQUESTED','SUCCESS',$2)`,[call.id,JSON.stringify({actor:req.user!.id})]);
  await audit(req,'CALL_TRANSFERRED','call',call.id,'SUCCESS');
  return res.json({ok:true,message:'Transfer requested'});
 }catch(e){next(e);}
});
