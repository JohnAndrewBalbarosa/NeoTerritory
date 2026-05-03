import { Annotation, DetectedPatternFull, AnalysisRunFile } from '../types/api';
import { patternFromAnnotation } from './patterns';

export interface ClassLocation {
  fileIdx: number;
  line: number;
  endLine: number;
}

// Locate every `class Foo` / `struct Foo` declaration across the run's files
// and approximate its scope as (declLine, nextDeclLine - 1). This is the same
// heuristic the AnnotatedTab uses; lifting it into a shared module so the
// legend, the source view, and the pattern cards all agree on what counts as
// "this line is the class declaration".
export function buildClassLocations(files: AnalysisRunFile[]): Map<string, ClassLocation> {
  const locs = new Map<string, ClassLocation>();
  for (let fi = 0; fi < files.length; fi++) {
    const text = files[fi].sourceText || '';
    const lines = text.split('\n');
    const decls: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/\b(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (m) decls.push({ name: m[1], line: i + 1 });
    }
    for (let k = 0; k < decls.length; k++) {
      const d = decls[k];
      const next = decls[k + 1]?.line ?? lines.length + 1;
      if (!locs.has(d.name)) {
        locs.set(d.name, { fileIdx: fi, line: d.line, endLine: next - 1 });
      }
    }
  }
  return locs;
}

// Per-line ambiguity signal: lines where >1 distinct pattern keys are claimed.
// Same resolution LinePopover uses (`patternKey || patternFromAnnotation(a)`).
export function buildAmbiguousLines(annotations: Annotation[]): Set<number> {
  const byLine = new Map<number, Set<string>>();
  for (const a of annotations) {
    if (typeof a.line !== 'number') continue;
    const key = a.patternKey || patternFromAnnotation(a);
    if (!key) continue;
    if (!byLine.has(a.line)) byLine.set(a.line, new Set());
    byLine.get(a.line)!.add(key);
  }
  const set = new Set<number>();
  for (const [line, keys] of byLine) {
    if (keys.size > 1) set.add(line);
  }
  return set;
}

// A class is ambiguous when:
//   1) the matcher attached >1 distinct patterns directly to its head, OR
//   2) a popover-ambiguous line lives inside its declaration scope.
// Resolved classes drop out (the user has decided).
export function buildAmbiguousClassNames(
  detectedPatterns: DetectedPatternFull[],
  classLocations: Map<string, ClassLocation>,
  ambiguousLines: Set<number>,
  classResolvedPatterns: Record<string, string> | undefined
): Set<string> {
  const ownPatternsByClass = new Map<string, Set<string>>();
  for (const p of detectedPatterns) {
    if (!p.className) continue;
    if (!ownPatternsByClass.has(p.className)) ownPatternsByClass.set(p.className, new Set());
    ownPatternsByClass.get(p.className)!.add(p.patternId);
  }
  const out = new Set<string>();
  const resolved = classResolvedPatterns || {};
  const candidates = new Set<string>([
    ...ownPatternsByClass.keys(),
    ...classLocations.keys()
  ]);
  for (const className of candidates) {
    if (resolved[className]) continue;
    const directAmbiguous = (ownPatternsByClass.get(className)?.size || 0) > 1;
    let bodyAmbiguous = false;
    const loc = classLocations.get(className);
    if (loc) {
      for (const ln of ambiguousLines) {
        if (ln >= loc.line && ln <= loc.endLine) { bodyAmbiguous = true; break; }
      }
    }
    if (directAmbiguous || bodyAmbiguous) out.add(className);
  }
  return out;
}

// Wider set than buildAmbiguousClassNames: every class that has a known
// declaration location and isn't already resolved is eligible for the
// rival picker. The detector-disagreed signal stays in
// buildAmbiguousClassNames for PatternCards/PatternLegend, which still
// distinguish "needs a decision" from "decided".
//
// Why this exists: the C++ matcher is binary (matched / not matched), so
// classes the matcher is fully confident on never become "ambiguous" in
// the strict sense — but the user still wants the affordance to override.
// SourceView reads from this set when deciding whether to surface the
// catalog-based picker on a class declaration line.
export function buildPickerEligibleClassNames(
  classLocations: Map<string, ClassLocation>,
  classResolvedPatterns: Record<string, string> | undefined
): Set<string> {
  const out = new Set<string>();
  const resolved = classResolvedPatterns || {};
  for (const className of classLocations.keys()) {
    if (resolved[className]) continue;
    out.add(className);
  }
  return out;
}

// k = annotation lines inside the class scope whose dominant pattern key
// equals the chosen pattern. n = total lines in the class scope. The user
// requested the simple line-count denominator (no blank/comment filter) so
// the recompute reflects exactly what they see in the source view.
export function recomputeKn(
  className: string,
  chosenPatternKey: string,
  classLocations: Map<string, ClassLocation>,
  annotations: Annotation[]
): { k: number; n: number } {
  const loc = classLocations.get(className);
  if (!loc) return { k: 0, n: 0 };
  const linesInScope = new Set<number>();
  for (let l = loc.line; l <= loc.endLine; l++) linesInScope.add(l);
  const winningLines = new Set<number>();
  for (const a of annotations) {
    if (typeof a.line !== 'number') continue;
    if (!linesInScope.has(a.line)) continue;
    const key = a.patternKey || patternFromAnnotation(a);
    if (key === chosenPatternKey) winningLines.add(a.line);
  }
  return { k: winningLines.size, n: loc.endLine - loc.line + 1 };
}
