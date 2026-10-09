import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { ROOT, currentState, runtimeEnvironment } from './config.mjs';

export function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => reject(new Error(`Demo port ${port} occupied or unavailable: ${error.message}`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

export async function startDemo(state = currentState()) {
  await assertPortFree(4310);
  await assertPortFree(4311);
  const env = runtimeEnvironment(state);
  const children = [];
  const logs = [];
  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.all(children.map((child) => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    })));
    for (const stream of logs) stream.end();
  }
  function launch(name, args) {
    const stream = fs.createWriteStream(path.join(state, `${name}.log`), { flags: 'a', mode: 0o600 });
    logs.push(stream);
    const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(stream); child.stderr.pipe(stream); children.push(child);
    child.once('error', () => { void stop(); });
    return child;
  }
  async function ready(url, child) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || stopped) throw new Error('Demo process stopped; inspect its isolated log');
      try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch { /* startup */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Demo did not become ready: ${url}`);
  }
  try {
    const backend = launch('backend', [path.join(ROOT, 'Codebase/Backend/node_modules/tsx/dist/cli.mjs'), path.join(ROOT, 'Codebase/AVP/worker.ts'), 'serve']);
    await ready('http://127.0.0.1:4311/health', backend);
    const frontend = launch('frontend', [path.join(ROOT, 'Codebase/AVP/frontend.mjs')]);
    await ready('http://127.0.0.1:4310', frontend);
    return { state, origin: 'http://127.0.0.1:4310', stop };
  } catch (error) { await stop(); throw error; }
}
