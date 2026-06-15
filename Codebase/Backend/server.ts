import path from 'path';
import dotenv from 'dotenv';
// In ts-node dev mode __dirname is Backend/, in compiled prod mode it's
// Backend/dist/. Try both so the .env at Backend/.env is found in either case.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

// Global safety net. An optional background actor — notably the pod-manager's
// docker-in-docker image build, which fails when the in-container docker
// client is older than the host daemon's minimum API — must NEVER take down
// the HTTP server. Node terminates the process on an unhandled rejection by
// default; here we log and keep serving so /studio, auth, and analysis stay
// up even when a non-essential subsystem (compile/run pods) cannot start.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err instanceof Error ? err.stack : err);
});

// Probe for a C++ compiler and seed ENABLE_TEST_RUNNER + TEST_RUNNER_SANDBOX
// when running outside production. Honours explicit env overrides; in prod
// the runner stays off unless both vars are set deliberately.
import { autoConfigureTestRunner } from './src/services/testRunnerService';
autoConfigureTestRunner();

import { errorHandler } from './src/middleware/errorHandler';
import { initDb } from './src/db/initDb';

import healthRoutes from './src/routes/health';
import authRoutes from './src/routes/auth';
import googleAuthRoutes from './src/routes/googleAuth';
import transformRoutes from './src/routes/transform';
import analysisRoutes from './src/routes/analysis';
import adminRoutes from './src/routes/admin';
import reviewRoutes from './src/routes/reviews';
import surveyRoutes from './src/routes/survey';
import scraperRoutes from './src/routes/scraper';
import learningRoutes from './src/routes/learning';
import projectLearningRoutes from './src/routes/projectLearningOrchestration';
import { startWatching as startReviewSchemaWatch } from './src/reviews/questionLoader';
import { uploadsDir } from './src/config/paths';
import { httpsAdapter } from './src/middleware/httpsHandler';

const app = express();
// API-only backend (B2.3 / D89). The frontend is served by the Next.js app on Vercel
// (neoterritory.vercel.app), which reaches this backend through Vercel rewrites
// (/api, /auth, /health). This Express app no longer serves any frontend HTML or assets;
// the C++ analysis binary and Docker test pods continue to run here unchanged.

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(httpsAdapter);
// While the public deployment is HTTP-only, drop the two directives that
// assume HTTPS — `upgrade-insecure-requests` forces the browser to retry
// every asset over https://… (which fails with CONNECTION_RESET, leaving
// the SPA blank), and HSTS pins the host to HTTPS for 6 months. Once SSL
// is provisioned (SSL_KEY_PATH/SSL_CERT_PATH), turn both back on.
const httpsReady = Boolean(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: httpsReady ? {} : { 'upgrade-insecure-requests': null },
  },
  strictTransportSecurity: httpsReady,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));

// No static frontend — API-only. The Next.js app on Vercel serves the UI.

// Rate limiters
// Bumped from 10 to 100 per 15-min window so a single-host empirical
// study (50-tester soak + variable-token regression sweep on the same
// IP) doesn't trip the limiter mid-run. The limiter still defends
// against credential stuffing — 100 claims / 15 min is well below an
// attacker's request rate but well above any plausible legitimate
// burst from a study harness.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

// Defense-in-depth: even if an admin token is compromised, the explicit
// "Refresh" path on the dashboard is hard-capped well below what a manual
// operator would ever need. The frontend tags each refresh batch with
// X-Admin-Refresh: 1; without the header this limiter is a no-op so normal
// admin traffic stays on `adminLimiter`. Keyed by user id when present
// (falls back to IP) so a single compromised admin can't burn the budget
// for legitimate co-admins on the same egress IP.
const adminRefreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.header('x-admin-refresh') !== '1',
  keyGenerator: (req) => {
    const uid = (req as Request & { user?: { id?: number } }).user?.id;
    return uid != null ? `u:${uid}` : `ip:${req.ip}`;
  },
  message: { error: 'Refresh rate exceeded. Please wait a minute before refreshing again.' }
});

// Routes
app.use('/health', healthRoutes);
app.use('/auth/login', authLimiter);
app.use('/auth/claim', authLimiter);
app.use('/auth', authRoutes);
app.use('/auth', googleAuthRoutes);
app.use('/api/transform', transformRoutes);
// Note ordering: adminRefreshLimiter is skipped unless X-Admin-Refresh: 1 is
// set, so it never affects normal admin traffic. adminLimiter still applies
// the broad per-IP ceiling on top.
app.use('/api/admin', adminRefreshLimiter, adminLimiter, adminRoutes);
// Deferred per D35 — only mounted when explicitly enabled. Admin-only.
if (process.env.NEOTERRITORY_ENABLE_SCRAPER === '1') {
  app.use('/api/admin/scraper', adminLimiter, scraperRoutes);
  console.warn('[scraper] route enabled. Manual-login Playwright scraping is admin-only and respects target ToS at the operator\'s risk.');
}
app.use('/api/reviews', reviewRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/project-learning', projectLearningRoutes);
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

// Root + the former SPA entry points now live on Vercel (Next.js). The bare backend
// origin is API-only: respond with a small JSON pointer instead of HTML so health
// checks hitting `/` still get a 200, and so old `/admin` bookmarks land on JSON rather
// than a 404. The real admin UI is https://neoterritory.vercel.app/admin.
const apiOnlyInfo = (_req: Request, res: Response): void => {
  res.json({
    service: 'NeoTerritory analysis backend',
    status: 'ok',
    frontend: 'https://neoterritory.vercel.app',
    api: '/api',
  });
};
app.get('/', apiOnlyInfo);

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

// No SPA catch-all — API-only. Unknown non-API paths fall through to the 404 handler.

// Error handler
app.use(errorHandler);

// DB init
initDb();

// Load review questionnaire and watch for edits
startReviewSchemaWatch();

// Per-user Docker pod lifecycle. registerShutdownHooks subscribes
// SIGINT/SIGTERM/beforeExit so live containers are torn down before the
// process exits ("deallocate before dying"). lazyStartPodServices triggers
// the sweep timer, docker watcher, and image builder asynchronously.
// In DEV_TEST_MODE we defer this entirely until the first pod is actually
// requested (ensurePod), making the boot path significantly faster.
import { registerShutdownHooks, isPodModeEnabled, lazyStartPodServices } from './src/services/podManager';
if (isPodModeEnabled()) {
  registerShutdownHooks();
}
if (isPodModeEnabled() && process.env.DEV_TEST_MODE !== 'true') {
  lazyStartPodServices();
}

const PORT = Number(process.env.PORT || 3001);
const SSL_PORT = Number(process.env.SSL_PORT || 443);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Start HTTP server
const httpServer = app.listen(PORT, HOST, () => {
  if (HOST === '0.0.0.0') {
    console.log(`HTTP Server running on http://localhost:${PORT}`);
  } else {
    console.log(`HTTP Server running on http://${HOST}:${PORT}`);
  }
});

// Optional HTTPS server if certificates are provided
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  try {
    const https = require('https');
    const sslOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    https.createServer(sslOptions, app).listen(SSL_PORT, HOST, () => {
      console.log(`HTTPS Server running on https://localhost:${SSL_PORT}`);
    });
  } catch (err) {
    console.error('[SSL] Failed to start HTTPS server:', (err as Error).message);
  }
}
