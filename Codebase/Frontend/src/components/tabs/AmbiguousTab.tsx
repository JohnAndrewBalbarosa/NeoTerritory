import { useEffect, useMemo, useState } from 'react';
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
  onDecide: (correct: boolean) => void;
}

function TaggedRow({ pattern, decision, isSaved, onDecide }: TaggedRowProps) {
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
          />
          <span>Yes — correctly identified</span>
        </label>
        <label className="checklist-chip checklist-chip--fp">
          <input
            type="radio"
            name={`tagged-${pattern.patternName}-${pattern.className}`}
            checked={decision.correct === false}
            onChange={() => onDecide(false)}
          />
          <span>No — false positive</span>
        </label>
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
  onDecide: (isPattern: boolean) => void;
  onPatternName: (name: string) => void;
}

function UntaggedRow({ className, decision, isSaved, onDecide, onPatternName }: UntaggedRowProps) {
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
          />
          <span>Correct — not a design pattern</span>
        </label>
        <label className="checklist-chip checklist-chip--fn">
          <input
            type="radio"
            name={`untagged-${className}`}
            checked={decision.isPattern === true}
            onChange={() => onDecide(true)}
          />
          <span>Wrong — this IS a:</span>
          <input
            type="text"
            className="other-input"
            value={decision.patternName}
            placeholder="e.g. Singleton"
            maxLength={64}
            disabled={decision.isPattern !== true}
            onChange={e => onPatternName(e.target.value)}
          />
        </label>
      </div>
    </li>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

// ─── Per-run questionnaire (run-relevant Likert items) ───────────────────────
// Sourced from Questionnaire B → Section B (Functional Suitability and Code
// Understanding Support). Only items that are answerable per-run live here;
// session-wide items (UI clarity, security perception, open-ended) are asked
// at sign-out instead. Likert 1=Strongly Disagree → 5=Strongly Agree.
interface LikertQuestion { id: string; text: string }
const PER_RUN_QUESTIONS: Array<{ section: string; title: string; questions: LikertQuestion[] }> = [
  {
    section: 'B',
    title: 'Code understanding',
    questions: [
      { id: 'B1', text: 'This run helped me understand unfamiliar C++ source code.' },
      { id: 'B2', text: 'The system helped me identify important parts of the analyzed code.' },
      { id: 'B3', text: 'The generated documentation for this run was clear and understandable.' }
    ]
  },
  {
    section: 'B-patterns',
    title: 'Pattern evidence',
    questions: [
      { id: 'B5', text: 'The detected design-pattern evidence helped me connect concepts to code.' },
      { id: 'B6', text: 'The explanations helped me understand why structures relate to a design pattern.' }
    ]
  },
  {
    section: 'D',
    title: 'Performance',
    questions: [
      { id: 'D17', text: 'The system generated this analysis without noticeable delay.' },
      { id: 'D18', text: 'The system stayed responsive while processing the submitted code.' }
    ]
  }
];

type SubTabId = 'validation' | 'survey-0' | 'survey-1' | 'survey-2';

const SUB_TABS: Array<{ id: SubTabId; label: string }> = [
  { id: 'validation', label: '1. Class validation' },
  { id: 'survey-0',   label: '2. Code understanding' },
  { id: 'survey-1',   label: '3. Pattern evidence' },
  { id: 'survey-2',   label: '4. Performance' }
];

function LikertRow({
  q, value, onChange
}: { q: LikertQuestion; value: number | null; onChange: (n: number) => void }) {
  return (
    <li className="checklist-row likert-row">
      <div className="checklist-meta likert-prompt">{q.text}</div>
      <div className="checklist-options likert-scale">
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} className="likert-chip">
            <input
              type="radio"
              name={`likert-${q.id}`}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span>{n}</span>
          </label>
        ))}
        <span className="likert-anchors">1 = Strongly Disagree · 5 = Strongly Agree</span>
      </div>
    </li>
  );
}

