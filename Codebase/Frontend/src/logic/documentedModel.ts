import { AnalysisRun, DocumentationTarget } from '../types/api';
import { AnnotatedModel } from './annotatedModel';
import { patternDefinitionFor } from '../data/patternDefinitions';
import { isAiAnnotation } from './docExport';

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
  run: AnalysisRun | null,
  annotatedModel: AnnotatedModel,
): DocumentedModel {
  const headerByLine = new Map<number, PatternHeaderData>();
  const docByLine = new Map<number, InlineDocData>();
  if (!run) return { headerByLine, docByLine };

  // Use the cascade-surviving patterns only. If cascade dropped everything,
  // the correct result is an empty header map — do NOT fall back to the raw
  // run.detectedPatterns, which would re-inflate dropped tags into the UI.
  const patterns = annotatedModel.activePatterns;

  // ── Headers: one per class declaration line ──────────────────────────────
  for (const p of patterns) {
    if (!p.className) continue;
    const loc = annotatedModel.classLocations.get(p.className);
    const declLine = loc?.line
      ?? (p.documentationTargets || [])
          .map(t => t.line)
          .filter((l): l is number => typeof l === 'number')
          .sort((a, b) => a - b)[0];
    if (typeof declLine !== 'number') continue;
    if (headerByLine.has(declLine)) continue; // first pattern wins the line

    const edu = p.patternEducation;
    const def = patternDefinitionFor(p.patternName);
    const source: 'ai' | 'static' = edu ? 'ai' : 'static';
    const oneLiner = edu ? edu.explanation : (def?.oneLiner ?? '');

    headerByLine.set(declLine, {
      line: declLine,
      patternName: p.patternName,
      className: p.className,
      source,
      oneLiner,
      whyThisFired: edu?.whyThisFired,
      whenToUse: edu ? undefined : def?.whenToUse,
      realWorldAnalogy: edu ? undefined : def?.realWorldAnalogy,
      watchOuts: edu ? undefined : def?.watchOuts,
      methodsToTest: (p.unitTestTargets || []).map(t => ({
        name: t.function_name,
        line: t.line,
        branchKind: t.branch_kind,
      })),
    });
  }

  // ── Inline docs: one per annotated line ──────────────────────────────────
  // Build a per-line landmark index from every pattern's documentationTargets.
  const landmarkByLine = new Map<number, string[]>();
  for (const p of patterns) {
    for (const t of p.documentationTargets || []) {
      if (typeof t.line !== 'number') continue;
      const list = landmarkByLine.get(t.line) ?? [];
      if (!list.includes(t.label)) list.push(t.label);
      landmarkByLine.set(t.line, list);
    }
  }

  // Usage lines per class (where the class is referenced elsewhere).
  const usageByClass = new Map<string, number[]>();
  for (const [cls, list] of Object.entries(run.classUsageBindings || {})) {
    const lines = (list || [])
      .map(b => b.line)
      .filter((l): l is number => typeof l === 'number');
    if (lines.length) usageByClass.set(cls, lines);
  }

  for (const a of run.annotations || []) {
    if (typeof a.line !== 'number') continue;
    const line = a.line;
    const newNote = {
      title: a.title,
      comment: a.comment,
      source: (isAiAnnotation(a) ? 'ai' : 'static') as 'ai' | 'static',
    };
    const existing = docByLine.get(line);
    const entry: InlineDocData = existing
      ? { ...existing, notes: [...existing.notes, newNote] }
      : {
          line,
          notes: [newNote],
          landmarks: landmarkByLine.get(line) ?? [],
          usageLines: a.className ? (usageByClass.get(a.className) ?? []) : [],
        };
    docByLine.set(line, entry);
  }

  // Lines that have a landmark but no annotation still deserve an inline doc.
  for (const [line, landmarks] of landmarkByLine) {
    if (docByLine.has(line)) continue;
    docByLine.set(line, { line, notes: [], landmarks, usageLines: [] });
  }

  return { headerByLine, docByLine };
}

// Local helpers referenced by tests are exported for direct coverage.
export function landmarksForLine(targets: DocumentationTarget[], line: number): string[] {
  return targets.filter(t => t.line === line).map(t => t.label);
}
