import { NextFunction, Request, Response } from 'express';
import { AuthService, AuthUser } from '../services/authService';

declare global {
  namespace Express {
    interface Request { authUser?: AuthUser; }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) return res.status(401).json({ success: false, error: 'Authentication is required.' });
  try {
    req.authUser = AuthService.verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Your session is invalid or has expired. Please sign in again.' });
  }
}
