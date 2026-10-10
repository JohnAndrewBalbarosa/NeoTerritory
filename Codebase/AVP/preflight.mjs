import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ROOT, currentState } from './config.mjs';
import { startDemo } from './runtime.mjs';
import { verifyAnalyzer } from './cli.mjs';
import { chromium } from '../Frontend/node_modules/playwright/index.mjs';

export async function preflight() {
  const state = currentState();
  verifyAnalyzer(state);
  const runtime = await startDemo(state);
  let browser;
  const checks = [];
  try {
    const credentials = JSON.parse(fs.readFileSync(path.join(state, 'credentials.json'), 'utf8'));
    async function login(username, password, role) {
      const response = await fetch(`${runtime.origin}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
      assert.equal(response.status, 200, `Real login for ${username}`);
      const auth = await response.json();
      assert.equal(auth.user.role, role);
      checks.push(`${role} normal password login`);
      return auth;
    }
    const manager = await login('AVP Project Manager', credentials.managerPassword, 'admin');
    const intern = await login('AVP Intern', credentials.internPassword, 'user');
    const denied = await fetch(`${runtime.origin}/api/admin/course-plan`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${intern.token}` }, body: JSON.stringify({ prompt: 'Authorization check' }) });
    assert.equal(denied.status, 403, 'Intern must not use Project Manager API');
    const unauthenticated = await fetch(`${runtime.origin}/api/learning/assessments`);
    assert.equal(unauthenticated.status, 401);
    checks.push('normal role and authentication gates');
    const historyResponse = await fetch(`${runtime.origin}/api/learning/assessments`, { headers: { authorization: `Bearer ${intern.token}` } });
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json();
    assert.equal(history.attempts.length, 0, 'Run reset before preflight; intern must have no assessment history');
    assert.equal(history.answers.length, 0);
    checks.push('clean intern assessment history');

    const code = fs.readFileSync(path.join(ROOT, 'Codebase/Microservice/samples/strategy/strategy_basic.cpp'), 'utf8');
    const analysisResponse = await fetch(`${runtime.origin}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${manager.token}` }, body: JSON.stringify({ code, filename: 'strategy_basic.cpp' }) });
    assert.equal(analysisResponse.status, 200);
    const result = await analysisResponse.json();
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.detectedPatterns.some((p) => p.patternId === 'behavioural.strategy_interface' && p.className === 'Compressor'));
    assert.equal(result.detectedPatterns.filter((p) => p.patternId === 'behavioural.strategy_concrete').length, 2);
    assert.ok(result.documentationTargets.length > 0);
    assert.ok(result.annotations.length > 0);
    assert.ok(result.classUsageBindings.Compressor.some((b) => b.kind === 'arrow_call' && b.methodName === 'compress'));
    fs.writeFileSync(path.join(state, 'api-analysis.json'), JSON.stringify(result, null, 2));
    checks.push('real API Strategy detection, documentation annotations and delegation usage binding');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === runtime.origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      return route.abort('blockedbyclient');
    });
    await context.addInitScript((auth) => {
      localStorage.setItem('nt_token', auth.token);
      localStorage.setItem('nt_user', JSON.stringify(auth.user));
    }, manager);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${runtime.origin}/admin`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'CodiNeo Project Manager Dashboard' }).waitFor();
    await page.getByText('No active learner plans yet.', { exact: true }).waitFor();
    assert.deepEqual(pageErrors, [], 'Project Manager must render without uncaught browser errors');
    await page.screenshot({ path: path.join(state, 'admin-preflight.png') });
    checks.push('real 1920×1080 Project Manager UI, no mocked responses, no uncaught browser errors');
    fs.writeFileSync(path.join(state, 'preflight-report.json'), JSON.stringify({ passed: true, checks, limitations: ['Word control downloads HTML .doc, not native DOCX'], observedAt: new Date().toISOString() }, null, 2));
    console.log(`Preflight passed (${checks.length} checks). Run avp:capture for the complete learning and export flow.`);
  } finally {
    await browser?.close();
    await runtime.stop();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preflight().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
