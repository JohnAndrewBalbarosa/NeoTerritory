import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore, StudioTab } from '../../store/appState';
import { useHealth } from '../../hooks/useHealth';
import { useAiCommentaryPoll } from '../../hooks/useAiCommentaryPoll';
import SubmitTab from '../tabs/SubmitTab';
import AnnotatedTab from '../tabs/AnnotatedTab';
import AmbiguousTab from '../tabs/AmbiguousTab';
import GdbRunnerTab from '../tabs/GdbRunnerTab';
import ReviewModal from '../modals/ReviewModal';
import { AnalysisRun } from '../../types/api';
import {
  IconUpload,
  IconLayers,
  IconPlay,
  IconCheckSquare,
  IconLock,
} from '../icons/Icons';
import type { ComponentType } from 'react';
import type { IconProps } from '../icons/Icons';

// Studio analysis surface — the tab strip (Submit → Patterns → Tests →
// Self-check) and its panels, factored out of MainLayout so it can be
// reused in two contexts:
//   1. MainLayout wraps it with the studio topbar chrome (standalone studio,
//      now reachable only by admins).
//   2. The Learning Path embeds it as a module practical "wrapper" with the
//      topbar stripped — the tab UI itself is byte-identical, only the chrome
//      differs (project owner: "don't change the Studio UI").
//
// When `targetPatternSlug` is supplied, the surface reports back via
// `onPatternDetected` the first time an analysis run tags that pattern. The
// learning page uses this to mark a module complete and unlock the next one,
// replacing the old standalone "Run check" textarea.

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

// Mirror of PatternsLearnPage#normalizePatternKey / backend candidateFilter
// normalize. Lowercase, strip "<family>." prefix, drop non-alphanum so the
// microservice's "creational.singleton" matches a target slug "singleton"
// or display name "Singleton".
function normalizePatternKey(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().trim().replace(/^[a-z]+\./, '').replace(/[^a-z0-9]/g, '');
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
  { id: 'ambiguous',  label: 'Self-check', icon: IconCheckSquare },
];

interface StudioSurfaceProps {
  // When present, the surface watches each completed analysis run for this
  // pattern (matched against detected patternId / patternName) and calls
  // onPatternDetected once the tag appears.
  targetPatternSlug?: string;
  // Display name of the target pattern (for the matcher's secondary key).
  targetPatternName?: string;
  // Fired the first time the target pattern is detected in a run.
  onPatternDetected?: (run: AnalysisRun) => void;
  // Optional starter file for embedded learning checks.
  starterCode?: string;
}

export default function StudioSurface({
  targetPatternSlug,
  targetPatternName,
  onPatternDetected,
  starterCode,
}: StudioSurfaceProps) {
  useHealth();
  useAiCommentaryPoll();

  const {
    activeTab, setActiveTab,
    setAiStatus, setStatus,
    currentRun, gdbAllPassedForRun, reviewsRequired,
  } = useAppStore();

  const visibleTabs = reviewsRequired
    ? TABS
    : TABS.filter(t => t.id !== 'ambiguous');

  // Safety net: if reviews get turned off while the user is sitting on the
  // Self-check (ambiguous) tab — or a stale activeTab points there — bounce
  // them off the deprecated surface.
  useEffect(() => {
    if (!reviewsRequired && activeTab === 'ambiguous') {
      setActiveTab(currentRun ? 'annotated' : 'submit');
    }
  }, [reviewsRequired, activeTab, currentRun, setActiveTab]);

  // Sequential tab gating: submit → annotate → run tests → review.
  function tabUnlocked(id: StudioTab): boolean {
    if (id === 'submit')    return true;
    if (id === 'annotated') return !!currentRun;
    if (id === 'gdb')       return !!currentRun;
    if (id === 'ambiguous') return gdbAllPassedForRun;
    return true;
  }
  function tabLockReason(id: StudioTab): string | undefined {
    if (id === 'annotated' && !currentRun)         return 'Submit source code first.';
    if (id === 'gdb'       && !currentRun)         return 'Submit source code and complete annotation first.';
    if (id === 'ambiguous' && !gdbAllPassedForRun) return 'Run the GDB unit tests and pass them all first.';
    return undefined;
  }

  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [runRefreshSignal, setRunRefreshSignal] = useState(0);
  const [analyzeReplace, setAnalyzeReplace] = useState<{ run: () => void } | null>(null);
  // Latched so onPatternDetected fires at most once per surface mount — the
  // learning page remounts the surface (key=moduleId) per module, so a fresh
  // module gets a fresh latch.
  const [detectedReported, setDetectedReported] = useState(false);

  function maybeReportDetection(run: AnalysisRun): void {
    if (!targetPatternSlug || !onPatternDetected || detectedReported) return;
    const targetKey = normalizePatternKey(targetPatternSlug);
    const targetNameKey = normalizePatternKey(targetPatternName);
    const matchesTarget = (key: string): boolean => key === targetKey || key === targetNameKey;
    // The target counts as "detected" if it is among the confidently-tagged
    // patterns OR among the AMBIGUOUS candidates (D92): when the analyser can't
    // separate same-structure rivals it returns them all as candidates, so if the
    // module's target pattern is one of them we still auto-resolve to it. The
    // per-module autoTag gate in PracticalExamBlock then decides whether this
    // auto-passes (autoTag on) or waits for a manual pick (semantic-differentiation
    // exams set autoTag off, so the learner must choose among the candidates).
    const hit =
      (run.detectedPatterns || []).some(
        (p) => matchesTarget(normalizePatternKey(p.patternId)) || matchesTarget(normalizePatternKey(p.patternName)),
      ) ||
      (run.ranking?.ambiguousCandidates || []).some((c) => matchesTarget(normalizePatternKey(c)));
    if (hit) {
      setDetectedReported(true);
      onPatternDetected(run);
    }
  }

  function onAnalysisComplete(run: AnalysisRun) {
    const r = run as AnalyzeResponseLike;
    if (r.aiJobId && r.aiStatus === 'pending') {
      setAiStatus('pending', r.aiJobId);
    } else {
      setAiStatus(r.aiStatus === 'disabled' ? 'disabled' : 'idle', null);
    }
    // Report a target-pattern hit to the learning page (if embedded) so the
    // module can unlock. Detection drives the gate regardless of save/tests.
    maybeReportDetection(run);
    if (!run.pendingId) return;
    const patternCount = (run.detectedPatterns || []).length;
    const commentCount = (run.annotations || []).length;
    const ambiguous = run.ranking?.verdict === 'ambiguous'
      && (run.ranking.ambiguousCandidates || []).length > 0;
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
    useAppStore.getState().patchCurrentRun({ runId });
    setActiveTab('submit');
  }

  function discardCurrentRun(): void {
    setPendingSave(null);
    useAppStore.getState().setCurrentRun(null);
    setStatus({ kind: 'idle', title: 'Discarded', detail: 'Run was not saved.' });
  }

  // Single popup: prompt only when there's already a run on screen.
  function beforeAnalyze(dispatch: () => void): void {
    const hasCurrentRun = !!useAppStore.getState().currentRun;
    if (hasCurrentRun) {
      setAnalyzeReplace({ run: dispatch });
      return;
    }
    dispatch();
  }

  function onReviewClose(_submitted: boolean) {
    setReview(null);
  }

  return (
    <>
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

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          className="tab-panel-flat"
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
              initialFile={starterCode ? { name: 'starter.cpp', code: starterCode } : undefined}
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
          {activeTab === 'ambiguous' && reviewsRequired && (
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
    </>
  );
}
