import type { Request } from 'express';
import { pool } from '../db/pool.js';
export async function audit(req: Request, action: string, resourceType: string, resourceId: string | null, outcome='SUCCESS', details: Record<string, unknown>={}) {
 const user = (req as Request & {user?: {id:string}}).user;
 await pool.query(`INSERT INTO audit_logs (actor_user_id, actor_type, action, resource_type, resource_id, outcome, ip_address, details)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [user?.id ?? null, user ? 'STAFF' : 'SYSTEM', action, resourceType, resourceId, outcome, req.ip || null, JSON.stringify(details)]);
}
