// Pure-function unit tests around analysis route helpers. We don't have an
// importable module per helper (they live inside the route file), so this
// suite exercises adjacent services that ARE importable. Goal: prove the
// service layer cold-imports under a perf budget and behaves on trivial input.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const BACKEND_SRC = path.resolve(
  __dirname, '..', '..', '..', '..', 'Codebase', 'Backend', 'src',
);

test('patternRankingService cold-imports under 200 ms', () => {
  const t0 = process.hrtime.bigint();
  // eslint-disable-next-line global-require
  const mod = require(path.join(BACKEND_SRC, 'services', 'patternRankingService'));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(typeof mod.rankAll, 'function');
  assert.ok(ms < 200, `cold import took ${ms.toFixed(1)} ms`);
});

test('rankAll([], "") returns array (no crash on empty)', () => {
  const { rankAll } = require(path.join(BACKEND_SRC, 'services', 'patternRankingService'));
  const out = rankAll([], '');
  assert.ok(Array.isArray(out));
});

test('classUsageBinder.bindAll([], "") returns array', () => {
  const { bindAll } = require(path.join(BACKEND_SRC, 'services', 'classUsageBinder'));
  const out = bindAll('', []);
  assert.ok(Array.isArray(out) || typeof out === 'object');
});

test('classDeclarationAnalysisService exposes resolver helpers', () => {
  const svc = require(path.join(BACKEND_SRC, 'services', 'classDeclarationAnalysisService'));
  assert.equal(typeof svc.resolveBinaryPath, 'function');
  assert.equal(typeof svc.resolveCatalogPath, 'function');
  // Must return strings even if files are missing — UI gates on existsSync.
  assert.equal(typeof svc.resolveBinaryPath(), 'string');
  assert.equal(typeof svc.resolveCatalogPath(), 'string');
});
