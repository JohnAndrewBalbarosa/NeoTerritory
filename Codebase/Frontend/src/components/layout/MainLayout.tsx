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
import StudioJoyrideTour, { dispatchStudioTourOpen } from '../studio/StudioJoyrideTour';
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
  // D76 follow-up: ensure the studio shell always lands at viewport top
  // on mount. Previously, navigating from a scrolled marketing page
  // (e.g., the bottom of /why or /tour) to /student-studio left the
  // window scroll position where it was, so the studio appeared
  // "missing" until the user scrolled back up. MarketingShell already
  // scrolls to top on its own surface changes, but the studio shell
  // is a sibling component with no equivalent reset.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

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
    setAiStatus, setStatus, status,
    currentRun, gdbAllPassedForRun, reviewsRequired
  } = useAppStore();

  // When the admin has flipped reviews_required OFF (post-thesis), the
  // Self-check / survey tab disappears from the workflow and the survey
  // gate is auto-flushed on the backend. Filter at render time so the
  // tab list rebuilds on toggle change without a reload.
  const visibleTabs = reviewsRequired
    ? TABS
    : TABS.filter(t => t.id !== 'ambiguous');

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

  // Backend / microservice / Docker / AI status chips were removed from the
  // topbar per project owner — they read as noise on a teaching tool. The
  // appStore still tracks them (setStatus / setAiStatus calls below are
  // intact) so admin views and pipeline timing can use them, just not the
  // studio chrome.
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

  // Admins skip the research-participant gates entirely. Their place is the
  // /admin dashboard, not the studio. Send them there immediately.
  useEffect(() => {
    if (token && user?.role === 'admin' && !window.location.pathname.startsWith('/admin')) {
      window.location.href = '/admin.html';
    }
  }, [token, user]);
  if (token && user?.role === 'admin') return null;

  // Real-account entry flow detection. GoogleCallback writes
  // `nt-entry-flow` to sessionStorage as 'developer' or 'student'
  // after a successful exchange. Devcon testers (claim-seat path)
  // never set this — so the absence of the flag = research participant.
  // Real-account users skip both ConsentGate and PretestForm; those
  // are tester-only research-onboarding screens.
  const entryFlow = typeof window !== 'undefined'
    ? window.sessionStorage.getItem('nt-entry-flow')
    : null;
  const isRealAccountUser = entryFlow === 'developer' || entryFlow === 'student';

  // Reflect each gate in the URL so the address bar distinguishes consent
  // and pretest from the studio home. replaceState avoids back-button noise.
  // Real-account users go straight to the studio; tester gates are skipped.
  if (token && user && typeof window !== 'undefined') {
    const path = window.location.pathname;
    const expected = isRealAccountUser
      ? '/studio'
      : !consentAccepted ? '/consent' : !pretestSubmitted ? '/pretest' : '/studio';
    if (path !== expected && path !== '/admin.html') {
      window.history.replaceState(null, '', expected);
    }
  }

  // Gate: consent first (research participants only — Devcon flow).
  // Real-account Google sign-in users (Developer / Student Learning)
  // skip this entirely.
  if (token && user && !isRealAccountUser && !consentAccepted) {
    return <ConsentGate />;
  }
  // Gate: pretest second. Same skip rule applies.
  if (token && user && !isRealAccountUser && !pretestSubmitted) {
    return <PretestForm />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">NeoTerritory Studio</p>
          {/* Solid-color title (project owner aligned with Miryl's branch:
              the ShinyText shimmer made the hero look like a marketing
              effect on a working tool). Plain h1 = solid theme accent. */}
          <h1 className="brand-title">Pattern detection &amp; annotation</h1>
          <p className="lede">
            Paste C++ source or upload a file. The microservice detects design patterns
            and the studio shows comments side-by-side with the lines they reference.
          </p>
        </div>
        <div id="status-card" className="status-card status-card--slim">
          {/* Screen-reader + Playwright status hook. The visual chrome was
              intentionally stripped by the layout-flatten refactor, but the
              appStore.status still tracks the run state. Keep the title +
              detail in the DOM as a sr-only aria-live region so assistive
              tech announces "Analysis ready" and the all-samples spec can
              still wait on `#status-title`. */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            <strong id="status-title" data-testid="status-title">{status?.title ?? ''}</strong>
            <span id="status-detail" data-testid="status-detail">{status?.detail ?? ''}</span>
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
            <button
              className="ghost-btn"
              type="button"
              title="Replay the studio tour"
              aria-label="Replay the studio tour"
              onClick={() => dispatchStudioTourOpen()}
            >
              ? Tour
            </button>
            <button id="logout-btn" className="ghost-btn" type="button" onClick={onSignOutClick}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <StudioJoyrideTour />

      <nav className="tab-bar" role="tablist" aria-label="Studio tabs">
        {visibleTabs.map((t, index) => {
          const unlocked = tabUnlocked(t.id);
          const lockReason = tabLockReason(t.id);
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-testid={`tab-${t.id}`}
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

      {/* Flattened: the per-tab content is a direct sibling of .topbar
          and .tab-bar inside .shell, so the entire page scrolls as one
          unit (no inner scrollbar, no "window in a window"). The old
          <main className="content tab-content"> wrapper used to be the
          single scroll container; removing it lets natural document flow
          take over. AnimatePresence renders no DOM node of its own, so
          motion.div is the direct .shell child. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          className="tab-panel-flat"
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
