import { useState } from 'react';
import { useAppStore, StudioTab } from '../../store/appState';
import { useHealth } from '../../hooks/useHealth';
import { useAuth } from '../../hooks/useAuth';
import { useAiCommentaryPoll } from '../../hooks/useAiCommentaryPoll';
import SubmitTab from '../tabs/SubmitTab';
import AnnotatedTab from '../tabs/AnnotatedTab';
import AmbiguousTab from '../tabs/AmbiguousTab';
import AmbiguityModal from '../modals/AmbiguityModal';
import SavePrompt from '../modals/SavePrompt';
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
}

interface AmbiguityState {
  run: AnalysisRun;
  pending: Omit<PendingSave, 'userResolvedPattern'>;
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
  { id: 'ambiguous',  label: 'Ambiguous Review' }
];

export default function MainLayout() {
  useHealth();
  useAiCommentaryPoll();
  const {
    status, msState, msLabel, user, sessionRanAnalyze, sessionReviewedEnd,
    token, activeTab, setActiveTab, consentAccepted, pretestSubmitted,
    setAiStatus, aiStatus, aiConfigured
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

  const [ambiguity, setAmbiguity] = useState<AmbiguityState | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [showSignout, setShowSignout] = useState(false);
  const [runRefreshSignal, setRunRefreshSignal] = useState(0);

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
    const pending = { pendingId: run.pendingId, sourceName: run.sourceName, patternCount, commentCount };
    if (run.ranking?.verdict === 'ambiguous' && (run.ranking.ambiguousCandidates || []).length) {
      setAmbiguity({ run, pending });
    } else {
      setPendingSave({ ...pending, userResolvedPattern: null });
    }
  }

  function onAmbiguityResolved(patternId: string | null) {
    if (!ambiguity) return;
    setPendingSave({ ...ambiguity.pending, userResolvedPattern: patternId });
    setAmbiguity(null);
  }

  function onSaved(runId: number) {
    setPendingSave(null);
    setRunRefreshSignal(s => s + 1);
    setReview({ scope: 'per-run', analysisRunId: runId, intro: 'Quick rating for this run (optional):' });
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

  // Gate: consent first.
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
          <div id="ai-row" className="ai-row" data-status={aiChipStatus}>
            <span className="ms-dot" aria-hidden="true"></span>
            <span className="ms-label">AI:</span>
            <strong id="ai-status-label">{aiChipLabel}</strong>
          </div>
          <div id="user-row" className="user-row">
            <span id="user-label">{user?.username ?? ''}</span>
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
          <SubmitTab onAnalysisComplete={onAnalysisComplete} refreshSignal={runRefreshSignal} />
        )}
        {activeTab === 'annotated' && (
          <AnnotatedTab onLineFlash={flashLine} onCommentFlash={flashComment} />
        )}
        {activeTab === 'ambiguous' && <AmbiguousTab />}
      </main>

      {ambiguity && ambiguity.run.ranking && (
        <AmbiguityModal
          ranking={ambiguity.run.ranking}
          sourceName={ambiguity.run.sourceName}
          onConfirm={onAmbiguityResolved}
          onSkip={() => onAmbiguityResolved(null)}
        />
      )}
      {pendingSave && (
        <SavePrompt
          pendingId={pendingSave.pendingId}
          sourceName={pendingSave.sourceName}
          patternCount={pendingSave.patternCount}
          commentCount={pendingSave.commentCount}
          userResolvedPattern={pendingSave.userResolvedPattern}
          onSaved={onSaved}
          onDiscard={() => setPendingSave(null)}
        />
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
