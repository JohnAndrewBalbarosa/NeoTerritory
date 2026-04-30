export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface AnalysisAnnotation {
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

export interface ClassUsageBinding {
  usageKind: string;
  line: number;
  text: string;
}

export interface AnalysisRun {
  runId: number | null;
  sourceName: string;
  sourceText: string;
  detectedPatterns: DetectedPattern[];
  annotations: AnalysisAnnotation[];
  ranking: PatternRanking | null;
  classUsageBindings: Record<string, ClassUsageBinding[]>;
  classUsageBindingSource: 'heuristic' | 'microservice';
  summary: string;
  pendingId?: string;
  createdAt?: string;
}

export interface AiDocResult {
  status: 'generated' | 'failed' | 'skipped' | 'pending_provider';
  reason?: string;
  verdict?: string;
  finalPatternId?: string;
  rationale?: string;
  documentationByTarget: Record<string, string>;
  unitTestPlanByTarget: Record<string, string>;
  providerMetadata?: {
    id?: string;
    model?: string;
    stop_reason?: string;
  } | null;
  providerError?: string;
}

export interface PipelineStage {
  key: string;
  title: string;
  state: 'waiting' | 'ready' | 'error';
  summary: string;
  detail: string;
}
