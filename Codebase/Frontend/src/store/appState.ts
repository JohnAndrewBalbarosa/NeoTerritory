import { create } from 'zustand';
import { User, AnalysisRun, AppStatus, MsState } from '../types/api';

const TOKEN_KEY = 'nt_token';
const USER_KEY = 'nt_user';

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

  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setCurrentRun: (run: AnalysisRun | null) => void;
  patchCurrentRun: (patch: Partial<AnalysisRun>) => void;
  setSourceText: (text: string) => void;
  setFilename: (name: string) => void;
  setStatus: (status: AppStatus) => void;
  setMsStatus: (state: MsState, label: string) => void;
  setSessionRanAnalyze: (v: boolean) => void;
  setSessionReviewedEnd: (v: boolean) => void;
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

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, currentRun: null, sessionRanAnalyze: false, sessionReviewedEnd: false });
  },

  setCurrentRun: (run) => set({ currentRun: run }),
  patchCurrentRun: (patch) => set((s) => ({
    currentRun: s.currentRun ? { ...s.currentRun, ...patch } : s.currentRun
  })),
  setSourceText: (text) => set({ sourceText: text }),
  setFilename: (name) => set({ filename: name }),
  setStatus: (status) => set({ status }),
  setMsStatus: (msState, msLabel) => set({ msState, msLabel }),
  setSessionRanAnalyze: (v) => set({ sessionRanAnalyze: v }),
  setSessionReviewedEnd: (v) => set({ sessionReviewedEnd: v }),
}));
