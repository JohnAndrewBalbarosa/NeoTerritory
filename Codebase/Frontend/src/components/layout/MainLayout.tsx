import { useEffect, useState } from 'react';
import { useAppStore, StudioTab } from '../../store/appState';
import { useHealth } from '../../hooks/useHealth';
import { useAuth } from '../../hooks/useAuth';
import { useAiCommentaryPoll } from '../../hooks/useAiCommentaryPoll';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useTheme } from '../../hooks/useTheme';
import SubmitTab from '../tabs/SubmitTab';
import AnnotatedTab from '../tabs/AnnotatedTab';
import AmbiguousTab from '../tabs/AmbiguousTab';
import GdbRunnerTab from '../tabs/GdbRunnerTab';
import ReviewModal from '../modals/ReviewModal';
import ConsentGate from '../survey/ConsentGate';
import PretestForm from '../survey/PretestForm';
import SignoutSurvey from '../survey/SignoutSurvey';
import { AnalysisRun } from '../../types/api';

interface PendingSave {
  pendingId: string;
  sourceName: string;
  patternCount: number;
  commentCount: number;
  userResolvedPattern: string | null;
  ambiguousVerdict: boolean;
}

interface ReviewState {
  scope: string;
  analysisRunId: number | null;
  intro: string;
}

interface AnalyzeResponseLike extends AnalysisRun {
  aiJobId?: string | null;
  aiStatus?: 'pending' | 'disabled';
}

