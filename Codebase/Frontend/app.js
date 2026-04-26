const state = {
  currentRun: null,
  runs: [],
  editor: null,
  activeLine: null,
  highlightedLines: [],
  sourceBaseline: '',
  sourceDirty: false,
  sourceTemplateName: 'sample.cpp',
  pendingTemplate: null,
  pendingAfter: null,
  suppressEditorChange: false
};

const els = {
  serviceStatus: document.getElementById('service-status'),
  serviceDetail: document.getElementById('service-detail'),
  runMeta: document.getElementById('run-meta'),
  structureScore: document.getElementById('structure-score'),
  modernizationScore: document.getElementById('modernization-score'),
  findingCount: document.getElementById('finding-count'),
  structureBar: document.getElementById('structure-bar'),
  modernizationBar: document.getElementById('modernization-bar'),
  summaryText: document.getElementById('summary-text'),
  commentSummary: document.getElementById('comment-summary'),
  commentRail: document.getElementById('comment-rail'),
  pipelineList: document.getElementById('pipeline-list'),
  findingsList: document.getElementById('findings-list'),
  runList: document.getElementById('run-list'),
  codeStats: document.getElementById('code-stats'),
  sourceStatus: document.getElementById('source-status'),
  commentedCodeLink: document.getElementById('commented-code-link'),
  commentsOnlyLink: document.getElementById('comments-only-link'),
  form: document.getElementById('analysis-form'),
  codeInput: document.getElementById('code-input'),
  fileInput: document.getElementById('file-input'),
  filenameInput: document.getElementById('filename-input'),
  analyzeBtn: document.getElementById('analyze-btn'),
  loadSampleBtn: document.getElementById('load-sample-btn'),
  clearBtn: document.getElementById('clear-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  sourceModal: document.getElementById('source-modal'),
  sourceModalTitle: document.getElementById('source-modal-title'),
  sourceModalMessage: document.getElementById('source-modal-message'),
  sourceModalKeep: document.getElementById('source-modal-keep'),
  sourceModalOverwrite: document.getElementById('source-modal-overwrite')
};

function setStatus(kind, title, detail) {
  els.serviceStatus.textContent = title;
  els.serviceDetail.textContent = detail;
  els.serviceStatus.dataset.kind = kind;
}

function fmtDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function scoreText(value) {
  return typeof value === 'number' ? `${value}/100` : '--';
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setBar(el, value) {
  if (!el) return;
  el.style.width = `${Math.max(0, Math.min(100, value || 0))}%`;
}

function severityRank(severity) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function commentTone(severity) {
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function getEditorValue() {
  return state.editor ? state.editor.getValue() : (els.codeInput.value || '');
}

function setSourceStateLabel() {
  if (!els.sourceStatus) return;
  if (!getEditorValue().trim()) {
    els.sourceStatus.textContent = 'No source loaded';
    els.sourceStatus.dataset.kind = 'idle';
    return;
  }
  if (state.sourceDirty) {
    els.sourceStatus.textContent = 'Unsaved edits';
    els.sourceStatus.dataset.kind = 'dirty';
    return;
  }
  els.sourceStatus.textContent = `Loaded ${state.sourceTemplateName}`;
  els.sourceStatus.dataset.kind = 'clean';
}

function clearAnalysisHighlights() {
  if (!state.editor) return;
  state.highlightedLines.forEach(item => {
    state.editor.removeLineClass(item.line, 'background', item.className);
  });
  if (state.activeLine != null) {
    state.editor.removeLineClass(state.activeLine, 'background', 'cm-line-active');
    state.activeLine = null;
  }
  state.highlightedLines = [];
}

function applyAnalysisHighlights(annotations = []) {
  if (!state.editor) return;
  clearAnalysisHighlights();

  const lines = new Map();
  annotations.forEach(annotation => {
    if (!annotation.line) return;
    const current = lines.get(annotation.line);
    if (!current || severityRank(annotation.severity) > severityRank(current.severity)) {
      lines.set(annotation.line, annotation);
    }
  });

  lines.forEach((annotation, lineNumber) => {
    const className = `cm-line-${commentTone(annotation.severity)}`;
    state.editor.addLineClass(lineNumber - 1, 'background', className);
    state.highlightedLines.push({ line: lineNumber - 1, className });
  });
}

function renderCommentRail(annotations = []) {
  if (!annotations.length) {
    els.commentRail.innerHTML = '<div class="empty-state">No comments were generated for this run.</div>';
    return;
  }

  els.commentRail.innerHTML = '';
  const fragment = document.createDocumentFragment();
  annotations.forEach(annotation => {
    const el = document.createElement('article');
    el.className = `comment-card ${commentTone(annotation.severity)}`;
    el.tabIndex = 0;
    el.dataset.line = annotation.line || '';
    el.innerHTML = `
      <div class="comment-head">
        <div>
          <strong>${escapeHtml(annotation.title)}</strong>
          <p>${escapeHtml(annotation.stage)}${annotation.line ? ` • L${annotation.line}` : ''}</p>
        </div>
        <span class="pill ${commentTone(annotation.severity)}">${escapeHtml(annotation.severity)}</span>
      </div>
      <p class="comment-body">${escapeHtml(annotation.comment || '')}</p>
      ${annotation.excerpt ? `<pre class="comment-excerpt">${escapeHtml(annotation.excerpt)}</pre>` : ''}
      <button class="ghost-btn comment-jump" type="button">Jump to line ${annotation.line || 'n/a'}</button>
    `;
    el.querySelector('button').addEventListener('click', () => scrollToLine(Number(annotation.line)));
    el.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        scrollToLine(Number(annotation.line));
      }
    });
    el.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      scrollToLine(Number(annotation.line));
    });
    fragment.appendChild(el);
  });
  els.commentRail.appendChild(fragment);
}

