'use strict';

const PATTERN_COLORS = {
  Singleton:      { bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', text: '#1d4ed8' },
  Factory:        { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#047857' },
  Builder:        { bg: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#6d28d9' },
  MethodChaining: { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', text: '#0f766e' },
  Adapter:        { bg: 'rgba(249, 115, 22, 0.20)', border: '#f97316', text: '#c2410c' },
  Decorator:      { bg: 'rgba(236, 72, 153, 0.18)', border: '#ec4899', text: '#be185d' },
  Proxy:          { bg: 'rgba(239, 68, 68, 0.18)',  border: '#ef4444', text: '#b91c1c' },
  Review:         { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#475569' },
  default:        { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#475569' }
};

const TOKEN_KEY = 'nt_token';
const USER_KEY = 'nt_user';

const state = {
  currentRun: null,
  sourceText: '',
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: (() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } })(),
  sessionRanAnalyze: false,
  sessionReviewedEnd: false,
  reviewSchemaCache: {}
};

const els = {
  statusCard:   document.getElementById('status-card'),
  statusTitle:  document.getElementById('status-title'),
  statusDetail: document.getElementById('status-detail'),
  form:         document.getElementById('analysis-form'),
  codeInput:    document.getElementById('code-input'),
  fileInput:    document.getElementById('file-input'),
  filenameInput:document.getElementById('filename-input'),
  analyzeBtn:   document.getElementById('analyze-btn'),
  loadSampleBtn:document.getElementById('load-sample-btn'),
  clearBtn:     document.getElementById('clear-btn'),
  refreshBtn:   document.getElementById('refresh-btn'),
  resultsPanel: document.getElementById('results-panel'),
  resultsSummary: document.getElementById('results-summary'),
  patternLegend:document.getElementById('pattern-legend'),
  sourceView:   document.getElementById('source-view'),
  commentsPane: document.getElementById('comments-pane'),
  runList:      document.getElementById('run-list'),
  loginOverlay: document.getElementById('login-overlay'),
  loginForm:    document.getElementById('login-form'),
  loginUsername:document.getElementById('login-username'),
  loginPassword:document.getElementById('login-password'),
  loginError:   document.getElementById('login-error'),
  userRow:      document.getElementById('user-row'),
  userLabel:    document.getElementById('user-label'),
  logoutBtn:    document.getElementById('logout-btn'),
  msRow:        document.getElementById('ms-row'),
  msStatus:     document.getElementById('ms-status'),
  testerList:   document.getElementById('tester-list'),
  testerGrid:   document.getElementById('tester-grid'),
  savePrompt:   document.getElementById('save-prompt'),
  savePromptDetail: document.getElementById('save-prompt-detail'),
  saveConfirmBtn: document.getElementById('save-confirm-btn'),
  saveDiscardBtn: document.getElementById('save-discard-btn'),
  patternCards: document.getElementById('pattern-cards'),
  classBindings: document.getElementById('class-bindings'),
  ambiguityModal: document.getElementById('ambiguity-modal'),
  ambiguityList:  document.getElementById('ambiguity-list'),
  ambiguityDetail: document.getElementById('ambiguity-detail'),
  ambiguityConfirmBtn: document.getElementById('ambiguity-confirm-btn'),
  ambiguitySkipBtn: document.getElementById('ambiguity-skip-btn'),
  reviewModal:  document.getElementById('review-modal'),
  reviewIntro:  document.getElementById('review-intro'),
  reviewQuestions: document.getElementById('review-questions'),
  reviewSubmitBtn: document.getElementById('review-submit-btn'),
  reviewSkipBtn:   document.getElementById('review-skip-btn'),
  reviewError:     document.getElementById('review-error')
};

function setMicroserviceStatus(stateKey, label) {
  if (!els.msRow || !els.msStatus) return;
  els.msRow.dataset.state = stateKey;
  els.msStatus.textContent = label;
}

function setStatus(kind, title, detail) {
  els.statusTitle.textContent  = title;
  els.statusDetail.textContent = detail;
  els.statusCard.dataset.kind  = kind;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function patternFromAnnotation(annotation) {
  const title = annotation.title || '';
  const head  = title.split(' :: ')[0] || annotation.stage || 'Review';
  return PATTERN_COLORS[head] ? head : (PATTERN_COLORS.default ? 'default' : head);
}

function colorFor(patternKey) {
  return PATTERN_COLORS[patternKey] || PATTERN_COLORS.default;
}

async function apiFetch(url, options = {}) {
  const isForm = options.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (response.status === 401) {
    handleSignOut();
    throw new Error(data.error || 'Session expired — please sign in.');
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function showLogin() {
  els.loginOverlay.hidden = false;
  document.body.classList.add('login-active');
  els.userRow.hidden = true;
  els.loginUsername.focus();
}

function hideLogin() {
  els.loginOverlay.hidden = true;
  document.body.classList.remove('login-active');
  els.userRow.hidden = false;
  if (state.user) els.userLabel.textContent = state.user.username || '';
}

function handleSignIn(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user && user.role === 'admin') {
    window.location.href = '/admin.html';
    return;
  }
  hideLogin();
}

function performSignOut() {
  state.token = null;
  state.user = null;
  state.sessionRanAnalyze = false;
  state.sessionReviewedEnd = false;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  els.runList.innerHTML = '<div class="empty-state">Sign in to see your runs.</div>';
  els.resultsPanel.hidden = true;
  showLogin();
}

async function handleSignOut() {
  if (state.sessionRanAnalyze && !state.sessionReviewedEnd && state.token) {
    await openReviewModal('end-of-session', null, {
      intro: 'Before you sign out — a few quick questions about this session.'
    });
  }
  performSignOut();
}

async function loadTesterAccounts() {
  if (!els.testerList || !els.testerGrid) return;
  try {
    const res = await fetch('/auth/test-accounts');
    const data = await res.json();
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    if (!accounts.length) { els.testerList.hidden = true; return; }
    els.testerList.hidden = false;
    els.testerGrid.innerHTML = '';
    accounts.forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tester-chip';
      btn.textContent = name;
      btn.addEventListener('click', () => {
        els.loginUsername.value = name;
        els.loginPassword.value = data.password || '';
        els.testerGrid.querySelectorAll('.tester-chip[aria-pressed="true"]').forEach(b => b.removeAttribute('aria-pressed'));
        btn.setAttribute('aria-pressed', 'true');
        els.loginPassword.focus();
      });
      els.testerGrid.appendChild(btn);
    });
  } catch {
    els.testerList.hidden = true;
  }
}

async function submitLogin(event) {
  event.preventDefault();
  els.loginError.hidden = true;
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (!username || !password) return;
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Login failed (${response.status})`);
    handleSignIn(data.token, data.user || { username });
    els.loginPassword.value = '';
    await loadRuns();
    await loadSample();
  } catch (err) {
    els.loginError.textContent = err.message;
    els.loginError.hidden = false;
  }
}

async function loadHealth() {
  setMicroserviceStatus('checking', 'checking...');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const h = await res.json();
    const ms = h.microservice || {};
    const proc = h.process || {};
    const tip = proc.pid
      ? `host:${proc.hostname || '?'} pid:${proc.pid} port:${proc.port || '?'} • served by this backend only`
      : '';
    if (els.msRow) els.msRow.title = tip;
    if (ms.connected) {
      setMicroserviceStatus('online', 'online');
    } else {
      const reason = !ms.binaryFound ? 'binary missing'
                    : !ms.catalogFound ? 'catalog missing'
                    : 'unreachable';
      setMicroserviceStatus('offline', `offline (${reason})`);
    }
    setStatus('ok', 'API ok',
      `${h.service} • ${h.totalRuns} run(s)${h.aiProviderConfigured ? ' • AI on' : ' • AI off'}`);
    rescheduleHealthPoll(false);
  } catch (err) {
    clearTimeout(timer);
    if (els.msRow) els.msRow.title = 'backend unreachable';
    const label = err.name === 'AbortError' ? 'offline (timeout)' : 'offline (unreachable)';
    setMicroserviceStatus('offline', label);
    setStatus('error', 'API offline', err.message || 'unreachable');
    rescheduleHealthPoll(true);
  }
}

function rescheduleHealthPoll(failed) {
  const next = failed ? 3000 : MS_POLL_INTERVAL_MS;
  if (window.__msPollHandle) {
    clearInterval(window.__msPollHandle);
    window.__msPollHandle = null;
  }
  window.__msPollHandle = setInterval(loadHealth, next);
}

function promptSaveRun(pendingId, sourceName, patternCount, commentCount, userResolvedPattern) {
  if (!els.savePrompt) return;
  const choiceLine = userResolvedPattern ? ` Choice: ${userResolvedPattern}.` : '';
  els.savePromptDetail.textContent =
    `${sourceName}: ${patternCount} pattern(s), ${commentCount} comment(s).${choiceLine} Save to your folder?`;
  els.savePrompt.hidden = false;

  const cleanup = () => {
    els.savePrompt.hidden = true;
    els.saveConfirmBtn.removeEventListener('click', onConfirm);
    els.saveDiscardBtn.removeEventListener('click', onDiscard);
  };
  const onConfirm = async () => {
    els.saveConfirmBtn.disabled = true;
    try {
      const result = await apiFetch('/api/runs/save', {
        method: 'POST',
        body: JSON.stringify({ pendingId, userResolvedPattern: userResolvedPattern || undefined })
      });
      setStatus('ok', 'Run saved', `Saved as run #${result.runId}.`);
      await loadRuns();
      openReviewModal('per-run', result.runId, {
        intro: 'Quick rating for this run (optional):'
      });
    } catch (err) {
      setStatus('error', 'Save failed', err.message);
    } finally {
      els.saveConfirmBtn.disabled = false;
      cleanup();
    }
  };
  const onDiscard = () => {
    setStatus('idle', 'Discarded', 'Run was not saved.');
    cleanup();
  };
  els.saveConfirmBtn.addEventListener('click', onConfirm);
  els.saveDiscardBtn.addEventListener('click', onDiscard);
}

const MS_POLL_INTERVAL_MS = 15000;
function startMicroservicePolling() {
  rescheduleHealthPoll(false);
}

async function loadRuns() {
  try {
    const data = await apiFetch('/api/runs?limit=12');
    const runs = data.runs || [];
    if (!runs.length) {
      els.runList.innerHTML = '<div class="empty-state">No runs stored yet.</div>';
      return;
    }
    els.runList.innerHTML = '';
    runs.forEach(run => {
      const el = document.createElement('div');
      el.className = 'run-item';
      el.innerHTML =
        `<div><strong>${escapeHtml(run.source_name)}</strong>` +
        `<p>${escapeHtml(fmtDate(run.created_at))} • ${run.findings_count || 0} finding(s)</p></div>` +
        `<button class="ghost-btn" type="button">Open</button>`;
      el.querySelector('button').addEventListener('click', () => loadRun(run.id));
      els.runList.appendChild(el);
    });
  } catch (err) {
    els.runList.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadRun(id) {
  try {
    setStatus('busy', 'Loading run', `Fetching run #${id}...`);
    const data = await apiFetch(`/api/runs/${id}`);
    const sourceText = data.sourceText || '';
    const analysis = data.analysis || {};
    els.codeInput.value = sourceText;
    els.filenameInput.value = data.sourceName || 'snippet.cpp';
    renderRun({
      runId: data.id,
      sourceName: data.sourceName,
      sourceText,
      detectedPatterns: analysis.detectedPatterns || [],
      detectedPatternCount: (analysis.detectedPatterns || []).length,
      annotations: analysis.annotations || [],
      summary: analysis.summary || ''
    });
    setStatus('ok', 'Run loaded', `Showing run #${id}.`);
  } catch (err) {
    setStatus('error', 'Load failed', err.message);
  }
}

async function loadSample() {
  try {
    const sample = await apiFetch('/api/sample');
    els.codeInput.value = sample.code || '';
    els.filenameInput.value = sample.filename || 'sample.cpp';
    setStatus('ok', 'Sample loaded', `${sample.filename} placed in the editor.`);
  } catch (err) {
    setStatus('error', 'Sample failed', err.message);
  }
}

function clearAll() {
  els.codeInput.value = '';
  els.fileInput.value = '';
  els.filenameInput.value = 'snippet.cpp';
  els.resultsPanel.hidden = true;
  state.currentRun = null;
  setStatus('idle', 'Cleared', 'Ready for new input.');
}

async function submitAnalysis(event) {
  event.preventDefault();
  const code = els.codeInput.value.trim();
  const file = els.fileInput.files[0];
  const filename = els.filenameInput.value.trim() || 'snippet.cpp';

  if (!code && !file) {
    setStatus('error', 'No input', 'Paste code or pick a file first.');
    return;
  }

  els.analyzeBtn.disabled = true;
  const originalLabel = els.analyzeBtn.textContent;
  els.analyzeBtn.textContent = 'Running...';
<<<<<<< Updated upstream
  setStatus('busy', 'Running analysis', 'Spawning microservice...');
=======
  setStatus('busy', 'Analyzing…', 'Spawning microservice…');

  let body;
  if (file) {
    body = new FormData();
    body.append('file', file);
    body.append('filename', filename);
  } else {
    body = JSON.stringify({ code, filename });
  }

  const headers = { Accept: 'text/event-stream' };
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  let pendingId = null;
  let finalRanking = null;
  let finalSuspectedStructures = [];
  let stablePatternCount = 0;
  let completedAiItems = 0;
  const completedAiPatternIndexes = new Set();
>>>>>>> Stashed changes

  try {
    let body;
    if (file) {
      body = new FormData();
      body.append('file', file);
      body.append('filename', filename);
    } else {
      body = JSON.stringify({ code, filename });
    }
    const run = await apiFetch('/api/analyze', { method: 'POST', body });
    state.sessionRanAnalyze = true;
    const sourceText = run.sourceText || code;
    if (run.sourceText) els.codeInput.value = run.sourceText;
    if (run.sourceName) els.filenameInput.value = run.sourceName;

    renderRun({
      runId: run.runId || null,
      sourceName: run.sourceName,
      sourceText,
      detectedPatterns: run.detectedPatterns || [],
      annotations: run.annotations || [],
      ranking: run.ranking || null,
      classUsageBindings: run.classUsageBindings || {},
      classUsageBindingSource: run.classUsageBindingSource || 'heuristic',
      summary: run.summary || ''
    });

    const patternCount = (run.detectedPatterns || []).length;
    const commentCount = (run.annotations || []).length;
    const verdict = run.ranking?.verdict || 'no_clear_pattern';
    setStatus('ok', 'Analysis ready (unsaved)',
      `${patternCount} pattern(s), ${commentCount} comment(s). Verdict: ${verdict}.`);

    if (run.pendingId) {
      const userResolvedPattern = await promptAmbiguity(run.pendingId, run.ranking, run.sourceName);
      promptSaveRun(run.pendingId, run.sourceName, patternCount, commentCount, userResolvedPattern);
    }
  } catch (err) {
    setStatus('error', 'Analysis failed', err.message);
  } finally {
    els.analyzeBtn.disabled = false;
    els.analyzeBtn.textContent = originalLabel;
  }
<<<<<<< Updated upstream
=======

  function handleSSEEvent(name, payload) {
    if (name === 'structural') {
      state.sessionRanAnalyze = true;
      stablePatternCount = (payload.detectedPatterns || []).length;
      const sourceText = payload.sourceText || code;
      if (payload.sourceText) els.codeInput.value = payload.sourceText;
      if (payload.sourceName) els.filenameInput.value = payload.sourceName;

      renderRun({
        sourceName: payload.sourceName || filename,
        sourceText,
        detectedPatterns: payload.detectedPatterns || [],
        detectedPatternCount: stablePatternCount,
        annotations: [],
        ranking: null,
        classUsageBindings: {},
        classUsageBindingSource: 'heuristic',
        suspectedStructures: [],
        noPatternsDetected: Boolean(payload.noPatternsDetected),
        aiAvailable: state.aiAvailable || false
      });

      const aiMsg = state.aiAvailable
        ? `${stablePatternCount} detected pattern(s) found — AI commentary in progress…`
        : `${stablePatternCount} detected pattern(s) found`;
      setStatus('busy', 'Structural done', aiMsg);

    } else if (name === 'ranking') {
      finalRanking = payload;
      if (state.currentRun) {
        state.currentRun.ranking = payload;
        finalSuspectedStructures = buildClientSuspectedStructures(
          state.currentRun.detectedPatterns || [], payload);
        state.currentRun.suspectedStructures = finalSuspectedStructures;
        renderSuspectedStructures(state.currentRun);
        renderPatternCards(
          state.currentRun.detectedPatterns || [],
          payload,
          null,
          state.currentRun.classUsageBindings || {},
          state.currentRun.classUsageBindingSource || 'heuristic'
        );
      }

    } else if (name === 'binding') {
      if (state.currentRun) {
        state.currentRun.classUsageBindings = payload.classUsageBindings || {};
        state.currentRun.classUsageBindingSource = 'heuristic';
        renderClassBindings(state.currentRun.classUsageBindings, 'heuristic');
        // Re-render source view with updated usage annotations
        const allAnns = buildAllAnnotations(state.currentRun);
        renderSourceView(state.currentRun.sourceText || '', allAnns);
      }

    } else if (name === 'ai_item') {
      if (Number.isInteger(payload.index)) {
        completedAiPatternIndexes.add(payload.index);
      } else {
        completedAiItems += 1;
      }
      let aiDoneCount = completedAiPatternIndexes.size || completedAiItems;
      if (stablePatternCount > 0) aiDoneCount = Math.min(aiDoneCount, stablePatternCount);
      const aiProgress = stablePatternCount > 0
        ? `${aiDoneCount}/${stablePatternCount} detected pattern(s) documented…`
        : 'Generating AI commentary…';
      setStatus('busy', 'AI in progress', aiProgress);

    } else if (name === 'complete') {
      pendingId = payload.pendingId || null;
      if (state.currentRun) {
        state.currentRun.annotations = payload.annotations || [];
        state.currentRun.suspectedStructures = payload.suspectedStructures || [];
        state.currentRun.ranking = payload.ranking || finalRanking;
        state.currentRun.aiAvailable = Boolean(payload.aiAvailable);
        state.currentRun.aiByPattern = payload.aiByPattern || [];
      }

      // Re-render with full annotations now that AI is done
      const run = state.currentRun;
      if (run) {
        const allAnns = buildAllAnnotations(run);
        renderSourceView(run.sourceText || '', allAnns);
        renderSuspectedStructures(run);
        renderPatternCards(
          run.detectedPatterns || [],
          run.ranking || null,
          null,
          run.classUsageBindings || {},
          run.classUsageBindingSource || 'heuristic'
        );
      }

      const patternCount = stablePatternCount || (run && run.detectedPatterns || []).length;
      const commentCount = (payload.annotations || []).length;
      const verdict = (payload.ranking || finalRanking)?.verdict || 'no_clear_pattern';
      setStatus('ok', 'Analysis ready (unsaved)',
        `${patternCount} detected pattern(s), ${commentCount} comment(s). Verdict: ${verdict}.`);

      if (pendingId && run) {
        promptAmbiguity(pendingId, payload.ranking || finalRanking, run.sourceName)
          .then(userResolvedPattern => {
            promptSaveRun(pendingId, run.sourceName, patternCount, commentCount, userResolvedPattern);
          });
      }

    } else if (name === 'error') {
      setStatus('error', 'Analysis failed', payload.error || 'Unknown error');
    }
  }
}

// Build combined annotations for source view (AI annotations + usage annotations).
function buildAllAnnotations(run) {
  const baseAnns = run.annotations || [];
  const usageAnns = synthesizeUsageAnnotations(
    run.classUsageBindings || {},
    run.detectedPatterns || [],
    run.suspectedStructures || [],
    (run.ranking && run.ranking.thresholds) || null
  );
  return [...baseAnns, ...usageAnns];
}

// Mirrors buildSuspectedStructures() from analysis.js so the frontend can
// render the structures section immediately after ranking arrives (before complete).
function buildClientSuspectedStructures(detectedPatterns, ranking) {
  return (ranking.winners || []).map(w => {
    const det = detectedPatterns.find(p =>
      p.patternId === w.patternId && p.className === w.className) || {};
    return {
      className:         w.className,
      patternId:         w.patternId,
      patternName:       det.patternName || w.patternId,
      patternFamily:     det.patternFamily || (w.patternId.split('.')[0] || ''),
      finalRank:         w.finalRank,
      implementationFit: w.implementationFit,
      evidence:          w.evidence,
      rivals:            (ranking.perClassRivals || {})[w.className] || []
    };
  });
>>>>>>> Stashed changes
}

function renderLegend(detectedPatterns) {
  if (!detectedPatterns.length) { els.patternLegend.innerHTML = ''; return; }
  const seen = new Set();
  const chips = [];
  detectedPatterns.forEach(p => {
    const key = p.patternName || 'Review';
    if (seen.has(key)) return;
    seen.add(key);
    const c = colorFor(key);
    chips.push(
      `<span class="legend-chip" style="background:${c.bg};border-color:${c.border};color:${c.text}">` +
      `<span class="legend-dot" style="background:${c.border}"></span>${escapeHtml(key)}</span>`
    );
  });
  els.patternLegend.innerHTML = chips.join('');
}

function renderSourceView(sourceText, annotations) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const annotationsByLine = new Map();
  annotations.forEach(a => {
    if (!a.line) return;
    if (!annotationsByLine.has(a.line)) annotationsByLine.set(a.line, []);
    annotationsByLine.get(a.line).push(a);
  });

  const out = [];
  const width = String(lines.length).length;
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const anns = annotationsByLine.get(lineNo) || [];
    const top = anns[0];
    let style = '';
    let dataAttrs = `data-line="${lineNo}"`;
    if (top) {
      const c = colorFor(patternFromAnnotation(top));
      style = `background:${c.bg};border-left:3px solid ${c.border};`;
      const ids = anns.map(a => a.id).join(' ');
      dataAttrs += ` data-comment-ids="${escapeHtml(ids)}"`;
    } else {
      style = 'border-left:3px solid transparent;';
    }
    const num = String(lineNo).padStart(width, ' ');
    out.push(
      `<span class="src-line${anns.length ? ' has-comment' : ''}" ${dataAttrs} style="${style}">` +
      `<span class="src-gutter">${num}</span>` +
      `<span class="src-code">${escapeHtml(line) || '​'}</span>` +
      `</span>`
    );
  });
  els.sourceView.innerHTML = out.join('');

  els.sourceView.querySelectorAll('.src-line.has-comment').forEach(el => {
    el.addEventListener('click', () => {
      const ids = (el.dataset.commentIds || '').split(/\s+/).filter(Boolean);
      if (ids.length) flashComment(ids[0]);
    });
  });
}

function renderComments(annotations) {
  if (!annotations.length) {
    els.commentsPane.innerHTML = '<div class="empty-state">No comments produced.</div>';
    return;
  }
  const sorted = annotations.slice().sort((a, b) => (a.line || 0) - (b.line || 0));
  const out = [];
  sorted.forEach(a => {
    const patternKey = patternFromAnnotation(a);
    const c = colorFor(patternKey);
    const titleParts = (a.title || '').split(' :: ');
    const head  = titleParts[0] || a.stage || 'Comment';
    const label = titleParts.slice(1).join(' :: ') || a.kind || '';
    out.push(
      `<article class="comment-card" id="${escapeHtml(a.id)}" data-line="${a.line || ''}" ` +
        `style="border-left:4px solid ${c.border};background:${c.bg}">` +
      `<header class="cc-head">` +
        `<span class="cc-pattern" style="color:${c.text}">${escapeHtml(head)}</span>` +
        (label ? `<span class="cc-label">${escapeHtml(label)}</span>` : '') +
        (a.line ? `<span class="cc-line">L${a.line}</span>` : '') +
      `</header>` +
      `<p class="cc-comment">${escapeHtml(a.comment)}</p>` +
      (a.excerpt ? `<pre class="cc-excerpt" style="border-color:${c.border}">${escapeHtml(a.excerpt)}</pre>` : '') +
      `</article>`
    );
  });
  els.commentsPane.innerHTML = out.join('');

  els.commentsPane.querySelectorAll('.comment-card').forEach(card => {
    card.addEventListener('click', () => {
      const line = Number(card.dataset.line);
      if (line) scrollToSourceLine(line);
    });
  });
}

function flashComment(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 1200);
}

