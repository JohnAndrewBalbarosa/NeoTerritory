export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

export interface DocumentationTarget {
  label: string;
  line: number;
  lexeme: string;
}

export interface UnitTestTarget {
  function_hash: string | number;
  function_name: string;
  branch_kind: string;
  line: number;
}

export interface DetectedPattern {
  patternId: string;
  patternName: string;
  confidence: number;
  documentationTargets: DocumentationTarget[];
  unitTestTargets: UnitTestTarget[];
}

export interface PatternRanking {
  verdict: string;
  topPattern: string | null;
  scores: Record<string, number>;
}

export interface PatternLexemeSet {
  keywords: string[];
  methods:  string[];
  idioms:   string[];
}

export interface Annotation {
  id: string;
  order: number;
  stage: string;
  severity: 'high' | 'medium' | 'low';
  line: number | null;
  lineEnd: number | null;
  title: string;
  comment: string;
  excerpt: string;
  kind: string;
  patternKey?: string;
  className?: string;
  scope?: string;
  lexemeHints?: string[];
}

export interface ClassUsageBinding {
  kind: string;
  line: number;
  varName?: string;
  methodName?: string;
  boundClass?: string;
  evidence?: string;
  snippet?: string;
}

// Per-line probability summary that drives the new scoring model. Mirrors
// LineEvidence in patternRankingService.ts.
//
// References (cited inline in ScoringExplainer):
//  - Wilson, E. B. (1927). JASA 22(158): 209-212.
//  - Agresti & Coull (1998). Am. Stat. 52(2): 119-126.
//  - z = 1.96: 97.5th percentile of N(0,1), the 95% CI standard.
export interface PatternLineEvidence {
  totalLines: number;
  taggedLines: number;
  hitsTotal: number;
  hitsMax: number;
  rivalHits: number;
  negativeHits: number;
  coverage: number;
  // Wilson score interval inputs and output
  trials: number;
  successes: number;
  pHat: number;
  z: number;
  wilsonLowerBound: number;
  probability: number; // alias for wilsonLowerBound
  byLine: Array<{ line: number; ownHits: number; rivalHits: number; opposingWeight: number; win: boolean }>;
}

export interface PatternRankEntry {
  patternId: string;
  patternName?: string;
  finalRank: number;
  implementationFit: number;
  hasImplementationTemplate?: boolean;
  evidence?: { callsites?: Array<{ line: number; snippet: string }> };
  lineEvidence?: PatternLineEvidence;
}

export interface AmbiguityRanking extends PatternRanking {
  ranks?: PatternRankEntry[];
  ambiguousCandidates?: string[];
}

export interface PatternEducation {
  explanation: string;     // 1-2 sentences, plain English, no jargon
  whyThisFired: string;    // What in the user's code triggered this match
  studyHint: string;       // Where to look in the code first
}

export interface DetectedPatternFull extends DetectedPattern {
  className?: string;
  // Set when this pattern was emitted via subclass propagation. Names
  // the parent class whose inheritance-driven match produced this child
  // tag. UI may surface it (e.g. "← from Vehicle") but it does not
  // drive coloring — the child carries its own canonical pattern key.
  parentClassName?: string;
  patternLexemes?: PatternLexemeSet;
  patternEducation?: PatternEducation;
}