function renderThreadList(annotations = []) {
  els.findingsList.innerHTML = '';
  if (!annotations.length) {
    els.findingsList.innerHTML = '<div class="empty-state">No comments were produced for this source.</div>';
    return;
  }

  annotations.forEach(annotation => {
    const el = document.createElement('article');
    el.className = 'comment-thread';
    el.innerHTML = `
      <div class="comment-head">
        <div>
          <h3>${escapeHtml(annotation.title)}</h3>
          <p>${escapeHtml(annotation.stage || annotation.kind || 'Comment')}${annotation.line ? ` • L${annotation.line}` : ''}</p>
        </div>
        <span class="pill ${commentTone(annotation.severity)}">${escapeHtml(annotation.severity)}</span>
      </div>
      ${annotation.line ? `<div class="line">Line ${annotation.line}</div>` : ''}
      ${annotation.kind ? `<div class="line">${escapeHtml(annotation.kind)}</div>` : ''}
      <p>${escapeHtml(annotation.comment || '')}</p>
    `;
    el.addEventListener('click', () => scrollToLine(Number(annotation.line)));
    els.findingsList.appendChild(el);
  });
}

function scrollToLine(line) {
  if (!state.editor || !line) return;
  const nextLine = line - 1;
  if (state.activeLine != null) {
    state.editor.removeLineClass(state.activeLine, 'background', 'cm-line-active');
  }
  state.editor.addLineClass(nextLine, 'background', 'cm-line-active');
  state.activeLine = nextLine;
  state.editor.scrollIntoView({ line: nextLine, ch: 0 }, 120);
}

function renderPipeline(pipeline = []) {
  if (!pipeline.length) {
    els.pipelineList.innerHTML = '<div class="empty-state">Run analysis to populate the pipeline view.</div>';
    return;
  }

  els.pipelineList.innerHTML = '';
  pipeline.forEach(step => {
    const el = document.createElement('article');
    el.className = 'pipeline-step';
    el.innerHTML = `
      <div class="pipeline-step-head">
        <strong>${escapeHtml(step.title)}</strong>
        <span class="step-state ${escapeHtml(step.state)}">${escapeHtml(step.state)}</span>
      </div>
      <p>${escapeHtml(step.summary)}</p>
      <p>${escapeHtml(step.detail)}</p>
    `;
    els.pipelineList.appendChild(el);
  });
}

