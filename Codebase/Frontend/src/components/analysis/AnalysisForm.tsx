import React, { useRef, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitAnalysis, fetchSample } from '../../api/client';
import { AnalysisRun } from '../../types/api';

interface AnalysisFormProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  beforeSubmit?: (dispatch: () => void) => void;
}

export default function AnalysisForm({ onAnalysisComplete, beforeSubmit }: AnalysisFormProps) {
  const { sourceText, filename, setSourceText, setFilename, setStatus,
    setCurrentRun, setSessionRanAnalyze } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function dispatchAnalyze(code: string, file: File | undefined, fname: string): Promise<void> {
    setBusy(true);
    setStatus({ kind: 'busy', title: 'Running analysis', detail: 'Spawning microservice...' });
    try {
      let body: string | FormData;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('filename', fname);
        body = fd;
      } else {
        body = JSON.stringify({ code, filename: fname });
      }
      const run = await submitAnalysis(body);
      setSessionRanAnalyze(true);
      if (run.sourceText) setSourceText(run.sourceText);
      if (run.sourceName) setFilename(run.sourceName);
      setCurrentRun(run);
      const patternCount = (run.detectedPatterns || []).length;
      const commentCount = (run.annotations || []).length;
      const verdict = run.ranking?.verdict || 'no_clear_pattern';
      setStatus({
        kind: 'ok',
        title: 'Analysis ready (unsaved)',
        detail: `${patternCount} pattern(s), ${commentCount} comment(s). Verdict: ${verdict}.`
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
    const code = sourceText.trim();
    const file = fileRef.current?.files?.[0];
    const fname = filename.trim() || 'snippet.cpp';
    if (!code && !file) {
      setStatus({ kind: 'error', title: 'No input', detail: 'Paste code or pick a file first.' });
      return;
    }
    const run = () => { void dispatchAnalyze(code, file, fname); };
    if (beforeSubmit) {
      beforeSubmit(run);
    } else {
      run();
    }
  }

  async function onLoadSample() {
    try {
      const sample = await fetchSample();
      setSourceText(sample.code || '');
      setFilename(sample.filename || 'sample.cpp');
      setStatus({ kind: 'ok', title: 'Sample loaded', detail: `${sample.filename} placed in the editor.` });
    } catch (err) {
      setStatus({ kind: 'error', title: 'Sample failed', detail: err instanceof Error ? err.message : 'unknown' });
    }
  }

  function onClear() {
    setSourceText('');
    setFilename('snippet.cpp');
    setCurrentRun(null);
    if (fileRef.current) fileRef.current.value = '';
    setStatus({ kind: 'idle', title: 'Cleared', detail: 'Ready for new input.' });
  }

  function onFileChange() {
    const file = fileRef.current?.files?.[0];
    if (file) {
      setFilename(file.name);
      setStatus({ kind: 'ok', title: 'File ready', detail: `${file.name} selected.` });
    }
  }

  return (
    <form id="analysis-form" className="analysis-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Filename</span>
        <input
          id="filename-input"
          type="text"
          value={filename}
          maxLength={256}
          onChange={e => setFilename(e.target.value)}
          placeholder="snippet.cpp"
        />
      </label>
      <label className="field">
        <span>Source code</span>
        <textarea
          id="code-input"
          value={sourceText}
          onChange={e => setSourceText(e.target.value)}
          rows={14}
          placeholder="Paste C++ source here..."
        />
      </label>
      <label className="field">
        <span>Or upload a file</span>
        <input
          id="file-input"
          ref={fileRef}
          type="file"
          accept=".cpp,.cc,.cxx,.h,.hpp"
          onChange={onFileChange}
        />
      </label>
      <div className="form-actions">
        <button id="analyze-btn" className="primary-btn" type="submit" disabled={busy}>
          {busy ? 'Running...' : 'Run analysis'}
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
