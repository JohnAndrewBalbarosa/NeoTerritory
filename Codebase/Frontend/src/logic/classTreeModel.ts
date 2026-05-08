// Single class-rooted tree derivation for the analysis surface.
//
// Reads the already-derived `AnnotatedModel` (single source of truth for
// per-class status + masterlist) plus the raw `AnalysisRun` (for line
// text and per-line annotation patterns) and produces a flat array of
// `ClassTreeNode` rows. One root per tagged class; each child is a tagged
// line carrying every pattern that fired on it.
//
// Status contract (matches the user's spec literally):
//   - LineNode.status === 'review' iff taggedPatterns.length > 1.
//   - LineNode.mainDesignPattern is the SINGLE variable name when length
//     is 1, else null.
//   - ClassTreeNode.status === 'resolved' when the user has picked
//     (model.resolvedClassNames or unambiguous-with-pick); 'review' when
//     any child is review or the class has multi-pattern divergence and
//     no pick yet; 'clean' otherwise.
//   - ClassTreeNode.mainDesignPattern carries the single canonical name
//     for resolved/clean rows, null for review rows.
//
// Pure: no JSX, no store reads. Memoize on (model, run) at the call site.

import type { AnalysisRun, AnalysisRunFile } from '../types/api';
import type { AnnotatedModel } from './annotatedModel';
import { canonicalPatternName, isRealPattern } from './patterns';
import { splitStatementsAt, type StatementSegment } from './lineDelimiters';

export type LineNodeStatus = 'clean' | 'review';

export interface LineNode {
  line: number;
  kind: 'declaration' | 'usage';
  rawText: string;
  segments: StatementSegment[];
  taggedPatterns: string[];
  mainDesignPattern: string | null;
  status: LineNodeStatus;
}

export type ClassNodeStatus = 'clean' | 'review' | 'resolved';

export interface ClassTreeNode {
  className: string;
  parent: string | null;
  subclasses: string[];
  classPatterns: string[];
  mainDesignPattern: string | null;
  status: ClassNodeStatus;
  children: LineNode[];
  // User-confirmed patterns after picker resolution + hierarchy propagation.
  chosenPatterns: string[];
  // True when the user has confirmed at least one pattern for this class.
  isTagged: boolean;
}

interface BuildInput {
  model: AnnotatedModel;
  run: AnalysisRun | null;
}

function getFiles(run: AnalysisRun): AnalysisRunFile[] {
  if (run.files && run.files.length > 0) return run.files;
  return [{
    name: run.sourceName || 'snippet.cpp',
    sourceText: run.sourceText || '',
  }];
}

function lineTextFor(
  files: AnalysisRunFile[],
  fileIdx: number,
  line: number,
): string {
  const file = files[fileIdx] || files[0];
  if (!file) return '';
  const lines = (file.sourceText || '').split('\n');
  return lines[line - 1] ?? '';
}