function renderRun(run) {
  const el = document.createElement('div');
  el.className = 'run-item';
  el.innerHTML = `
    <div>
      <strong>${escapeHtml(run.source_name)}</strong>
      <p>${fmtDate(run.created_at)}</p>
    </div>
    <div class="run-actions">
      <span class="pill ${run.structure_score >= 75 ? 'low' : 'medium'}">${run.structure_score}/100</span>
      <span class="pill ${run.modernization_score >= 75 ? 'low' : 'medium'}">${run.modernization_score}/100</span>
      <button class="ghost-btn" type="button">Open</button>
    </div>
  `;
  el.querySelector('button').addEventListener('click', () => loadRun(run.id));
  return el;
}

function setExportLinks(runId) {
  const disabled = !runId;
  [
    { el: els.commentedCodeLink, href: disabled ? '#' : `/api/runs/${runId}/export?format=commented-code` },
    { el: els.commentsOnlyLink, href: disabled ? '#' : `/api/runs/${runId}/export?format=comments-only` }
  ].forEach(({ el, href }) => {
    if (!el) return;
    el.href = href;
    if (disabled) {
      el.setAttribute('aria-disabled', 'true');
    } else {
      el.removeAttribute('aria-disabled');
    }
  });
}

function setSourceValue(text, filename, options = {}) {
  const { markClean = true } = options;
  const nextText = text || '';
  state.suppressEditorChange = true;
  if (state.editor) {
    state.editor.setValue(nextText);
  } else {
    els.codeInput.value = nextText;
  }
  state.suppressEditorChange = false;
  if (filename) {
    els.filenameInput.value = filename;
    state.sourceTemplateName = filename;
  }
  state.sourceBaseline = nextText;
  state.sourceDirty = !markClean ? true : false;
  setSourceStateLabel();
}

function syncSourceDirtyState() {
  state.sourceDirty = getEditorValue() !== state.sourceBaseline;
  setSourceStateLabel();
  if (state.sourceDirty) {
    els.commentSummary.textContent = 'Source edited. Run analysis again to refresh comments.';
    clearAnalysisHighlights();
  } else if (state.currentRun) {
    els.commentSummary.textContent = `${(state.currentRun.annotations || []).length} comment thread(s) anchored to the source.`;
    applyAnalysisHighlights(state.currentRun.annotations || []);
  }
}

function openSourceModal(sample, afterConfirm = null) {
  state.pendingTemplate = sample;
  state.pendingAfter = afterConfirm;
  if (!els.sourceModal) return;
  els.sourceModalTitle.textContent = 'Replace current source?';
  els.sourceModalMessage.textContent = `You have unsaved edits in ${els.filenameInput.value || 'the editor'}. Overwrite them with ${sample.filename || 'the template'}?`;
  els.sourceModal.showModal();
}

function closeSourceModal() {
  state.pendingTemplate = null;
  state.pendingAfter = null;
  if (els.sourceModal && els.sourceModal.open) {
    els.sourceModal.close();
  }
}