function scrollToSourceLine(line) {
  const el = els.sourceView.querySelector(`.src-line[data-line="${line}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}

function synthesizeUsageAnnotations(bindings, detectedPatterns) {
  const classToPatternName = new Map();
  (detectedPatterns || []).forEach(p => {
    if (p && p.className && p.patternName) classToPatternName.set(p.className, p.patternName);
  });
  const KIND_HUMAN = {
    declaration:    'declaration',
    member_call:    'member call',
    arrow_call:     'arrow call',
    qualified_call: 'qualified call',
    make_unique:    'make_unique',
    make_shared:    'make_shared',
    new_ctor:       'new'
  };
  const out = [];
  let id = 1;
  Object.entries(bindings || {}).forEach(([cls, rows]) => {
    const patternName = classToPatternName.get(cls) || 'Review';
    (rows || []).forEach(u => {
      const target = u.varName
        ? `${u.varName}${u.methodName ? '.' + u.methodName : ''}`
        : (u.methodName ? `${cls}::${u.methodName}` : cls);
      out.push({
        id:       `usage-${id++}`,
        order:    1000 + id,
        stage:    patternName,
        severity: 'low',
        line:     u.line,
        lineEnd:  u.line,
        title:    `${patternName} :: ${KIND_HUMAN[u.kind] || u.kind}`,
        comment:  `${target} — bound to ${cls}` + (u.evidence ? ` (${u.evidence})` : ''),
        excerpt:  u.snippet || '',
        kind:     'tagged_usage'
      });
    });
  });
  return out;
}

function renderRun(run) {
  state.currentRun = run;
  els.resultsPanel.hidden = false;
<<<<<<< Updated upstream
  const patternCount = (run.detectedPatterns || []).length;
  const baseAnns = run.annotations || [];
  const usageAnns = synthesizeUsageAnnotations(run.classUsageBindings || {}, run.detectedPatterns || []);
  const allAnns = [...baseAnns, ...usageAnns];
=======
  const patternCount = Number.isFinite(run.detectedPatternCount)
    ? run.detectedPatternCount
    : (run.detectedPatterns || []).length;
  const allAnns = buildAllAnnotations(run);
>>>>>>> Stashed changes
  const annCount = allAnns.length;
  els.resultsSummary.textContent =
    `${escapeHtml(run.sourceName || 'snippet.cpp')} • ${patternCount} pattern(s) • ${annCount} comment(s)`;
  renderLegend(run.detectedPatterns || []);
  renderSourceView(run.sourceText || '', allAnns);
  renderComments(allAnns);
  renderPatternCards(
    run.detectedPatterns || [],
    run.ranking || null,
    run.userResolvedPattern || null,
    run.classUsageBindings || {},
    run.classUsageBindingSource || 'heuristic'
  );
  renderClassBindings(run.classUsageBindings || {}, run.classUsageBindingSource || 'heuristic');
}

function flashSourceLine(line) {
  if (!line) return;
  const el = els.sourceView.querySelector(`[data-line="${line}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('source-line-flash');
  setTimeout(() => el.classList.remove('source-line-flash'), 1200);
}

function renderClassBindings(bindings, sourceTagRaw) {
  if (!els.classBindings) return;
  els.classBindings.innerHTML = '';
  const classNames = Object.keys(bindings || {});
  if (!classNames.length) return;
  const sourceTag = sourceTagRaw === 'microservice' ? 'microservice-bound' : 'heuristic';
  const totalRows = classNames.reduce((acc, c) => acc + (bindings[c] || []).length, 0);

  const wrap = document.createElement('details');
  wrap.className = 'class-bindings-wrap';
  // Collapsed by default; user clicks summary to expand.
  const summary = document.createElement('summary');
  summary.className = 'class-bindings-summary';
  summary.innerHTML =
    `<span class="caret" aria-hidden="true">▶</span>` +
    `<span class="class-bindings-title">Class usage bindings</span>` +
    `<span class="class-bindings-count">${classNames.length} class(es) • ${totalRows} usage(s)</span>` +
    `<span class="usage-source">[${sourceTag}]</span>`;
  wrap.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'class-bindings-body';

  classNames.forEach(cls => {
    const rows = bindings[cls] || [];
    if (!rows.length) return;
    const card = document.createElement('div');
    card.className = 'class-binding-card';
    card.innerHTML = `<div class="class-binding-head"><code>${escapeHtml(cls)}</code> <span class="row-line">${rows.length} usage(s)</span></div>`;
    const list = document.createElement('div');
    list.className = 'pattern-row-list';
    rows.forEach(u => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'pattern-row';
      const label = USAGE_KIND_LABEL[u.kind] || u.kind;
      const target = u.varName
        ? `<code>${escapeHtml(u.varName)}${u.methodName ? '.' + escapeHtml(u.methodName) : ''}</code>`
        : (u.methodName ? `<code>${escapeHtml(u.boundClass)}::${escapeHtml(u.methodName)}</code>` : `<code>${escapeHtml(u.boundClass)}</code>`);
      row.innerHTML =
        `<span class="row-kind">${escapeHtml(label)}</span>` +
        target +
        `<span class="row-line">line ${u.line || '?'}</span>`;
      row.addEventListener('click', () => flashSourceLine(u.line));
      list.appendChild(row);
    });
    card.appendChild(list);
    body.appendChild(card);
  });

  wrap.appendChild(body);
  els.classBindings.appendChild(wrap);
}

const USAGE_KIND_LABEL = {
  declaration:    'declared',
  member_call:    '. call',
  arrow_call:     '-> call',
  qualified_call: ':: static',
  make_unique:    'make_unique',
  make_shared:    'make_shared',
  new_ctor:       'new'
};

function renderPatternCards(detectedPatterns, ranking, userResolvedPattern, classUsageBindings, classUsageBindingSource) {
  if (!els.patternCards) return;
  els.patternCards.innerHTML = '';
  if (!detectedPatterns.length) return;

  const ranksById = new Map();
  (ranking?.ranks || []).forEach(r => ranksById.set(r.patternId, r));

  detectedPatterns.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'pattern-card';
    if (userResolvedPattern && userResolvedPattern === p.patternId) {
      card.dataset.resolved = 'true';
    }
    const colour = colorFor(p.patternName || 'default');
    const rank = ranksById.get(p.patternId);
    const declarationLine = (p.documentationTargets || [])[0]?.line || null;

    const head = document.createElement('div');
    head.className = 'pattern-card-head';
    head.innerHTML =
      `<span class="pattern-badge" style="border-color:${colour.border};background:${colour.bg};color:${colour.text}">${escapeHtml(p.patternName || p.patternId)}</span>` +
      `<span class="pattern-card-class"><code>${escapeHtml(p.className || 'unknown')}</code></span>` +
      (declarationLine ? `<span class="pattern-card-line">declared at line ${declarationLine}</span>` : '');
    card.appendChild(head);

    if (rank) {
      const rb = document.createElement('div');
      rb.className = 'rank-bar';
      rb.dataset.verdict = ranking.verdict || 'no_clear_pattern';
      const pct = Math.round((rank.finalRank || 0) * 100);
      rb.innerHTML =
        `<span>rank</span>` +
        `<div class="rank-bar-track"><div class="rank-bar-fill" style="width:${pct}%"></div></div>` +
        `<span>${pct}%</span>` +
        (rank.hasImplementationTemplate
          ? `<span title="implementation_fit">impl ${(rank.implementationFit*100|0)}%</span>`
          : `<span title="no implementation_template authored yet">class-only</span>`);
      card.appendChild(rb);
    }

    const fns = p.unitTestTargets || [];
    if (fns.length) {
      const sect = document.createElement('div');
      sect.className = 'pattern-card-section';
      sect.innerHTML = `<h4>Functions</h4>`;
      const list = document.createElement('div');
      list.className = 'pattern-row-list';
      fns.forEach(t => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'pattern-row';
        row.innerHTML =
          `<code>${escapeHtml(t.function_name || '?')}</code>` +
          `<span class="row-kind">${escapeHtml(t.branch_kind || 'fn')}</span>` +
          `<span class="row-line">line ${t.line || '?'}</span>`;
        row.addEventListener('click', () => flashSourceLine(t.line));
        list.appendChild(row);
      });
      sect.appendChild(list);
      card.appendChild(sect);
    }

    const docs = p.documentationTargets || [];
    if (docs.length) {
      const sect = document.createElement('div');
      sect.className = 'pattern-card-section';
      sect.innerHTML = `<h4>Anchors</h4>`;
      const list = document.createElement('div');
      list.className = 'pattern-row-list';
      docs.forEach(d => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'pattern-row';
        row.innerHTML =
          `<code>${escapeHtml(d.label || '?')}</code>` +
          `<span class="row-kind">${escapeHtml(d.lexeme || '')}</span>` +
          `<span class="row-line">line ${d.line || '?'}</span>`;
        row.addEventListener('click', () => flashSourceLine(d.line));
        list.appendChild(row);
      });
      sect.appendChild(list);
      card.appendChild(sect);
    }

    const usagesSect = document.createElement('div');
    usagesSect.className = 'pattern-card-section';
    usagesSect.innerHTML = `<h4>Where it's used</h4>`;
    const cs = rank && rank.evidence && rank.evidence.callsites || [];
    if (cs.length) {
      const list = document.createElement('div');
      list.className = 'pattern-row-list';
      cs.forEach(hit => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'pattern-row';
        row.innerHTML =
          `<code>${escapeHtml(hit.snippet || '')}</code>` +
          `<span class="row-line">line ${hit.line || '?'}</span>`;
        row.addEventListener('click', () => flashSourceLine(hit.line));
        list.appendChild(row);
      });
      usagesSect.appendChild(list);
    } else {
      const note = document.createElement('div');
      note.className = 'pattern-card-pending';
      note.textContent = rank && rank.hasImplementationTemplate
        ? 'No call-sites matched the implementation template in this source.'
        : 'Pending: implementation template not yet authored for this pattern.';
      usagesSect.appendChild(note);
    }
    card.appendChild(usagesSect);

    // Tagged usages (D24, heuristic-derived from backend classUsageBinder)
    const tagged = (classUsageBindings && classUsageBindings[p.className]) || [];
    const tagSect = document.createElement('div');
    tagSect.className = 'pattern-card-section';
    const sourceTag = classUsageBindingSource === 'microservice' ? 'microservice-bound' : 'heuristic';
    tagSect.innerHTML = `<h4>Tagged usages <span class="usage-source">[${sourceTag}]</span></h4>`;
    if (tagged.length) {
      const list = document.createElement('div');
      list.className = 'pattern-row-list';
      tagged.forEach(u => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'pattern-row';
        const label = USAGE_KIND_LABEL[u.kind] || u.kind;
        const target = u.varName
          ? `<code>${escapeHtml(u.varName)}${u.methodName ? '.' + escapeHtml(u.methodName) : ''}</code>`
          : (u.methodName ? `<code>${escapeHtml(u.boundClass)}::${escapeHtml(u.methodName)}</code>` : `<code>${escapeHtml(u.boundClass)}</code>`);
        const evidence = u.evidence ? `<span class="row-kind" title="${escapeHtml(u.evidence)}">${escapeHtml(u.evidence)}</span>` : '';
        row.innerHTML =
          `<span class="row-kind">${escapeHtml(label)}</span>` +
          target +
          evidence +
          `<span class="row-line">line ${u.line || '?'}</span>`;
        row.addEventListener('click', () => flashSourceLine(u.line));
        list.appendChild(row);
      });
      tagSect.appendChild(list);
    } else {
      const note = document.createElement('div');
      note.className = 'pattern-card-pending';
      note.textContent = `No tagged usages of ${p.className} found in this source.`;
      tagSect.appendChild(note);
    }
    card.appendChild(tagSect);

    els.patternCards.appendChild(card);
  });
}

