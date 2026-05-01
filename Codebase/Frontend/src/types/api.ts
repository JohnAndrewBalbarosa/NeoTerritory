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
export interface PatternLineEvidence {
  totalLines: number;
  taggedLines: number;
  hitsTotal: number;
  hitsMax: number;
  rivalHits: number;
  negativeHits: number;
  coverage: number;
  odds: number;
  probability: number;
  byLine: Array<{ line: number; ownHits: number; rivalHits: number }>;
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

export interface AdminLogEntry {
  id: number;
  created_at: string;
  username?: string;
  event_type: string;
  message: string;
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
export interface PatternFreqPoint { pattern: string; count: number; }
export interface ScoreBucket { range: string; count: number; }
export interface PerUserPoint { username: string; runs: number; }

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
  microservice: {
    connected: boolean;
    binaryFound: boolean;
    catalogFound: boolean;
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

export interface F1Metrics {
  overall:              F1Score;
  perPattern:           PatternF1[];
  userAccuracyAvg:      number | null;
  likertF1Correlation:  number | null;
  note:                 string;
}
