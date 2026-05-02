import {
  AnalysisRun, RunListItem, HealthStatus, TesterAccount, User,
  ReviewSchema, AdminUser, AdminLogEntry, AdminReview, AdminOverview,
  RunsPerDayPoint, PatternFreqPoint, ScoreBucket, PerUserPoint, RunsResponse,
  SurveySummary, ComplexityData, F1Metrics
} from '../types/api';

const TOKEN_KEY = 'nt_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
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
    // Build a richer error so callers (e.g. GdbRunnerTab) can read status,
    // detail, and retryAfterMs without parsing strings.
    const body = data as {
      error?: string; detail?: string; retryAfterMs?: number;
      ambiguousClasses?: string[];
    };
    const err = new Error(body.error || `HTTP ${response.status}`) as Error & {
      status?: number;
      detail?: string;
      retryAfterMs?: number;
      ambiguousClasses?: string[];
    };
    err.status = response.status;
    err.detail = body.detail;
    err.retryAfterMs = body.retryAfterMs;
    err.ambiguousClasses = body.ambiguousClasses;
    throw err;
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

// Tells the backend "this tab is still alive — keep my seat". Called every
// ~30s by useHeartbeat. Tolerates transient network errors silently because
// missing one beat is fine; the backend grace window covers a missed call.
export async function sendHeartbeat(): Promise<void> {
  try {
    await apiFetch('/auth/heartbeat', { method: 'POST' });
  } catch {
    // ignore — next beat will reconcile
  }
}