function promptAmbiguity(pendingId, ranking, sourceName) {
  if (!ranking || ranking.verdict !== 'ambiguous' || !ranking.ambiguousCandidates?.length) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    els.ambiguityList.innerHTML = '';
    let chosen = null;
    const ranksById = new Map();
    (ranking.ranks || []).forEach(r => ranksById.set(r.patternId, r));

    ranking.ambiguousCandidates.forEach(pid => {
      const r = ranksById.get(pid) || { finalRank: 0, implementationFit: 0 };
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'ambiguity-option';
      opt.innerHTML =
        `<span class="opt-name">${escapeHtml(pid)}</span>` +
        `<span class="opt-rank">rank ${(r.finalRank*100|0)}% • impl ${(r.implementationFit*100|0)}%</span>`;
      opt.addEventListener('click', () => {
        els.ambiguityList.querySelectorAll('.ambiguity-option[aria-pressed="true"]').forEach(o => o.removeAttribute('aria-pressed'));
        opt.setAttribute('aria-pressed', 'true');
        chosen = pid;
        els.ambiguityConfirmBtn.disabled = false;
      });
      els.ambiguityList.appendChild(opt);
    });

    els.ambiguityDetail.textContent =
      `${sourceName}: top ${ranking.ambiguousCandidates.length} patterns scored within tolerance. You can keep reviewing the code while choosing; skip keeps all.`;
    els.ambiguityModal.hidden = false;
    els.ambiguityConfirmBtn.disabled = true;

    const cleanup = () => {
      els.ambiguityModal.hidden = true;
      els.ambiguityConfirmBtn.removeEventListener('click', onConfirm);
      els.ambiguitySkipBtn.removeEventListener('click', onSkip);
    };
    const onConfirm = () => { cleanup(); resolve(chosen); };
    const onSkip    = () => { cleanup(); resolve(null); };
    els.ambiguityConfirmBtn.addEventListener('click', onConfirm);
    els.ambiguitySkipBtn.addEventListener('click', onSkip);
  });
}

