import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { logEvent } from '../services/logService';
import type { UserRow } from '../types/db';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
    if (!username || !email || !password) {
      res.status(400).json({ error: 'All fields required' });
      return;
    }
    const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (userExists) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, 'user', datetime('now'))");
    const info = stmt.run(username, email, hash);
    logEvent(Number(info.lastInsertRowid), 'register', `User registered: ${email}`);
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, username, password } = req.body as { email?: string; username?: string; password?: string };
    const identifier = (username || email || '').trim();
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username (or email) and password required' });
      return;
    }
    const user = db
      .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
      .get(identifier, identifier) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const role = user.role || 'user';
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    logEvent(user.id, 'login', `User logged in: ${user.username}`);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role } });
  } catch (err) {
    next(err);
  }
};
