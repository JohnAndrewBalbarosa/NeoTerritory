import { create } from 'zustand';
import { User, AnalysisRun, AppStatus, MsState, Annotation, PatternEducation } from '../types/api';

const TOKEN_KEY = 'nt_token';
const USER_KEY = 'nt_user';

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
  sessionRanAnalyze: boolean;
  sessionReviewedEnd: boolean;
  // True after at least one GDB run completed for the *current* run with
  // every test passing. Resets when a new analysis is dispatched. Drives
  // the Annotated tab's CTA: "Run GDB tests" first, then "Review before
  // submission" after they pass.
  gdbAllPassedForRun: boolean;
  activeTab: StudioTab;
  consentAccepted: boolean;
  pretestSubmitted: boolean;
  aiStatus: AiCommentaryStatus;
  aiJobId: string | null;
  aiConfigured: boolean;
  maxFilesPerSubmission: number;
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
  setSessionRanAnalyze: (v: boolean) => void;
  setSessionReviewedEnd: (v: boolean) => void;
  setGdbAllPassedForRun: (v: boolean) => void;
  setActiveTab: (tab: StudioTab) => void;
  setConsentAccepted: (v: boolean) => void;
  setPretestSubmitted: (v: boolean) => void;
  setAiStatus: (status: AiCommentaryStatus, jobId?: string | null) => void;
  setAiConfigured: (v: boolean) => void;
  setMaxFilesPerSubmission: (v: number) => void;
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
  sessionRanAnalyze: false,
  sessionReviewedEnd: false,
  gdbAllPassedForRun: false,
  activeTab: 'submit',
  consentAccepted: false,
  pretestSubmitted: false,
  aiStatus: 'idle',
  aiJobId: null,
  aiConfigured: false,
  maxFilesPerSubmission: 3,
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
    // Setting a fresh run invalidates any prior GDB pass state.
    gdbAllPassedForRun: false
  }),
  patchCurrentRun: (patch) => set((s) => ({
    currentRun: s.currentRun ? { ...s.currentRun, ...patch } : s.currentRun
  })),
  setSourceText: (text) => set({ sourceText: text }),
  setFilename: (name) => set({ filename: name }),
  setStatus: (status) => set({ status }),
  setMsStatus: (msState, msLabel) => set({ msState, msLabel }),
  setSessionRanAnalyze: (v) => set({ sessionRanAnalyze: v }),
  setSessionReviewedEnd: (v) => set({ sessionReviewedEnd: v }),
  setGdbAllPassedForRun: (v) => set({ gdbAllPassedForRun: v }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setConsentAccepted: (v) => set({ consentAccepted: v }),
  setPretestSubmitted: (v) => set({ pretestSubmitted: v }),
  setAiStatus: (status, jobId) => set((s) => ({
    aiStatus: status,
    aiJobId: jobId === undefined ? s.aiJobId : jobId
  })),
  setAiConfigured: (v) => set({ aiConfigured: v }),
  setMaxFilesPerSubmission: (v) => set({ maxFilesPerSubmission: Math.max(1, Math.min(16, v)) }),
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
