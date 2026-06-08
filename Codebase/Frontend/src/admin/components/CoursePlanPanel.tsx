import { useEffect, useMemo, useState } from 'react';
import { patchLearningModule, previewCoursePlan } from '../../api/client';
import type { AdminCoursePlan, AdminLearningModule } from '../../types/api';
import { buildModuleSwitchboard, countSwitchboard } from '../../logic/moduleSwitchboard';

interface CoursePlanPanelProps {
  modules: ReadonlyArray<AdminLearningModule>;
  onApplied: () => Promise<void> | void;
  onPreviewChange?: (plan: AdminCoursePlan | null) => void;
}

export default function CoursePlanPanel({
  modules,
  onApplied,
  onPreviewChange,
}: CoursePlanPanelProps): JSX.Element {
  const [promptText, setPromptText] = useState('');
  const [plan, setPlan] = useState<AdminCoursePlan | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    const prompt = promptText.trim();
    if (!prompt) {
      setPlan(null);
      onPreviewChange?.(null);
      setState('idle');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setState('loading');
      previewCoursePlan({ prompt })
        .then((nextPlan) => {
          if (cancelled) return;
          setPlan(nextPlan);
          onPreviewChange?.(nextPlan);
          setState('ready');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setPlan(null);
          onPreviewChange?.(null);
          setState('failed');
          setError(err instanceof Error ? err.message : 'Course plan failed');
        });
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onPreviewChange, promptText]);

  const switchboard = useMemo(
    () => buildModuleSwitchboard(modules, plan?.modules),
    [modules, plan],
  );
  const changedPreview = useMemo(
    () => switchboard.filter((item) => item.currentPublished !== item.effectivePublished),
    [switchboard],
  );
  const counts = useMemo(() => countSwitchboard(switchboard), [switchboard]);
  const enabledPreview = useMemo(
    () => switchboard.filter((item) => item.effectivePublished),
    [switchboard],
  );
  const disabledPreview = useMemo(
    () => switchboard.filter((item) => !item.effectivePublished),
    [switchboard],
  );

  async function applyPlan(): Promise<void> {
    if (saving || !plan) return;
    setSaving(true);
    setError(null);
    setResultMessage(null);
    try {
      await Promise.all(
        changedPreview.map((item) => patchLearningModule(item.moduleId, { published: item.effectivePublished })),
      );
      await onApplied();
      setPromptText('');
      setPlan(null);
      onPreviewChange?.(null);
      setState('idle');
      setResultMessage('AI course plan applied. Modules now follow implicit deny.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply course plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="course-plan-panel">
      <header className="admin-section__head">
        <h2>Course planner</h2>
        <p className="admin-section__hint">
          Prompt-driven course scope. All modules start OFF by default; the AI plan decides which courses should turn ON.
        </p>
      </header>

      {error && <p className="admin-login-error" role="alert">{error}</p>}
      {resultMessage && <p className="admin-success-pill" role="status">{resultMessage}</p>}

      <div className="admin-policy-editor">
        <div className="admin-prompt-box">
          <label htmlFor="course-plan-prompt">Course Prompt</label>
          <textarea
            id="course-plan-prompt"
            placeholder="Describe the project architecture and business flow. The AI will choose which modules should turn on."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
          <div className="admin-prompt-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setPromptText('');
                setPlan(null);
                onPreviewChange?.(null);
                setState('idle');
                setResultMessage(null);
              }}
              disabled={!promptText}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="admin-policy-preview">
          <h3>AI course plan</h3>
          {state === 'loading' && <p className="admin-section__hint">Generating JSON course plan&hellip;</p>}
          {state === 'failed' && <p className="admin-login-error" role="alert">AI preview failed. Default OFF stays intact.</p>}
          {plan && (
            <>
              <p className="admin-section__hint">{plan.summary}</p>
              <div className="admin-plan-scope">
                <h4>Required learning</h4>
                {plan.requiredLearning.length === 0 ? (
                  <p className="admin-section__hint">No required learning modules were selected.</p>
                ) : (
                  <ul className="admin-scope-list">
                    {plan.requiredLearning.map((item) => (
                      <li key={item.moduleId} className="admin-scope-card">
                        <strong>{item.title}</strong>
                        <p>{item.reason}</p>
                        <div className="admin-scope-meta">
                          <span>{item.category}</span>
                          <span>{item.sections.length} sections</span>
                          <span>{item.topics.length} topics</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <div className="admin-plan-board">
            <div className="admin-plan-board__head">
              <h3>Modules by AI</h3>
              <p className="admin-section__hint">
                {counts.on} on, {counts.off} off.
              </p>
            </div>

            <ul className="admin-feature-list admin-feature-list--compact">
              {enabledPreview.length === 0 ? (
                <li className="admin-feature-row admin-feature-row--preview">
                  <div className="admin-feature-row__meta">
                    <p className="admin-feature-row__label">No modules switched on</p>
                    <p className="admin-feature-row__explanation">
                      The AI kept everything off, which means the prompt did not require a publish change.
                    </p>
                  </div>
                </li>
              ) : enabledPreview.map((item) => (
                <li
                  key={item.moduleId}
                  className={`admin-feature-row admin-feature-row--preview${item.currentPublished === item.effectivePublished ? '' : ' is-changed'}`}
                >
                  <div className="admin-feature-row__meta">
                    <p className="admin-feature-row__label">{item.title}</p>
                    <p className="admin-feature-row__explanation">{item.reason}</p>
                    {item.matchedSections.length > 0 && (
                      <p className="admin-feature-row__desc">Sections: {item.matchedSections.join(', ')}</p>
                    )}
                    {item.matchedTopics.length > 0 && (
                      <p className="admin-feature-row__desc">Topics: {item.matchedTopics.slice(0, 6).join(', ')}</p>
                    )}
                  </div>
                  <div className="admin-feature-row__delta">
                    <span className={`tag ${item.currentPublished ? 'tag--on' : 'tag--off'}`}>{item.currentPublished ? 'ON' : 'OFF'}</span>
                    <span className="arrow" aria-hidden="true">&rarr;</span>
                    <span className={`tag ${item.effectivePublished ? 'tag--on' : 'tag--off'}`}>{item.effectivePublished ? 'ON' : 'OFF'}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="admin-plan-board__actions">
              <p className="admin-section__hint">
                {disabledPreview.length} modules stay off unless turned on by AI.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ghost-btn admin-policy-confirm"
            disabled={saving || !plan || changedPreview.length === 0}
            onClick={() => { void applyPlan(); }}
          >
            {saving ? 'Saving...' : 'Apply AI course plan'}
          </button>

        </div>
      </div>
    </section>
  );
}
