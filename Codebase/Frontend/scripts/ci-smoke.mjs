import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const BACKEND_URL = process.env.CI_BACKEND_URL || 'http://127.0.0.1:3001';
const FRONTEND_PATHS = ['/', '/app', '/studio'];

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

async function runUiSmoke() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const p of FRONTEND_PATHS) {
    const url = `${BACKEND_URL}${p}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || !response.ok()) {
      throw new Error(`Page failed to load: ${url} (${response?.status() ?? 'no-response'})`);
    }
    const bodyHtml = await page.locator('body').innerHTML();
    if (!bodyHtml || bodyHtml.trim().length === 0) {
      throw new Error(`Empty body rendered at ${url}`);
    }
  }

  await browser.close();
}

async function main() {
  const backend = startBackend();
  try {
    await waitForHttp(`${BACKEND_URL}/health`, 90000);
    await runUiSmoke();
    console.log('CI smoke checks passed (backend + frontend routes).');
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