async function fetchReviewSchema(scope) {
  if (state.reviewSchemaCache[scope]) return state.reviewSchemaCache[scope];
  const data = await apiFetch(`/api/reviews/schema?scope=${encodeURIComponent(scope)}`);
  state.reviewSchemaCache[scope] = data;
  return data;
}

function renderReviewQuestions(container, questions) {
  container.innerHTML = '';
  questions.forEach(q => {
    const wrap = document.createElement('div');
    wrap.className = 'review-q';
    const label = document.createElement('label');
    label.className = 'review-q-prompt';
    label.textContent = q.prompt + (q.required ? ' *' : '');
    wrap.appendChild(label);

    if (q.type === 'rating') {
      const stars = document.createElement('div');
      stars.className = 'review-stars-picker';
      stars.dataset.qid = q.id;
      for (let i = 1; i <= q.max; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'star-btn';
        btn.dataset.value = String(i);
        btn.setAttribute('aria-label', `${i} of ${q.max}`);
        btn.textContent = '★';
        btn.addEventListener('click', () => {
          stars.dataset.value = String(i);
          stars.querySelectorAll('.star-btn').forEach(b => {
            b.classList.toggle('active', Number(b.dataset.value) <= i);
          });
        });
        stars.appendChild(btn);
      }
      wrap.appendChild(stars);
    } else if (q.type === 'text') {
      const ta = document.createElement('textarea');
      ta.className = 'review-textarea';
      ta.rows = 3;
      ta.maxLength = q.maxLength || 500;
      ta.dataset.qid = q.id;
      ta.placeholder = q.required ? 'Required' : 'Optional';
      wrap.appendChild(ta);
    } else if (q.type === 'choice') {
      const sel = document.createElement('select');
      sel.dataset.qid = q.id;
      sel.className = 'review-select';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = q.required ? '— select —' : '(skip)';
      sel.appendChild(blank);
      (q.options || []).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
      });
      wrap.appendChild(sel);
    }
    container.appendChild(wrap);
  });
}

