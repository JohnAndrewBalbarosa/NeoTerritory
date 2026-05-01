import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitManualReview, saveRun } from '../../api/client';
import { DetectedPatternFull, ClassUsageBinding } from '../../types/api';

interface PendingSave {
  pendingId: string;
  sourceName: string;
  patternCount: number;
  commentCount: number;
  userResolvedPattern: string | null;
  ambiguousVerdict: boolean;
}

interface AmbiguousTabProps {
  pendingSave: PendingSave | null;
  onSaved: (runId: number) => void;
  onDiscard: () => void;
}

// ─── Tagged class row (TP / FP) ───────────────────────────────────────────────

interface TaggedDecision { correct: boolean | null }

interface TaggedRowProps {
  pattern: DetectedPatternFull;
  decision: TaggedDecision;
  isSaved: boolean;
  isSaving: boolean;
  onDecide: (correct: boolean) => void;
  onSave: () => void;
}

function TaggedRow({ pattern, decision, isSaved, isSaving, onDecide, onSave }: TaggedRowProps) {
  return (
    <li className={`checklist-row ${isSaved ? 'is-saved' : ''}`}>
      <div className="checklist-meta">
        <strong className="checklist-classname">{pattern.className}</strong>
        <span className="checklist-arrow">→</span>
        <span className="checklist-pattern">{pattern.patternName}</span>
      </div>
      <div className="checklist-options">
        <label className="checklist-chip">
          <input
            type="radio"
            name={`tagged-${pattern.patternName}-${pattern.className}`}
            checked={decision.correct === true}
            onChange={() => onDecide(true)}
            disabled={isSaved}
          />
          <span>Yes — correctly identified</span>
        </label>
        <label className="checklist-chip checklist-chip--fp">
          <input
            type="radio"
            name={`tagged-${pattern.patternName}-${pattern.className}`}
            checked={decision.correct === false}
            onChange={() => onDecide(false)}
            disabled={isSaved}
          />
          <span>No — false positive</span>
        </label>
      </div>
      <div className="checklist-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={decision.correct === null || isSaved || isSaving}
          onClick={onSave}
        >
          {isSaved ? 'Saved ✓' : isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </li>
  );
}

// ─── Untagged class row (TN / FN) ─────────────────────────────────────────────

interface UntaggedDecision { isPattern: boolean | null; patternName: string }

interface UntaggedRowProps {
  className: string;
  decision: UntaggedDecision;
  isSaved: boolean;
  isSaving: boolean;
  onDecide: (isPattern: boolean) => void;
  onPatternName: (name: string) => void;
  onSave: () => void;
}

function UntaggedRow({ className, decision, isSaved, isSaving, onDecide, onPatternName, onSave }: UntaggedRowProps) {
  return (
    <li className={`checklist-row ${isSaved ? 'is-saved' : ''}`}>
      <div className="checklist-meta">
        <strong className="checklist-classname">{className}</strong>
        <span className="checklist-no-tag">— no pattern detected</span>
      </div>
      <div className="checklist-options">
        <label className="checklist-chip">
          <input
            type="radio"
            name={`untagged-${className}`}
            checked={decision.isPattern === false}
            onChange={() => onDecide(false)}
            disabled={isSaved}
          />
          <span>Correct — not a design pattern</span>
        </label>
        <label className="checklist-chip checklist-chip--fn">
          <input
            type="radio"
            name={`untagged-${className}`}
            checked={decision.isPattern === true}
            onChange={() => onDecide(true)}
            disabled={isSaved}
          />
          <span>Wrong — this IS a:</span>
          <input
            type="text"
            className="other-input"
            value={decision.patternName}
            placeholder="e.g. Singleton"
            maxLength={64}
            disabled={isSaved || decision.isPattern !== true}
            onChange={e => onPatternName(e.target.value)}
          />
        </label>
      </div>
      <div className="checklist-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={
            decision.isPattern === null ||
            (decision.isPattern === true && !decision.patternName.trim()) ||
            isSaved || isSaving
          }
          onClick={onSave}
        >
          {isSaved ? 'Saved ✓' : isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </li>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function AmbiguousTab({ pendingSave, onSaved, onDiscard }: AmbiguousTabProps) {
  const { currentRun, setStatus } = useAppStore();

  const [taggedDecisions, setTaggedDecisions]   = useState<Record<string, TaggedDecision>>({});
  const [untaggedDecisions, setUntaggedDecisions] = useState<Record<string, UntaggedDecision>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<Set<string>>(new Set());
  const [savingRun, setSavingRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { taggedClasses, untaggedClasses } = useMemo(() => {
    if (!currentRun) return { taggedClasses: [], untaggedClasses: [] };

    const tagged = (currentRun.detectedPatterns || []).filter(p => !!p.className);

    const taggedNames = new Set(tagged.map(p => p.className!));
    const allClasses  = Object.keys(currentRun.classUsageBindings || {});
    const untagged    = allClasses.filter(n => !taggedNames.has(n));

    return { taggedClasses: tagged, untaggedClasses: untagged };
  }, [currentRun]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-ambiguous tab-empty">
        <p>Run an analysis to validate detected patterns.</p>
      </section>
    );
  }

  if (taggedClasses.length === 0 && untaggedClasses.length === 0) {
    return (
      <section className="tab-panel tab-ambiguous tab-empty">
        <p>No classes found in this run.</p>
      </section>
    );
  }

  // Capture non-null ref so closures below don't need null checks.
  const run = currentRun;

  // ── helpers ──────────────────────────────────────────────────────────────

  function taggedKey(p: DetectedPatternFull) { return `${p.patternName}_${p.className}`; }

  function setTagged(key: string, patch: Partial<TaggedDecision>) {
    setTaggedDecisions(prev => {
      const existing = prev[key] ?? { correct: null };
      return { ...prev, [key]: { ...existing, ...patch } };
    });
  }

  function setUntagged(className: string, patch: Partial<UntaggedDecision>) {
    setUntaggedDecisions(prev => {
      const existing = prev[className] ?? { isPattern: null, patternName: '' };
      return { ...prev, [className]: { ...existing, ...patch } };
    });
  }

  function markSaved(key: string) {
    setSaved(prev => { const next = new Set(prev); next.add(key); return next; });
  }

  // ── submit tagged (TP / FP) ───────────────────────────────────────────────

  async function saveTagged(p: DetectedPatternFull): Promise<void> {
    if (!run.runId) { setError('Save the run first.'); return; }
    const key = taggedKey(p);
    const dec = taggedDecisions[key];
    if (!dec || dec.correct === null) { setError('Pick Yes or No first.'); return; }
    const repLine = p.documentationTargets?.[0]?.line ?? 1;
    setError(null);
    setSaving(key);
    try {
      await submitManualReview(run.runId, {
        line:          repLine,
        candidates:    [p.patternName],
        chosenPattern: dec.correct ? p.patternName : null,
        chosenKind:    dec.correct ? 'pattern' : 'none'
      });
      markSaved(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(null);
    }
  }

  // ── submit untagged (TN / FN) ─────────────────────────────────────────────

  async function saveUntagged(className: string): Promise<void> {
    if (!run.runId) { setError('Save the run first.'); return; }
    const dec = untaggedDecisions[className];
    if (!dec || dec.isPattern === null) { setError('Make a selection first.'); return; }
    if (dec.isPattern && !dec.patternName.trim()) { setError('Enter the pattern name.'); return; }

    const bindings: ClassUsageBinding[] = run.classUsageBindings?.[className] || [];
    const repLine = bindings[0]?.line ?? 0;
    setError(null);
    setSaving(className);
    try {
      await submitManualReview(run.runId, {
        line:          repLine,
        candidates:    [],
        chosenPattern: dec.isPattern ? dec.patternName.trim() : null,
        chosenKind:    dec.isPattern ? 'pattern' : 'none'
      });
      markSaved(className);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(null);
    }
  }

  // ── completeness check ───────────────────────────────────────────────────
  // The submit button is gated until every tagged and untagged row has an
  // answer — TP/FP for tagged, TN/FN (with pattern name when claiming FN)
  // for untagged. Backend runs the same check for security.
  function isComplete(): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const p of taggedClasses) {
      const dec = taggedDecisions[taggedKey(p)];
      if (!dec || dec.correct === null) missing.push(`${p.className} (Yes/No)`);
    }
    for (const cls of untaggedClasses) {
      const dec = untaggedDecisions[cls];
      if (!dec || dec.isPattern === null) missing.push(`${cls} (Correct/Wrong)`);
      else if (dec.isPattern && !dec.patternName.trim()) missing.push(`${cls} (pattern name)`);
    }
    return { ok: missing.length === 0, missing };
  }

  // ── save run handler ─────────────────────────────────────────────────────
  async function handleSaveRun(): Promise<void> {
    if (!pendingSave) return;
    setSavingRun(true);
    setError(null);
    try {
      const result = await saveRun(
        pendingSave.pendingId,
        run.userResolvedPattern || undefined,
        run.classResolvedPatterns
      );
      setStatus({ kind: 'ok', title: 'Run saved', detail: `Saved as run #${result.runId}.` });
      onSaved(result.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingRun(false);
    }
  }

  // ── batch submit (validation) ────────────────────────────────────────────
  async function handleSubmitValidation(): Promise<void> {
    if (!run.runId) {
      setError('You must save the run first before submitting validation.');
      return;
    }
    const check = isComplete();
    if (!check.ok) {
      setError(`Please answer every row before submitting. Missing: ${check.missing.slice(0, 4).join(', ')}${check.missing.length > 4 ? '…' : ''}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Sequential submit so the backend can reject any malformed row without
      // half-applied state. Each call is small.
      for (const p of taggedClasses) {
        const key = taggedKey(p);
        if (saved.has(key)) continue;
        const dec = taggedDecisions[key];
        const repLine = p.documentationTargets?.[0]?.line ?? 1;
        await submitManualReview(run.runId, {
          line: repLine,
          candidates: [p.patternName],
          chosenPattern: dec.correct ? p.patternName : null,
          chosenKind: dec.correct ? 'pattern' : 'none'
        });
        markSaved(key);
      }
      for (const cls of untaggedClasses) {
        if (saved.has(cls)) continue;
        const dec = untaggedDecisions[cls];
        const bindings: ClassUsageBinding[] = run.classUsageBindings?.[cls] || [];
        const repLine = bindings[0]?.line ?? 1;
        await submitManualReview(run.runId, {
          line: repLine,
          candidates: [],
          chosenPattern: dec.isPattern ? dec.patternName.trim() : null,
          chosenKind: dec.isPattern ? 'pattern' : 'none'
        });
        markSaved(cls);
      }
      setStatus({ kind: 'ok', title: 'Validation submitted', detail: 'Thanks for the feedback.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const isSaved = !pendingSave && !!run.runId;
  const completeness = isComplete();

  return (
    <section className="tab-panel tab-ambiguous">
      <div className="review-action-bar">
        <div className="review-action-status" data-saved={isSaved ? 'true' : undefined}>
          {isSaved ? (
            <><strong>Run saved</strong> · run #{run.runId} · ready to submit validation</>
          ) : (
            <><strong>Unsaved run</strong> · save before you can submit validation</>
          )}
        </div>
        <div className="review-action-buttons">
          {!isSaved && pendingSave && (
            <button
              type="button"
              className="primary-btn"
              disabled={savingRun}
              onClick={handleSaveRun}
            >
              {savingRun ? 'Saving…' : 'Save run'}
            </button>
          )}
          {pendingSave && (
            <button
              type="button"
              className="ghost-btn discard-btn"
              onClick={() => { if (confirm('Discard this run? Your tags and edits will be lost.')) onDiscard(); }}
            >
              Discard run
            </button>
          )}
          <button
            type="button"
            className="primary-btn"
            disabled={!isSaved || submitting || !completeness.ok}
            onClick={handleSubmitValidation}
            title={!isSaved
              ? 'Save the run first'
              : !completeness.ok
                ? `Missing: ${completeness.missing.length} row(s)`
                : 'Submit validation feedback'}
          >
            {submitting ? 'Submitting…' : 'Submit validation'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {taggedClasses.length > 0 && (
        <div className="checklist-section">
          <header className="checklist-section-header">
            <h3>Tagged classes</h3>
            <p className="checklist-section-desc">
              Confirm whether each detected pattern is a genuine match. <strong>All rows are required.</strong>
            </p>
          </header>
          <ul className="checklist-list">
            {taggedClasses.map(p => {
              const key = taggedKey(p);
              return (
                <TaggedRow
                  key={key}
                  pattern={p}
                  decision={taggedDecisions[key] || { correct: null }}
                  isSaved={saved.has(key)}
                  isSaving={saving === key}
                  onDecide={correct => setTagged(key, { correct })}
                  onSave={() => { void saveTagged(p); }}
                />
              );
            })}
          </ul>
        </div>
      )}

      {untaggedClasses.length > 0 && (
        <div className="checklist-section">
          <header className="checklist-section-header">
            <h3>Untagged classes</h3>
            <p className="checklist-section-desc">
              These classes were not detected as any pattern. Confirm or correct. <strong>All rows are required.</strong>
            </p>
          </header>
          <ul className="checklist-list">
            {untaggedClasses.map(className => (
              <UntaggedRow
                key={className}
                className={className}
                decision={untaggedDecisions[className] || { isPattern: null, patternName: '' }}
                isSaved={saved.has(className)}
                isSaving={saving === className}
                onDecide={isPattern => setUntagged(className, { isPattern })}
                onPatternName={name => setUntagged(className, { patternName: name })}
                onSave={() => { void saveUntagged(className); }}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