function uniqueOrdered(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function buildClassTree(input: BuildInput): ClassTreeNode[] {
  const { model, run } = input;
  if (!run) return [];

  const files = getFiles(run);
  const annotations = run.annotations || [];
  const detected = run.detectedPatterns || [];
  const resolvedMap = run.classResolvedPatterns || {};

  // Per (className, line) → set of canonical pattern names, drawn from
  // BOTH detectedPatterns.documentationTargets AND annotations. Keying on
  // className is important so a multi-class file does not bleed tags
  // across class boundaries.
  const tagsByClassLine = new Map<string, Map<number, Set<string>>>();
  function addTag(className: string, line: number, patternKey: string): void {
    if (!isRealPattern(patternKey)) return;
    const canon = canonicalPatternName(patternKey);
    let perClass = tagsByClassLine.get(className);
    if (!perClass) {
      perClass = new Map<number, Set<string>>();
      tagsByClassLine.set(className, perClass);
    }
    let perLine = perClass.get(line);
    if (!perLine) {
      perLine = new Set<string>();
      perClass.set(line, perLine);
    }
    perLine.add(canon);
  }

  for (const p of detected) {
    if (!p.className) continue;
    for (const t of p.documentationTargets || []) {
      if (typeof t.line === 'number') addTag(p.className, t.line, p.patternId);
    }
  }
  for (const a of annotations) {
    if (typeof a.line !== 'number') continue;
    if (!a.className || !a.patternKey) continue;
    addTag(a.className, a.line, a.patternKey);
  }

  function buildLineNode(
    className: string,
    line: number,
    kind: 'declaration' | 'usage',
  ): LineNode {
    const loc = model.classLocations.get(className);
    const fileIdx = loc?.fileIdx ?? 0;
    const rawText = lineTextFor(files, fileIdx, line);

    const tagSet = tagsByClassLine.get(className)?.get(line) ?? new Set<string>();
    const taggedPatterns = uniqueOrdered(tagSet);
    const isReview = taggedPatterns.length > 1;

    return {
      line,
      kind,
      rawText,
      segments: isReview ? splitStatementsAt(rawText) : [],
      taggedPatterns,
      mainDesignPattern: taggedPatterns.length === 1 ? taggedPatterns[0] : null,
      status: isReview ? 'review' : 'clean',
    };
  }

  const out: ClassTreeNode[] = [];

  for (const [className, entry] of model.workingMasterlist) {
    const node = model.classes.get(className);

    const declarationChildren: LineNode[] = entry.taggedLines.declaration.map(
      (ln) => buildLineNode(className, ln, 'declaration'),
    );
    const usageChildren: LineNode[] = entry.taggedLines.usage.map(
      (ln) => buildLineNode(className, ln, 'usage'),
    );
    const children = [...declarationChildren, ...usageChildren];

    // Class-level pattern union: every distinct canonical pattern that
    // appeared on any child node. This is the single masterlist of
    // patterns the user requested per class.
    const classPatterns = uniqueOrdered(
      children.flatMap((child) => child.taggedPatterns),
    );

    // Resolution state — derived from the centralised model so the tree
    // stays in lockstep with SourceView, PatternCards, PatternLegend.
    let status: ClassNodeStatus;
    let mainDesignPattern: string | null = null;

    const resolvedPick = node?.resolved ?? resolvedMap[className];
    const hasReviewChild = children.some((c) => c.status === 'review');

    // Sidebar must mirror the popup's view of "user owes a pick".
    // The popup (ClassRootPicker / LinePopover) treats a class as
    // pickable whenever the model marks it `ambiguous_pending` —
    // i.e. its `candidates` (direct ∪ in-scope) has 2+ entries.
    // Without consulting that, we miss cases where the union has
    // multiple patterns but each individual child line carries only
    // one tag and `classPatterns` collapses to 1.
    const modelAmbiguous = node?.status === 'ambiguous_pending';

    if (resolvedPick) {
      status = 'resolved';
      mainDesignPattern = canonicalPatternName(resolvedPick);
    } else if (hasReviewChild || classPatterns.length > 1 || modelAmbiguous) {
      status = 'review';
      mainDesignPattern = null;
    } else {
      status = 'clean';
      mainDesignPattern = classPatterns[0] ?? null;
    }

    out.push({
      className,
      parent: entry.parent,
      subclasses: entry.subclasses.slice(),
      classPatterns,
      mainDesignPattern,
      status,
      children,
      chosenPatterns: entry.chosenPatterns.slice(),
      isTagged: entry.isTagged,
    });
  }

  // Stable order: review nodes first (so they surface as a separate top
  // section), then parents before children, then alphabetical within each
  // depth band. Falls back to insertion order if the parent map is
  // cyclic (shouldn't happen, but render must not hang).
  out.sort((a, b) => {
    const aReview = a.status === 'review' ? 0 : 1;
    const bReview = b.status === 'review' ? 0 : 1;
    if (aReview !== bReview) return aReview - bReview;
    if ((a.parent ?? '') !== (b.parent ?? '')) {
      if (a.parent === null) return -1;
      if (b.parent === null) return 1;
      return a.parent.localeCompare(b.parent);
    }
    return a.className.localeCompare(b.className);
  });

  return out;
}
