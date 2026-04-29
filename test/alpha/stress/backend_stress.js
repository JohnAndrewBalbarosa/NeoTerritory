#!/usr/bin/env node
/*
 * Backend stress harness — pure node, no extra deps.
 *
 * Generates closed-loop concurrent load against the backend, records per-
 * request wall time using process.hrtime.bigint(), and reports:
 *   - throughput (req/s)
 *   - latency p50/p95/p99/max
 *   - Apdex score (T configurable; default 1.0 s for analyze)
 *   - peak RSS observed in this client process (request-side, not server)
 *
 * Methodology notes:
 *   - We use hrtime, not Date.now, to avoid clock-drift + ms-resolution noise.
 *   - We start the timer BEFORE issuing the request and stop AFTER 'end',
 *     so we include connect + TLS + body parse, not just TTFB. This is
 *     consistent with how RAIL / G.1010 frame "user-perceived latency".
 *   - We compute percentiles from the full sample, not a sliding window —
 *     this avoids the coordinated-omission pattern Tene (2015) warns about
 *     in closed-loop benchmarks. (For a fully open-loop test, use k6.)
 *
 * Usage:
 *   node backend_stress.js \
 *     --target http://localhost:3001 \
 *     --route  /health \
 *     --concurrency 50 \
 *     --duration 30 \
 *     --apdex-T 1.0 \
 *     --report stress.json
 *
 * For the analyze route, pass --route /api/analyze --auth <jwt>
 * --body-file path/to/payload.json (the body must already be a JSON object
 * with `code` and optional `filename`).
 */

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { URL } = require('node:url');

function parseArgs(argv) {
  const args = {
    target: 'http://localhost:3001',
    route: '/health',
    method: 'GET',
    concurrency: 25,
    duration: 15,
    apdexT: 1.0,
    auth: '',
    bodyFile: '',
    report: '',
  };
  for (let i = 2; i < argv.length; ++i) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--target':       args.target = v; ++i; break;
      case '--route':        args.route = v; ++i; break;
      case '--method':       args.method = v.toUpperCase(); ++i; break;
      case '--concurrency':  args.concurrency = Number(v); ++i; break;
      case '--duration':     args.duration = Number(v); ++i; break;
      case '--apdex-T':      args.apdexT = Number(v); ++i; break;
      case '--auth':         args.auth = v; ++i; break;
      case '--body-file':    args.bodyFile = v; ++i; break;
      case '--report':       args.report = v; ++i; break;
      case '--help': case '-h':
        console.log('See header of backend_stress.js for flags.');
        process.exit(0);
      default:
        if (k.startsWith('--')) {
          console.error(`unknown flag: ${k}`); process.exit(2);
        }
    }
  }
  return args;
}

function lib(url) { return url.protocol === 'https:' ? https : http; }

function fireOne(url, opts, bodyBuf) {
  return new Promise(resolve => {
    const t0 = process.hrtime.bigint();
    const req = lib(url).request({
      method: opts.method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: opts.headers,
    }, res => {
      // Drain to include body parse in the measurement.
      res.on('data', () => {});
      res.on('end', () => {
        const ns = Number(process.hrtime.bigint() - t0);
        resolve({ ok: res.statusCode < 500, status: res.statusCode, ms: ns / 1e6 });
      });
    });
    req.on('error', () => {
      const ns = Number(process.hrtime.bigint() - t0);
      resolve({ ok: false, status: 0, ms: ns / 1e6 });
    });
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function apdex(samples, tMs) {
  // Apdex V1.1: satisfied <= T, tolerating <= 4T, frustrated > 4T.
  // Score = (satisfied + tolerating/2) / total.
  let s = 0, t = 0;
  for (const ms of samples) {
    if (ms <= tMs) ++s;
    else if (ms <= 4 * tMs) ++t;
  }
  return samples.length ? (s + t / 2) / samples.length : 0;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = new URL(args.target.replace(/\/$/, '') + args.route);

  const headers = {};
  let bodyBuf = null;
  if (args.auth) headers.Authorization = `Bearer ${args.auth}`;
  if (args.bodyFile) {
    bodyBuf = fs.readFileSync(args.bodyFile);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = bodyBuf.length;
    if (args.method === 'GET') args.method = 'POST';
  }

  console.log(`Stressing ${args.method} ${url.toString()}`);
  console.log(`  concurrency=${args.concurrency} duration=${args.duration}s apdexT=${args.apdexT}s`);

  const samples = [];
  let nOk = 0, nErr = 0;
  let peakRssMb = 0;
  const stopAt = Date.now() + args.duration * 1000;

  // Sample client-side RSS every 250 ms.
  const rssTimer = setInterval(() => {
    const rss = process.memoryUsage.rss() / (1024 * 1024);
    if (rss > peakRssMb) peakRssMb = rss;
  }, 250);

  async function worker() {
    while (Date.now() < stopAt) {
      const r = await fireOne(url, { method: args.method, headers }, bodyBuf);
      samples.push(r.ms);
      if (r.ok) ++nOk; else ++nErr;
    }
  }

  const t0 = process.hrtime.bigint();
  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  clearInterval(rssTimer);

  const sorted = samples.slice().sort((a, b) => a - b);
  const total = samples.length;
  const sum = samples.reduce((a, b) => a + b, 0);
  const avg = total ? sum / total : 0;
  const result = {
    target: url.toString(),
    method: args.method,
    concurrency: args.concurrency,
    duration_s: elapsed,
    requests: total,
    ok: nOk,
    errors: nErr,
    rps: total / elapsed,
    latency_ms: {
      avg,
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] || 0,
    },
    apdex: apdex(samples, args.apdexT * 1000),
    apdexT_s: args.apdexT,
    client_peak_rss_mb: Number(peakRssMb.toFixed(1)),
  };

  console.log(JSON.stringify(result, null, 2));
  if (args.report) fs.writeFileSync(args.report, JSON.stringify(result, null, 2));

  // Exit 1 if Apdex < 0.7 or error rate > 1%.
  const errorRate = total ? nErr / total : 1;
  if (result.apdex < 0.7 || errorRate > 0.01) {
    console.error(`FAIL: apdex=${result.apdex.toFixed(3)} errorRate=${(errorRate * 100).toFixed(2)}%`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
