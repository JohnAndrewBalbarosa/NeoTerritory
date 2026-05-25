import { AnalysisRun, Annotation, DocumentationTarget } from '../types/api';
import { AnnotatedModel } from './annotatedModel';
import { PatternDefinition } from '../data/patternDefinitions';

export interface PatternHeaderData {
  line: number;                 // class declaration line
  patternName: string;
  className: string;
  source: 'ai' | 'static';      // which explanation won
  oneLiner: string;             // AI explanation OR definition.oneLiner
  whyThisFired?: string;        // AI only
  whenToUse?: string;           // static only
  realWorldAnalogy?: string;    // static only
  watchOuts?: string;           // static only
  methodsToTest: Array<{ name: string; line: number; branchKind: string }>;
}

export interface InlineDocData {
  line: number;
  notes: Array<{ title: string; comment: string; source: 'ai' | 'static' }>;
  landmarks: string[];          // documentationTarget labels on this line
  usageLines: number[];         // other lines where this line's class is used
}

export interface DocumentedModel {
  headerByLine: Map<number, PatternHeaderData>;
  docByLine: Map<number, InlineDocData>;
}

export function buildDocumentedModel(
  _run: AnalysisRun | null,
  _annotatedModel: AnnotatedModel,
): DocumentedModel {
  throw new Error('not implemented');
}

// Local helpers referenced by tests are exported for direct coverage.
export function isAiAnn(a: Annotation): boolean {
  return a.stage === 'ai_commentary';
}
export function landmarksForLine(targets: DocumentationTarget[], line: number): string[] {
  return targets.filter(t => t.line === line).map(t => t.label);
}
export type { PatternDefinition };
