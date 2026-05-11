import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitAnalysis, fetchSample } from '../../api/client';
import { consumeStudioPrefill } from '../../logic/studioPrefill';
import { logFrontendEvent } from '../../logic/frontendLog';
import { AnalysisRun } from '../../types/api';
import { countCppTokens, DEFAULT_MAX_TOKENS_PER_FILE } from '../../utils/tokenCounter';
import SamplePickerModal from './SamplePickerModal';

interface AnalysisFormProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  beforeSubmit?: (dispatch: () => void) => void;
}

interface FileSlot {
  id: string;
  name: string;
  text: string;
}

// Hard ceiling — must match backend payloadValidator max(5).
const MAX_FILES_HARD_CAP = 5;
const ACCEPTED_EXT = '.cpp,.cc,.cxx,.h,.hpp';

function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AnalysisForm({ onAnalysisComplete, beforeSubmit }: AnalysisFormProps) {
  const { sourceText, filename, setSourceText, setFilename, setStatus,
    setCurrentRun, setSessionRanAnalyze, maxFilesPerSubmission, maxTokensPerFile,
    submissionFiles, setSubmissionFiles,
    programStdin, setProgramStdin } = useAppStore();
  const MAX_FILES = Math.min(MAX_FILES_HARD_CAP, Math.max(1, maxFilesPerSubmission || 3));
  const MAX_TOKENS = Math.max(100, maxTokensPerFile || DEFAULT_MAX_TOKENS_PER_FILE);

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
      const patternCount = (run.detectedPatterns || []).length;
      const commentCount = (run.annotations || []).length;
      const verdict = run.ranking?.verdict || 'no_clear_pattern';
      setStatus({
        kind: 'ok',
        title: 'Analysis ready (unsaved)',
        detail: `${patternCount} pattern(s), ${commentCount} comment(s), ${payloadFiles.length} file(s). Verdict: ${verdict}.`
      });
      onAnalysisComplete(run);
      logFrontendEvent('frontend.run_complete', `patterns=${patternCount} comments=${commentCount}`);
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
    const oversized = filled
      .map(s => ({ name: s.name || 'snippet.cpp', tokens: countCppTokens(s.text) }))
      .filter(x => x.tokens > MAX_TOKENS);
    if (oversized.length > 0) {
      const first = oversized[0];
      setStatus({
        kind: 'error',
        title: 'File too large',
        detail: `${first.name} has ${first.tokens} tokens (limit ${MAX_TOKENS}). Trim the file before submitting.`
      });
      return;
    }
    const dispatch = () => { void dispatchAnalyze(filled); };
    if (beforeSubmit) beforeSubmit(dispatch);
    else dispatch();
  }

  const submissionOverLimit = slots.some(s => countCppTokens(s.text) > MAX_TOKENS);

  // Sample-picker modal: replaces the old single-fetch behaviour. Clicking
  // "Load sample" now opens a categorised picker (Creational / Structural /
  // Behavioural / Idioms) and the user chooses one. The legacy fetchSample
  // backend endpoint is kept as a fallback when the bundled raw samples are
  // empty for some reason.
  const [samplePickerOpen, setSamplePickerOpen] = useState<boolean>(false);

  function applyLoadedSample(filename: string, code: string): void {
    setSlots(prev => {
      const next = [...prev];
      next[0] = { ...next[0], name: filename, text: code };
      return next;
    });
    setSourceText(code);
    setFilename(filename);
    setStatus({ kind: 'ok', title: 'Sample loaded', detail: `${filename} placed in slot 1.` });
  }

  function onLoadSample(): void {
    setSamplePickerOpen(true);
  }

  async function onLoadSampleFallback(): Promise<void> {
    // Used when the picker has no bundled samples — preserves the legacy
    // single-sample behaviour so the studio is never stuck.
    try {
      const sample = await fetchSample();
      applyLoadedSample(sample.filename || 'sample.cpp', sample.code || '');
    } catch (err) {
      setStatus({
        kind: 'error',
        title: 'Sample failed',
        detail: err instanceof Error ? err.message : 'unknown',
      });
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
    <>
    <SamplePickerModal
      open={samplePickerOpen}
      onClose={() => setSamplePickerOpen(false)}
      onSelect={({ filename, code }) => {
        if (!code) {
          // Bundled raw samples returned an empty string — fall back to
          // backend single-fetch so the user is never stuck.
          void onLoadSampleFallback();
          return;
        }
        applyLoadedSample(filename, code);
      }}
    />
    <form id="analysis-form" className="analysis-form" onSubmit={onSubmit}>
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

      {activeSlot && (
        <div className="file-tab-pane">
          <header className="file-slot-head">
            <span className="file-slot-eyebrow">Filename</span>
            <input
              type="text"
              className="file-slot-name"
              value={activeSlot.name}
              maxLength={256}
              onChange={e => patchSlot(activeSlot.id, { name: e.target.value })}
              placeholder="snippet.cpp"
              aria-label="Filename for this tab"
            />
            <input
              type="file"
              className="file-slot-picker"
              accept={ACCEPTED_EXT}
              onChange={e => onFileInput(activeSlot.id, e.target.files)}
              aria-label="Upload a file into this tab"
            />
          </header>
          <textarea
            className="file-slot-textarea"
            value={activeSlot.text}
            onChange={e => patchSlot(activeSlot.id, { text: e.target.value })}
            rows={14}
            placeholder="Paste C++ source here…"
            aria-label="Source for this tab"
          />
          {activeSlot.text.trim().length > 0 && (() => {
            const t = countCppTokens(activeSlot.text);
            const over = t > MAX_TOKENS;
            return (
              <span className={`token-counter ${over ? 'token-counter--over' : ''}`}>
                {t} / {MAX_TOKENS} tokens{over ? ' — too large, the server will reject this' : ''}
              </span>
            );
          })()}
        </div>
      )}

      <div className="program-stdin-row">
        <label htmlFor="program-stdin">
          Program input <small>(stdin — newlines = Enter)</small>
        </label>
        <textarea
          id="program-stdin"
          className="program-stdin-textarea"
          value={programStdin}
          onChange={e => setProgramStdin(e.target.value)}
          rows={3}
          placeholder="If your program reads from cin/scanf/getline, type its input here. Each newline is one Enter press."
          aria-label="Program standard input — sent to your binary on every unit-test run"
        />
      </div>

      <div className="form-actions">
        <button id="analyze-btn" data-testid="analyze-btn" className="primary-btn" type="submit" disabled={busy || submissionOverLimit}>
          {busy ? 'Running...' : `Run analysis (${slots.filter(s => s.text.trim()).length} file${slots.filter(s => s.text.trim()).length === 1 ? '' : 's'})`}
        </button>
        <button id="load-sample-btn" data-testid="load-sample-btn" className="ghost-btn" type="button" onClick={onLoadSample}>
          Load sample
        </button>
        <button id="clear-btn" data-testid="clear-btn" className="ghost-btn" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </form>
    </>
  );
}
