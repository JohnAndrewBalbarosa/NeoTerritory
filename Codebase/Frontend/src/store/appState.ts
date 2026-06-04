import { create } from 'zustand';
import { User, AnalysisRun, AppStatus, MsState, Annotation, PatternEducation } from '../types/api';
import { sourceKeyOf, loadResolutions, saveResolutions, clearResolutions } from '../logic/resolutionPersistence';

const TOKEN_KEY = 'nt_token';
const USER_KEY = 'nt_user';

// SSR-safe localStorage access. Under Next.js the store module is evaluated on the
// server during prerender, where `window`/`localStorage` do not exist; an unguarded
// read throws "localStorage is not defined". In the browser (Vite or hydrated Next)
// this behaves exactly as a direct localStorage call. See D89.
const canUseDom = typeof window !== 'undefined';
function readStored(key: string): string | null {
  if (!canUseDom) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// 'docs' is no longer a top-level studio tab — the generated documentation
// now lives as a sub-view inside the Patterns (annotated) tab. The union is
// kept tight so a stale 'docs' activeTab can't be set anywhere.
export type StudioTab = 'submit' | 'annotated' | 'gdb' | 'ambiguous';
export type AiCommentaryStatus = 'idle' | 'pending' | 'ready' | 'failed' | 'disabled';

interface AppState {
  token: string | null;
  user: User | null;
  currentRun: AnalysisRun | null;
  sourceText: string;
  filename: string;
  status: AppStatus;
  msState: MsState;
  msLabel: string;
  // Per-tester Docker pod status surfaced in the studio status card so
  // the user can see whether their unit-test runs will execute inside an
  // isolated container (online + image ready) or via the local fallback.
  dockerState: MsState;
  dockerLabel: string;
  sessionRanAnalyze: boolean;
  sessionReviewedEnd: boolean;
  // True after at least one GDB run completed for the *current* run with
  // every test passing. Resets when a new analysis is dispatched. Drives
  // the Annotated tab's CTA: "Run GDB tests" first, then "Review before
  // submission" after they pass.
  gdbAllPassedForRun: boolean;
  // Cached GDB run results bound to the current run's identity (runId or
  // pendingId). Persists across tab switches so the runner doesn't re-run
  // on every visit; cleared when a new analysis is dispatched (see
  // setCurrentRun) so a fresh submission is required to re-run.
  lastGdbResults: import('../api/client').GdbTestResult[] | null;
  lastGdbRunKey: string | null;
  // In-flight GDB run state. Lifted into the store (was local useState in
  // GdbRunnerTab) so a tab switch doesn't unmount the component and lose the
  // running spinner / skeleton / cooldown / error banner. The runner is now
  // session-based: it survives navigation between Annotated/Ambiguous/etc.
  gdbBusy: boolean;
  gdbBusyForKey: string | null;
  gdbInflightSkeleton: Array<{ patternId: string; patternName: string; className: string }>;
  gdbError: string | null;
  gdbUnavailable: string | null;
  gdbCooldownUntil: number | null;
  gdbBudgetRemaining: number | null;
  gdbAmbiguousBlock: string[] | null;
  // One-shot flag flipped by the Annotated tab CTA. The GDB tab observes
  // it on mount and dispatches `runAll()` once, then resets it. Lets a
  // single click on the CTA both navigate and trigger the run.
  pendingGdbAutoRun: boolean;
  // Program input — text streamed to the binary's stdin during GDB unit
  // tests. Newlines act as the user's Enter key. Cleared on
  // setCurrentRun / resetSession.
  programStdin: string;
  activeTab: StudioTab;
  aiStatus: AiCommentaryStatus;
  aiJobId: string | null;
  aiConfigured: boolean;
  // Admin-controlled toggle. ON during the thesis testing window so
  // the Self-check / review-survey tab is part of the workflow. OFF
  // after the thesis ends so post-thesis Developer / Student users do
  // not hit a survey wall after every run. Seeded from /api/health.
  reviewsRequired: boolean;
  maxFilesPerSubmission: number;
  maxTokensPerFile: number;
  pendingRunSurveyForRunKey: string | null;
  linePatternOverrides: Record<number, string>;
  // LMS Progress (Khan Academy Style)
  preTestCompleted: boolean;
  completedItems: string[]; // IDs of lessons/quizzes finished
  // Persistent multi-file submission slots; survive AnalysisForm unmount so
  // tabbing away and back (or running an analysis) doesn't drop the user's
  // other files. Empty array = legacy single-file mode (AnalysisForm seeds
  // a single slot from sourceText/filename).
  submissionFiles: Array<{ id: string; name: string; text: string }>;

  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  resetSession: () => void;
  setCurrentRun: (run: AnalysisRun | null) => void;
  patchCurrentRun: (patch: Partial<AnalysisRun>) => void;
  setSourceText: (text: string) => void;
  setFilename: (name: string) => void;
  setStatus: (status: AppStatus) => void;
  setMsStatus: (state: MsState, label: string) => void;
  setDockerStatus: (state: MsState, label: string) => void;
  setSessionRanAnalyze: (v: boolean) => void;
  setSessionReviewedEnd: (v: boolean) => void;
  setGdbAllPassedForRun: (v: boolean) => void;
  setLastGdbResults: (results: import('../api/client').GdbTestResult[] | null, runKey: string | null) => void;
  setGdbBusy: (busy: boolean, sessionKey?: string | null) => void;
  setGdbInflightSkeleton: (skel: Array<{ patternId: string; patternName: string; className: string }>) => void;
  setGdbError: (msg: string | null) => void;
  setGdbUnavailable: (msg: string | null) => void;
  setGdbCooldownUntil: (until: number | null) => void;
  setGdbBudgetRemaining: (n: number | null) => void;
  setGdbAmbiguousBlock: (classes: string[] | null) => void;
  setPendingGdbAutoRun: (v: boolean) => void;
  setProgramStdin: (text: string) => void;
  setActiveTab: (tab: StudioTab) => void;
  setAiStatus: (status: AiCommentaryStatus, jobId?: string | null) => void;
  setAiConfigured: (v: boolean) => void;
  setReviewsRequired: (v: boolean) => void;
  setMaxFilesPerSubmission: (v: number) => void;
  setMaxTokensPerFile: (v: number) => void;
  mergeAiAnnotations: (aiAnnotations: Annotation[]) => void;
  mergeAiEducation: (educationByKey: Record<string, PatternEducation>) => void;
  setPendingRunSurvey: (key: string | null) => void;
  setLinePatternOverride: (line: number, patternKey: string) => void;
  clearLinePatternOverride: (line: number) => void;
  setPreTestCompleted: (v: boolean) => void;
  setCompletedItems: (items: string[]) => void;
  addCompletedItem: (id: string) => void;
  bulkSetLinePatternOverrides: (overrides: Record<number, string>) => void;
  bulkClearLinePatternOverrides: (lines: number[]) => void;
  setSubmissionFiles: (files: Array<{ id: string; name: string; text: string }>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: readStored(TOKEN_KEY),
  user: (() => {
    try {
      const raw = readStored(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  })(),
  currentRun: null,
  sourceText: '',
  filename: 'snippet.cpp',
  status: { kind: 'idle', title: 'Checking...', detail: 'Waiting for API response.' },
  msState: 'checking',
  msLabel: 'checking...',
  dockerState: 'checking',
  dockerLabel: 'checking...',
  sessionRanAnalyze: false,
  sessionReviewedEnd: false,
  gdbAllPassedForRun: false,
  lastGdbResults: null,
  lastGdbRunKey: null,
  gdbBusy: false,
  gdbBusyForKey: null,
  gdbInflightSkeleton: [],
  gdbError: null,
  gdbUnavailable: null,
  gdbCooldownUntil: null,
  gdbBudgetRemaining: null,
  gdbAmbiguousBlock: null,
  pendingGdbAutoRun: false,
  programStdin: '',
  activeTab: 'submit',
  aiStatus: 'idle',
  aiJobId: null,
  aiConfigured: false,
  // Default true so a network blip on the initial /api/health probe
  // does not accidentally hide the Self-check tab from in-flight
  // research participants.
  reviewsRequired: true,
  maxFilesPerSubmission: 3,
  maxTokensPerFile: 1000,
  pendingRunSurveyForRunKey: null,
  linePatternOverrides: {},
  submissionFiles: [],

  setAuth: (token, user) => {
    if (canUseDom) {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ token, user });
  },

  clearAuth: () => {
    if (canUseDom) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
    // Drop persisted per-class resolutions on logout (hygiene — they are
    // source-keyed, not user-keyed). NOT cleared on resetSession, so a
    // resolution survives re-analysis within a session.
    clearResolutions();
    set({
      token: null,
      user: null,
      currentRun: null,
      sessionRanAnalyze: false,
      sessionReviewedEnd: false,
      activeTab: 'submit',
      aiStatus: 'idle',
      aiJobId: null,
      pendingRunSurveyForRunKey: null,
      linePatternOverrides: {},
      submissionFiles: []
    });
  },

  resetSession: () => set({
    currentRun: null,
    sourceText: '',
    filename: 'snippet.cpp',
    activeTab: 'submit',
    aiStatus: 'idle',
    aiJobId: null,
    linePatternOverrides: {},
    submissionFiles: []
  }),

  setCurrentRun: (run) => {
    // Re-hydrate any per-class resolution previously saved for THIS source, so
    // re-analysing byte-identical code (after a reload / HMR / redeploy) keeps
    // the learner's pick and the test runner's ambiguity gate stays cleared.
    // The run's own / server-saved values win; the persisted map only fills
    // gaps. Detection/scoring is untouched — this only restores the tag map.
    let next = run;
    if (run) {
      const saved = loadResolutions(sourceKeyOf(run));
      if (Object.keys(saved).length > 0) {
        next = { ...run, classResolvedPatterns: { ...saved, ...(run.classResolvedPatterns || {}) } };
      }
    }
    set({
      currentRun: next,
      activeTab: run ? 'annotated' : 'submit',
      // A fresh run invalidates GDB pass state AND the cached results — the
      // runner is bound to the run's identity, so new code = new session.
      gdbAllPassedForRun: false,
      lastGdbResults: null,
      lastGdbRunKey: null,
      gdbBusy: false,
      gdbBusyForKey: null,
      gdbInflightSkeleton: [],
      gdbError: null,
      gdbUnavailable: null,
      gdbCooldownUntil: null,
      gdbBudgetRemaining: null,
      gdbAmbiguousBlock: null,
      pendingGdbAutoRun: false,
      programStdin: ''
    });
  },
  patchCurrentRun: (patch) => set((s) => {
    if (!s.currentRun) return { currentRun: s.currentRun };
    const merged = { ...s.currentRun, ...patch };
    // Persist whenever the resolution map changes (covers both resolve and
    // unresolve, the only writers — SourceView routes both through here).
    // Keyed by source, so it restores on the next analysis of the same code.
    if (patch.classResolvedPatterns !== undefined) {
      saveResolutions(sourceKeyOf(merged), merged.classResolvedPatterns || {});
    }
    return { currentRun: merged };
  }),
  setSourceText: (text) => set({ sourceText: text }),
  setFilename: (name) => set({ filename: name }),
  setStatus: (status) => set({ status }),
  setMsStatus: (msState, msLabel) => set({ msState, msLabel }),
  setDockerStatus: (dockerState, dockerLabel) => set({ dockerState, dockerLabel }),
  setSessionRanAnalyze: (v) => set({ sessionRanAnalyze: v }),
  setSessionReviewedEnd: (v) => set({ sessionReviewedEnd: v }),
  setGdbAllPassedForRun: (v) => set({ gdbAllPassedForRun: v }),
  setLastGdbResults: (results, runKey) => set({ lastGdbResults: results, lastGdbRunKey: runKey }),
  setGdbBusy: (busy, sessionKey) => set({
    gdbBusy: busy,
    gdbBusyForKey: busy ? (sessionKey ?? null) : null,
    // Clear the skeleton when the run finishes so display falls back to
    // lastGdbResults; keep it while busy so the spinning rows stay visible.
    ...(busy ? {} : { gdbInflightSkeleton: [] })
  }),
  setGdbInflightSkeleton: (skel) => set({ gdbInflightSkeleton: skel }),
  setGdbError: (msg) => set({ gdbError: msg }),
  setGdbUnavailable: (msg) => set({ gdbUnavailable: msg }),
  setGdbCooldownUntil: (until) => set({ gdbCooldownUntil: until }),
  setGdbBudgetRemaining: (n) => set({ gdbBudgetRemaining: n }),
  setGdbAmbiguousBlock: (classes) => set({ gdbAmbiguousBlock: classes }),
  setPendingGdbAutoRun: (v) => set({ pendingGdbAutoRun: v }),
  setProgramStdin: (text) => set({ programStdin: text }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setAiStatus: (status, jobId) => set((s) => ({
    aiStatus: status,
    aiJobId: jobId === undefined ? s.aiJobId : jobId
  })),
  setAiConfigured: (v) => set({ aiConfigured: v }),
  setReviewsRequired: (v) => set({ reviewsRequired: v }),
  setMaxFilesPerSubmission: (v) => set({ maxFilesPerSubmission: Math.max(1, Math.min(16, v)) }),
  setMaxTokensPerFile: (v) => set({ maxTokensPerFile: Math.max(100, Math.min(20_000, Math.floor(v))) }),
  setLinePatternOverride: (line, patternKey) => set((s) => ({
    linePatternOverrides: { ...s.linePatternOverrides, [line]: patternKey }
  })),
  setPreTestCompleted: (v) => set({ preTestCompleted: v }),
  setCompletedItems: (items) => set({ completedItems: items }),
  addCompletedItem: (id) => set((s) => ({
    completedItems: s.completedItems.includes(id) ? s.completedItems : [...s.completedItems, id]
  })),
  clearLinePatternOverride: (line) => set((s) => {
    const next = { ...s.linePatternOverrides };
    delete next[line];
    return { linePatternOverrides: next };
  }),
  bulkSetLinePatternOverrides: (overrides) => set((s) => ({
    linePatternOverrides: { ...s.linePatternOverrides, ...overrides }
  })),
  bulkClearLinePatternOverrides: (lines) => set((s) => {
    const next = { ...s.linePatternOverrides };
    for (const l of lines) delete next[l];
    return { linePatternOverrides: next };
  }),
  mergeAiAnnotations: (aiAnnotations) => set((s) => {
    if (!s.currentRun) return {};
    const existing = s.currentRun.annotations || [];
    // Replace structural annotations whose AI doc was a placeholder, keyed by id.
    const byId = new Map<string, Annotation>();
    existing.forEach((a) => byId.set(a.id, a));
    aiAnnotations.forEach((a) => byId.set(a.id, { ...byId.get(a.id), ...a }));
    return {
      currentRun: { ...s.currentRun, annotations: Array.from(byId.values()) }
    };
  }),
  mergeAiEducation: (educationByKey) => set((s) => {
    if (!s.currentRun) return {};
    if (!educationByKey || !Object.keys(educationByKey).length) return {};
    const updated = (s.currentRun.detectedPatterns || []).map((p) => {
      const key = `${p.patternId}|${p.className || ''}`;
      const edu = educationByKey[key];
      return edu ? { ...p, patternEducation: edu } : p;
    });
    return { currentRun: { ...s.currentRun, detectedPatterns: updated } };
  }),
  setPendingRunSurvey: (key) => set({ pendingRunSurveyForRunKey: key }),
  setSubmissionFiles: (files) => set({ submissionFiles: files }),
}));
