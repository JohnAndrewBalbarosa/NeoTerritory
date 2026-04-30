import { Request, Response, NextFunction } from 'express';

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'admin only' });
    return;
  }
  next();
}

export { requireAdmin };
