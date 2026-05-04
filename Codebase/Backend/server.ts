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

// Probe for a C++ compiler and seed ENABLE_TEST_RUNNER + TEST_RUNNER_SANDBOX
// when running outside production. Honours explicit env overrides; in prod
// the runner stays off unless both vars are set deliberately.
import { autoConfigureTestRunner } from './src/services/testRunnerService';
autoConfigureTestRunner();

import { errorHandler } from './src/middleware/errorHandler';
import { initDb } from './src/db/initDb';

import healthRoutes from './src/routes/health';
import authRoutes from './src/routes/auth';
import transformRoutes from './src/routes/transform';
import analysisRoutes from './src/routes/analysis';
import adminRoutes from './src/routes/admin';
import reviewRoutes from './src/routes/reviews';
import surveyRoutes from './src/routes/survey';
import scraperRoutes from './src/routes/scraper';
import { startWatching as startReviewSchemaWatch } from './src/reviews/questionLoader';
import { uploadsDir } from './src/config/paths';

const app = express();
const frontendDir = path.join(__dirname, '..', '..', 'Frontend');

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
// Deferred per D35 — only mounted when explicitly enabled. Admin-only.
if (process.env.NEOTERRITORY_ENABLE_SCRAPER === '1') {
  app.use('/api/admin/scraper', adminLimiter, scraperRoutes);
  console.warn('[scraper] route enabled. Manual-login Playwright scraping is admin-only and respects target ToS at the operator\'s risk.');
}
app.use('/api/reviews', reviewRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api', analysisRoutes);

// Sealed namespace — every route under /api/sealed/* is gated by the
// stateless asymmetric envelope verifier (see docs/SECURITY.md §8). The
// only route currently mounted is a ping for acceptance testing; future
// routes that need replay-protected, no-server-state authentication land
// here without retrofitting the bearer-JWT path.
import { verifySealedEnvelope } from './src/middleware/sealedEnvelope';
app.post('/api/sealed/ping', verifySealedEnvelope, (req: Request, res: Response) => {
  const env = (req as Request & { sealedEnvelope?: { dayUtc?: string; nonce?: string } }).sealedEnvelope;
  res.json({ ok: true, echoedDayUtc: env?.dayUtc, echoedNonce: env?.nonce });
});

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

// Per-user Docker pod lifecycle. registerShutdownHooks subscribes
// SIGINT/SIGTERM/beforeExit so live containers are torn down before the
// process exits ("deallocate before dying"). ensurePodImageBuilt builds
// the cpp-pod image on first boot if it isn't already present, so the
// operator never has to remember a manual `docker build`. The sweep
// timer reaps pods past their TTL every 30s. All three are no-ops when
// TEST_RUNNER_USE_DOCKER is not '1' or Docker isn't on PATH.
import { startSweepTimer, registerShutdownHooks, isPodModeEnabled, ensurePodImageBuilt } from './src/services/podManager';
import { startDockerWatcher } from './src/services/dockerWatcher';
registerShutdownHooks();
if (isPodModeEnabled()) {
  // Fire-and-forget: image build can take 30–60s on first run; we don't
  // want to block the HTTP listener. Sweep timer can start immediately —
  // it has nothing to sweep until ensurePod creates the first pod.
  void ensurePodImageBuilt();
  startSweepTimer();
  // Background actor: probes the Docker daemon every few seconds and
  // pushes the result into healthMasterlist. /api/health reads the
  // masterlist instead of shelling out, so a slow Docker Desktop named
  // pipe under WSL2 can never stall a health probe again.
  startDockerWatcher();
}

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
app.listen(PORT, HOST, () => {
  if (HOST === '0.0.0.0') {
    console.log(`Server running on http://localhost:${PORT} (also reachable on LAN at all interfaces)`);
  } else {
    console.log(`Server running on http://${HOST}:${PORT}`);
  }
});
