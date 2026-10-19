import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { env } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthedRequest } from '../types.js';
import { audit } from '../services/audit.js';
export const authRouter = Router();
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
authRouter.post('/login', async (req, res, next) => {
 try {
  const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({error:'Enter a valid email and password'});
  const email = parsed.data.email.toLowerCase();
  const result = await pool.query(`SELECT id,email,display_name,password_hash,role,active,locked_until FROM staff_users WHERE email=$1`, [email]);
  const user = result.rows[0];
  if (!user || !user.active || (user.locked_until && new Date(user.locked_until) > new Date()) || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
   if (user) await pool.query(`UPDATE staff_users SET failed_login_count=failed_login_count+1, locked_until=CASE WHEN failed_login_count+1 >= 8 THEN NOW()+INTERVAL '15 minutes' ELSE locked_until END WHERE id=$1`, [user.id]);
   await audit(req, 'LOGIN_FAILED', 'staff_user', user?.id ?? null, 'DENIED', {email});
   return res.status(401).json({error:'Invalid credentials or account unavailable'});
  }
  await pool.query(`UPDATE staff_users SET failed_login_count=0,locked_until=NULL,last_login_at=NOW() WHERE id=$1`, [user.id]);
  const token = jwt.sign({email:user.email,displayName:user.display_name,role:user.role}, env.JWT_SECRET, {subject:user.id,expiresIn:env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']});
  await audit(req, 'LOGIN_SUCCESS', 'staff_user', user.id);
  return res.json({token,user:{id:user.id,email:user.email,displayName:user.display_name,role:user.role}});
 } catch(e) { next(e); }
});
authRouter.get('/me', authenticate, (req: AuthedRequest,res) => res.json({user:req.user}));
authRouter.post('/logout', authenticate, async (req,res,next) => { try { await audit(req,'LOGOUT','staff_user',req.user!.id); res.json({ok:true}); } catch(e){next(e);} });
