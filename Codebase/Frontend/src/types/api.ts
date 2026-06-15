import type { LearningModuleDTO } from '../data/learningModules';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  // Populated by /auth/google/exchange when the user is signed in via
  // Supabase OAuth with admin intent. Both fields are optional so the
  // legacy username/password path (which doesn't know about org
  // memberships) keeps working.
  orgId?: string | null;
  isOriginalDevs?: boolean;
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
  created_via?: 'oauth' | 'guest' | 'legacy';
}

export interface AdminLearningQuestionStat {
  family: string;
  moduleId: string;
  questionIndex: number;
  seen: number;
  firstTryCorrect: number;
  passRate: number;
  optionDistribution: number[];
}

export interface AdminLearningQuestionLearner {
  userId: number;
  username: string;
  email?: string | null;
  selectedIndex: number;
  isCorrect: number;
  firstAttemptCorrect: number;
  attempts: number;
}

// ── Instructor dashboard: raw learning payload (D91) ──────────────────────────
// The Instructor tab fetches RAW per-user rows from
// GET /api/admin/stats/learning-raw and does ALL aggregation client-side
// (per-student scores, module difficulty). Question/option text is resolved
// client-side from data/learningModules.ts (per D87 — not stored server-side).

export interface LearningRawStudent {
  userId: number;
  username: string;
  email: string | null;
  createdVia: string;
}

export interface LearningRawProgress {
  userId: number;
  completedModuleIds: string[];
  lastUnlockedModuleId: string | null;
  triesByModule: Record<string, number>;
  theoryPassedModuleIds: string[];
  updatedAt: string;
}

export interface LearningRawQuestionResult {
  userId: number;
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  isCorrect: number;
  firstAttemptCorrect: number;
  attempts: number;
  updatedAt: string;
}

export interface LearningRawExamAttempt {
  id: number;
  userId: number;
  moduleId: string;
  attemptNo: number;
  correctCount: number;
  totalQuestions: number;
  passed: number;
  createdAt: string;
}

export interface AdminLearningRaw {
  students: LearningRawStudent[];
  progress: LearningRawProgress[];
  questionResults: LearningRawQuestionResult[];
  examAttempts: LearningRawExamAttempt[];
}

// Raw learning-assessment data (pre-test / post-test / post-test-2). The
// client interprets the result entirely in-browser; the backend stores only
// raw selected answers and the assessment metadata needed to reconstruct the
// submission history.
export type LearningAssessmentType = 'pretest' | 'posttest' | 'posttest2' | 'practical';
export type BloomTaxonomy = 'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating' | 'creating';

export interface BaseExamQuestion {
  taxonomy?: BloomTaxonomy;
  explanation?: string;
}

export interface McqQuestion extends BaseExamQuestion {
  type: 'mcq';
  question: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
  code?: string;
}

export interface IdentificationQuestion extends BaseExamQuestion {
  type: 'identification';
  question: string;
  scenario: string;
  expectedTokens: ReadonlyArray<string>;
}

export interface StudioQuestion extends BaseExamQuestion {
  type: 'studio';
  prompt: string;
  targetPatternSlug: string;
  starterCode?: string;
}

export type ExamQuestion = McqQuestion | IdentificationQuestion | StudioQuestion;

export interface LearningAssessmentAnswerInput {
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  responseText?: string | null;
  questionTaxonomy?: BloomTaxonomy | null;
  questionKind?: 'theoretical' | 'practical';
}

export interface LearningAssessmentAttemptRaw {
  id: number;
  assessmentType: LearningAssessmentType;
  sessionId: string | null;
  questionCount: number;
  createdAt: string;
}

export interface LearningAssessmentAnswerRaw {
  id: number;
  attemptId: number;
  assessmentType: LearningAssessmentType;
  assessmentIndex: number;
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  responseText: string | null;
  questionTaxonomy: BloomTaxonomy | null;
  questionKind: 'theoretical' | 'practical';
  sessionId: string | null;
  createdAt: string;
}

export interface LearningAssessmentsResponse {
  attempts: LearningAssessmentAttemptRaw[];
  answers: LearningAssessmentAnswerRaw[];
  courseUpdatedAt?: string;
}

// ── Learning CMS (D92) ────────────────────────────────────────────────────
// LearningModuleDTO is the frozen wire shape (= the frontend LearningModule).
// The public GET returns published modules in that exact shape; the admin GET
// adds the CMS control fields. Re-exported so consumers can import the DTO from
// the api types module alongside these response shapes.
export type { LearningModuleDTO };

// Public GET /api/learning/modules.
export interface LearningModulesResponse {
  modules: LearningModuleDTO[];
}

// One row in the admin CMS list — the DTO plus the control fields the admin
// edits. published/autoTag are surfaced as booleans (the backend stores 0/1).
export type AdminLearningModule = LearningModuleDTO & {
  published: boolean;
  autoTag: boolean;
  sortOrder: number;
  isSeed: boolean;
  updatedAt: string;
};

// Admin GET /api/admin/learning/modules.
export interface AdminLearningModulesResponse {
  modules: AdminLearningModule[];
}

export interface AdminFeatureReleasePlannerFlag {
  key: string;
  label: string;
  description: string;
}

export interface AdminFeatureReleaseToggleDecision {
  key: string;
  label: string;
  enabled: boolean;
  reason: string;
  matchedModules: string[];
  matchedTopics: string[];
}

export interface AdminFeatureReleaseLearningScope {
  moduleId: string;
  title: string;
  category: string;
  sections: string[];
  topics: string[];
  reason: string;
}

