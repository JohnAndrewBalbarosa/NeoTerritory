import { useMemo, useState } from 'react';
import { patchLearningModule, previewCoursePlan } from '../../api/client';
import type {
  AdminCoursePlan,
  AdminCoursePlanAiValidation,
  AdminCoursePlanPatternDiversity,
  AdminLearningModule,
} from '../../types/api';
import { buildModuleSwitchboard, groupModuleSwitchboard } from '../../logic/moduleSwitchboard';
import CoursePlanPatternAudit from './CoursePlanPatternAudit';

type VerificationState = 'verified' | 'fallback' | 'failed';

function humanizeReason(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function summarizeValidation(validation: AdminCoursePlanAiValidation | null | undefined): string | null {
  if (!validation) return null;
  const pieces = [
    `${validation.status} in ${validation.mode} mode`,
    `${validation.acceptedModuleIds.length} accepted`,
  ];
  if (validation.issues.length > 0) {
    pieces.push(`issues: ${validation.issues.map(humanizeReason).join(', ')}`);
  }
  return pieces.length > 0 ? pieces.join(' | ') : null;
}

function summarizeDiversity(diversity: AdminCoursePlanPatternDiversity | null | undefined): string | null {
  if (!diversity) return null;
  const familyCount = Object.keys(diversity.selectedFamilies).length;
  const pieces = [
    `score ${formatNumber(diversity.diversityScore)}`,
    `${diversity.selectedSlugs.length} patterns`,
    `${familyCount} families`,
  ];
  if (diversity.adapter.blockedReason) {
    pieces.push(`adapter ${humanizeReason(diversity.adapter.blockedReason)}`);
  }
  return pieces.join(' | ');
}

function resolveVerificationState(plan: AdminCoursePlan): {
  state: VerificationState;
  title: string;
  detail: string;
} {
  const diagnostics = plan.diagnostics;
  const validation = diagnostics?.aiValidation ?? null;
  const fallbackReason = diagnostics?.fallbackReason ?? null;
  const aiSucceeded = diagnostics?.aiSucceeded ?? plan.source === 'ai';
  const fallbackUsed = Boolean(fallbackReason) || plan.source === 'heuristic' || !aiSucceeded;
  const validationFailed = validation?.status === 'failed' && !fallbackUsed;
  if (validationFailed) {
    return {
      state: 'failed',
      title: 'Verification failed',
      detail:
        summarizeValidation(validation)
        ?? diagnostics?.aiError
        ?? diagnostics?.message
        ?? 'The AI plan did not pass verification.',
    };
  }
  if (fallbackUsed) {
    return {
      state: 'fallback',
      title: 'Fallback used',
      detail:
        summarizeValidation(validation)
        ?? diagnostics?.message
        ?? (fallbackReason ? `Fallback reason: ${humanizeReason(fallbackReason)}` : 'The heuristic fallback generated this plan.'),
    };
  }
  return {
    state: 'verified',
    title: 'Verified',
    detail:
      summarizeValidation(validation)
      ?? diagnostics?.message
      ?? 'The AI plan passed verification.',
  };
}

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
  const changedPreview = useMemo(
    () => switchboard.filter((item) => item.currentPublished !== item.effectivePublished),
    [switchboard],
  );
  const requiredLearningIds = useMemo(
    () => new Set((plan?.requiredLearning ?? []).map((item) => item.moduleId)),
    [plan],
  );
  const aiEnabledRows = useMemo(
    () => switchboard.filter(
      (item) => item.effectivePublished && !item.protectedBaseline && !requiredLearningIds.has(item.moduleId),
    ),
    [requiredLearningIds, switchboard],
  );
  const aiGroups = useMemo(
    () => groupModuleSwitchboard(aiEnabledRows),
    [aiEnabledRows],
  );
  const aiChangedCount = useMemo(
    () => aiEnabledRows.filter((item) => item.currentPublished !== item.effectivePublished).length,
    [aiEnabledRows],
  );

  const diagnostics = plan?.diagnostics ?? null;
  const verification = plan ? resolveVerificationState(plan) : null;
  const verificationToneClass = verification ? `is-${verification.state}` : '';
  const validationSummary = summarizeValidation(diagnostics?.aiValidation ?? null);
  const diversitySummary = summarizeDiversity(diagnostics?.patternDiversity ?? null);
  const aiResponseState = diagnostics
    ? (diagnostics.aiSucceeded ? 'AI response accepted' : diagnostics.aiAttempted ? 'AI response rejected' : 'AI response not attempted')
    : null;

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
              {state === 'loading' ? 'Sending...' : 'Send prompt'}
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
            {verification && diagnostics && (
              <div
                className={`admin-plan-verification ${verificationToneClass}`}
                role="status"
                data-testid="course-plan-verification-strip"
              >
                <div className="admin-plan-verification__copy">
                  <div className="admin-plan-verification__title-row">
                    <span className={`tag ${verification.state === 'failed' ? 'tag--off' : 'tag--on'}`}>{verification.title}</span>
                    <strong>{plan.source === 'ai' ? 'AI plan' : 'Fallback plan'}</strong>
                  </div>
                  <p>{verification.detail}</p>
                  {diagnostics.aiError && <p>AI error: {diagnostics.aiError}</p>}
                  {validationSummary && <p>AI validation: {validationSummary}</p>}
                  {diversitySummary && <p>Pattern diversity: {diversitySummary}</p>}
                </div>
                <div className="admin-plan-diagnostics__chips">
                  {aiResponseState && (
                    <span className={diagnostics.aiSucceeded ? 'tag tag--on' : 'tag tag--off'}>
                      {aiResponseState}
                    </span>
                  )}
                  <span className="tag tag--on">{diagnostics.catalogModuleCount} catalog</span>
                  <span className={diagnostics.selectedSectionCount > 0 ? 'tag tag--on' : 'tag tag--off'}>
                    {diagnostics.selectedSectionCount} sections
                  </span>
                  <span className={diagnostics.selectedModuleCount > 0 ? 'tag tag--on' : 'tag tag--off'}>
                    {diagnostics.selectedModuleCount} modules
                  </span>
                  <span className={diagnostics.aiSucceeded ? 'tag tag--on' : 'tag tag--off'}>
                    {diagnostics.aiSucceeded ? 'AI success' : 'AI pending'}
                  </span>
                  {diagnostics.fallbackReason && (
                    <span className="tag tag--off">{humanizeReason(diagnostics.fallbackReason)}</span>
                  )}
                  {diagnostics.aiValidation && (
                    <span className="tag tag--on">
                      validation {diagnostics.aiValidation.status}
                    </span>
                  )}
                  {diagnostics.patternDiversity && (
                    <span className="tag tag--on">
                      diversity {formatNumber(diagnostics.patternDiversity.diversityScore)}
                    </span>
                  )}
                </div>
              </div>
            )}
            {plan.diagnostics?.patternAudit?.length ? (
              <CoursePlanPatternAudit entries={plan.diagnostics.patternAudit} />
            ) : null}
            <div className="admin-plan-board" data-testid="course-plan-ai-enabled-board">
              <div className="admin-plan-board__head">
                <div>
                  <h3>AI-enabled modules</h3>
                  <p className="admin-section__hint">
                    {aiEnabledRows.length} non-required module{aiEnabledRows.length === 1 ? '' : 's'} enabled by the plan.
                  </p>
                </div>
                <div className="admin-plan-board__counts">
                  <span className="tag tag--on">{aiEnabledRows.length} enabled</span>
                  <span className="tag tag--on">{aiGroups.length} sections</span>
                  {aiChangedCount > 0 && (
                    <span className="tag tag--off">{aiChangedCount} pending change{aiChangedCount === 1 ? '' : 's'}</span>
                  )}
                </div>
              </div>

              {aiEnabledRows.length === 0 ? (
                <div className="admin-plan-empty">
                  <p className="admin-feature-row__label">No non-foundation modules were enabled</p>
                </div>
              ) : (
                <div className="admin-plan-sections">
                  {aiGroups.map((section) => {
                    const changedCount = section.rows.filter((row) => row.currentPublished !== row.effectivePublished).length;
                    return (
                      <article key={section.sectionId} className="admin-plan-section-card">
                        <div className="admin-plan-section-card__head">
                          <div>
                            <h4>{section.section}</h4>
                            <p className="admin-section__hint">
                              {section.effectiveOn} AI-enabled module{section.effectiveOn === 1 ? '' : 's'} in this section
                            </p>
                          </div>
                          <div className="admin-plan-section-card__counts">
                            <span className="tag tag--on">{section.currentOn} current on</span>
                            <span className="tag tag--on">{section.effectiveOn} effective on</span>
                          </div>
                        </div>
                        <div className="admin-plan-section-card__meta">
                          <span className="tag tag--on">{section.sectionId}</span>
                          <span className="admin-plan-section-card__summary">
                            {section.rows.length} module{section.rows.length === 1 ? '' : 's'} enabled
                          </span>
                          <span className="admin-plan-section-card__summary">
                            {section.currentOff} currently off
                          </span>
                          {changedCount > 0 && (
                            <span className="admin-plan-section-card__summary">
                              {changedCount} pending change{changedCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <ul className="admin-plan-section-list">
                          {section.rows.map((item) => (
                            <li
                              key={item.moduleId}
                              className={`admin-feature-row admin-feature-row--preview admin-plan-ai-row${item.currentPublished === item.effectivePublished ? '' : ' is-changed'}`}
                              data-testid="course-plan-ai-enabled-row"
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
            </div>

          </>
        )}
          <div className="admin-plan-board__actions">
            {plan && (
              <p className="admin-section__hint">
                Only the modules enabled by the plan appear above. Required modules are marked in the main table.
              </p>
            )}
          </div>

          <button
            type="button"
            className="primary-btn admin-policy-confirm"
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