// Fired on pagehide via navigator.sendBeacon so a tab close releases the seat
// instantly. Plain `fetch` doesn't survive page teardown, hence the beacon.
export function sendDisconnectBeacon(token: string | null): void {
  if (!token || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  // sendBeacon must use a Blob; the auth header is encoded in the URL via a
  // query string read by an alternate verifier path. Safer: send a typed body
  // and let the existing /auth/disconnect endpoint read the bearer header
  // through a sendBeacon-compatible Blob.
  const body = new Blob(
    [JSON.stringify({ token })],
    { type: 'application/json' }
  );
  navigator.sendBeacon('/auth/disconnect-beacon', body);
}

// Explicit sign-out request. Frees the tester seat and adds the JWT to the
// server-side revocation list so any further request with this token is
// rejected with 401. Best-effort — failures are swallowed because the client
// already cleared its local auth before this resolves.
export async function signOutAndRevoke(): Promise<void> {
  try {
    await apiFetch('/auth/disconnect', { method: 'POST' });
  } catch {
    // ignore — server-side cleanup also runs via the heartbeat sweep
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
    userResolvedPattern?: string | null;
    classResolvedPatterns?: Record<string, string>;
    files?: Array<{ name: string; sourceText: string }>;
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
    summary: a.summary || '',
    userResolvedPattern: a.userResolvedPattern || null,
    classResolvedPatterns: a.classResolvedPatterns || undefined,
    // Restore the multi-file payload when reopening a saved run; fall back
    // to a single-entry list mirroring sourceName + sourceText for legacy
    // pre-multi-file runs so AnnotatedTab can render uniformly.
    files: a.files && a.files.length > 0
      ? a.files
      : [{ name: data.sourceName, sourceText: data.sourceText || '' }]
  };
}

export async function fetchSample(): Promise<{ code: string; filename: string }> {
  return apiFetch<{ code: string; filename: string }>('/api/sample');
}

export async function submitAnalysis(body: string | FormData): Promise<AnalysisRun> {
  return apiFetch<AnalysisRun>('/api/analyze', { method: 'POST', body });
}

export async function saveRun(
  pendingId: string,
  userResolvedPattern?: string,
  classResolvedPatterns?: Record<string, string>
): Promise<{ runId: number }> {
  return apiFetch<{ runId: number }>('/api/runs/save', {
    method: 'POST',
    body: JSON.stringify({ pendingId, userResolvedPattern, classResolvedPatterns })
  });
}

// Single-button "Submit validation & save" flow. Hits the new
// /api/runs/submit-and-save endpoint which re-validates the payload
// server-side then persists the run. Same response shape as saveRun.
export async function submitAndSaveRun(
  pendingId: string,
  userResolvedPattern?: string,
  classResolvedPatterns?: Record<string, string>
): Promise<{ runId: number }> {
  return apiFetch<{ runId: number }>('/api/runs/submit-and-save', {
    method: 'POST',
    body: JSON.stringify({ pendingId, userResolvedPattern, classResolvedPatterns })
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
export interface AdminTestRunStats {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  perPhase: Array<{ phase: string; passed: number; failed: number }>;
}
export async function fetchAdminTestRunStats(): Promise<AdminTestRunStats> {
  return apiFetch<AdminTestRunStats>('/api/admin/stats/test-runs');
}
// User-side variant: just my own GDB pass/fail tally for the studio sidebar.
export async function fetchMyTestRunStats(): Promise<AdminTestRunStats> {
  return apiFetch<AdminTestRunStats>('/api/stats/my-test-runs');
}
export async function fetchAdminPerRunFeedback(): Promise<{ rows: import('../types/api').AdminPerRunFeedbackRow[] }> {
  return apiFetch('/api/admin/stats/per-run-feedback');
}
export async function fetchAdminPerSessionFeedback(): Promise<{ rows: import('../types/api').AdminPerSessionFeedbackRow[] }> {
  return apiFetch('/api/admin/stats/per-session-feedback');
}
export async function fetchAdminOpenEnded(): Promise<{ rows: import('../types/api').AdminOpenEndedRow[] }> {
  return apiFetch('/api/admin/stats/open-ended');
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
export async function fetchAdminLogs(
  limit = 200,
  opts?: { eventType?: string; username?: string; order?: 'asc' | 'desc' }
): Promise<{ logs: AdminLogEntry[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.eventType) params.set('event_type', opts.eventType);
  if (opts?.username)  params.set('username',   opts.username);
  if (opts?.order)     params.set('order',       opts.order);
  return apiFetch<{ logs: AdminLogEntry[] }>(`/api/admin/logs?${params}`);
}
export interface AdminRunRow {
  id: number;
  source_name: string;
  findings_count: number;
  created_at: string;
  username: string | null;
}
export async function fetchAdminRuns(limit = 100): Promise<{ runs: AdminRunRow[] }> {
  return apiFetch<{ runs: AdminRunRow[] }>(`/api/admin/runs?limit=${limit}`);
}
export async function deleteAdminRun(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/admin/runs/${id}`, { method: 'DELETE' });
}
export interface AdminAuditEntry {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  action: string;
  target_kind: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
}
export async function fetchAdminAudit(limit = 200): Promise<{ entries: AdminAuditEntry[] }> {
  return apiFetch<{ entries: AdminAuditEntry[] }>(`/api/admin/audit?limit=${limit}`);
}

export async function deleteAdminLogs(password: string): Promise<{ ok: boolean; deleted: number }> {
  return apiFetch<{ ok: boolean; deleted: number }>('/api/admin/logs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
}
export async function resetTesterSeats(opts?: { userIds?: number[]; offlineOnly?: boolean }): Promise<{ ok: boolean; reset: number }> {
  const body = opts && (opts.userIds?.length || opts.offlineOnly)
    ? JSON.stringify({ userIds: opts.userIds, offlineOnly: !!opts.offlineOnly })
    : undefined;
  return apiFetch<{ ok: boolean; reset: number }>('/api/admin/tester-seats/reset', {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body
  });
}
export async function fetchAdminSurveySummary(): Promise<SurveySummary> {
  return apiFetch<SurveySummary>('/api/admin/stats/survey-summary');
}
export async function fetchAdminComplexityData(): Promise<ComplexityData> {
  return apiFetch<ComplexityData>('/api/admin/stats/complexity-data');
}
export async function fetchAdminF1Metrics(): Promise<F1Metrics> {
  return apiFetch<F1Metrics>('/api/admin/stats/f1-metrics');
}

// Pre-templated unit-test runner (Tier-2). The backend may return 503 with a
// detail string when ENABLE_TEST_RUNNER is unset; the GdbRunnerTab catches
// that and renders a "configure to enable" banner instead of an error toast.
// 429 responses include retryAfterMs so the tab can show a live cooldown.
export type GdbTestPhase = 'compile_run' | 'unit_test';
export interface GdbTestResult {
  patternId: string;
  patternName: string;
  className: string;
  phase: GdbTestPhase;
  passed: boolean;
  expected: string;
  actual: string;
  gdb?: string;
  exitCode: number;
  durationMs: number;
  verdict: string;
  failingLine?: number;
  message?: string;
  criteria?: Array<{ status: 'pass' | 'skip' | 'fail'; description: string }>;
}
export interface GdbRunResponse {
  results: GdbTestResult[];
  rateLimit?: { window: number; cooldownMs: number; remaining: number };
}
export async function runPatternTests(opts: {
  runId?: number;
  pendingId?: string;
  classResolvedPatterns?: Record<string, string>;
  stdin?: string;
}): Promise<GdbRunResponse> {
  if (opts.runId != null) {
    return apiFetch<GdbRunResponse>(`/api/analysis/${opts.runId}/run-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classResolvedPatterns: opts.classResolvedPatterns || {},
        stdin: opts.stdin || ''
      })
    });
  }
  if (!opts.pendingId) throw new Error('runId or pendingId required');
  return apiFetch<GdbRunResponse>('/api/analysis/run-tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pendingId: opts.pendingId,
      classResolvedPatterns: opts.classResolvedPatterns || {},
      stdin: opts.stdin || ''
    })
  });
}

