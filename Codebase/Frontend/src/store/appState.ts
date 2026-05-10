import { create } from 'zustand';
import { User, AnalysisRun, AppStatus, MsState, Annotation, PatternEducation } from '../types/api';

const TOKEN_KEY = 'nt_token';
const USER_KEY = 'nt_user';

export type StudioTab = 'submit' | 'annotated' | 'gdb' | 'docs' | 'ambiguous';
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
  consentAccepted: boolean;
  pretestSubmitted: boolean;
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
  setConsentAccepted: (v: boolean) => void;
  setPretestSubmitted: (v: boolean) => void;
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
  bulkSetLinePatternOverrides: (overrides: Record<number, string>) => void;
  bulkClearLinePatternOverrides: (lines: number[]) => void;
  setSubmissionFiles: (files: Array<{ id: string; name: string; text: string }>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
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
  consentAccepted: false,
  pretestSubmitted: false,
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
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      token: null,
      user: null,
      currentRun: null,
      sessionRanAnalyze: false,
      sessionReviewedEnd: false,
      activeTab: 'submit',
      consentAccepted: false,
      pretestSubmitted: false,
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

  setCurrentRun: (run) => set({
    currentRun: run,
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
  }),
  patchCurrentRun: (patch) => set((s) => ({
    currentRun: s.currentRun ? { ...s.currentRun, ...patch } : s.currentRun
  })),
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
  setConsentAccepted: (v) => set({ consentAccepted: v }),
  setPretestSubmitted: (v) => set({ pretestSubmitted: v }),
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
