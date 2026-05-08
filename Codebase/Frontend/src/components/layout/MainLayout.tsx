import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore, StudioTab } from '../../store/appState';
import { useOverflowGuard } from '../../hooks/useOverflowGuard';
import { useHealth } from '../../hooks/useHealth';
import { useAuth } from '../../hooks/useAuth';
import { useAiCommentaryPoll } from '../../hooks/useAiCommentaryPoll';
// import { useHeartbeat } from '../../hooks/useHeartbeat';  // TEMP: disabled, see useHeartbeat() call below
import { useTheme } from '../../hooks/useTheme';
import SubmitTab from '../tabs/SubmitTab';
import AnnotatedTab from '../tabs/AnnotatedTab';
import AmbiguousTab from '../tabs/AmbiguousTab';
import GdbRunnerTab from '../tabs/GdbRunnerTab';
import DocumentationTab from '../tabs/DocumentationTab';
import ReviewModal from '../modals/ReviewModal';
import ConsentGate from '../survey/ConsentGate';
import PretestForm from '../survey/PretestForm';
import SignoutSurvey from '../survey/SignoutSurvey';
import { AnalysisRun } from '../../types/api';
import {
  IconUpload,
  IconLayers,
  IconPlay,
  IconBook,
  IconCheckSquare,
  IconLock,
} from '../icons/Icons';
import type { ComponentType } from 'react';
import type { IconProps } from '../icons/Icons';

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

interface TabDef {
  id: StudioTab;
  label: string;
  icon: ComponentType<IconProps>;
}

const TABS: ReadonlyArray<TabDef> = [
  { id: 'submit',     label: 'Submit',     icon: IconUpload },
  { id: 'annotated',  label: 'Patterns',   icon: IconLayers },
  { id: 'gdb',        label: 'Tests',      icon: IconPlay },
  { id: 'docs',       label: 'Docs',       icon: IconBook },
  { id: 'ambiguous',  label: 'Self-check', icon: IconCheckSquare },
];

export default function MainLayout() {
  useHealth();
  useAiCommentaryPoll();
  // useHeartbeat();  // TEMP: disabled while debugging tagging/undo verification logs.
                      // Heartbeat already verified working — re-enable after observability sweep.
  // Dev-only viewport overflow detector for the studio shell.
  useOverflowGuard({ rootSelector: '.shell', tolerancePx: 2 });
  const { theme, toggleTheme } = useTheme();
  const {
    user, sessionRanAnalyze, sessionReviewedEnd,
    token, activeTab, setActiveTab, consentAccepted, pretestSubmitted,
    setAiStatus, setStatus,
    currentRun, gdbAllPassedForRun
  } = useAppStore();

  // Sequential tab gating. Each tab unlocks only after the previous is
  // complete, mirroring the natural workflow: submit → annotate → run
  // tests → review. Clicking a locked tab is a no-op (the button is
  // disabled with a tooltip explaining the prerequisite).
  function tabUnlocked(id: StudioTab): boolean {
    if (id === 'submit')    return true;
    if (id === 'annotated') return !!currentRun;            // need a finished analysis
    if (id === 'gdb')       return !!currentRun;            // need a finished analysis
    if (id === 'docs')      return !!currentRun;            // need a finished analysis
    if (id === 'ambiguous') return gdbAllPassedForRun;      // need GDB to have all-passed
    return true;
  }
  function tabLockReason(id: StudioTab): string | undefined {
    if (id === 'annotated' && !currentRun)        return 'Submit source code first.';
    if (id === 'gdb'       && !currentRun)        return 'Submit source code and complete annotation first.';
    if (id === 'docs'      && !currentRun)        return 'Submit source code first.';
    if (id === 'ambiguous' && !gdbAllPassedForRun) return 'Run the GDB unit tests and pass them all first.';
    return undefined;
  }

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
    // which row to attach manual-review answers to. The "Quick rating for
    // this run" modal that used to open here was per-run feedback NOT in
    // Questionnaire A/B; the formal questionnaire lives on the Ambiguous /
    // Validation tab and at sign-out, so this auto-popup was redundant
    // and confusing — removed.
    useAppStore.getState().patchCurrentRun({ runId });
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

  const isDeveloperEntryFlow =
    typeof window !== 'undefined' && window.sessionStorage.getItem('nt-entry-flow') === 'developer';

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
    const expected = isDeveloperEntryFlow
      ? '/studio'
      : !consentAccepted
        ? '/consent'
        : !pretestSubmitted
          ? '/pretest'
          : '/studio';
    if (path !== expected && path !== '/admin.html') {
      window.history.replaceState(null, '', expected);
    }
  }

  // Gate: consent first (research participants only).
  if (token && user && !isDeveloperEntryFlow && !consentAccepted) {
    return <ConsentGate />;
  }
  // Gate: pretest second (auto-skips when surveyQuestions.pretest is empty).
  if (token && user && !isDeveloperEntryFlow && !pretestSubmitted) {
    return <PretestForm />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-brand__dot" aria-hidden="true" />
          <span className="topbar-brand__name">NeoTerritory Studio</span>
        </div>
        <div className="topbar-actions">
          {user?.username && (
            <span className="topbar-user-chip" aria-label="Signed in as">
              {user.username}
            </span>
          )}
          <button
            className={`theme-switch theme-switch--${theme}`}
            type="button"
            role="switch"
            aria-checked={theme === 'light'}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="ts-track" aria-hidden="true">
              <span className="ts-stars">
                <span className="ts-star ts-s1" />
                <span className="ts-star ts-s2" />
                <span className="ts-star ts-s3" />
                <span className="ts-star ts-s4" />
              </span>
              <span className="ts-thumb" />
            </span>
          </button>
          <button id="logout-btn" className="ghost-btn" type="button" onClick={onSignOutClick}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tab-bar" role="tablist" aria-label="Studio tabs">
        {TABS.map((t, index) => {
          const unlocked = tabUnlocked(t.id);
          const lockReason = tabLockReason(t.id);
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={!unlocked}
              disabled={!unlocked}
              title={lockReason}
              className={`tab-btn ${isActive ? 'is-active' : ''}${unlocked ? '' : ' is-locked'}`}
              onClick={() => unlocked && setActiveTab(t.id)}
            >
              <span className="tab-btn__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="tab-btn__icon" aria-hidden="true">
                {unlocked ? <Icon size={16} /> : <IconLock size={16} />}
              </span>
              <span className="tab-btn__label">{t.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="content tab-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            // NOTE: no `filter` and no `y` — both properties create a
            // containing block for any position:fixed descendant, which
            // breaks viewport pinning for src-popover, class-nav-corner,
            // save-prompt, etc. Opacity-only transition keeps the wrapper
            // a transparent layout proxy.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
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
            {activeTab === 'docs' && <DocumentationTab />}
            {activeTab === 'ambiguous' && (
              <AmbiguousTab
                pendingSave={pendingSave}
                onSaved={onSaved}
                onDiscard={discardCurrentRun}
              />
            )}
          </motion.div>
        </AnimatePresence>
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
