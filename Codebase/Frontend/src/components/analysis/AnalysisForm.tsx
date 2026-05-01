import React, { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitAnalysis, fetchSample } from '../../api/client';
import { AnalysisRun } from '../../types/api';

interface AnalysisFormProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  beforeSubmit?: (dispatch: () => void) => void;
}

interface FileSlot {
  id: string;
  name: string;
  text: string;
}

// Hard ceiling — backend clamps to this even if .env asks for more.
const MAX_FILES_HARD_CAP = 16;
const ACCEPTED_EXT = '.cpp,.cc,.cxx,.h,.hpp';

function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AnalysisForm({ onAnalysisComplete, beforeSubmit }: AnalysisFormProps) {
  const { sourceText, filename, setSourceText, setFilename, setStatus,
    setCurrentRun, setSessionRanAnalyze, maxFilesPerSubmission } = useAppStore();
  const MAX_FILES = Math.min(MAX_FILES_HARD_CAP, Math.max(1, maxFilesPerSubmission || 3));

  // Initialise from the legacy single-file store fields so existing flows
  // (Load sample, Clear, the old store hydration on mount) keep working.
  const [slots, setSlots] = useState<FileSlot[]>(() => [{
    id: newSlotId(),
    name: filename || 'snippet.cpp',
    text: sourceText || ''
  }]);
  const [busy, setBusy] = useState(false);

  async function dispatchAnalyze(payloadFiles: FileSlot[]): Promise<void> {
    setBusy(true);
    setStatus({ kind: 'busy', title: 'Running analysis', detail: 'Spawning microservice...' });
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed.';
      setStatus({ kind: 'error', title: 'Analysis failed', detail: msg });
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
    setSlots([{ id: newSlotId(), name: 'snippet.cpp', text: '' }]);
    setSourceText('');
    setFilename('snippet.cpp');
    setCurrentRun(null);
    setStatus({ kind: 'idle', title: 'Cleared', detail: 'Ready for new input.' });
  }

  function addSlot() {
    if (slots.length >= MAX_FILES) {
      setStatus({ kind: 'error', title: 'File cap', detail: `At most ${MAX_FILES} files per submission.` });
      return;
    }
    setSlots(prev => [...prev, { id: newSlotId(), name: `file-${prev.length + 1}.cpp`, text: '' }]);
  }

  function removeSlot(id: string) {
    setSlots(prev => prev.length <= 1 ? prev : prev.filter(s => s.id !== id));
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
      <div className="multi-file-list">
        {slots.map((slot, idx) => (
          <div key={slot.id} className="file-slot" data-idx={idx + 1}>
            <header className="file-slot-head">
              <span className="file-slot-eyebrow">File {idx + 1}</span>
              <input
                type="text"
                className="file-slot-name"
                value={slot.name}
                maxLength={256}
                onChange={e => patchSlot(slot.id, { name: e.target.value })}
                placeholder={`file-${idx + 1}.cpp`}
                aria-label={`Filename for file ${idx + 1}`}
              />
              <input
                type="file"
                className="file-slot-picker"
                accept={ACCEPTED_EXT}
                onChange={e => onFileInput(slot.id, e.target.files)}
                aria-label={`Upload file for slot ${idx + 1}`}
              />
              {slots.length > 1 && (
                <button
                  type="button"
                  className="ghost-btn file-slot-delete"
                  onClick={() => removeSlot(slot.id)}
                  aria-label={`Remove file ${idx + 1}`}
                  title="Remove this file"
                >× Remove</button>
              )}
            </header>
            <textarea
              className="file-slot-textarea"
              value={slot.text}
              onChange={e => patchSlot(slot.id, { text: e.target.value })}
              rows={10}
              placeholder="Paste C++ source here…"
              aria-label={`Source for file ${idx + 1}`}
            />
          </div>
        ))}
        <button
          type="button"
          className="ghost-btn multi-file-add"
          onClick={addSlot}
          disabled={slots.length >= MAX_FILES}
          title={slots.length >= MAX_FILES ? `Cap is ${MAX_FILES} files` : 'Add another file'}
        >
          + Add file
        </button>
      </div>
      <div className="form-actions">
        <button id="analyze-btn" className="primary-btn" type="submit" disabled={busy}>
          {busy ? 'Running...' : `Run analysis (${slots.filter(s => s.text.trim()).length} file${slots.filter(s => s.text.trim()).length === 1 ? '' : 's'})`}
        </button>
        <button id="load-sample-btn" className="ghost-btn" type="button" onClick={onLoadSample}>
          Load sample
        </button>
        <button id="clear-btn" className="ghost-btn" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </form>
  );
}
