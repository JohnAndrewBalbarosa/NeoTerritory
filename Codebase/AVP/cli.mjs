import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { assertDemoDirectory } from './isolation.mjs';
import { ROOT, local, currentState, runtimeEnvironment } from './config.mjs';

function runWorker(action, state) {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'Codebase/Backend/node_modules/tsx/dist/cli.mjs'), path.join(ROOT, 'Codebase/AVP/worker.ts'), action], {
    cwd: ROOT, env: runtimeEnvironment(state), stdio: 'inherit', timeout: 60000,
  });
  if (run.error || run.status !== 0) throw new Error(`AVP ${action} failed: ${run.error?.message || run.status}`);
}

function reset() {
  // A reset creates a new generation; it never deletes or reuses another database.
  const state = assertDemoDirectory(ROOT, path.join(local, `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`));
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(state, 'marker.json'), JSON.stringify({ kind: 'codineo-avp', root: ROOT }), { mode: 0o600 });
  fs.writeFileSync(path.join(state, 'credentials.json'), JSON.stringify({ managerPassword: crypto.randomBytes(24).toString('hex'), internPassword: crypto.randomBytes(24).toString('hex'), jwtSecret: crypto.randomBytes(64).toString('hex') }), { mode: 0o600 });
  runWorker('reset', state);
  fs.writeFileSync(path.join(local, 'current'), state, { mode: 0o600 });
  console.log(`Demo state: ${path.relative(ROOT, state)}`);
}

export function verifyAnalyzer(state) {
  const env = runtimeEnvironment(state);
  if (!env.NEOTERRITORY_BIN) throw new Error('No existing analyzer binary. Supply a supported build; AVP tooling never rebuilds the analyzer.');
  const output = path.join(state, 'golden-analysis');
  fs.mkdirSync(output, { recursive: true });
  const fixture = path.join(ROOT, 'Codebase/Microservice/samples/strategy/strategy_basic.cpp');
  const run = spawnSync(env.NEOTERRITORY_BIN, ['--catalog', env.NEOTERRITORY_CATALOG, '--output', output, fixture], { env, encoding: 'utf8', timeout: 30000 });
  if (run.error || run.status !== 0) throw new Error(`Analyzer failed: ${run.error?.message || run.stderr}`);
  const report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
  for (const [className, id] of [['Compressor', 'behavioural.strategy_interface'], ['ZipCompressor', 'behavioural.strategy_concrete'], ['GzipCompressor', 'behavioural.strategy_concrete']]) {
    const match = report.detected_patterns?.find((p) => p.class_name === className && p.pattern_id === id);
    if (!match || !match.documentation_targets?.length) throw new Error(`Missing golden evidence: ${className}`);
    const lines = fs.readFileSync(fixture, 'utf8').split('\n');
    for (const anchor of match.documentation_targets) {
      if (!lines[anchor.line - 1]?.includes(anchor.lexeme)) throw new Error(`Untraceable evidence: ${className} ${anchor.label}`);
    }
  }
  if (report.diagnostics?.length) throw new Error('Analyzer reported diagnostics; inspect golden-analysis/report.json');
  console.log('Golden Strategy fixture verified: interface, two concrete classes, and source anchors.');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'reset') reset();
    else if (process.argv[2] === 'verify') { const state = currentState(); verifyAnalyzer(state); runWorker('recommend', state); }
    else if (process.argv[2] === 'capture') {
      const { startDemo, assertPortFree } = await import('./runtime.mjs');
      await assertPortFree(4310); await assertPortFree(4311);
      reset();
      const state = currentState();
      verifyAnalyzer(state); runWorker('recommend', state);
      const runtime = await startDemo(state);
      try {
        await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [path.join(ROOT, 'Codebase/Backend/node_modules/tsx/dist/cli.mjs'), path.join(ROOT, 'Codebase/AVP/capture.ts')], {
            cwd: ROOT, env: { ...runtimeEnvironment(state), AVP_CAPTURE_OWNED: 'true' }, stdio: 'inherit',
          });
          child.once('error', reject);
          child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Capture failed (${code})`)));
        });
      } finally { await runtime.stop(); }
    }
    else if (process.argv[2] === 'serve') {
      const { startDemo } = await import('./runtime.mjs');
      const runtime = await startDemo();
      console.log(`Isolated CodiNeo demo: ${runtime.origin}`);
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.stop(); process.exit(0); });
    }
    else throw new Error('Usage: node Codebase/AVP/cli.mjs reset|verify|capture|serve');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