// AI poll endpoint
export interface AiPollResponse {
  status: 'pending' | 'ready' | 'failed';
  annotations?: AnalysisRun['annotations'];
  // Beginner-voice copy keyed by `${patternId}|${className}`. Used by the
  // poll hook to graft education onto each detected pattern card.
  educationByPatternKey?: Record<string, {
    explanation: string;
    whyThisFired: string;
    studyHint: string;
  }>;
  error?: string;
}

export async function pollAiJob(jobId: string): Promise<AiPollResponse> {
  return apiFetch<AiPollResponse>(`/api/analyze/ai/${encodeURIComponent(jobId)}`);
}

// Manual review endpoint
export interface ManualReviewPayload {
  line: number;
  candidates: string[];
  chosenPattern: string | null;
  chosenKind: 'pattern' | 'none' | 'other';
  otherText?: string;
}

export async function submitManualReview(runId: number, payload: ManualReviewPayload): Promise<unknown> {
  return apiFetch<unknown>(`/api/analysis/${runId}/manual-review`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Survey endpoints
export async function submitConsent(version: string): Promise<unknown> {
  return apiFetch<unknown>('/api/survey/consent', {
    method: 'POST',
    body: JSON.stringify({ version })
  });
}

export async function submitPretest(answers: Record<string, unknown>): Promise<unknown> {
  return apiFetch<unknown>('/api/survey/pretest', {
    method: 'POST',
    body: JSON.stringify({ answers })
  });
}

export async function submitRunSurvey(
  runId: string,
  ratings: Record<string, number>,
  openEnded: Record<string, string>
): Promise<unknown> {
  return apiFetch<unknown>(`/api/survey/run/${encodeURIComponent(runId)}`, {
    method: 'POST',
    body: JSON.stringify({ ratings, openEnded })
  });
}

export async function submitSessionSurvey(
  ratings: Record<string, number>,
  openEnded: Record<string, string>,
  sessionUuid?: string
): Promise<unknown> {
  return apiFetch<unknown>('/api/survey/session', {
    method: 'POST',
    body: JSON.stringify({ ratings, openEnded, sessionUuid })
  });
}

// Re-export TesterAccount so consumers can avoid touching the type module directly.
export type { TesterAccount };
