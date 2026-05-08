import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitAnalysis, fetchSample } from '../../api/client';
import { consumeStudioPrefill } from '../../logic/studioPrefill';
import { logFrontendEvent } from '../../logic/frontendLog';
import { AnalysisRun } from '../../types/api';
import { IconUpload, IconPlay, IconCode, IconLayers, IconClipboard } from '../icons/Icons';

interface AnalysisFormProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  beforeSubmit?: (dispatch: () => void) => void;
  aside?: React.ReactNode;
}

interface FileSlot {
  id: string;
  name: string;
  text: string;
}

// Hard ceiling — must match backend payloadValidator max(5).
const MAX_FILES_HARD_CAP = 5;
const MAX_TOKENS_PER_FILE = 500;
const ACCEPTED_EXT = '.cpp,.cc,.cxx,.h,.hpp';

function countTokens(code: string): number {
  return code.trim().split(/\s+/).filter(Boolean).length;
}

function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AnalysisForm({ onAnalysisComplete, beforeSubmit, aside }: AnalysisFormProps) {
  const { sourceText, filename, setSourceText, setFilename, setStatus,
    setCurrentRun, setSessionRanAnalyze, maxFilesPerSubmission,
    submissionFiles, setSubmissionFiles,
    programStdin, setProgramStdin, currentRun } = useAppStore();
  const MAX_FILES = Math.min(MAX_FILES_HARD_CAP, Math.max(1, maxFilesPerSubmission || 3));

  // Slots are persisted in the store as `submissionFiles` so they survive
  // unmount/remount of this form (e.g. after running an analysis the form
  // unmounts; on return the user's other files were being lost). On first
  // mount we hydrate from the store, falling back to a single seed slot
  // synthesized from the legacy single-file store fields.
  const [slots, setSlots] = useState<FileSlot[]>(() => {
    // Marketing /learn lessons can stash a sample in sessionStorage and
    // navigate here. Consume it before falling back to existing state so
    // the user lands with the lesson's sample already loaded.
    const prefill = consumeStudioPrefill();
    if (prefill) {
      return [{ id: newSlotId(), name: prefill.name, text: prefill.code }];
    }
    if (submissionFiles && submissionFiles.length > 0) return submissionFiles;
    return [{ id: newSlotId(), name: filename || 'snippet.cpp', text: sourceText || '' }];
  });
  const [activeSlotId, setActiveSlotId] = useState<string>(() => slots[0]?.id || '');

  // Mirror local slot state into the store on every change so the next mount
  // (after running analysis or tabbing away) sees the full file set instead
  // of a single seeded slot. Discard via Clear/resetSession explicitly empties.
  useEffect(() => {
    setSubmissionFiles(slots);
  }, [slots, setSubmissionFiles]);
  const [busy, setBusy] = useState(false);

  const activeSlot = slots.find(s => s.id === activeSlotId) || slots[0];
  const filledCount = slots.filter(s => s.text.trim()).length;

  // Derive result preview values from currentRun
  const topPattern = currentRun?.ranking?.topPattern ?? null;
  const patternCount = currentRun?.detectedPatterns?.length ?? null;
  const firstAnnotation = currentRun?.annotations?.[0]?.title ?? currentRun?.annotations?.[0]?.comment ?? null;

  async function dispatchAnalyze(payloadFiles: FileSlot[]): Promise<void> {
    setBusy(true);
    setStatus({ kind: 'busy', title: 'Running analysis', detail: 'Spawning microservice...' });
    logFrontendEvent('frontend.run_dispatch', `files=${payloadFiles.length}`);
    try {
      // The backend accepts either a JSON {files: [...]} body for paste-only
      // submissions or multipart/form-data with field name `files` repeated
      // for actual file uploads. We use JSON here because the slots already
      // carry the text contents in memory.
      const body = JSON.stringify({
        files: payloadFiles.map(s => ({ name: s.name || 'snippet.cpp', code: s.text })),
        // Legacy single-file shape so older backends fall through cleanly.
        filename: payloadFiles[0]?.name || 'snippet.cpp',
        code:     payloadFiles[0]?.text || ''
      });
      const run = await submitAnalysis(body);
      setSessionRanAnalyze(true);
      // Mirror the first file into the legacy single-file store fields so
      // components that still read currentRun.sourceText keep working until
      // they migrate to currentRun.files[].
      const primary = run.files?.[0];
      if (primary?.sourceText) setSourceText(primary.sourceText);
      else if (run.sourceText) setSourceText(run.sourceText);
      if (primary?.name) setFilename(primary.name);
      else if (run.sourceName) setFilename(run.sourceName);
      setCurrentRun(run);
      const detectedCount = (run.detectedPatterns || []).length;
      const commentCount = (run.annotations || []).length;
      const verdict = run.ranking?.verdict || 'no_clear_pattern';
      setStatus({
        kind: 'ok',
        title: 'Analysis ready (unsaved)',
        detail: `${detectedCount} pattern(s), ${commentCount} comment(s), ${payloadFiles.length} file(s). Verdict: ${verdict}.`
      });
      onAnalysisComplete(run);
      logFrontendEvent('frontend.run_complete', `patterns=${detectedCount} comments=${commentCount}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed.';
      setStatus({ kind: 'error', title: 'Analysis failed', detail: msg });
      logFrontendEvent('frontend.run_failed', msg.slice(0, 200));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = slots.filter(s => s.text.trim().length > 0);
    if (filled.length === 0) {
      setStatus({ kind: 'error', title: 'No input', detail: 'Paste code or load a file in at least one slot.' });
      return;
    }
    const dispatch = () => { void dispatchAnalyze(filled); };
    if (beforeSubmit) beforeSubmit(dispatch);
    else dispatch();
  }

  async function onLoadSample() {
    try {
      const sample = await fetchSample();
      // Drop the sample into the first slot.
      setSlots(prev => {
        const next = [...prev];
        next[0] = { ...next[0], name: sample.filename || 'sample.cpp', text: sample.code || '' };
        return next;
      });
      setSourceText(sample.code || '');
      setFilename(sample.filename || 'sample.cpp');
      setStatus({ kind: 'ok', title: 'Sample loaded', detail: `${sample.filename} placed in slot 1.` });
    } catch (err) {
      setStatus({ kind: 'error', title: 'Sample failed', detail: err instanceof Error ? err.message : 'unknown' });
    }
  }

  function onClear() {
    const fresh = { id: newSlotId(), name: 'snippet.cpp', text: '' };
    setSlots([fresh]);
    setActiveSlotId(fresh.id);
    setSourceText('');
    setFilename('snippet.cpp');
    setCurrentRun(null);
    setSubmissionFiles([fresh]);
    setStatus({ kind: 'idle', title: 'Cleared', detail: 'Ready for new input.' });
  }

  function addSlot() {
    if (slots.length >= MAX_FILES) {
      setStatus({ kind: 'error', title: 'File cap', detail: `At most ${MAX_FILES} files per submission.` });
      return;
    }
    const id = newSlotId();
    setSlots(prev => [...prev, { id, name: `file-${prev.length + 1}.cpp`, text: '' }]);
    setActiveSlotId(id);
  }

  function removeSlot(id: string) {
    setSlots(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(s => s.id !== id);
      // If we removed the active tab, select its left neighbour (or the new
      // first tab) so the editor stays mounted with a real slot behind it.
      if (id === activeSlotId) {
        const removedIdx = prev.findIndex(s => s.id === id);
        const newActive = next[Math.max(0, removedIdx - 1)];
        if (newActive) setActiveSlotId(newActive.id);
      }
      return next;
    });
  }

  function patchSlot(id: string, patch: Partial<FileSlot>) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    // Keep the legacy single-file store in sync when slot 1 changes so the
    // "Source code" view that still reads sourceText doesn't go stale.
    const idx = slots.findIndex(s => s.id === id);
    if (idx === 0 && patch.text !== undefined) setSourceText(patch.text);
    if (idx === 0 && patch.name !== undefined) setFilename(patch.name);
  }

  function onFileInput(id: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    file.text().then(txt => patchSlot(id, { name: file.name, text: txt })).catch(() => {});
  }

  return (
    <form id="analysis-form" className="analysis-form" onSubmit={onSubmit}>
      <div className="studio-workspace">

        {/* Workspace heading */}
        <div className="studio-workspace__head">
          <div className="studio-workspace__icon" aria-hidden="true">
            &lt;/&gt;
          </div>
          <div className="studio-workspace__title-group">
            <h2 className="studio-workspace__title">Add your C++ code</h2>
            <p className="studio-workspace__sub">
              Upload or paste up to {MAX_FILES} .cpp files for pattern analysis.
            </p>
          </div>
        </div>

        {/* File tabs — only shown when multi-file in use */}
        <div className="file-tabs" role="tablist" aria-label="Submission files">
          {slots.map((slot) => {
            const isActive = slot.id === activeSlotId;
            return (
              <div
                key={slot.id}
                role="tab"
                aria-selected={isActive}
                className={`file-tab ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveSlotId(slot.id)}
              >
                <span className="file-tab-name" title={slot.name}>{slot.name || 'untitled.cpp'}</span>
                {slots.length > 1 && (
                  <button
                    type="button"
                    className="file-tab-close"
                    aria-label={`Close ${slot.name}`}
                    onClick={(e) => { e.stopPropagation(); removeSlot(slot.id); }}
                  >×</button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="file-tab-add"
            onClick={addSlot}
            disabled={slots.length >= MAX_FILES}
            aria-label="Add file"
            title={slots.length >= MAX_FILES ? `Cap is ${MAX_FILES} files` : 'Add another file'}
          >+</button>
        </div>

        {/* File upload limit hint */}
        <p className="studio-file-limit-hint">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
          You can upload up to <strong>{MAX_FILES}</strong> .cpp files per submission.
        </p>

        {/* Active file pane */}
        {activeSlot && (
          <div className="file-tab-pane">

            {/* Filename + upload row */}
            <div className="studio-filename-section">
              <span className="studio-field-eyebrow">Filename (optional)</span>
              <div className="studio-filename-row">
                <input
                  type="text"
                  className="file-slot-name"
                  value={activeSlot.name}
                  maxLength={256}
                  onChange={e => patchSlot(activeSlot.id, { name: e.target.value })}
                  placeholder="e.g., all_patterns.cpp"
                  aria-label="Filename for this tab"
                />
                <label className="ghost-btn studio-upload-btn">
                  <IconUpload size={14} />
                  Upload file
                  <input
                    type="file"
                    className="studio-file-picker-hidden"
                    accept={ACCEPTED_EXT}
                    onChange={e => onFileInput(activeSlot.id, e.target.files)}
                    aria-label="Upload a file into this tab"
                  />
                </label>
              </div>
            </div>

            {/* Code editor */}
            <div className="studio-editor-section">
              <span className="studio-field-eyebrow">Code editor</span>
              <textarea
                className="file-slot-textarea"
                value={activeSlot.text}
                onChange={e => patchSlot(activeSlot.id, { text: e.target.value })}
                rows={14}
                placeholder={'Paste your C++ code here...\nYou can also upload one or more files.'}
                aria-label="Source for this tab"
              />
              {activeSlot.text.trim().length > 0 && (() => {
                const t = countTokens(activeSlot.text);
                const over = t > MAX_TOKENS_PER_FILE;
                return (
                  <span className={`token-counter ${over ? 'token-counter--over' : ''}`}>
                    {t} / {MAX_TOKENS_PER_FILE} tokens{over ? ' — too large' : ''}
                  </span>
                );
              })()}
            </div>

            {/* Format hint */}
            <p className="studio-format-hint">
              <span aria-hidden="true">ⓘ</span>
              Supports .cpp, .h, .hpp files. You can paste code or upload files.
            </p>
          </div>
        )}

        {/* Program stdin */}
        <div className="studio-stdin-compact">
          <label htmlFor="program-stdin">
            Program input
            <small>(stdin — newlines = Enter)</small>
          </label>
          <textarea
            id="program-stdin"
            className="program-stdin-textarea"
            value={programStdin}
            onChange={e => setProgramStdin(e.target.value)}
            rows={3}
            placeholder="If your program reads from cin/scanf/getline, type its input here."
            aria-label="Program standard input — sent to your binary on every unit-test run"
          />
        </div>

        {/* Action buttons */}
        <div className="studio-actions">
          <button id="load-sample-btn" className="ghost-btn" type="button" onClick={onLoadSample}>
            Load sample
          </button>
          <button id="clear-btn" className="ghost-btn" type="button" onClick={onClear}>
            Clear
          </button>
          <button id="analyze-btn" className="primary-btn studio-run-btn" type="submit" disabled={busy}>
            <IconPlay size={15} />
            {busy ? 'Running...' : `Run analysis (${filledCount} file${filledCount === 1 ? '' : 's'})`}
          </button>
        </div>

        {/* Result preview */}
        <div className="studio-result-preview">
          <div className="studio-result-preview__head">
            <span className="studio-result-preview__title">
              <span className="studio-result-preview__title-icon" aria-hidden="true">
                <IconLayers size={16} />
              </span>
              Result Preview
            </span>
          </div>
          {!currentRun && (
            <p className="studio-result-preview__empty">Your analysis results will appear here.</p>
          )}
          <div className="studio-preview-cards">
            <div className="studio-preview-card">
              <span className="studio-preview-card__icon" aria-hidden="true">
                <IconCode size={18} />
              </span>
              <span className="studio-preview-card__label">Pattern name</span>
              <span className={`studio-preview-card__value${topPattern ? '' : ' studio-preview-card__value--dim'}`}>
                {topPattern ?? '—'}
              </span>
            </div>
            <div className="studio-preview-card">
              <span className="studio-preview-card__icon" aria-hidden="true">
                <IconLayers size={18} />
              </span>
              <span className="studio-preview-card__label">Code highlights</span>
              <span className={`studio-preview-card__value${patternCount !== null ? '' : ' studio-preview-card__value--dim'}`}>
                {patternCount !== null ? `${patternCount} pattern${patternCount === 1 ? '' : 's'}` : '—'}
              </span>
            </div>
            <div className="studio-preview-card">
              <span className="studio-preview-card__icon" aria-hidden="true">
                <IconClipboard size={18} />
              </span>
              <span className="studio-preview-card__label">Simple explanation</span>
              <span className={`studio-preview-card__value${firstAnnotation ? '' : ' studio-preview-card__value--dim'}`}>
                {firstAnnotation ?? '—'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* aside kept for backward compatibility — not used by SubmitTab */}
      {aside ? <aside className="submit-side-panel submit-side-panel--runs">{aside}</aside> : null}
    </form>
  );
}
