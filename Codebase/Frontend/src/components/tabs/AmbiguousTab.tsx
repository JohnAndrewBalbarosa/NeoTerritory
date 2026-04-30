import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitManualReview } from '../../api/client';
import { Annotation } from '../../types/api';

interface AmbiguousLine {
  line: number;
  excerpt: string;
  candidates: string[];
}

type ChoiceKind = 'pattern' | 'none' | 'other';
interface RowDecision {
  kind: ChoiceKind;
  pattern: string | null;
  other: string;
}

function computeAmbiguous(annotations: Annotation[]): AmbiguousLine[] {
  const byLine = new Map<number, { excerpt: string; patterns: Set<string> }>();
  for (const a of annotations) {
    if (!a.line || !a.patternKey) continue;
    const entry = byLine.get(a.line) || { excerpt: a.excerpt || '', patterns: new Set<string>() };
    entry.patterns.add(a.patternKey);
    if (!entry.excerpt && a.excerpt) entry.excerpt = a.excerpt;
    byLine.set(a.line, entry);
  }
  const result: AmbiguousLine[] = [];
  for (const [line, info] of byLine) {
    if (info.patterns.size >= 2) {
      result.push({ line, excerpt: info.excerpt, candidates: Array.from(info.patterns) });
    }
  }
  return result.sort((a, b) => a.line - b.line);
}

export default function AmbiguousTab() {
  const { currentRun, patchCurrentRun } = useAppStore();
  const [decisions, setDecisions] = useState<Record<number, RowDecision>>({});
  const [savingLine, setSavingLine] = useState<number | null>(null);
  const [savedLines, setSavedLines] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const ambiguous = useMemo(
    () => computeAmbiguous(currentRun?.annotations || []),
    [currentRun]
  );

  if (!currentRun) {
    return (
      <section className="tab-panel tab-ambiguous tab-empty">
        <p>Run an analysis to review ambiguous lines.</p>
      </section>
    );
  }

  if (ambiguous.length === 0) {
    return (
      <section className="tab-panel tab-ambiguous tab-empty">
        <p>No ambiguous lines in this run.</p>
      </section>
    );
  }

  function setDecision(line: number, patch: Partial<RowDecision>): void {
    setDecisions((prev) => {
      const cur = prev[line] || { kind: 'pattern', pattern: null, other: '' };
      return { ...prev, [line]: { ...cur, ...patch } };
    });
  }

  async function onSave(row: AmbiguousLine): Promise<void> {
    if (!currentRun?.runId) {
      setError('Save the run first before submitting manual decisions.');
      return;
    }
    const dec = decisions[row.line];
    if (!dec) {
      setError(`Pick an option for line ${row.line}.`);
      return;
    }
    if (dec.kind === 'pattern' && !dec.pattern) {
      setError(`Choose a pattern for line ${row.line}.`);
      return;
    }
    setError(null);
    setSavingLine(row.line);
    try {
      await submitManualReview(currentRun.runId, {
        line: row.line,
        candidates: row.candidates,
        chosenPattern: dec.kind === 'pattern' ? dec.pattern : null,
        chosenKind: dec.kind,
        otherText: dec.kind === 'other' ? dec.other : undefined
      });

      // Locally update the run's annotations: set patternKey on this line's
      // annotations to the chosen pattern (clears ambiguity for re-render).
      if (currentRun) {
        const updated = (currentRun.annotations || []).map((a) => {
          if (a.line !== row.line) return a;
          if (dec.kind !== 'pattern' || !dec.pattern) return a;
          return { ...a, patternKey: dec.pattern };
        });
        patchCurrentRun({ annotations: updated });
      }
      setSavedLines((prev) => {
        const next = new Set(prev);
        next.add(row.line);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save manual review.');
    } finally {
      setSavingLine(null);
    }
  }

  return (
    <section className="tab-panel tab-ambiguous">
      <header className="results-header">
        <p className="results-summary">
          {ambiguous.length} ambiguous line{ambiguous.length === 1 ? '' : 's'} — pick the best match per line.
        </p>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <ul className="ambiguous-list">
        {ambiguous.map((row) => {
          const dec = decisions[row.line] || { kind: 'pattern' as ChoiceKind, pattern: null, other: '' };
          const isSaved = savedLines.has(row.line);
          return (
            <li key={row.line} className={`ambiguous-row ${isSaved ? 'is-saved' : ''}`}>
              <div className="ambiguous-meta">
                <strong>Line {row.line}</strong>
                <code className="ambiguous-excerpt">{row.excerpt || '(no excerpt)'}</code>
              </div>
              <div className="ambiguous-candidates">
                {row.candidates.map((c) => (
                  <label key={c} className="candidate-chip">
                    <input
                      type="radio"
                      name={`amb-${row.line}`}
                      checked={dec.kind === 'pattern' && dec.pattern === c}
                      onChange={() => setDecision(row.line, { kind: 'pattern', pattern: c })}
                    />
                    <span>{c}</span>
                  </label>
                ))}
                <label className="candidate-chip">
                  <input
                    type="radio"
                    name={`amb-${row.line}`}
                    checked={dec.kind === 'none'}
                    onChange={() => setDecision(row.line, { kind: 'none', pattern: null })}
                  />
                  <span>None of the above</span>
                </label>
                <label className="candidate-chip">
                  <input
                    type="radio"
                    name={`amb-${row.line}`}
                    checked={dec.kind === 'other'}
                    onChange={() => setDecision(row.line, { kind: 'other', pattern: null })}
                  />
                  <span>Other:</span>
                  <input
                    type="text"
                    className="other-input"
                    value={dec.other}
                    onChange={(e) => setDecision(row.line, { kind: 'other', pattern: null, other: e.target.value })}
                    placeholder="Describe…"
                  />
                </label>
              </div>
              <div className="ambiguous-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={savingLine === row.line || isSaved}
                  onClick={() => { void onSave(row); }}
                >
                  {isSaved ? 'Saved' : savingLine === row.line ? 'Saving…' : 'Save'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
