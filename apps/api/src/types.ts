import type { Request } from 'express';
export type Role = 'SUPER_ADMIN' | 'SUPERVISOR' | 'SUPPORT_AGENT' | 'AUDITOR';
export interface AuthUser { id: string; email: string; displayName: string; role: Role; }
export interface AuthedRequest extends Request { user?: AuthUser; }

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
