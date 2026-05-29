import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Backend API smoke (B2.3 / D89). The backend is now API-only — the frontend is the
// Next.js app on Vercel, tested separately by the routes-manifest / playwright-e2e
// workflows against `next start`. So this smoke verifies the backend contract only:
// /health is reachable and /api + / return the service descriptor JSON. No browser /
// served-HTML checks (the backend no longer serves frontend routes).
const BACKEND_URL = process.env.CI_BACKEND_URL || 'http://127.0.0.1:3001';

function startBackend() {
  return spawn('node', ['../Backend/dist/server.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      PORT: process.env.PORT || '3001',
      HOST: process.env.HOST || '127.0.0.1',
    },
  });
}

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastError = err;
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function checkJson(url, predicate, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  const body = await res.json();
  if (!predicate(body)) throw new Error(`${label}: unexpected response from ${url}`);
}

async function main() {
  const backend = startBackend();
  try {
    await waitForHttp(`${BACKEND_URL}/health`, 90000);
    // API-only contract: /api descriptor + / returns JSON status (not HTML).
    await checkJson(`${BACKEND_URL}/api`, (b) => b && b.status === 'ok', '/api descriptor');
    await checkJson(`${BACKEND_URL}/`, (b) => b && b.status === 'ok', 'API-only root');
    console.log('CI smoke checks passed (backend API-only contract).');
  } finally {
    if (!backend.killed) {
      backend.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