export interface ReviewQuestion {
  id: string;
  prompt: string;
  required?: boolean;
  type: 'rating' | 'text' | 'choice';
  max?: number;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface ReviewSchema {
  questions: ReviewQuestion[];
  version?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email?: string;
  role?: string;
  runCount?: number;
  lastRunAt?: string;
  created_at?: string;
  last_active?: string;
}

export interface AdminPerRunFeedbackRow {
  id: number;
  runId: string;
  runSourceName: string | null;
  username: string | null;
  ratings: Record<string, number>;
  openEnded: Record<string, string>;
  submittedAt: string;
}
export interface AdminPerSessionFeedbackRow {
  id: number;
  sessionUuid: string;
  username: string | null;
  ratings: Record<string, number>;
  openEnded: Record<string, string>;
  submittedAt: string;
}
export interface AdminOpenEndedRow {
  id: number;
  source: 'per-run' | 'per-session' | 'review';
  username: string | null;
  runId?: string;
  sessionUuid?: string;
  questionId: string;
  text: string;
  submittedAt: string;
}

export interface AdminLogEntry {
  id: number;
  created_at: string;
  username?: string;
  event_type: string;
  message: string;
}

// Compound filter state for the admin logs view. Empty/undefined fields
// mean "do not filter on that dimension". Categories are AND'd with the
// rest, OR'd within themselves.
export type AdminLogCategory = 'auth' | 'analysis' | 'survey' | 'frontend' | 'errors';

export interface AdminLogFilters {
  username?:    string;
  eventType?:   string;
  tester?:      'tester' | 'non-tester' | 'any';
  dateFrom?:    string;          // ISO date (YYYY-MM-DD or full timestamp)
  dateTo?:      string;
  online?:      'online' | 'offline' | 'any';
  categories?:  AdminLogCategory[];
  order?:       'asc' | 'desc';
}

export interface AdminReview {
  username?: string;
  scope: string;
  sourceName?: string;
  createdAt: string;
  schemaVersion: string;
  answers: Record<string, string | number>;
}

export interface AdminOverview {
  totalUsers: number;
  totalRuns: number;
  runsToday: number;
  totalReviews: number;
  avgFindings: number;
}

export interface RunsPerDayPoint { date: string; count: number; }
export interface PatternFreqPoint {
  pattern: string;        // patternId, e.g. "creational.singleton"
  count: number;
  family?: string;        // catalog folder, e.g. "creational" — drives the family pie
  displayName?: string;   // human label, e.g. "Singleton" — falls back to pattern when absent
}
export interface ScoreBucket { range: string; count: number; }
export interface PerUserPoint { username: string; runs: number; }

// Per-file slice of an analysis run. Multi-file submission stores one of
// these per uploaded source. Single-file runs put their content into
// files[0]; sourceName / sourceText on AnalysisRun stay populated as
// aliases for files[0] so legacy call sites keep working unchanged.
export interface AnalysisRunFile {
  name: string;
  sourceText: string;
}

export interface AnalysisRun {
  runId: number | null;
  sourceName: string;
  sourceText: string;
  detectedPatterns: DetectedPatternFull[];
  annotations: Annotation[];
  ranking: AmbiguityRanking | null;
  classUsageBindings: Record<string, ClassUsageBinding[]>;
  classUsageBindingSource: 'heuristic' | 'microservice';
  summary: string;
  pendingId?: string;
  createdAt?: string;
  userResolvedPattern?: string | null;
  // Per-class user pattern resolutions. When set for a class, color rendering
  // and synthesized usage annotations prefer this over the heuristic verdict.
  classResolvedPatterns?: Record<string, string>;
  // Per-class accumulated confirmed patterns after user resolution + hierarchy
  // propagation. Populated by applyPatternTag whenever the user confirms a
  // pattern via the picker. Multiple entries per class are possible when
  // different hierarchy members contributed different patterns.
  classChosenPatterns?: Record<string, string[]>;
  // Multi-file payload. Always non-empty for runs produced by /analyze; older
  // runs loaded from disk that predate multi-file get back-filled with a
  // single entry mirroring sourceName + sourceText.
  files?: AnalysisRunFile[];
  // Family-keyed list of pattern short names that propagate to
  // subclasses, mirrored from
  // `pattern_catalog/inheritance_driven_patterns.json` on the
  // microservice. Used by the annotated-source model to decide which
  // parent picks cascade onto child classes. Empty/missing for runs
  // produced before this field shipped — the model treats the
  // subclass-cascade as inactive in that case.
  inheritanceDrivenPatterns?: Record<string, string[]>;
}

export interface RunListItem {
  id: number;
  source_name: string;
  created_at: string;
  findings_count: number;
}

export interface RunsResponse {
  runs: RunListItem[];
}

export interface HealthStatus {
  service: string;
  totalRuns: number;
  aiProviderConfigured: boolean;
  aiModel?: string;
  // Provenance of the active AI config. 'db' = set via admin AI tab,
  // 'env' = baked into the container, 'none' = no provider wired up.
  aiSource?: 'db' | 'env' | 'none';
  aiProvider?: 'anthropic' | 'gemini' | 'none';
  maxFilesPerSubmission?: number;
  maxTokensPerFile?: number;
  testRunnerEnabled?: boolean;
  // Admin-controlled toggle. Mirrors app_settings.reviews_required.
  // Drives the Self-check tab visibility + the survey-gated finalize
  // buffer.
  reviewsRequired?: boolean;
  gdbRunsPerWindow?: number;
  gdbCooldownMs?: number;
  microservice: {
    connected: boolean;
    binaryFound: boolean;
    catalogFound: boolean;
  };
  // Per-tester Docker pod isolation status. `enabled` flips with the
  // backend env flag; `imageReady` is true only after the cpp-pod image
  // has finished its one-time build; `livePods` is the count currently
  // attached to online testers.
  docker?: {
    enabled: boolean;
    imageReady: boolean;
    livePods: number;
    reason: 'env_off' | 'no_binary' | 'daemon_down' | null;
    // True iff the JWT presented on this request maps to a live
    // per-user pod. Lets the studio's status card append "(your pod
    // active)" so the signed-in tester knows their seat is bound to
    // a container.
    mine: boolean;
  };
  process?: {
    pid: number;
    hostname: string;
    port: number;
  };
}

export interface TesterAccount {
  username: string;
}

export type StatusKind = 'idle' | 'ok' | 'busy' | 'error';

export interface AppStatus {
  kind: StatusKind;
  title: string;
  detail: string;
}

export type MsState = 'checking' | 'online' | 'offline';

// ─── Admin analytics types ────────────────────────────────────────────────────

export interface LikertMetric {
  avg: number;
  count: number;
  distribution: number[];  // 5 elements: index 0 = rating 1, index 4 = rating 5
}

export interface SurveySummary {
  perRun:       Record<string, LikertMetric>;
  endOfSession: Record<string, LikertMetric>;
}

export interface ComplexityPoint {
  runId:        number;
  // Token count is the regression's independent variable (a coarse C++
  // tokenizer counts identifiers, numbers, and individual punctuation).
  // `loc` is kept for parity with older charts that displayed line counts.
  tokens:       number;
  loc:          number;
  patternCount: number;
  totalTargets: number;
  totalMs:      number;
}

export interface RegressionResult {
  slope:          number;
  intercept:      number;
  r2:             number;
  n:              number;
  interpretation: string;
}

export interface ComplexityData {
  points:     ComplexityPoint[];
  regression: RegressionResult;
}

export interface F1Score {
  precision: number;
  recall:    number;
  f1:        number;
  tp:        number;
  fp:        number;
  fn:        number;
}

export interface PatternF1 extends F1Score {
  pattern: string;
}

// Overall extends F1Score with TN (true negative). Per-pattern TN is
// intentionally omitted — see D36 in DESIGN_DECISIONS for rationale.
export interface F1Overall extends F1Score {
  tn: number;
}

export interface F1Metrics {
  overall:              F1Overall;
  perPattern:           PatternF1[];
  userAccuracyAvg:      number | null;
  likertF1Correlation:  number | null;
  note:                 string;
}
