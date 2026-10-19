import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config.js';
import type { AuthedRequest, Role } from '../types.js';
export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
 const header = req.header('authorization');
 if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
 try {
  const p = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
  if (!p.sub || !p.email || !p.role || !p.displayName) throw new Error('Invalid token claims');
  req.user = { id: String(p.sub), email: String(p.email), role: p.role as Role, displayName: String(p.displayName) };
  next();
 } catch { return res.status(401).json({ error: 'Invalid or expired session' }); }
}
export function allowRoles(...roles: Role[]) {
 return (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
 };
}
