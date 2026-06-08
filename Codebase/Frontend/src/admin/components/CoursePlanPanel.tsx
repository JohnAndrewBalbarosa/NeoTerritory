import { useMemo, useState } from 'react';
import { patchLearningModule, previewCoursePlan } from '../../api/client';
import type { AdminCoursePlan, AdminLearningModule } from '../../types/api';
import { buildModuleSwitchboard, countSwitchboard, groupModuleSwitchboard } from '../../logic/moduleSwitchboard';

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

  async function runPreview(promptValue?: string): Promise<void> {
    const prompt = (promptValue ?? promptText).trim();
    if (!prompt || saving) return;
    setError(null);
    setResultMessage(null);
    setState('loading');
    try {
      const nextPlan = await previewCoursePlan({ prompt });
      setPlan(nextPlan);
      onPreviewChange?.(nextPlan);
      setState('ready');
    } catch (err: unknown) {
      setPlan(null);
      onPreviewChange?.(null);
      setState('failed');
      setError(err instanceof Error ? err.message : 'Course plan failed');
    }
  }

  const switchboard = useMemo(
    () => buildModuleSwitchboard(modules, plan),
    [modules, plan],
  );
  const groupedSwitchboard = useMemo(
    () => groupModuleSwitchboard(switchboard),
    [switchboard],
  );
  const changedPreview = useMemo(
    () => switchboard.filter((item) => item.currentPublished !== item.effectivePublished),
    [switchboard],
  );
  const counts = useMemo(() => countSwitchboard(switchboard), [switchboard]);
  const activeSections = useMemo(
    () => groupedSwitchboard.filter((section) => section.effectiveOn > 0),
    [groupedSwitchboard],
  );
  const prunedSections = Math.max(groupedSwitchboard.length - activeSections.length, 0);
  const offModules = Math.max(counts.off, 0);

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
        <form
          className="admin-prompt-box"
          onSubmit={(e) => {
            e.preventDefault();
            void runPreview();
          }}
        >
          <label htmlFor="course-plan-prompt">Course Prompt</label>
          <textarea
            id="course-plan-prompt"
            placeholder="Describe the project architecture and business flow. The AI will choose which modules should turn on."
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              setPlan(null);
              onPreviewChange?.(null);
              setState('idle');
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
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
            <button
              type="submit"
              className="primary-btn"
              disabled={!promptText.trim() || saving}
            >
              {state === 'loading' ? 'Sending…' : 'Send prompt'}
            </button>
          </div>
        </form>

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
                {activeSections.length} sections on, {prunedSections} pruned, {counts.on} modules on, {offModules} modules off.
              </p>
            </div>

            {activeSections.length === 0 ? (
              <div className="admin-plan-empty">
                <p className="admin-feature-row__label">No sections switched on</p>
                <p className="admin-feature-row__explanation">
                  The AI kept every section off, so the learner path stays unpublished.
                </p>
              </div>
            ) : (
              <div className="admin-plan-sections">
                {activeSections.map((section) => {
                  const visibleRows = section.rows.filter((row) => row.effectivePublished);
                  const hiddenCount = Math.max(section.rows.length - visibleRows.length, 0);
                  return (
                    <article key={section.sectionId} className="admin-plan-section-card">
                      <div className="admin-plan-section-card__head">
                        <div>
                          <h4>{section.section}</h4>
                          <p className="admin-section__hint">
                            {section.effectiveOn} modules on · {hiddenCount} modules off inside this section
                          </p>
                        </div>
                        <div className="admin-plan-section-card__counts">
                          <span className="tag tag--on">{section.currentOn} current on</span>
                          <span className="tag tag--on">{section.effectiveOn} effective on</span>
                        </div>
                      </div>
                      <ul className="admin-plan-section-list">
                        {visibleRows.map((item) => (
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
                    </article>
                  );
                })}
              </div>
            )}

            <div className="admin-plan-board__actions">
              <p className="admin-section__hint">
                {offModules} modules stay off unless turned on by AI. Missing sections are pruned automatically.
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
