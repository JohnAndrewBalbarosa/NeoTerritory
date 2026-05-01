import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });

import crypto from 'crypto';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

// JWT secret bootstrap. Without a valid secret jsonwebtoken.sign() throws
// "secretOrPrivateKey must have a value" on first login, which is a confusing
// failure for a fresh-clone developer. If the env var is missing or empty we
// generate a one-shot 64-byte hex secret for this process and warn loudly so
// the dev knows sessions will be invalidated on restart. Production must set
// JWT_SECRET in .env.
if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
  // eslint-disable-next-line no-console
  console.warn(
    '[auth] JWT_SECRET not set — using a one-shot random secret. All sessions ' +
    'will be invalidated on restart. Set JWT_SECRET in your .env to persist.'
  );
}

import { errorHandler } from './src/middleware/errorHandler';
import { initDb } from './src/db/initDb';

import healthRoutes from './src/routes/health';
import authRoutes from './src/routes/auth';
import transformRoutes from './src/routes/transform';
import analysisRoutes from './src/routes/analysis';
import adminRoutes from './src/routes/admin';
import reviewRoutes from './src/routes/reviews';
import surveyRoutes from './src/routes/survey';
import { startWatching as startReviewSchemaWatch } from './src/reviews/questionLoader';
import { uploadsDir } from './src/config/paths';

const app = express();
const frontendDir = path.join(__dirname, '..', 'Frontend');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));

// Static frontend
app.use(express.static(frontendDir));

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please slow down and retry shortly.' }
});

// Routes
app.use('/health', healthRoutes);
app.use('/auth/login', authLimiter);
app.use('/auth/claim', authLimiter);
app.use('/auth', authRoutes);
app.use('/api/transform', transformRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api', analysisRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/api', (_req: Request, res: Response) => {
  res.json({
    service: 'NeoTerritory analysis backend',
    status: 'ok',
    frontend: '/',
    endpoints: [
      '/api/health',
      '/api/analyze',
      '/api/runs',
      '/api/runs/:id',
      '/api/runs/:id/export'
    ]
  });
});

app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Error handler
app.use(errorHandler);

// DB init
initDb();

// Load review questionnaire and watch for edits
startReviewSchemaWatch();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
