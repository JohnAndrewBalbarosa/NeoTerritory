import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect, type Page } from '../Frontend/node_modules/@playwright/test';
import { ROOT, currentState } from './config.mjs';
import { LEARNING_MODULES, normalizeLearningModules } from '../Frontend/src/data/learningModules';

// Run only against the owned loopback demo. Never mock API results or learning state.
assert.equal(process.env.AVP_CAPTURE_OWNED, 'true', 'Use npm run avp:capture to launch owned isolated services');
const origin = 'http://127.0.0.1:4310';
const state = currentState();
const output = path.join(state, 'capture');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const credentials = JSON.parse(fs.readFileSync(path.join(state, 'credentials.json'), 'utf8'));
const modules = normalizeLearningModules(LEARNING_MODULES);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const source = fs.readFileSync(path.join(ROOT, 'Codebase/Microservice/samples/strategy/strategy_basic.cpp'), 'utf8');
const resume = process.argv.includes('--resume');
const clips: Array<{ name: string; source: string; start: number; duration: number }> = resume && fs.existsSync(path.join(output, 'clips.json')) ? JSON.parse(fs.readFileSync(path.join(output, 'clips.json'), 'utf8')) : [];
let recordingStart = 0;
let recordingName = '';
async function clip(page: Page, name: string, action: () => Promise<void>, hold = 2500) {
  const start = (Date.now() - recordingStart) / 1000;
  await action();
  await page.waitForTimeout(hold); // Intentional editorial hold, never a readiness assertion.
  clips.push({ name, source: recordingName, start, duration: (Date.now() - recordingStart) / 1000 - start });
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
async function login(username: string, password: string) {
  const response = await fetch(`${origin}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(response.status, 200);
  return response.json();
}
async function answerVisible(page: Page, selector: string, bank: Array<{ moduleId: string; question: any }>, failStrategy: boolean) {
  const items = page.locator(selector);
  for (let i = 0; i < await items.count(); i++) {
    const item = items.nth(i);
    const prompt = clean(await item.locator('.nt-bloom-question__prompt').innerText());
    const entry = bank.find((entry) => clean(entry.question.question || entry.question.prompt || '') === prompt);
    assert.ok(entry, 'Visible assessment question must match the real authored bank');
    const q = entry.question;
    const wrong = failStrategy && entry.moduleId === 'behavioural-strategy';
    const radios = item.locator('input[type=radio]');
    if (await radios.count()) await radios.nth(wrong ? (q.correctIndex + 1) % q.options.length : q.correctIndex).check();
    else await item.locator('input[type=text], textarea').first().fill(wrong ? 'Not yet learned' : q.expectedTokens.join(' '));
  }
}
async function formal(page: Page, form: 'A' | 'B') {
  const bank = modules.flatMap((module) => (module.assessmentForms?.[form] ?? []).map((question) => ({ moduleId: module.id, question })));
  await page.locator('.nt-assessment__items > li').first().waitFor();
  let captured = false;
  for (let n = 0; n < 150; n++) {
    const visible = clean(await page.locator('.nt-assessment__items').innerText());
    const hasStrategy = bank.some((entry) => entry.moduleId === 'behavioural-strategy' && visible.includes(clean(entry.question.question)));
    if (form === 'A' && hasStrategy && !captured) {
      const prompts = await page.locator('.nt-assessment__items > li .nt-bloom-question__prompt').allTextContents();
      const strategyIndex = prompts.findIndex((prompt) => bank.some((entry) => entry.moduleId === 'behavioural-strategy' && clean(entry.question.question) === clean(prompt)));
      assert.ok(strategyIndex >= 0);
      const selected = `.nt-assessment__items > li:nth-child(${strategyIndex + 1})`;
      await page.locator(selected).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await clip(page, '03_intern_pretest', async () => {
        await page.waitForTimeout(1200);
        await answerVisible(page, selected, bank, true);
      });
      await answerVisible(page, '.nt-assessment__items > li', bank, true);
      captured = true;
    } else await answerVisible(page, '.nt-assessment__items > li', bank, form === 'A');
    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (await next.count() && await next.isEnabled()) { await next.click(); continue; }
    await page.getByRole('button', { name: 'Review & Submit', exact: true }).click();
    await page.getByRole('button', { name: form === 'A' ? 'Finish Pre-Test' : 'Save Post-test', exact: true }).click();
    await page.getByText('Your answers have been submitted and saved.', { exact: true }).waitFor();
    return;
  }
  throw new Error('Formal assessment did not finish');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    async function session(name: string, auth: any) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, recordVideo: { dir: output, size: { width: 1920, height: 1080 } }, acceptDownloads: true });
      await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await context.addInitScript((auth) => {
        localStorage.setItem('nt_token', auth.token); localStorage.setItem('nt_user', JSON.stringify(auth.user));
        localStorage.setItem('nt_start_here_dismissed', '1');
        for (const store of [localStorage, sessionStorage]) {
          store.setItem('nt_studio_tour_suppressed', '1');
          store.setItem('nt_studio_tour_completed', '1');
          for (const tab of ['submit', 'annotated', 'gdb', 'ambiguous']) store.setItem(`nt_studio_tour_completed__${tab}`, '1');
        }
      }, auth);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      recordingName = `${name}.webm`; recordingStart = Date.now();
      return { page, close: async () => { const video = page.video(); await context.close(); await video?.saveAs(path.join(output, `${name}.webm`)); } };
    }
    if (!resume) {
    const pm = await session('project-manager', await login('AVP Project Manager', credentials.managerPassword));
    try {
      await pm.page.goto(`${origin}/admin`, { waitUntil: 'networkidle' });
      await pm.page.getByRole('button', { name: 'Manage Course Plan', exact: true }).click();
      await pm.page.getByTestId('courses-table').waitFor();
      await pm.page.getByLabel('Course Prompt', { exact: true }).scrollIntoViewIfNeeded();
      await clip(pm.page, '01_pm_project_spec', async () => {
        await pm.page.getByLabel('Course Prompt', { exact: true }).fill(fs.readFileSync(path.join(ROOT, 'Codebase/AVP/project-specification.txt'), 'utf8'));
      });
      const responseWait = pm.page.waitForResponse((r) => r.url().endsWith('/api/admin/course-plan') && r.request().method() === 'POST');
      await pm.page.getByRole('button', { name: 'Send prompt', exact: true }).click();
      const plan = await (await responseWait).json();
      assert.ok(plan.modules.some((m: any) => m.moduleId === 'behavioural-strategy' && m.published));
      fs.writeFileSync(path.join(output, 'actual-recommendation.json'), JSON.stringify(plan, null, 2));
      const strategyRow = pm.page.getByTestId('course-plan-ai-enabled-row').filter({ hasText: 'Strategy' });
      await strategyRow.waitFor();
      await clip(pm.page, '02_pm_strategy_recommendation', async () => { await strategyRow.scrollIntoViewIfNeeded(); });
      await pm.page.getByRole('button', { name: 'Apply AI course plan', exact: true }).click();
      await pm.page.getByText('AI course plan applied. Modules now follow implicit deny.', { exact: true }).waitFor();
    } finally { await pm.close(); }
    console.log('PM project specification, real Strategy recommendation, and course configuration verified.');
    }
    const internAuth = await login('AVP Intern', credentials.internPassword);
    const intern = await session(`intern-${Date.now()}`, internAuth);
    try {
      const page = intern.page;
      if (!resume) {
        await page.goto(`${origin}/pre-test`, { waitUntil: 'networkidle' });
        await formal(page, 'A');
        await page.getByRole('button', { name: 'Continue to Dashboard', exact: true }).click();
      } else await page.goto(`${origin}/intern-dashboard`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Your learning progress', exact: true }).waitFor();
      await clip(page, '04_strategy_recommended', async () => { await page.getByText('Remaining: Strategy', { exact: true }).scrollIntoViewIfNeeded(); });
      await page.goto(`${origin}/patterns/learn`, { waitUntil: 'networkidle' });
      const category = page.locator('.nt-course-accordion__cat').filter({ hasText: /Behavioural/i });
      if (await category.getAttribute('aria-expanded') !== 'true') await category.click();
      if (await page.locator('.nt-course-accordion__module').filter({ hasText: 'Strategy' }).isDisabled()) {
        const foundation = page.locator('.nt-course-accordion__cat').filter({ hasText: /Foundations/i });
        if (await foundation.getAttribute('aria-expanded') !== 'true') await foundation.click();
        await page.locator('.nt-course-accordion__module').filter({ hasText: 'Post-Foundations open questions' }).click();
        await page.locator('.nt-pager__arrow--next').first().click();
        await page.locator('.nt-exam__question').first().waitFor();
        const checkpoint = modules.find((m) => m.id === 'foundations-postrequisite')!;
        await answerVisible(page, '.nt-exam__question', checkpoint.theoreticalExam!.questions.map((question) => ({ moduleId: checkpoint.id, question })), false);
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        await page.getByRole('button', { name: 'Proceed to Next Module', exact: true }).click();
      }
      if (!(await page.getByRole('heading', { name: 'Strategy', exact: true }).count())) {
        if (await category.getAttribute('aria-expanded') !== 'true') await category.click();
        await page.locator('.nt-course-accordion__module').filter({ hasText: 'Strategy' }).click();
      }
      console.log('Strategy lesson reached through the real learning gate.');
      await clip(page, '05_strategy_module', async () => { await page.locator('.nt-learn__module-section').first().scrollIntoViewIfNeeded(); }, 4000);
      await page.locator('.nt-pager__arrow--next').first().click();
      await page.locator('.nt-exam__question').first().waitFor();
      const strategy = modules.find((module) => module.id === 'behavioural-strategy')!;
      const strategyBank = strategy.theoreticalExam!.questions.map((question) => ({ moduleId: strategy.id, question }));
      await page.locator('.nt-exam__question').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await clip(page, '06_strategy_assessment', async () => {
        await page.waitForTimeout(1500);
        await answerVisible(page, '.nt-exam__question:first-of-type', strategyBank, false);
      });
      await answerVisible(page, '.nt-exam__question', strategyBank, false);
      // End the selected conceptual clip BEFORE submitting: answer-key reveal is never included.
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await page.getByRole('button', { name: 'Proceed to Practical Assessment', exact: true }).click();
      const practical = page.getByTestId('practical-studio-frame');
      await practical.locator('.file-slot-textarea').first().fill(source);
      await practical.getByTestId('analyze-btn').click();
      await page.getByText('You have completed this module', { exact: true }).waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: /^Proceed to (Post-Test|Next Module)/ }).click();
      if (!page.url().includes('/post-test')) await page.goto(`${origin}/post-test`, { waitUntil: 'networkidle' });
      await formal(page, 'B');
      await page.getByRole('button', { name: 'Back to Intern Dashboard', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Open Studio', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Open Studio', exact: true }).click();
      await page.getByTestId('analyze-btn').waitFor();
      await clip(page, '07_studio_source_upload', async () => { await page.locator('.file-slot-textarea').first().fill(source); });
      await clip(page, '08_studio_analyze', async () => {
        await page.getByTestId('analyze-btn').click();
        await expect(page.getByTestId('status-title')).toHaveText(/Analysis ready/i, { timeout: 60000 });
      });
      await page.getByTestId('tab-annotated').click();
      await page.getByTestId('documented-source').waitFor();
      await clip(page, '09_strategy_result_overview', async () => { await page.locator('.pattern-header__toggle').first().scrollIntoViewIfNeeded(); });
      await clip(page, '10_strategy_evidence_detail', async () => {
        await page.locator('.pattern-header__toggle').first().click();
        const delegation = page.locator('.src-line[data-line="33"]').first();
        await delegation.scrollIntoViewIfNeeded();
        if (await delegation.getAttribute('title') === 'Show note') await delegation.click();
      }, 4500);
      const docs = page.getByTestId('subview-docs');
      if (await docs.count()) await docs.click();
      await page.locator('.pattern-header__body').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await clip(page, '11_generated_documentation', async () => {}, 4000);
      await clip(page, '12_export_controls', async () => { await page.locator('.docs-download-group').scrollIntoViewIfNeeded(); });
      const downloadWait = page.waitForEvent('download');
      await page.getByRole('button', { name: 'MD', exact: true }).click();
      const download = await downloadWait;
      await download.saveAs(path.join(output, download.suggestedFilename()));
      const markdown = fs.readFileSync(path.join(output, download.suggestedFilename()), 'utf8');
      assert.match(markdown, /Compressor/); assert.match(markdown, /Strategy/i);
      const wordWait = page.waitForEvent('download');
      await page.getByRole('button', { name: 'DOCX', exact: true }).click();
      const word = await wordWait;
      assert.match(word.suggestedFilename(), /\.doc$/);
      await word.saveAs(path.join(output, word.suggestedFilename()));
      assert.match(fs.readFileSync(path.join(output, word.suggestedFilename()), 'utf8'), /Compressor/);
      const printWait = page.waitForEvent('popup');
      await page.getByRole('button', { name: 'PDF', exact: true }).click();
      const print = await printWait;
      await expect(print.locator('body')).toContainText('Compressor');
      await print.pdf({ path: path.join(output, 'strategy-documentation.pdf'), format: 'A4' });
      await print.close();
      fs.writeFileSync(path.join(output, 'capture-success.json'), JSON.stringify({ passed: true, realResponses: true, learningBypass: false, markdownVerified: true, wordHtmlVerified: true, pdfPrintViewVerified: true, nativeDocx: false, clips: clips.map((c) => c.name) }, null, 2));
      console.log('Real intern learning, post-test, Studio, evidence and Markdown export verified.');
    } catch (error) {
      await intern.page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
      fs.writeFileSync(path.join(output, 'failure.txt'), `${String(error)}\n\n${await intern.page.locator('body').innerText()}`);
      throw error;
    } finally { await intern.close(); }
  } finally {
    fs.writeFileSync(path.join(output, 'clips.json'), JSON.stringify(clips, null, 2));
    await browser.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