function flashLine(line: number) {
  const el = document.querySelector<HTMLElement>(`.src-line[data-line="${line}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}

function flashComment(id: string) {
  const card = document.getElementById(id);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 1200);
}

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'submit',     label: 'Submit' },
  { id: 'annotated',  label: 'Annotated Source' },
  { id: 'gdb',        label: 'GDB Runner' },
  { id: 'ambiguous',  label: 'Review before submission' }
];

export default function MainLayout() {
  useHealth();
  useAiCommentaryPoll();
  useHeartbeat();
  const { theme, toggleTheme } = useTheme();
  const {
    status, msState, msLabel, dockerState, dockerLabel, user, sessionRanAnalyze, sessionReviewedEnd,
    token, activeTab, setActiveTab, consentAccepted, pretestSubmitted,
    setAiStatus, aiStatus, aiConfigured, setStatus
  } = useAppStore();

  const aiChipStatus = !aiConfigured ? 'offline'
    : aiStatus === 'pending'  ? 'working'
    : aiStatus === 'failed'   ? 'error'
    : aiStatus === 'disabled' ? 'offline'
    : 'ready';

  const aiChipLabel = !aiConfigured  ? 'not configured'
    : aiStatus === 'pending'  ? 'working…'
    : aiStatus === 'failed'   ? 'failed'
    : aiStatus === 'disabled' ? 'disabled'
    : aiStatus === 'ready'    ? 'done'
    : 'ready';
  const { signOut } = useAuth();

  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [showSignout, setShowSignout] = useState(false);
  const [runRefreshSignal, setRunRefreshSignal] = useState(0);
  const [analyzeReplace, setAnalyzeReplace] = useState<{ run: () => void } | null>(null);

  function onAnalysisComplete(run: AnalysisRun) {
    const r = run as AnalyzeResponseLike;
    if (r.aiJobId && r.aiStatus === 'pending') {
      setAiStatus('pending', r.aiJobId);
    } else {
      setAiStatus(r.aiStatus === 'disabled' ? 'disabled' : 'idle', null);
    }
    if (!run.pendingId) return;
    const patternCount = (run.detectedPatterns || []).length;
    const commentCount = (run.annotations || []).length;
    const ambiguous = run.ranking?.verdict === 'ambiguous'
      && (run.ranking.ambiguousCandidates || []).length > 0;
    // The auto-blocking ambiguity modal was removed because PatternCards and
    // the class popout already expose the same picker. Surface a non-blocking
    // status nudge instead so the user knows there were tied candidates.
    if (ambiguous) {
      setStatus({
        kind: 'busy',
        title: 'Multiple patterns matched',
        detail: 'Use "Tag pattern…" on a card or class chip to choose, or save to keep all.'
      });
    }
    setPendingSave({
      pendingId: run.pendingId,
      sourceName: run.sourceName,
      patternCount,
      commentCount,
      userResolvedPattern: null,
      ambiguousVerdict: ambiguous
    });
  }

  function onSaved(runId: number) {
    setPendingSave(null);
    setRunRefreshSignal(s => s + 1);
    // Stamp the runId on currentRun so the validation submit endpoint knows
    // which row to attach manual-review answers to.
    useAppStore.getState().patchCurrentRun({ runId });
    setReview({ scope: 'per-run', analysisRunId: runId, intro: 'Quick rating for this run (optional):' });
  }

  function discardCurrentRun(): void {
    setPendingSave(null);
    useAppStore.getState().setCurrentRun(null);
    setStatus({ kind: 'idle', title: 'Discarded', detail: 'Run was not saved.' });
  }

  // Single popup: prompt only when there's already a run on screen. First
  // run dispatches immediately. The popup is the only confirmation.
  function beforeAnalyze(dispatch: () => void): void {
    const hasCurrentRun = !!useAppStore.getState().currentRun;
    if (hasCurrentRun) {
      setAnalyzeReplace({ run: dispatch });
      return;
    }
    dispatch();
  }

  function onSignOutClick() {
    if (sessionRanAnalyze && !sessionReviewedEnd && token) {
      setShowSignout(true);
      return;
    }
    signOut();
  }

  function onSignoutComplete() {
    useAppStore.getState().setSessionReviewedEnd(true);
    setShowSignout(false);
    signOut();
  }

  function onReviewClose(_submitted: boolean) {
    setReview(null);
  }

  // Admins skip the research-participant gates entirely. Their place is the
  // /admin dashboard, not the studio. Send them there immediately.
  useEffect(() => {
    if (token && user?.role === 'admin' && !window.location.pathname.startsWith('/admin')) {
      window.location.href = '/admin.html';
    }
  }, [token, user]);
  if (token && user?.role === 'admin') return null;

  // Reflect each gate in the URL so the address bar distinguishes consent
  // and pretest from the studio home. replaceState avoids back-button noise.
  if (token && user && typeof window !== 'undefined') {
    const path = window.location.pathname;
    const expected = !consentAccepted ? '/consent' : !pretestSubmitted ? '/pretest' : '/studio';
    if (path !== expected && path !== '/admin.html') {
      window.history.replaceState(null, '', expected);
    }
  }

  // Gate: consent first (research participants only).
  if (token && user && !consentAccepted) {
    return <ConsentGate />;
  }
  // Gate: pretest second (auto-skips when surveyQuestions.pretest is empty).
  if (token && user && !pretestSubmitted) {
    return <PretestForm />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">NeoTerritory Studio</p>
          <h1>Pattern detection &amp; annotation</h1>
          <p className="lede">
            Paste C++ source or upload a file. The microservice detects design patterns
            and the studio shows comments side-by-side with the lines they reference.
          </p>
        </div>
        <div id="status-card" className="status-card" data-kind={status.kind}>
          <span className="status-label">Backend</span>
          <strong id="status-title">{status.title}</strong>
          <span id="status-detail">{status.detail}</span>
          <div id="ms-row" className="ms-row" data-state={msState}>
            <span className="ms-dot" aria-hidden="true"></span>
            <span className="ms-label">Microservice:</span>
            <strong id="ms-status">{msLabel}</strong>
          </div>
          <div id="docker-row" className="ms-row" data-state={dockerState}>
            <span className="ms-dot" aria-hidden="true"></span>
            <span className="ms-label">Docker service:</span>
            <strong id="docker-status">{dockerLabel}</strong>
          </div>
          <div id="ai-row" className="ai-row" data-status={aiChipStatus}>
            <span className="ms-dot" aria-hidden="true"></span>
            <span className="ms-label">AI:</span>
            <strong id="ai-status-label">{aiChipLabel}</strong>
          </div>
          <div id="user-row" className="user-row">
            <span id="user-label">{user?.username ?? ''}</span>
            <button
              className="ghost-btn theme-toggle-btn"
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
            <button id="logout-btn" className="ghost-btn" type="button" onClick={onSignOutClick}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-bar" role="tablist" aria-label="Studio tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab-btn ${activeTab === t.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content tab-content">
        {activeTab === 'submit' && (
          <SubmitTab
            onAnalysisComplete={onAnalysisComplete}
            refreshSignal={runRefreshSignal}
            beforeAnalyze={beforeAnalyze}
          />
        )}
        {activeTab === 'annotated' && (
          <AnnotatedTab
            onLineFlash={flashLine}
            onCommentFlash={flashComment}
            pendingSave={!!pendingSave}
            onDiscard={discardCurrentRun}
            onGoToReview={() => setActiveTab('ambiguous')}
          />
        )}
        {activeTab === 'gdb' && <GdbRunnerTab />}
        {activeTab === 'ambiguous' && (
          <AmbiguousTab
            pendingSave={pendingSave}
            onSaved={onSaved}
            onDiscard={discardCurrentRun}
          />
        )}
      </main>

      {analyzeReplace && (
        <div className="modal-overlay" id="analyze-replace-modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Discard current results?</h3>
            <p className="modal-detail">Running a new analysis replaces the run on screen.</p>
            <div className="modal-actions">
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setAnalyzeReplace(null)}
              >No, keep editing</button>
              <button
                className="primary-btn"
                type="button"
                onClick={() => {
                  const fn = analyzeReplace.run;
                  setAnalyzeReplace(null);
                  discardCurrentRun();
                  fn();
                }}
              >Yes, discard</button>
            </div>
          </div>
        </div>
      )}
      {review && (
        <ReviewModal
          scope={review.scope}
          analysisRunId={review.analysisRunId}
          intro={review.intro}
          onClose={onReviewClose}
        />
      )}
      {showSignout && (
        <SignoutSurvey
          onComplete={onSignoutComplete}
          onCancel={() => setShowSignout(false)}
        />
      )}
    </div>
  );
}
