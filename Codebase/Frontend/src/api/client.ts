import {
  AnalysisRun, RunListItem, HealthStatus, TesterAccount, User,
  ReviewSchema, AdminUser, AdminLogEntry, AdminReview, AdminOverview,
  RunsPerDayPoint, PatternFreqPoint, ScoreBucket, PerUserPoint, RunsResponse
} from '../types/api';

const TOKEN_KEY = 'nt_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isForm = options.body instanceof FormData;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal: ctrl.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out — is the backend running?');
    }
    throw err;
  }
  clearTimeout(timer);

  let data: unknown;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response from server`);
  }

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('nt_user');
    throw new Error((data as { error?: string }).error || 'Session expired — please sign in.');
  }

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${response.status}`);
  }

  return data as T;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const data = await response.json().catch(() => ({})) as { token?: string; user?: User; error?: string };
    if (!response.ok) throw new Error(data.error || `Login failed (${response.status})`);
    return { token: data.token!, user: data.user! };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Login timed out — is the backend running?');
    }
    throw err;
  }
}

export async function fetchHealth(): Promise<HealthStatus> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as HealthStatus;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fetchRuns(limit = 12): Promise<RunListItem[]> {
  const data = await apiFetch<RunsResponse | RunListItem[]>(`/api/runs?limit=${limit}`);
  if (Array.isArray(data)) return data;
  return data.runs ?? [];
}

interface RunDetailPayload {
  id: number;
  sourceName: string;
  sourceText: string;
  analysis: {
    detectedPatterns?: AnalysisRun['detectedPatterns'];
    annotations?: AnalysisRun['annotations'];
    ranking?: AnalysisRun['ranking'];
    summary?: string;
    classUsageBindings?: AnalysisRun['classUsageBindings'];
    classUsageBindingSource?: AnalysisRun['classUsageBindingSource'];
  };
}

export async function fetchRun(id: number): Promise<AnalysisRun> {
  const data = await apiFetch<RunDetailPayload>(`/api/runs/${id}`);
  const a = data.analysis || {};
  return {
    runId: data.id,
    sourceName: data.sourceName,
    sourceText: data.sourceText || '',
    detectedPatterns: a.detectedPatterns || [],
    annotations: a.annotations || [],
    ranking: a.ranking || null,
    classUsageBindings: a.classUsageBindings || {},
    classUsageBindingSource: a.classUsageBindingSource || 'heuristic',
    summary: a.summary || ''
  };
}

export async function fetchSample(): Promise<{ code: string; filename: string }> {
  return apiFetch<{ code: string; filename: string }>('/api/sample');
}

export async function submitAnalysis(body: string | FormData): Promise<AnalysisRun> {
  return apiFetch<AnalysisRun>('/api/analyze', { method: 'POST', body });
}

export async function saveRun(pendingId: string, userResolvedPattern?: string): Promise<{ runId: number }> {
  return apiFetch<{ runId: number }>('/api/runs/save', {
    method: 'POST',
    body: JSON.stringify({ pendingId, userResolvedPattern })
  });
}

export interface TesterAccountInfo {
  username: string;
  claimed: boolean;
}

export interface TesterAccountsResponse {
  accounts: TesterAccountInfo[];
  password?: string;
  mode?: string;
}

function normalizeTesterAccount(value: unknown): TesterAccountInfo | null {
  if (typeof value === 'string') {
    return { username: value, claimed: false };
  }
  if (value && typeof value === 'object') {
    const v = value as { username?: unknown; claimed?: unknown };
    if (typeof v.username === 'string') {
      return { username: v.username, claimed: v.claimed === true };
    }
  }
  return null;
}

export async function fetchTesterAccounts(): Promise<TesterAccountsResponse> {
  const res = await fetch('/auth/test-accounts', { headers: { Accept: 'application/json' } });
  if (!res.ok) return { accounts: [] };
  const data = await res.json().catch(() => ({})) as {
    accounts?: unknown;
    password?: string;
    mode?: string;
  };
  const raw = Array.isArray(data.accounts) ? data.accounts : [];
  const accounts: TesterAccountInfo[] = [];
  for (const r of raw) {
    const norm = normalizeTesterAccount(r);
    if (norm) accounts.push(norm);
  }
  return { accounts, password: data.password, mode: data.mode };
}

export async function claimSeat(username: string): Promise<{ token: string; user: User }> {
  const res = await fetch('/auth/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username })
  });
  const data = await res.json().catch(() => ({})) as {
    token?: string;
    user?: User;
    error?: string;
  };
  if (!res.ok) {
    const err = new Error(data.error || `Claim failed (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  if (!data.token || !data.user) {
    throw new Error('Claim response missing token or user');
  }
  return { token: data.token, user: data.user };
}

export async function fetchReviewSchema(scope: string): Promise<ReviewSchema> {
  return apiFetch<ReviewSchema>(`/api/reviews/schema?scope=${encodeURIComponent(scope)}`);
}

export interface ReviewSubmission {
  scope: string;
  analysisRunId?: number | null;
  answers: Record<string, string | number>;
}

export async function submitReview(payload: ReviewSubmission): Promise<unknown> {
  return apiFetch<unknown>('/api/reviews', { method: 'POST', body: JSON.stringify(payload) });
}

// Admin endpoints
export async function fetchAdminOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>('/api/admin/stats/overview');
}
export async function fetchAdminRunsPerDay(days = 30): Promise<{ series: RunsPerDayPoint[] }> {
  return apiFetch<{ series: RunsPerDayPoint[] }>(`/api/admin/stats/runs-per-day?days=${days}`);
}
export async function fetchAdminPatternFreq(): Promise<{ series: PatternFreqPoint[] }> {
  return apiFetch<{ series: PatternFreqPoint[] }>('/api/admin/stats/pattern-frequency');
}
export async function fetchAdminScoreDistribution(): Promise<{ buckets: ScoreBucket[] }> {
  return apiFetch<{ buckets: ScoreBucket[] }>('/api/admin/stats/score-distribution');
}
export async function fetchAdminPerUser(): Promise<{ series: PerUserPoint[] }> {
  return apiFetch<{ series: PerUserPoint[] }>('/api/admin/stats/per-user-activity');
}
export async function fetchAdminUsers(): Promise<{ users: AdminUser[] }> {
  return apiFetch<{ users: AdminUser[] }>('/api/admin/users');
}
export async function fetchAdminReviews(): Promise<{ reviews: AdminReview[] }> {
  return apiFetch<{ reviews: AdminReview[] }>('/api/admin/reviews');
}
export async function fetchAdminLogs(limit = 80): Promise<{ logs: AdminLogEntry[] }> {
  return apiFetch<{ logs: AdminLogEntry[] }>(`/api/admin/logs?limit=${limit}`);
}

// Re-export TesterAccount so consumers can avoid touching the type module directly.
export type { TesterAccount };
