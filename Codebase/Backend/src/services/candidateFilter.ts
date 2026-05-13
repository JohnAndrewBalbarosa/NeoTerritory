// candidateFilter — pure functions extracted from routes/analysis.ts so
// they can be exercised by unit tests without spinning up the express
// app, the microservice, or the database. Both helpers implement the
// ambiguity-resolution rules from DESIGN_DECISIONS.md (D38).
//
// findAmbiguousClasses(patterns, resolvedMap)
//   Returns the sorted list of class names that have two-or-more
//   competing patterns AND no entry in resolvedMap. Used by the test
//   runner to bounce the user back to the annotated tab for
//   disambiguation.
//
// filterToTaggedPatterns(patterns, resolvedMap)
//   Returns only the patterns the user has actually committed to.
//   Either the matcher gave a single confident detection for the class
//   (no ambiguity) or the user picked one via resolvedMap. Everything
//   else is dropped so the runner does not waste compile cycles on a
//   hypothesis the user rejected.
//
// resolvedMap key  = className
// resolvedMap value = the patternId the user picked for that class
//
// The functions are dependency-free (Map + Array). No I/O.

import type { DetectedPatternResult } from './classDeclarationAnalysisService';

// Frontend stores resolvedMap values as canonical pattern names
// (e.g. "Singleton", "Factory") sourced from canonicalPatternName() in
// Frontend/src/logic/patterns.ts. The microservice emits patternId values
// like "creational.singleton" / "structural.adapter". Without normalization
// the equality check below never matches and every test request comes back
// as 400 AMBIGUOUS_TAGS even though the user did tag a real pattern.
// Normalize both sides to lowercase, strip family prefix, drop non-alphanum,
// then compare. This keeps the existing single-detection short-circuit
// intact and stays case/format-insensitive across the layers.
function normalize(s: string | null | undefined): string {
  if (!s) return '';
  const lower = s.toLowerCase().trim();
  const noPrefix = lower.replace(/^[a-z]+\./, '');
  return noPrefix.replace(/[^a-z0-9]/g, '');
}

function resolvedMatches(
  resolved: string | undefined,
  pattern: { patternId: string; patternName: string }
): boolean {
  if (!resolved) return false;
  const want = normalize(resolved);
  if (!want) return false;
  return want === normalize(pattern.patternId)
      || want === normalize(pattern.patternName);
}

export function findAmbiguousClasses(
  patterns: DetectedPatternResult[],
  resolvedMap: Record<string, string>
): string[] {
  const countByClass = new Map<string, number>();
  for (const p of patterns) {
    if (!p.className) continue;
    countByClass.set(p.className, (countByClass.get(p.className) || 0) + 1);
  }
  const out: string[] = [];
  for (const [name, count] of countByClass) {
    if (count > 1 && !resolvedMap[name]) out.push(name);
  }
  return out.sort();
}

export function filterToTaggedPatterns(
  patterns: DetectedPatternResult[],
  resolvedMap: Record<string, string>
): DetectedPatternResult[] {
  const countByClass = new Map<string, number>();
  for (const p of patterns) {
    if (!p.className) continue;
    countByClass.set(p.className, (countByClass.get(p.className) || 0) + 1);
  }
  return patterns.filter((p) => {
    if (!p.className) return false;
    const cnt = countByClass.get(p.className) || 0;
    if (cnt === 1) return true;
    return resolvedMatches(resolvedMap[p.className], p);
  });
}
