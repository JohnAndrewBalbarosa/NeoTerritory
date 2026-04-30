const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const MAX_SOURCE_BYTES = 50 * 1024;
const COMPILE_TIMEOUT_MS = 15_000;
const RUN_TIMEOUT_MS = 10_000;
const JOB_TTL_MS = 10 * 60 * 1000;

// In-memory queue — single GDB process at a time (shared compile/run resource).
const queue = [];
const completedJobs = new Map();
let activeJob = null;

function randomId() {
  return `gdb_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function evictExpired() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of completedJobs) {
    if (job.completedAt && job.completedAt < cutoff) completedJobs.delete(id);
  }
}

function updatePositions() {
  queue.forEach((item, i) => { item.queuePosition = i + 1; });
}

async function runGdb({ sourceCode, filename }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntgdb_'));
  const srcFile = path.join(dir, filename || 'prog.cpp');
  const binFile = path.join(dir, 'prog');

  try {
    fs.writeFileSync(srcFile, sourceCode, 'utf8');

    const compile = spawnSync('g++', ['-g', '-O0', '-o', binFile, srcFile], {
      timeout: COMPILE_TIMEOUT_MS,
      encoding: 'utf8'
    });

    if (compile.status !== 0 || !fs.existsSync(binFile)) {
      return {
        compiledOk: false,
        compileStderr: (compile.stderr || '').slice(0, 4096),
        exitCode: null,
        stdout: '',
        stderr: compile.stderr || '',
        backtrace: null,
        runtimeMs: 0
      };
    }

    const t = Date.now();
    const run = spawnSync('gdb', [
      '--batch',
      '--ex', 'run',
      '--ex', 'bt',
      binFile
    ], {
      timeout: RUN_TIMEOUT_MS,
      encoding: 'utf8'
    });
    const runtimeMs = Date.now() - t;

    const stdout = (run.stdout || '').slice(0, 8192);
    const stderr = (run.stderr || '').slice(0, 4096);
    const backtrace = extractBacktrace(stdout + '\n' + stderr);

    return {
      compiledOk: true,
      compileStderr: (compile.stderr || '').slice(0, 1024),
      exitCode: run.status,
      stdout,
      stderr,
      backtrace,
      runtimeMs
    };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function extractBacktrace(output) {
  const lines = output.split('\n');
  const btStart = lines.findIndex(l => /^#0\s/.test(l));
  if (btStart === -1) return null;
  return lines.slice(btStart).join('\n').slice(0, 4096);
}

async function processNext() {
  if (activeJob || queue.length === 0) return;
  activeJob = queue.shift();
  updatePositions();
  activeJob.status = 'running';
  activeJob.queuePosition = 0;

  const t = Date.now();
  try {
    activeJob.result = await runGdb(activeJob.input);
    activeJob.status = 'complete';
  } catch (err) {
    activeJob.result = { error: String(err?.message || err) };
    activeJob.status = 'failed';
  }
  activeJob.completedAt = Date.now();
  activeJob.runtimeMs = Date.now() - t;
  completedJobs.set(activeJob.id, activeJob);
  activeJob = null;
  evictExpired();
  processNext();
}

function enqueue(input) {
  if (Buffer.byteLength(input.sourceCode || '', 'utf8') > MAX_SOURCE_BYTES) {
    throw new Error('Source code too large (max 50kb)');
  }
  const id = randomId();
  const job = {
    id,
    input,
    status: 'queued',
    queuePosition: queue.length + (activeJob ? 1 : 0) + 1,
    createdAt: Date.now(),
    completedAt: null,
    result: null
  };
  queue.push(job);
  processNext();
  return { id, queuePosition: job.queuePosition };
}

function getJob(id) {
  if (activeJob && activeJob.id === id) {
    return { id, status: 'running', queuePosition: 0, result: null };
  }
  const inQueue = queue.find(j => j.id === id);
  if (inQueue) {
    return { id, status: 'queued', queuePosition: inQueue.queuePosition, result: null };
  }
  const done = completedJobs.get(id);
  if (done) {
    return { id, status: done.status, queuePosition: 0, result: done.result };
  }
  return null;
}

function getQueueStatus() {
  return {
    length: queue.length,
    activeJobId: activeJob ? activeJob.id : null
  };
}

module.exports = { enqueue, getJob, getQueueStatus };
