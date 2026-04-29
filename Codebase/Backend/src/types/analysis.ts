/**
 * Analysis pipeline types — the contract between the microservice, backend
 * routes, and the frontend renderer.
 */

import type { EvidenceSignals } from './catalog';

export type AnalysisVerdict = 'confident' | 'ambiguous' | 'weak' | 'no_clear_pattern';

export interface DetectedPattern {
  patternId: string;
  patternName: string;
  patternFamily: string;
  className: string;
  /** Match locations from `ordered_checks` capture_as data. */
  captures?: Record<string, string>;
}

export interface PatternRanking {
  patternId: string;
  classFit: 1.0;
  /** Discretized: count of positive evidence rules fired / total positive rules, minus the same for negatives. Clamped 0..1. */
  implementationFit: number;
  finalRank: number;
  /** Which evidence rules fired and which did not. The "why this verdict" UI displays this directly. */
  evidence: {
    fired: readonly string[];
    missed: readonly string[];
  };
  hasEvidenceRules: boolean;
}

export interface RankAllResult {
  ranks: readonly PatternRanking[];
  verdict: AnalysisVerdict;
  leadingPatternId: string | null;
  ambiguousCandidates: readonly string[];
  thresholds: {
    confident: number;
    ambiguityDelta: number;
    noClearPattern: number;
  };
}

/** Annotation attached to source lines or to the whole file (Bucket F: scope:'file' suppresses per-line rendering). */
export interface Annotation {
  id: string;
  order: number;
  stage: 'Review' | 'Documentation' | 'UnitTest';
  severity: 'low' | 'medium' | 'high';
  scope: 'line' | 'file';
  line?: number;
  lineEnd?: number;
  title: string;
  comment: string;
  excerpt?: string;
  kind: string;
  /** Pattern this annotation belongs to, used for color routing. */
  patternId?: string;
}

export interface AnalysisReport {
  stage: 'output';
  diagnostics: readonly string[];
  detectedPatterns: readonly DetectedPattern[];
  /** Emitted by the C++ evidence extractor (D29). */
  evidenceSignals?: EvidenceSignals;
  ranking?: RankAllResult;
  annotations: readonly Annotation[];
  documentationTargets: readonly DocumentationTarget[];
  unitTestTargets: readonly UnitTestTarget[];
  runDirectory: string;
  stageMetrics: readonly StageMetric[];
  artifacts: Record<string, unknown>;
}

export interface DocumentationTarget {
  patternId: string;
  className: string;
  anchorId: string;
  line: number;
  description: string;
}

export interface UnitTestTarget {
  patternId: string;
  className: string;
  branch_kind: string;
  line: number;
}

export interface StageMetric {
  stage_name: string;
  milliseconds: number;
  items_processed: number;
}
