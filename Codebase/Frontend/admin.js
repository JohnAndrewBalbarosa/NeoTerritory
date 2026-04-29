'use strict';

const TOKEN_KEY = 'nt_token';
const USER_KEY = 'nt_user';

const state = {
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: (() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } })(),
  charts: {}
};

const els = {
  alphaTier:        document.getElementById('alpha-tier'),
  alphaSamples:     document.getElementById('alpha-samples'),
  alphaConcurrency: document.getElementById('alpha-concurrency'),
  alphaRunBtn:      document.getElementById('alpha-run-btn'),
  alphaExportBtn:   document.getElementById('alpha-export-btn'),
  alphaStatus:      document.getElementById('alpha-status'),
  alphaResultsTbody:document.getElementById('alpha-results-tbody'),
  alphaThresholdsPre: document.getElementById('alpha-thresholds-pre'),
  alphaSummary:     document.getElementById('alpha-summary'),

  refreshBtn:   document.getElementById('admin-refresh-btn'),
  logoutBtn:    document.getElementById('admin-logout-btn'),
  userLabel:    document.getElementById('admin-user-label'),
  tileUsers:    document.getElementById('tile-users'),
  tileRuns:     document.getElementById('tile-runs'),
  tileToday:    document.getElementById('tile-today'),
  tileReviews:  document.getElementById('tile-reviews'),
  tileFindings: document.getElementById('tile-findings'),
  activitySummary: document.getElementById('activity-summary'),
  usersTbody:   document.getElementById('users-tbody'),
  reviewsList:  document.getElementById('reviews-list'),
  logsList:     document.getElementById('logs-list'),
  userDrawer:   document.getElementById('user-drawer'),
  drawerTitle:  document.getElementById('drawer-title'),
  drawerBody:   document.getElementById('drawer-body'),
  drawerCloseBtn: document.getElementById('drawer-close-btn'),
  runDrawer:    document.getElementById('run-drawer'),
  runDrawerTitle: document.getElementById('run-drawer-title'),
  runDrawerBody:document.getElementById('run-drawer-body'),
  runDrawerCloseBtn: document.getElementById('run-drawer-close-btn')
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

async function apiFetch(url, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/';
    throw new Error('Not authorized');
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function gateAdmin() {
  if (!state.token || !state.user || state.user.role !== 'admin') {
    window.location.href = '/';
    return false;
  }
  els.userLabel.textContent = `${state.user.username} · admin`;
  return true;
}

function tweenCount(el, target, duration = 700) {
  const start = Number(el.textContent) || 0;
  const delta = target - start;
  if (!delta) { el.textContent = String(target); return; }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = start + delta * eased;
    const isInt = Number.isInteger(target);
    el.textContent = isInt ? String(Math.round(v)) : v.toFixed(2);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

const palette = [
  '#2563eb', '#10b981', '#8b5cf6', '#f97316',
  '#ec4899', '#14b8a6', '#ef4444', '#f59e0b',
  '#3b82f6', '#22c55e', '#a855f7', '#0ea5e9'
];

function renderChart(id, config) {
  if (state.charts[id]) state.charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  state.charts[id] = new Chart(ctx, config);
}

async function loadOverview() {
  const data = await apiFetch('/api/admin/stats/overview');
  tweenCount(els.tileUsers, data.totalUsers || 0);
  tweenCount(els.tileRuns, data.totalRuns || 0);
  tweenCount(els.tileToday, data.runsToday || 0);
  tweenCount(els.tileReviews, data.totalReviews || 0);
  tweenCount(els.tileFindings, data.avgFindings || 0);
}

async function loadActivity() {
  const data = await apiFetch('/api/admin/stats/runs-per-day?days=30');
  const series = data.series || [];
  const total = series.reduce((acc, p) => acc + p.count, 0);
  els.activitySummary.textContent = `${total} run${total === 1 ? '' : 's'} in the window`;
  renderChart('chart-activity', {
    type: 'line',
    data: {
      labels: series.map(p => p.date.slice(5)),
      datasets: [{
        label: 'Runs',
        data: series.map(p => p.count),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.18)',
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

async function loadPatterns() {
  const data = await apiFetch('/api/admin/stats/pattern-frequency');
  const series = (data.series || []).slice(0, 12);
  renderChart('chart-patterns', {
    type: 'bar',
    data: {
      labels: series.map(s => s.pattern),
      datasets: [{
        label: 'Detections',
        data: series.map(s => s.count),
        backgroundColor: series.map((_, i) => palette[i % palette.length]),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

async function loadFindings() {
  const data = await apiFetch('/api/admin/stats/score-distribution');
  const buckets = data.buckets || [];
  renderChart('chart-findings', {
    type: 'doughnut',
    data: {
      labels: buckets.map(b => b.range),
      datasets: [{
        data: buckets.map(b => b.count),
        backgroundColor: buckets.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { position: 'bottom' } },
      cutout: '62%'
    }
  });
}

async function loadPerUser() {
  const data = await apiFetch('/api/admin/stats/per-user-activity');
  const series = data.series || [];
  renderChart('chart-users', {
    type: 'bar',
    data: {
      labels: series.map(s => s.username),
      datasets: [{
        label: 'Runs',
        data: series.map(s => s.runs),
        backgroundColor: '#2563eb',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

async function loadUsers() {
  const data = await apiFetch('/api/admin/users');
  const users = data.users || [];
  if (!users.length) {
    els.usersTbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users.</td></tr>';
    return;
  }
  els.usersTbody.innerHTML = users.map(u => `
    <tr data-id="${u.id}" data-username="${escapeHtml(u.username)}">
      <td><strong>${escapeHtml(u.username)}</strong><br><small>${escapeHtml(u.email || '')}</small></td>
      <td><span class="role-pill" data-role="${u.role || 'user'}">${u.role || 'user'}</span></td>
      <td>${u.runCount || 0}</td>
      <td>${fmtDate(u.lastRunAt)}</td>
      <td>${fmtDate(u.created_at)}</td>
    </tr>
  `).join('');
  els.usersTbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => openUserDrawer(tr.dataset.id, tr.dataset.username));
  });
}

async function openUserDrawer(userId, username) {
  els.drawerTitle.textContent = `Runs · ${username}`;
  els.drawerBody.innerHTML = '<div class="empty-state">Loading...</div>';
  els.userDrawer.hidden = false;
  try {
    const data = await apiFetch(`/api/admin/users/${userId}/runs`);
    const runs = data.runs || [];
    if (!runs.length) {
      els.drawerBody.innerHTML = '<div class="empty-state">No runs yet.</div>';
      return;
    }
    els.drawerBody.innerHTML = runs.map(r => `
      <div class="run-row" data-run="${r.id}">
        <strong>${escapeHtml(r.source_name)}</strong>
        <span class="meta">findings: ${r.findings_count} · ${fmtDate(r.created_at)}</span>
      </div>
    `).join('');
    els.drawerBody.querySelectorAll('.run-row').forEach(row => {
      row.addEventListener('click', () => openRunDrawer(row.dataset.run));
    });
  } catch (err) {
    els.drawerBody.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function openRunDrawer(runId) {
  els.runDrawerBody.innerHTML = '<div class="empty-state">Loading...</div>';
  els.runDrawer.hidden = false;
  try {
    const data = await apiFetch(`/api/admin/runs/${runId}`);
    els.runDrawerTitle.textContent = `Run · ${data.sourceName}`;
    const patterns = (data.analysis && data.analysis.detectedPatterns) || [];
    const ranking = (data.analysis && data.analysis.ranking) || [];
    const summary = (data.analysis && data.analysis.summary) || '';
    els.runDrawerBody.innerHTML = `
      <div class="run-detail-section">
        <h4>Summary</h4>
        <p>${escapeHtml(summary)}</p>
        <p><strong>${escapeHtml(data.username || '?')}</strong> · ${fmtDate(data.createdAt)} · findings ${data.findingsCount}</p>
      </div>
      ${patterns.length ? `
        <div class="run-detail-section">
          <h4>Detected patterns</h4>
          <ul>${patterns.map(p => `<li>${escapeHtml(p.patternName || p.patternId)}${p.className ? ` <code>${escapeHtml(p.className)}</code>` : ''}</li>`).join('')}</ul>
        </div>
      ` : ''}
      ${ranking.length ? `
        <div class="run-detail-section">
          <h4>Ranking</h4>
          <ul>${ranking.map(r => `<li>${escapeHtml(r.patternName || r.patternId)} — ${(r.finalRank || 0).toFixed(2)}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <div class="run-detail-section">
        <h4>Source</h4>
        <pre class="run-detail-source">${escapeHtml(data.sourceText || '')}</pre>
      </div>
    `;
  } catch (err) {
    els.runDrawerBody.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderStars(value, max = 5) {
  const v = Math.max(0, Math.min(max, Number(value) || 0));
  return '★'.repeat(v) + '☆'.repeat(max - v);
}

async function loadReviews() {
  const data = await apiFetch('/api/admin/reviews');
  const reviews = data.reviews || [];
  if (!reviews.length) {
    els.reviewsList.innerHTML = '<div class="empty-state">No reviews submitted yet.</div>';
    return;
  }
  els.reviewsList.innerHTML = reviews.map(r => {
    const answers = r.answers || {};
    const answerLines = Object.entries(answers).map(([key, value]) => {
      const isRating = typeof value === 'number' && value >= 1 && value <= 10;
      const valueHtml = isRating
        ? `<span class="review-stars">${renderStars(value)}</span> <small>(${value}/5)</small>`
        : escapeHtml(value);
      return `<p class="review-answer"><strong>${escapeHtml(key)}:</strong>${valueHtml}</p>`;
    }).join('');
    return `
      <div class="review-card">
        <div class="review-card-head">
          <span><strong>${escapeHtml(r.username || '?')}</strong> · ${escapeHtml(r.scope)}${r.sourceName ? ` · <code>${escapeHtml(r.sourceName)}</code>` : ''}</span>
          <span>${fmtDate(r.createdAt)} · v${escapeHtml(r.schemaVersion)}</span>
        </div>
        ${answerLines || '<p class="review-answer"><em>(no answers)</em></p>'}
      </div>
    `;
  }).join('');
}

async function loadLogs() {
  const data = await apiFetch('/api/admin/logs?limit=80');
  const logs = data.logs || [];
  if (!logs.length) {
    els.logsList.innerHTML = '<div class="empty-state">No log entries.</div>';
    return;
  }
  els.logsList.innerHTML = logs.map(l => `
    <div class="log-row">
      <span>${fmtDate(l.created_at)}</span>
      <span>${escapeHtml(l.username || '—')}</span>
      <strong>${escapeHtml(l.event_type)}</strong>
      <span>${escapeHtml(l.message)}</span>
    </div>
  `).join('');
}

async function loadAll() {
  await Promise.all([
    loadOverview(),
    loadActivity(),
    loadPatterns(),
    loadFindings(),
    loadPerUser(),
    loadUsers(),
    loadReviews(),
    loadLogs()
  ].map(p => p.catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
  })));
}

// === Alpha diagnostics =====================================================
//
// In-browser latency probes against the live backend. Uses performance.now()
// for sub-ms wall-clock resolution. Reports p50/p95/p99/max per endpoint and
// gates each result against the active SLA tier from thresholds.json.
//
// References: Google RAIL, Nielsen (0.1/1/10s), ITU-T G.1010 (interactive
// transactional <2s preferred / <4s acceptable), Tene 2015 on percentile
// reporting (no averages).

const alphaState = {
  thresholds: null,
  lastReport: null,
  busy: false
};

const ALPHA_PROBES = [
  { id: 'health',    method: 'GET',  url: '/health',          auth: false, budgetKey: 'health_p95_ms' },
  { id: 'apiHealth', method: 'GET',  url: '/api/health',      auth: false, budgetKey: 'api_health_p95_ms' },
  { id: 'apiRoot',   method: 'GET',  url: '/api',             auth: false, budgetKey: 'health_p95_ms' },
  { id: 'analyze',   method: 'POST', url: '/api/analyze',     auth: true,  budgetKey: 'analyze_p95_ms',
    body: () => ({ filename: 'probe.cpp', code: 'class Probe {};\n' }) }
];

function percentile(sortedMs, p) {
  if (!sortedMs.length) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1));
  return sortedMs[idx];
}

async function probeOnce(probe) {
  const headers = { Accept: 'application/json' };
  let body;
  if (probe.body) {
    body = JSON.stringify(probe.body());
    headers['Content-Type'] = 'application/json';
  }
  if (probe.auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const t0 = performance.now();
  try {
    const res = await fetch(probe.url, { method: probe.method, headers, body });
    // Drain body so we measure full response, not just TTFB.
    await res.text();
    return { ms: performance.now() - t0, ok: res.ok, status: res.status };
  } catch (err) {
    return { ms: performance.now() - t0, ok: false, status: 0, error: String(err) };
  }
}

async function runProbe(probe, samples, concurrency) {
  // Warmup once so the first cold sample doesn't dominate p95 on small N.
  await probeOnce(probe);

  const results = [];
  let issued = 0;
  async function worker() {
    while (issued < samples) {
      const my = issued++;
      if (my >= samples) break;
      results.push(await probeOnce(probe));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  const ok = results.filter(r => r.ok).length;
  const errors = results.length - ok;
  const sorted = results.map(r => r.ms).sort((a, b) => a - b);
  return {
    samples: results.length,
    ok,
    errors,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] || 0
  };
}

function renderAlphaRow(probe, stats, budget) {
  const fmt = v => (v == null ? 'N/A' : v.toFixed(1));
  const hasBudget = Number.isFinite(budget);
  const passLatency = hasBudget && stats.p95 <= budget;
  const passErrors = stats.errors === 0;
  const pass = passLatency && passErrors;
  const tag = pass
    ? '<span class="pill pill-pass">PASS</span>'
    : '<span class="pill pill-fail">FAIL</span>';
  const reason = !pass
    ? `<div class="alpha-reason">${[
        !hasBudget ? `missing budget key ${escapeHtml(probe.budgetKey)}` : '',
        hasBudget && !passLatency ? `p95 ${fmt(stats.p95)} ms &gt; ${budget} ms` : '',
        !passErrors ? `${stats.errors} error(s)` : ''
      ].filter(Boolean).join(' | ')}</div>`
    : '';
  return `
    <tr>
      <td><code>${escapeHtml(probe.url)}</code></td>
      <td>${probe.method}</td>
      <td>${fmt(stats.p50)}</td>
      <td>${fmt(stats.p95)}</td>
      <td>${fmt(stats.p99)}</td>
      <td>${fmt(stats.max)}</td>
      <td>${stats.errors}</td>
      <td>${hasBudget ? `${budget} ms` : 'N/A'}</td>
      <td>${tag}${reason}</td>
    </tr>`;
}

async function loadAlphaThresholds() {
  try {
    const data = await apiFetch('/api/admin/alpha/thresholds');
    alphaState.thresholds = data.thresholds;
    els.alphaThresholdsPre.textContent = JSON.stringify(data.thresholds, null, 2);
  } catch (err) {
    els.alphaThresholdsPre.textContent = `Could not load thresholds: ${err.message}`;
  }
}

async function runAlpha() {
  if (alphaState.busy) return;
  if (!alphaState.thresholds) await loadAlphaThresholds();
  const tier = els.alphaTier.value;
  const tierThresh = alphaState.thresholds && alphaState.thresholds[tier];
  if (!tierThresh) {
    els.alphaStatus.textContent = 'No thresholds available.';
    return;
  }
  const samples = Math.max(3, Math.min(200, Number(els.alphaSamples.value) || 20));
  const concurrency = Math.max(1, Math.min(20, Number(els.alphaConcurrency.value) || 4));

  alphaState.busy = true;
  els.alphaRunBtn.disabled = true;
  els.alphaExportBtn.disabled = true;
  els.alphaStatus.textContent = 'Running probes...';
  els.alphaResultsTbody.innerHTML =
    '<tr><td colspan="9" class="empty-state">Probing...</td></tr>';

  const rows = [];
  const report = {
    startedAt: new Date().toISOString(),
    tier,
    samples,
    concurrency,
    thresholds: tierThresh,
    probes: []
  };
  let allPass = true;

  for (const probe of ALPHA_PROBES) {
    els.alphaStatus.textContent = `Probing ${probe.url} ...`;
    const stats = await runProbe(probe, samples, concurrency);
    const budget = Number(tierThresh[probe.budgetKey]);
    const pass = Number.isFinite(budget) && stats.p95 <= budget && stats.errors === 0;
    if (!pass) allPass = false;
    rows.push(renderAlphaRow(probe, stats, budget));
    report.probes.push({ id: probe.id, url: probe.url, method: probe.method, budget, pass, ...stats });
    // incremental render
    els.alphaResultsTbody.innerHTML = rows.join('');
  }

  report.finishedAt = new Date().toISOString();
  report.pass = allPass;
  alphaState.lastReport = report;

  els.alphaStatus.innerHTML = allPass
    ? '<span class="pill pill-pass">All probes within SLA</span>'
    : '<span class="pill pill-fail">One or more probes outside SLA</span>';
  els.alphaSummary.textContent =
    `Tier: ${tier} · ${samples} samples × ${concurrency} concurrent · ${report.probes.length} probes`;
  els.alphaRunBtn.disabled = false;
  els.alphaExportBtn.disabled = false;
  alphaState.busy = false;
}

function exportAlphaReport() {
  if (!alphaState.lastReport) return;
  const blob = new Blob([JSON.stringify(alphaState.lastReport, null, 2)],
                       { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alpha-probe-${alphaState.lastReport.tier}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bind() {
  els.refreshBtn.addEventListener('click', () => loadAll());
  els.alphaRunBtn.addEventListener('click', () => runAlpha());
  els.alphaExportBtn.addEventListener('click', () => exportAlphaReport());
  els.alphaTier.addEventListener('change', () => {
    const tier = els.alphaTier.value;
    const tierThresh = alphaState.thresholds && alphaState.thresholds[tier];
    els.alphaThresholdsPre.textContent = tierThresh
      ? JSON.stringify(tierThresh, null, 2)
      : 'No thresholds loaded for this tier.';
  });
  els.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/';
  });
  els.drawerCloseBtn.addEventListener('click', () => { els.userDrawer.hidden = true; });
  els.runDrawerCloseBtn.addEventListener('click', () => { els.runDrawer.hidden = true; });
  [els.userDrawer, els.runDrawer].forEach(drawer => {
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) drawer.hidden = true;
    });
  });
}

(function init() {
  if (!gateAdmin()) return;
  bind();
  setupReveal();
  loadAlphaThresholds();
  loadAll();
})();