export interface AdminFeatureReleasePlan {
  schemaVersion: 'feature-release-plan-v1';
  source: 'ai' | 'heuristic';
  summary: string;
  toggles: AdminFeatureReleaseToggleDecision[];
  requiredLearning: AdminFeatureReleaseLearningScope[];
}

export interface AdminCoursePlanModuleDecision {
  moduleId: string;
  title: string;
  category: string;
  published: boolean;
  reason: string;
  matchedSections: string[];
  matchedTopics: string[];
}

export interface AdminCoursePlanSectionDecision {
  sectionId: string;
  section: string;
  modules: AdminCoursePlanModuleDecision[];
}

export interface AdminCoursePlanLearningScope {
  moduleId: string;
  title: string;
  category: string;
  sections: string[];
  topics: string[];
  reason: string;
}

export interface AdminCoursePlanDiagnostics {
  aiAttempted: boolean;
  aiSucceeded: boolean;
  catalogModuleCount: number;
  selectedSectionCount: number;
  selectedModuleCount: number;
  emptyPlan: boolean;
  message: string;
  fallbackReason?: AdminCoursePlanFallbackReason;
  aiError?: string;
  aiValidation?: AdminCoursePlanAiValidation | null;
  patternDiversity?: AdminCoursePlanPatternDiversity | null;
  patternAudit?: AdminPatternAuditEntry[];
}

export interface AdminPatternAuditEntry {
  slug: string;
  name: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  score: number;
  selected: boolean;
  matchedEvidence: string[];
  rejectedReason?: string;
}

export type AdminCoursePlanFallbackReason =
  | 'no_provider'
  | 'invalid_json'
  | 'invalid_structure'
  | 'ai_error'
  | 'ai_empty'
  | 'empty_catalog'
  | 'adapter_overselected'
  | 'pattern_diversity_low';

export interface AdminCoursePlanAiValidation {
  status: 'passed' | 'failed';
  mode: 'sections' | 'modules' | 'mixed' | 'none';
  issues: string[];
  acceptedModuleIds: string[];
}

export interface AdminCoursePlanPatternDiversityAdapter {
  selected: boolean;
  score: number;
  matchedEvidence: string[];
  avoidedEvidence: string[];
  blockedReason?: 'weak_evidence' | 'proxy_conflict' | 'facade_conflict' | 'decorator_conflict';
}

export interface AdminCoursePlanPatternDiversity {
  selectedSlugs: string[];
  selectedFamilies: Partial<Record<'Creational' | 'Structural' | 'Behavioural' | 'Idioms', number>>;
  diversityScore: number;
  adapter: AdminCoursePlanPatternDiversityAdapter;
}

export interface AdminCoursePlan {
  schemaVersion: 'course-plan-v1';
  source: 'ai' | 'heuristic';
  summary: string;
  sections: AdminCoursePlanSectionDecision[];
  modules: AdminCoursePlanModuleDecision[];
  requiredLearning: AdminCoursePlanLearningScope[];
  diagnostics: AdminCoursePlanDiagnostics;
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
  sourceName:   string;
  createdAt:    string;
  // Token count is the regression's independent variable (a coarse C++
  // tokenizer counts identifiers, numbers, and individual punctuation).
  // `loc` is kept for parity with older charts that displayed line counts.
  tokens:       number;
  loc:          number;
  patternCount: number;
  totalTargets: number;
  totalMs:      number;
  items?:        number;
  serverWallUs?: number;
  analysisKb?:   number;
}

export interface RegressionResult {
  slope:          number;
  intercept:      number;
  r2:             number;
  n:              number;
  interpretation: string;
}

export interface ComplexityData {
  points:                   ComplexityPoint[];
  regression:               RegressionResult;
  regressionByItems?:         RegressionResult;
  regressionSpaceByTokens?:   RegressionResult;
  regressionSpaceKbByTokens?: RegressionResult;
  regressionWallUsByTokens?:        RegressionResult;
  regressionWallUsByTokensTrimmed?: RegressionResult;
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
  // Per-pattern TN: at the run × pattern grain — runs where the analyzer
  // did NOT flag this pattern AND the participant didn't tick it as
  // missed in the per-run survey. With 10 patterns and 150 runs the
  // per-pattern total always sums to 150.
  tn: number;
  // (TP+TN)/total. TN-dominated at the run×pattern grain, so it reads high —
  // pair with precision/recall rather than reading it alone.
  accuracy: number;
  // Optional total surfaced by the v4 endpoint so the UI can show the
  // denominator next to F1 without re-summing TP/FP/FN/TN client-side.
  total?: number;
  // Human-readable explanation of the score, keyed off familiarity
  // bucket + observed counts. Shown to the thesis panel so each row
  // is defensible without needing to derive the reasoning manually.
  reasoning?: string;
  // false when the pattern has too few decisions to compute a stable
  // F1 (informational-only). Used by the UI to mark the row.
  valid?: boolean;
}

// Overall extends F1Score with TN (true negative) + a top-level
// reasoning string comparing the actual F1 to the expected-norm
// projection so the panel can read the verdict at a glance.
export interface F1Overall extends F1Score {
  tn: number;
  accuracy: number;
  reasoning?: string;
}

// /api/admin/stats/test-summary — aggregates testResults across all runs.
export interface TestSummary {
  runs: number;
  runsWithTests: number;
  compile: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgMs: number;
  };
  staticAnalysis: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgFindings: number;
    avgMs: number;
  };
  unitTests: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    passRate: number;
    totalClasses: number;
    avgCasesPerClass: number;
  };
  note: string;
}

export interface F1Metrics {
  overall:              F1Overall;
  perPattern:           PatternF1[];
  userAccuracyAvg:      number | null;
  likertF1Correlation:  number | null;
  totalRuns?:           number;
  note:                 string;
}