function collectReviewAnswers(container) {
  const answers = {};
  container.querySelectorAll('[data-qid]').forEach(el => {
    const id = el.dataset.qid;
    if (el.classList.contains('review-stars-picker')) {
      if (el.dataset.value) answers[id] = Number(el.dataset.value);
    } else if (el.tagName === 'TEXTAREA') {
      const v = el.value.trim();
      if (v) answers[id] = v;
    } else if (el.tagName === 'SELECT') {
      if (el.value) answers[id] = el.value;
    }
  });
  return answers;
}

function openReviewModal(scope, analysisRunId, opts = {}) {
  return new Promise(async (resolve) => {
    if (!els.reviewModal) return resolve(false);
    let schema;
    try {
      schema = await fetchReviewSchema(scope);
    } catch (err) {
      // Schema unavailable — silently skip rather than block the user.
      return resolve(false);
    }
    if (!schema || !schema.questions || !schema.questions.length) return resolve(false);

    els.reviewIntro.textContent = opts.intro || 'A few quick questions:';
    els.reviewError.hidden = true;
    renderReviewQuestions(els.reviewQuestions, schema.questions);
    els.reviewModal.hidden = false;

    const cleanup = () => {
      els.reviewModal.hidden = true;
      els.reviewSubmitBtn.removeEventListener('click', onSubmit);
      els.reviewSkipBtn.removeEventListener('click', onSkip);
    };
    const onSkip = () => {
      if (scope === 'end-of-session') state.sessionReviewedEnd = true;
      cleanup();
      resolve(false);
    };
    const onSubmit = async () => {
      const answers = collectReviewAnswers(els.reviewQuestions);
      els.reviewSubmitBtn.disabled = true;
      try {
        await apiFetch('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({ scope, analysisRunId: analysisRunId || undefined, answers })
        });
        if (scope === 'end-of-session') state.sessionReviewedEnd = true;
        cleanup();
        resolve(true);
      } catch (err) {
        els.reviewError.textContent = err.message;
        els.reviewError.hidden = false;
      } finally {
        els.reviewSubmitBtn.disabled = false;
      }
    };
    els.reviewSubmitBtn.addEventListener('click', onSubmit);
    els.reviewSkipBtn.addEventListener('click', onSkip);
  });
}

els.form.addEventListener('submit', submitAnalysis);
els.loadSampleBtn.addEventListener('click', loadSample);
els.clearBtn.addEventListener('click', clearAll);
els.refreshBtn.addEventListener('click', loadRuns);
els.loginForm.addEventListener('submit', submitLogin);
els.logoutBtn.addEventListener('click', handleSignOut);
els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files[0];
  if (file) {
    els.filenameInput.value = file.name;
    setStatus('ok', 'File ready', `${file.name} selected.`);
  }
});

(async function init() {
  if (state.token && state.user && state.user.role === 'admin') {
    window.location.href = '/admin.html';
    return;
  }
  await loadHealth();
  startMicroservicePolling();
  if (state.token && state.user) {
    hideLogin();
    await loadRuns();
    await loadSample();
  } else {
    showLogin();
    loadTesterAccounts();
  }
})();