export default function AmbiguousTab({ pendingSave, onSaved, onDiscard }: AmbiguousTabProps) {
  const { currentRun, setStatus, gdbAllPassedForRun } = useAppStore();

  const [taggedDecisions, setTaggedDecisions]   = useState<Record<string, TaggedDecision>>({});
  const [untaggedDecisions, setUntaggedDecisions] = useState<Record<string, UntaggedDecision>>({});
  const [likert, setLikert] = useState<Record<string, number>>({});
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('validation');
  const [saved, setSaved]     = useState<Set<string>>(new Set());
  const [savingRun, setSavingRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  // Submit-once lock + redirect state. Once the backend ack'd the
  // payload, the button stays disabled (no double-submit) and we show
  // a 3-second redirect overlay before resetting back to the source
  // tab with a clean slate.
  const [submitted, setSubmitted] = useState(false);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const { taggedClasses, untaggedClasses } = useMemo(() => {
    if (!currentRun) return { taggedClasses: [], untaggedClasses: [] };

    // ONE row per class. The Annotated source's popover writes the
    // user's pick into `classResolvedPatterns[className] = patternKey`.
    // The resolved string format isn't stable (sometimes patternId like
    // `creational.singleton`, sometimes patternName like `Singleton`),
    // so we match it against BOTH patternId and patternName,
    // case-insensitively. First matching detection wins; if no resolved
    // entry exists for an ambiguous class, the class is dropped from
    // validation — the user must disambiguate on the Annotated tab.
    const detections = currentRun.detectedPatterns || [];
    const resolved = currentRun.classResolvedPatterns || {};

    function matchesResolved(p: typeof detections[number], tag: string | undefined): boolean {
      if (!tag) return false;
      const t = tag.toLowerCase();
      if ((p.patternId   || '').toLowerCase() === t) return true;
      if ((p.patternName || '').toLowerCase() === t) return true;
      // Suffix match handles `creational.singleton` vs bare `singleton`.
      if (t.endsWith('.' + (p.patternId   || '').toLowerCase().split('.').pop())) return true;
      if (t.endsWith('.' + (p.patternName || '').toLowerCase())) return true;
      return false;
    }

    const detectionCountByClass = new Map<string, Set<string>>();
    for (const p of detections) {
      if (!p.className) continue;
      const setForClass = detectionCountByClass.get(p.className) || new Set<string>();
      setForClass.add(p.patternId || p.patternName || '');
      detectionCountByClass.set(p.className, setForClass);
    }

    const byClass = new Map<string, typeof detections[number]>();
    for (const p of detections) {
      if (!p.className) continue;
      const distinct = detectionCountByClass.get(p.className)?.size || 0;
      if (distinct === 1) {
        // Unambiguous → just take the single detection.
        byClass.set(p.className, p);
        continue;
      }
      // Ambiguous → only keep the detection that matches the user's pick.
      const userPick = resolved[p.className];
      if (matchesResolved(p, userPick)) {
        byClass.set(p.className, p);
      }
    }

    const tagged = [...byClass.values()];
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

  // Per-row save was removed. Every row now contributes to a single
  // bulk send when the user presses "Save & submit validation"; see
  // handleSubmitValidation below for the streaming send loop.

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
    for (const group of PER_RUN_QUESTIONS) {
      for (const q of group.questions) {
        if (!likert[q.id]) missing.push(`${q.id} (rating)`);
      }
    }
    return { ok: missing.length === 0, missing };
  }

  function subTabComplete(id: SubTabId): boolean {
    if (id === 'validation') {
      const taggedDone = taggedClasses.every(p => {
        const d = taggedDecisions[taggedKey(p)];
        return d && d.correct !== null;
      });
      const untaggedDone = untaggedClasses.every(c => {
        const d = untaggedDecisions[c];
        return d && d.isPattern !== null && (!d.isPattern || d.patternName.trim().length > 0);
      });
      return taggedDone && untaggedDone;
    }
    const idx = parseInt(id.split('-')[1] || '0', 10);
    const group = PER_RUN_QUESTIONS[idx];
    if (!group) return true;
    return group.questions.every(q => !!likert[q.id]);
  }

  // ── save run handler ─────────────────────────────────────────────────────
  async function handleSaveRun(): Promise<number | null> {
    if (!pendingSave) return run.runId ?? null;
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
      return result.runId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSavingRun(false);
    }
  }

  // ONE click → save + submit, sequentially, in the background. Pass
  // the freshly-saved id directly into the submit step so the React
  // state snapshot doesn't bite us. After a successful submit the
  // button locks (submitted=true), a 3-second redirect overlay starts
  // counting down, then setCurrentRun(null) drops us back at the
  // Source tab with a clean slate. Idempotent — re-clicking the
  // disabled button is a no-op; backend also de-dupes by run identity.
  async function handleSaveAndSubmit(): Promise<void> {
    if (submitted) return;
    let id = run.runId ?? null;
    if (!id) {
      id = await handleSaveRun();
      if (!id) return;
    }
    const ok = await handleSubmitValidation(id);
    if (!ok) return;
    setSubmitted(true);
    setRedirectIn(3);
  }

  // Redirect countdown — once submitted, tick every second; on hit-zero
  // wipe the run (which the layout's tab-gating uses to lock the user
  // back to Source) and reset every local form bit so a fresh
  // submission starts cleanly.
  useEffect(() => {
    if (redirectIn === null) return;
    if (redirectIn <= 0) {
      useAppStore.getState().setCurrentRun(null);
      setSubmitted(false);
      setRedirectIn(null);
      setTaggedDecisions({});
      setUntaggedDecisions({});
      setLikert({});
      setSaved(new Set());
      setActiveSubTab('validation');
      return;
    }
    const t = setTimeout(() => setRedirectIn(n => (n ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [redirectIn]);

  // ── batch submit (validation) ────────────────────────────────────────────
  // Accepts an explicit runId so handleSaveAndSubmit can pass the id
  // it just received from the save call WITHOUT waiting for the React
  // state snapshot to refresh. The previous version read from the
  // closure's `run.runId` which was still null in the same tick the
  // save returned, so the submit step silently no-op'd and the user
  // had to click again.
  async function handleSubmitValidation(runIdOverride?: number): Promise<boolean> {
    const effectiveRunId = runIdOverride ?? run.runId;
    if (!effectiveRunId) {
      setError('You must save the run first before submitting validation.');
      return false;
    }
    const check = isComplete();
    if (!check.ok) {
      setError(`Please answer every row before submitting. Missing: ${check.missing.slice(0, 4).join(', ')}${check.missing.length > 4 ? '…' : ''}`);
      return false;
    }
    setSubmitting(true);
    setError(null);
    const rejected: string[] = [];
    async function send(label: string, payload: Parameters<typeof submitManualReview>[1]): Promise<boolean> {
      try {
        await submitManualReview(effectiveRunId!, payload);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        rejected.push(`${label}: ${msg}`);
        return false;
      }
    }
    for (const p of taggedClasses) {
      const key = taggedKey(p);
      if (saved.has(key)) continue;
      const dec = taggedDecisions[key];
      const repLine = p.documentationTargets?.[0]?.line ?? 1;
      const ok = await send(`${p.className} (${p.patternName})`, {
        line: repLine,
        candidates: [p.patternName],
        chosenPattern: dec.correct ? p.patternName : null,
        chosenKind: dec.correct ? 'pattern' : 'none'
      });
      if (ok) markSaved(key);
    }
    for (const cls of untaggedClasses) {
      if (saved.has(cls)) continue;
      const dec = untaggedDecisions[cls];
      const bindings: ClassUsageBinding[] = run.classUsageBindings?.[cls] || [];
      const repLine = bindings[0]?.line ?? 1;
      const ok = await send(`${cls} (untagged)`, {
        line: repLine,
        candidates: [],
        chosenPattern: dec.isPattern ? dec.patternName.trim() : null,
        chosenKind: dec.isPattern ? 'pattern' : 'none'
      });
      if (ok) markSaved(cls);
    }
    // Likert ratings go to the per-run survey endpoint (run_feedback
    // table) — they're scoped to THIS run, distinct from the
    // session-feedback collected at sign-out. We post them as ONE
    // bulk call instead of row-by-row, so the network shape matches
    // what the survey table expects (a `ratings` map per run).
    const likertRatings: Record<string, number> = {};
    for (const group of PER_RUN_QUESTIONS) {
      for (const q of group.questions) {
        const rating = likert[q.id];
        if (rating) likertRatings[q.id] = rating;
      }
    }
    if (Object.keys(likertRatings).length > 0) {
      try {
        const { submitRunSurvey } = await import('../../api/client');
        await submitRunSurvey(String(effectiveRunId), likertRatings, {});
        for (const id of Object.keys(likertRatings)) markSaved(`likert-${id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        rejected.push(`Per-run Likert: ${msg}`);
      }
    }
    setSubmitting(false);
    if (rejected.length === 0) {
      setStatus({ kind: 'ok', title: 'Validation submitted', detail: 'Thanks for the feedback.' });
      return true;
    }
    setError(
      `Backend rejected ${rejected.length} row(s): ${rejected.slice(0, 3).join('; ')}${rejected.length > 3 ? '…' : ''}`
    );
    return false;
  }

  // ── render ────────────────────────────────────────────────────────────────

  const isSaved = !pendingSave && !!run.runId;
  const completeness = isComplete();

  return (
    <section className="tab-panel tab-ambiguous">
      {redirectIn !== null && (
        <div className="modal-overlay" role="status" aria-live="polite">
          <div className="modal-card" style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2>Validation submitted ✓</h2>
            <p>Thanks for the feedback. Redirecting to the source tab in <strong>{redirectIn}s</strong>…</p>
          </div>
        </div>
      )}
      <div className="review-action-bar">
        <div className="review-action-status" data-saved={isSaved ? 'true' : undefined}>
          {submitted ? (
            <><strong>Saved and submitted</strong> · run #{run.runId} · waiting for response</>
          ) : isSaved ? (
            <><strong>Run saved</strong> · run #{run.runId} · ready to submit validation</>
          ) : (
            <><strong>Unsaved run</strong> · save and submit in one click below</>
          )}
        </div>
        <div className="review-action-buttons">
          {pendingSave && (
            <button
              type="button"
              className="ghost-btn discard-btn"
              onClick={() => { if (confirm('Discard this run? Your tags and edits will be lost.')) onDiscard(); }}
            >
              Discard run
            </button>
          )}
          {/* One button: save (if needed) then submit. Sequence runs in
              order; the user no longer has to click two buttons. */}
          {/* One button, constant label, single user click. The
              background sequence (save run → submit each validation
              row) is invisible from the UI — the user just sees one
              action. Disabled until every required row has an answer. */}
          <button
            type="button"
            className="primary-btn"
            disabled={savingRun || submitting || submitted || !completeness.ok}
            onClick={handleSaveAndSubmit}
            title={submitted
              ? 'Already submitted for this run.'
              : !completeness.ok
                ? `Missing: ${completeness.missing.length} row(s)`
                : 'Save the run, then submit validation feedback'}
          >
            {submitted
              ? 'Submitted ✓'
              : savingRun || submitting
                ? 'Working…'
                : 'Save and submit for validation'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <nav className="review-subtab-bar" role="tablist" aria-label="Review sections">
        {SUB_TABS.map(t => {
          const done = subTabComplete(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === t.id}
              data-complete={done ? 'true' : undefined}
              className={`review-subtab-btn ${activeSubTab === t.id ? 'is-active' : ''}`}
              onClick={() => setActiveSubTab(t.id)}
            >
              {t.label}{done ? ' ✓' : ''}
            </button>
          );
        })}
      </nav>

      {activeSubTab === 'validation' && !gdbAllPassedForRun && (
        <div className="empty-state">
          <p><strong>Validation locked.</strong></p>
          <p>
            Finish the workflow first: submit source → tag any ambiguous
            classes on the Annotated tab → run all unit tests on the
            GDB Runner. The validation rows below populate automatically
            once every step passes.
          </p>
        </div>
      )}
      {activeSubTab === 'validation' && gdbAllPassedForRun && (
        <>
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
                      onDecide={correct => setTagged(key, { correct })}
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
                    onDecide={isPattern => setUntagged(className, { isPattern })}
                    onPatternName={name => setUntagged(className, { patternName: name })}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {activeSubTab !== 'validation' && (() => {
        const idx = parseInt(activeSubTab.split('-')[1] || '0', 10);
        const group = PER_RUN_QUESTIONS[idx];
        if (!group) return null;
        return (
          <div className="checklist-section">
            <header className="checklist-section-header">
              <h3>{group.title}</h3>
              <p className="checklist-section-desc">
                Rate each statement on a 1–5 Likert scale. <strong>All rows are required.</strong>
              </p>
            </header>
            <ul className="checklist-list">
              {group.questions.map(q => (
                <LikertRow
                  key={q.id}
                  q={q}
                  value={likert[q.id] ?? null}
                  onChange={n => setLikert(prev => ({ ...prev, [q.id]: n }))}
                />
              ))}
            </ul>
          </div>
        );
      })()}

      <div className="review-subtab-nav">
        <button
          type="button"
          className="ghost-btn"
          disabled={SUB_TABS.findIndex(t => t.id === activeSubTab) === 0}
          onClick={() => {
            const i = SUB_TABS.findIndex(t => t.id === activeSubTab);
            if (i > 0) setActiveSubTab(SUB_TABS[i - 1].id);
          }}
        >← Back</button>
        {/* One button, constant label, single user click. The
            background sequence (save run → submit each validation row)
            is invisible from the UI — the user just sees one action.
            Disabled until every required row has an answer. */}
        {SUB_TABS.findIndex(t => t.id === activeSubTab) === SUB_TABS.length - 1 ? (
          <button
            type="button"
            className="primary-btn"
            disabled={savingRun || submitting || submitted || !completeness.ok}
            onClick={handleSaveAndSubmit}
            title={submitted
              ? 'Already submitted for this run.'
              : !completeness.ok
                ? `Missing: ${completeness.missing.length} row(s)`
                : 'Save the run, then submit validation feedback'}
          >
            {submitted
              ? 'Submitted ✓'
              : savingRun || submitting
                ? 'Working…'
                : 'Save and submit for validation'}
          </button>
        ) : (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              const i = SUB_TABS.findIndex(t => t.id === activeSubTab);
              if (i < SUB_TABS.length - 1) setActiveSubTab(SUB_TABS[i + 1].id);
            }}
          >Next →</button>
        )}
      </div>
    </section>
  );
}
