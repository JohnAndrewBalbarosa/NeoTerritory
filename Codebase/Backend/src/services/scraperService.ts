import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';

interface ScraperEvent {
  ts: string;
  event: string;
  [k: string]: unknown;
}

interface ScraperState {
  runId: string;
  url: string;
  startedAt: string;
  ready: boolean;
  finishedAt: string | null;
  outputDir: string | null;
  events: ScraperEvent[];
  pid: number | null;
  exitCode: number | null;
}

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RUNNER = path.join(ROOT, 'tools', 'scraper', 'run.mjs');

let active: { proc: ChildProcessWithoutNullStreams; state: ScraperState } | null = null;

function isEnabled(): boolean {
  return process.env.NEOTERRITORY_ENABLE_SCRAPER === '1';
}

function makeRunId(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${Math.random().toString(36).slice(2, 6)}`;
}

function ringPush<T>(arr: T[], item: T, max = 200): void {
  arr.push(item);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export interface StartArgs {
  url: string;
  hostKey?: string;
  maxScrolls?: number;
}

export interface StartResult {
  runId: string;
  state: ScraperState;
}

export function startScraper(args: StartArgs): StartResult {
  if (!isEnabled()) {
    throw Object.assign(new Error('scraper disabled (set NEOTERRITORY_ENABLE_SCRAPER=1)'), { status: 403 });
  }
  if (active && active.state.exitCode === null) {
    throw Object.assign(new Error('scraper already running'), { status: 409 });
  }
  if (!fs.existsSync(RUNNER)) {
    throw Object.assign(new Error(`scraper runner missing at ${RUNNER}`), { status: 500 });
  }
  let parsed: URL;
  try {
    parsed = new URL(args.url);
  } catch {
    throw Object.assign(new Error('invalid url'), { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw Object.assign(new Error('only http/https urls allowed'), { status: 400 });
  }

  const runId = makeRunId();
  const cliArgs = [
    RUNNER,
    '--url',
    args.url,
    '--run-id',
    runId,
  ];
  if (args.hostKey) cliArgs.push('--host-key', args.hostKey);
  if (args.maxScrolls !== undefined) cliArgs.push('--max-scrolls', String(args.maxScrolls));

  const proc = spawn(process.execPath, cliArgs, {
    cwd: ROOT,
    env: { ...process.env },
    windowsHide: false,
  });

  const state: ScraperState = {
    runId,
    url: args.url,
    startedAt: new Date().toISOString(),
    ready: false,
    finishedAt: null,
    outputDir: null,
    events: [],
    pid: proc.pid ?? null,
    exitCode: null,
  };
  active = { proc, state };

  let stdoutBuf = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8');
    let nl = stdoutBuf.indexOf('\n');
    while (nl !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line) {
        try {
          const ev = JSON.parse(line) as ScraperEvent;
          ringPush(state.events, ev);
          if (ev.event === 'ready') {
            state.ready = true;
            if (typeof ev.outputDir === 'string') state.outputDir = ev.outputDir;
          }
          if (ev.event === 'extract-done' && typeof ev.outputDir === 'string') {
            state.outputDir = ev.outputDir;
          }
        } catch {
          ringPush(state.events, { ts: new Date().toISOString(), event: 'log', line });
        }
      }
      nl = stdoutBuf.indexOf('\n');
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (text) ringPush(state.events, { ts: new Date().toISOString(), event: 'stderr', line: text });
  });

  proc.on('exit', (code) => {
    state.finishedAt = new Date().toISOString();
    state.exitCode = code;
    state.ready = false;
  });

  return { runId, state };
}

export function getScraperStatus(): { enabled: boolean; running: boolean; state: ScraperState | null } {
  return {
    enabled: isEnabled(),
    running: !!active && active.state.exitCode === null,
    state: active ? active.state : null,
  };
}

export function stopScraper(): { stopped: boolean; reason?: string } {
  if (!active || active.state.exitCode !== null) {
    return { stopped: false, reason: 'no active scraper' };
  }
  try {
    active.proc.kill('SIGTERM');
    return { stopped: true };
  } catch (err) {
    return { stopped: false, reason: err instanceof Error ? err.message : 'kill failed' };
  }
}
