import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { User } from '../types/api';

type JwtUserPayload = Pick<User, 'id' | 'username' | 'email' | 'role'>;

const jwtAuth = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }
  const token = auth.split(' ')[1] as string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtUserPayload;
    req.user = decoded;
    // Track last active time for online-presence detection in admin panel.
    try {
      db.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").run(decoded.id);
    } catch {
      // Non-fatal: column may not exist yet if migration hasn't run.
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export { jwtAuth };
