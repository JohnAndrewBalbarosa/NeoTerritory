import { useEffect, useMemo, useState } from 'react';
import { patchLearningModule, previewCoursePlan } from '../../api/client';
import type { AdminCoursePlan, AdminLearningModule } from '../../types/api';

interface CoursePlanPanelProps {
  modules: ReadonlyArray<AdminLearningModule>;
  onApplied: () => Promise<void> | void;
}

export default function CoursePlanPanel({ modules, onApplied }: CoursePlanPanelProps): JSX.Element {
  const [promptText, setPromptText] = useState('');
  const [plan, setPlan] = useState<AdminCoursePlan | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prompt = promptText.trim();
    if (!prompt) {
      setPlan(null);
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
          setState('ready');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setPlan(null);
          setState('failed');
          setError(err instanceof Error ? err.message : 'Course plan failed');
        });
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [promptText]);

  const modulePreview = useMemo(() => {
    const byId = new Map((plan?.modules || []).map((item) => [item.moduleId, item]));
    return modules.map((module) => {
      const chosen = byId.get(module.id);
      return {
        id: module.id,
        title: module.title,
        current: module.published,
        next: chosen?.published ?? false,
        reason: chosen?.reason ?? 'No AI plan yet. Defaults to OFF.',
        matchedSections: chosen?.matchedSections ?? [],
        matchedTopics: chosen?.matchedTopics ?? [],
      };
    });
  }, [modules, plan]);

  async function applyPlan(): Promise<void> {
    if (saving || !plan) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        modulePreview.map((item) => patchLearningModule(item.id, { published: item.next })),
      );
      await onApplied();
      setPromptText('');
      setPlan(null);
      setState('idle');
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
          Prompt-driven course scope. All modules start OFF by default; the AI plan decides which courses should be published.
        </p>
      </header>

      {error && <p className="admin-login-error" role="alert">{error}</p>}

      <div className="admin-policy-editor">
        <div className="admin-prompt-box">
          <label htmlFor="course-plan-prompt">Course Prompt</label>
          <textarea
            id="course-plan-prompt"
            placeholder="Describe the project architecture and business flow. The AI will choose which modules should be published."
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
                setState('idle');
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

          <h3>Publish preview</h3>
          <ul className="admin-feature-list">
            {modulePreview.map((item) => (
              <li
                key={item.id}
                className={`admin-feature-row admin-feature-row--preview${item.current === item.next ? '' : ' is-changed'}`}
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
                  <span className={`tag ${item.current ? 'tag--on' : 'tag--off'}`}>{item.current ? 'ON' : 'OFF'}</span>
                  <span className="arrow">→</span>
                  <span className={`tag ${item.next ? 'tag--on' : 'tag--off'}`}>{item.next ? 'ON' : 'OFF'}</span>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="ghost-btn admin-policy-confirm"
            disabled={saving || !plan}
            onClick={() => { void applyPlan(); }}
          >
            {saving ? 'Saving...' : 'Apply AI course plan'}
          </button>
        </div>
      </div>
    </section>
  );
}