function formatHealthMessage(health) {
  const latest = health.latestRun
    ? `Latest: ${health.latestRun.source_name} (${health.latestRun.structure_score}/${health.latestRun.modernization_score})`
    : 'No stored runs yet.';
  return `${health.service} • ${health.totalRuns} stored run(s) • ${latest}`;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function loadHealth() {
  try {
    const health = await apiFetch('/api/health');
    setStatus('ok', health.status.toUpperCase(), formatHealthMessage(health));
  } catch (err) {
    setStatus('error', 'API offline', err.message);
  }
}

async function loadRuns() {
  try {
    const data = await apiFetch('/api/runs?limit=12');
    renderRuns(data.runs || []);
  } catch (err) {
    els.runList.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderRuns(runs) {
  state.runs = runs;
  els.runList.innerHTML = '';
  if (!runs.length) {
    els.runList.innerHTML = '<div class="empty-state">No runs stored yet.</div>';
    return;
  }
  runs.forEach(run => els.runList.appendChild(renderRun(run)));
}

async function loadSample() {
  const sample = await apiFetch('/api/sample');
  if (state.sourceDirty && getEditorValue().trim()) {
    openSourceModal(sample);
    return;
  }
  els.fileInput.value = '';
  setSourceValue(sample.code || '', sample.filename || 'sample.cpp', { markClean: true });
}

async function loadRun(id) {
  const data = await apiFetch(`/api/runs/${id}`);
  const sourceTemplate = {
    filename: data.sourceName || 'snippet.cpp',
    code: data.sourceText || ''
  };

  const applyRun = () => {
    setSourceValue(sourceTemplate.code, sourceTemplate.filename, { markClean: true });
    renderCurrentRun({
      runId: data.id,
      sourceName: data.sourceName,
      createdAt: data.createdAt,
      sourceText: data.sourceText,
      ...data.analysis
    });
  };

  if (state.sourceDirty && getEditorValue().trim()) {
    openSourceModal(sourceTemplate, applyRun);
    return;
  }

  applyRun();
}

function renderCurrentRun(run) {
  state.currentRun = run;
  const annotations = Array.isArray(run.annotations) ? run.annotations : [];

  els.runMeta.textContent = `${run.sourceName} • ${fmtDate(run.createdAt || run.created_at || new Date().toISOString())}`;
  els.structureScore.textContent = scoreText(run.structureScore);
  els.modernizationScore.textContent = scoreText(run.modernizationScore);
  els.findingCount.textContent = String(run.commentCount ?? annotations.length ?? 0);
  els.summaryText.textContent = run.summary;
  els.commentSummary.textContent = annotations.length
    ? `${annotations.length} comment thread(s) anchored to the source.`
    : 'No comment threads were produced for this run.';
  els.codeStats.textContent = `${run.lineCount} lines • ${run.charCount} chars • ${run.classCount} class(es) • ${run.commentCount ?? annotations.length ?? 0} comment(s)`;
  setBar(els.structureBar, run.structureScore);
  setBar(els.modernizationBar, run.modernizationScore);
  setExportLinks(run.runId);
  applyAnalysisHighlights(annotations);
  renderPipeline(run.pipeline);
  renderCommentRail(annotations);
  renderThreadList(annotations);
}

async function submitAnalysis(event) {
  event.preventDefault();
  const code = getEditorValue().trim();
  const file = els.fileInput.files[0];
  const filename = els.filenameInput.value.trim() || 'snippet.cpp';

  if (!code && !file) {
    setStatus('error', 'No input', 'Paste code or upload a file first.');
    return;
  }

  els.analyzeBtn.disabled = true;
  els.analyzeBtn.textContent = 'Running...';

  try {
    let payload;
    if (file) {
      payload = new FormData();
      payload.append('file', file);
      payload.append('filename', filename);
    } else {
      payload = JSON.stringify({ code, filename });
    }

    const run = await apiFetch('/api/analyze', {
      method: 'POST',
      body: payload,
      headers: payload instanceof FormData ? undefined : {}
    });

    setSourceValue(run.sourceText || code, run.sourceName || filename, { markClean: true });
    renderCurrentRun({
      runId: run.runId,
      sourceName: run.sourceName,
      sourceText: run.sourceText,
      ...run
    });
    setStatus('ok', 'Analysis complete', `${run.commentCount ?? run.annotations?.length ?? 0} comment(s) written to ${run.artifactPath}`);
    await loadRuns();
  } catch (err) {
    setStatus('error', 'Analysis failed', err.message);
  } finally {
    els.analyzeBtn.disabled = false;
    els.analyzeBtn.textContent = 'Run analysis';
  }
}

function clearForm() {
  setSourceValue('', 'snippet.cpp', { markClean: true });
  els.fileInput.value = '';
  els.filenameInput.value = 'snippet.cpp';
  state.currentRun = null;
  state.pendingTemplate = null;
  els.runMeta.textContent = 'No run yet';
  els.structureScore.textContent = '--';
  els.modernizationScore.textContent = '--';
  els.findingCount.textContent = '--';
  els.summaryText.textContent = 'Run analysis to populate this panel.';
  els.commentSummary.textContent = 'Run analysis to see inline comments.';
  els.commentRail.innerHTML = '<div class="empty-state">Comments will appear here.</div>';
  els.pipelineList.innerHTML = '<div class="empty-state">Run analysis to populate the pipeline view.</div>';
  els.findingsList.innerHTML = '<div class="empty-state">No comments yet.</div>';
  els.codeStats.textContent = '0 lines';
  setBar(els.structureBar, 0);
  setBar(els.modernizationBar, 0);
  setExportLinks(null);
  clearAnalysisHighlights();
  setSourceStateLabel();
}

function applyPendingTemplate() {
  if (!state.pendingTemplate) return;
  const sample = state.pendingTemplate;
  const afterConfirm = state.pendingAfter;
  state.pendingTemplate = null;
  state.pendingAfter = null;
  els.fileInput.value = '';
  setSourceValue(sample.code || '', sample.filename || 'sample.cpp', { markClean: true });
  setStatus('ok', 'Template loaded', `${sample.filename || 'sample.cpp'} replaced the current source.`);
  closeSourceModal();
  if (typeof afterConfirm === 'function') {
    afterConfirm();
  }
}

function initializeEditor() {
  if (!window.CodeMirror) {
    setStatus('error', 'Editor unavailable', 'CodeMirror failed to load.');
    return;
  }

  state.editor = CodeMirror.fromTextArea(els.codeInput, {
    mode: 'text/x-c++src',
    theme: 'neo',
    lineNumbers: true,
    lineWrapping: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    viewportMargin: Infinity,
    tabSize: 2,
    indentUnit: 2
  });
  state.editor.setSize('100%', '100%');
  state.editor.refresh();

  state.editor.on('change', () => {
    if (state.suppressEditorChange) return;
    syncSourceDirtyState();
  });

  state.editor.on('cursorActivity', () => {
    if (!state.sourceDirty && state.currentRun) {
      els.commentSummary.textContent = `${(state.currentRun.annotations || []).length} comment thread(s) anchored to the source.`;
    }
  });
}

els.form.addEventListener('submit', submitAnalysis);
els.loadSampleBtn.addEventListener('click', async () => {
  try {
    await loadSample();
    if (!state.pendingTemplate) {
      setStatus('ok', 'Sample loaded', 'Sample code was loaded into the editor.');
    }
  } catch (err) {
    setStatus('error', 'Sample failed', err.message);
  }
});

els.clearBtn.addEventListener('click', clearForm);
els.refreshBtn.addEventListener('click', loadRuns);

els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files[0];
  if (file) {
    els.filenameInput.value = file.name;
    setStatus('ok', 'File ready', `${file.name} selected for analysis.`);
  }
});

if (els.sourceModalKeep) {
  els.sourceModalKeep.addEventListener('click', () => {
    closeSourceModal();
    setStatus('ok', 'Kept current source', 'The existing edits were preserved.');
  });
}

if (els.sourceModalOverwrite) {
  els.sourceModalOverwrite.addEventListener('click', applyPendingTemplate);
}

if (els.sourceModal) {
  els.sourceModal.addEventListener('cancel', () => {
    state.pendingTemplate = null;
    state.pendingAfter = null;
    syncSourceDirtyState();
  });
}

async function init() {
  initializeEditor();
  await Promise.all([loadHealth(), loadRuns()]);
  try {
    await loadSample();
  } catch {
    // Keep the editor empty if the sample cannot be loaded.
  }
  syncSourceDirtyState();
}

init();

