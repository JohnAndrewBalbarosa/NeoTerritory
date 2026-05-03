// Single derivation surface for the annotated-source view.
//
// Why this exists: SourceView, PatternLegend, ClassBindings, PatternCards,
// the rival picker, and the class-nav arrows all need to agree on which
// classes are ambiguous, which are resolved, what each line should be
// coloured as, which subclass tags are still live, and what to show in the
// legend. Each used to derive that locally with subtly different rules,
// which is how PlainHolder ended up grey while its class wasn't tagged at
// all and how the legend kept claiming patterns the user hadn't picked.
//
// The model is built by ONE pure function — `deriveAnnotatedModel` — that
// takes the immutable API response (`currentRun`) plus the user's override
// layer (line-level + class-level picks) and returns a frozen view-model.
// Nothing inside this module mutates the input. UI components consume the
// model directly. A user picking a different pattern simply re-derives the
// whole thing — backtracking is free because the original JSON is never
// touched.
//
// Subclass cascade: when a class was tagged by parent-driven propagation
// (carries `parentClassName`), its tag is only "live" while the parent's
// resolved pattern is one that propagates to subclasses. Today the only
// inheritance-driven pattern is Strategy, so the rule is: parent resolves
// to Strategy → subclass tags stay; parent resolves to anything else →
// subclass tags drop. When the catalog grows new inheritance-driven
// patterns add their canonical names to SUBCLASS_PROPAGATING_PATTERNS.

import { AnalysisRun, Annotation, DetectedPatternFull } from '../types/api';
import {
  patternFromAnnotation,
  canonicalPatternName,
  isRealPattern,
} from './patterns';

// Sentinel written into `classResolvedPatterns[className]` when the user
// explicitly clears an inheritance-driven parent's pattern via the
// "Not this pattern" affordance. Treated by the cascade as a
// non-propagating effective pick → propagated children drop. Distinct
// from "no pick at all" (which is just the absence of an entry).
export const CLASS_RESOLVED_NONE = '__none__';

// Hardcoded fallback used only when the backend doesn't ship the
// `inheritanceDrivenPatterns` masterlist (older runs, or a deployment
// pre-dating that field). The live model derives its propagating set
// from `run.inheritanceDrivenPatterns` if present — see
// resolvePropagatingPatterns below — so adding patterns to
// `pattern_catalog/inheritance_driven_patterns.json` ships end-to-end
// without a frontend recompile.
const FALLBACK_PROPAGATING_PATTERNS: ReadonlySet<string> = new Set([
  'Strategy',
]);

// Build the canonical pattern-name set from the masterlist payload.
// Each entry is a short pattern name (`strategy_interface`, etc.); we
// canonicalise it (`Strategy`) so the model's cascade comparison aligns
// with the canonical names everything else in the UI uses.
function resolvePropagatingPatterns(
  masterlist: Record<string, string[]> | undefined,
): ReadonlySet<string> {
  if (!masterlist) return FALLBACK_PROPAGATING_PATTERNS;
  const out = new Set<string>();
  for (const list of Object.values(masterlist)) {
    if (!Array.isArray(list)) continue;
    for (const shortName of list) {
      if (typeof shortName !== 'string' || !shortName) continue;
      const canon = canonicalPatternName(shortName);
      if (canon && canon !== 'Review') out.add(canon);
    }
  }
  // Empty masterlist (file existed but had no entries) = no propagation
  // at all. Don't fall back to the hardcoded set in that case — the
  // catalog explicitly said "nothing propagates."
  return out;
}

export interface ClassLocation {
  fileIdx: number;
  line: number;
  endLine: number;
}

export type ClassStatus =
  | 'unambiguous'         // single canonical candidate, no user pick needed
  | 'ambiguous_pending'   // multiple candidates, user has not picked
  | 'ambiguous_resolved'  // user has picked a candidate
  | 'subclass_pending'    // parent-propagated tag whose parent has not (yet) effectively picked — grey, not clickable
  | 'subclass_dropped';   // parent picked a non-propagating pattern, child tag is cancelled

export interface ClassNode {
  className: string;
  candidates: string[];           // canonical pattern names that the matcher offered
  resolved?: string;              // canonical name the user picked (or auto-resolved)
  status: ClassStatus;
  // Tags emitted via inheritance-driven propagation carry parentClassName.
  // The model needs this so it can re-evaluate liveness when the parent's
  // resolution changes.
  isPropagatedSubclass: boolean;
  parentClassName?: string;
}

export interface AnnotatedModel {
  // Read-through metadata (computed once for downstream consumers).
  classLocations: Map<string, ClassLocation>;
  // Per-line distinct canonical pattern keys, excluding `Review` and
  // collapsing dotted aliases. A line whose set size > 1 is the
  // popover-ambiguous trigger.
  ambiguousLines: Set<number>;
  // Class → canonical pattern names found inside its scope (Pass A+B+C).
  inScopePatterns: Map<string, Set<string>>;

  // Per-class state — the centralised classification the UI works from.
  classes: Map<string, ClassNode>;

  // Convenience sets the existing components are wired against. Each is a
  // strict slice of `classes`.
  pickerEligibleClassNames: Set<string>;     // status === 'ambiguous_pending'
  resolvedClassNames: Set<string>;           // status === 'ambiguous_resolved'
  unambiguousClassNames: Set<string>;        // status === 'unambiguous'
  subclassPendingClassNames: Set<string>;    // status === 'subclass_pending'
  droppedClassNames: Set<string>;            // status === 'subclass_dropped'

  // Classes that hold at least one propagating pattern as a candidate.
  // SourceView uses this set to ALWAYS allow opening the popover on
  // their decl line (even when the class is auto-confirmed unambiguous)
  // so the user can pick "Not this pattern" and break the cascade.
  inheritanceDrivenParentClassNames: Set<string>;

  // Greyed chrome (no committed colour yet). Picker-eligible classes plus
  // subclass-pending classes — both render grey in the source view and
  // class-strip. Differs from pickerEligibleClassNames in that
  // subclass-pending lines are NOT clickable: their decision belongs to
  // the parent.
  greyClassNames: Set<string>;

  // Detected patterns surviving cascade — i.e. the original
  // `currentRun.detectedPatterns` minus tags whose class was dropped via
  // subclass cascade. UI components that paint per-pattern data should
  // iterate this list, not the raw response.
  activePatterns: DetectedPatternFull[];

  // Legend chips: the patterns the user can be SURE of right now.
  // Populated by unambiguous classes plus ambiguous classes the user has
  // resolved. Pending-ambiguous classes contribute nothing — they have
  // not earned a chip yet.
  legendPatterns: string[];

  // Reverse index keyed by line for chrome greying of external usage
  // sites of picker-eligible classes.
  usageLinesByAmbiguousClass: Map<number, string>;
}

interface DeriveInput {
  run: AnalysisRun | null;
  // The user override layer. Class picks live in
  // `run.classResolvedPatterns` today (legacy: written via patchCurrentRun)
  // but we ALSO accept an explicit override map so callers that keep their
  // own immutable copy of the original run can pass it in separately.
  classResolvedPatternsOverride?: Record<string, string>;
}

const EMPTY_MODEL: AnnotatedModel = {
  classLocations: new Map(),
  ambiguousLines: new Set(),
  inScopePatterns: new Map(),
  classes: new Map(),
  pickerEligibleClassNames: new Set(),
  resolvedClassNames: new Set(),
  unambiguousClassNames: new Set(),
  subclassPendingClassNames: new Set(),
  droppedClassNames: new Set(),
  inheritanceDrivenParentClassNames: new Set(),
  greyClassNames: new Set(),
  activePatterns: [],
  legendPatterns: [],
  usageLinesByAmbiguousClass: new Map(),
};

export function emptyAnnotatedModel(): AnnotatedModel {
  return EMPTY_MODEL;
}

function buildClassLocations(run: AnalysisRun): Map<string, ClassLocation> {
  const out = new Map<string, ClassLocation>();
  const files = run.files && run.files.length > 0
    ? run.files
    : [{ name: run.sourceName || 'snippet.cpp', sourceText: run.sourceText || '' }];
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
      if (!out.has(d.name)) {
        out.set(d.name, { fileIdx: fi, line: d.line, endLine: next - 1 });
      }
    }
  }
  return out;
}

function buildAmbiguousLines(annotations: Annotation[]): Set<number> {
  const byLine = new Map<number, Set<string>>();
  for (const a of annotations) {
    if (typeof a.line !== 'number') continue;
    const raw = a.patternKey || patternFromAnnotation(a);
    if (!raw || !isRealPattern(raw)) continue;
    const canon = canonicalPatternName(raw);
    if (!byLine.has(a.line)) byLine.set(a.line, new Set());
    byLine.get(a.line)!.add(canon);
  }
  const set = new Set<number>();
  for (const [line, keys] of byLine) {
    if (keys.size > 1) set.add(line);
  }
  return set;
}

function buildInScopePatterns(
  run: AnalysisRun,
  classLocations: Map<string, ClassLocation>,
  annotations: Annotation[],
  taggedClassNames: Set<string>,
): Map<string, Set<string>> {
  const inScope = new Map<string, Set<string>>();
  const add = (name: string, canon: string): void => {
    if (!taggedClassNames.has(name)) return;
    if (!inScope.has(name)) inScope.set(name, new Set());
    inScope.get(name)!.add(canon);
  };

  // Pass A — pattern documentation targets.
  for (const p of run.detectedPatterns || []) {
    const targetLines = (p.documentationTargets || [])
      .map((t) => t.line)
      .filter((l): l is number => typeof l === 'number');
    if (targetLines.length === 0) continue;
    if (!isRealPattern(p.patternId)) continue;
    const canon = canonicalPatternName(p.patternId);
    for (const [name, loc] of classLocations.entries()) {
      const hits = targetLines.some((l) => l >= loc.line && l <= loc.endLine);
      if (hits) add(name, canon);
    }
  }

  // Pass B — annotation lines.
  for (const ann of annotations) {
    const line = typeof ann.line === 'number' ? ann.line : null;
    const key = ann.patternKey;
    if (!line || !key || !isRealPattern(key)) continue;
    const canon = canonicalPatternName(key);
    for (const [name, loc] of classLocations.entries()) {
      if (line >= loc.line && line <= loc.endLine) add(name, canon);
    }
  }

  // Pass C — usage-binding lines, gated to tagged classes only (the binder
  // emits bindings for every class declared in source, but only tagged
  // classes can legitimately accrete in-scope patterns).
  const usageBindings = run.classUsageBindings || {};
  for (const [name, list] of Object.entries(usageBindings)) {
    if (!taggedClassNames.has(name)) continue;
    for (const b of list || []) {
      const line = typeof b?.line === 'number' ? b.line : null;
      if (!line) continue;
      for (const p of run.detectedPatterns || []) {
        const hit = (p.documentationTargets || []).some((t) => t.line === line);
        if (hit && isRealPattern(p.patternId)) {
          add(name, canonicalPatternName(p.patternId));
        }
      }
      for (const ann of annotations) {
        if (ann.line === line && ann.patternKey && isRealPattern(ann.patternKey)) {
          add(name, canonicalPatternName(ann.patternKey));
        }
      }
    }
  }
  return inScope;
}

export function deriveAnnotatedModel(input: DeriveInput): AnnotatedModel {
  const run = input.run;
  if (!run) return EMPTY_MODEL;

  const propagatingPatterns = resolvePropagatingPatterns(run.inheritanceDrivenPatterns);

  const annotations: Annotation[] = run.annotations || [];
  const detected = run.detectedPatterns || [];
  const taggedClassNames = new Set<string>(
    detected.map((p) => p.className).filter((c): c is string => !!c),
  );

  const classLocations = buildClassLocations(run);
  const ambiguousLines = buildAmbiguousLines(annotations);
  const inScopePatterns = buildInScopePatterns(
    run,
    classLocations,
    annotations,
    taggedClassNames,
  );

  // Class → canonical pattern names directly tagged by the matcher.
  // Distinct from inScopePatterns: this ignores body/scope leakage and
  // counts only patterns the matcher attached to the class HEAD.
  const directCandidates = new Map<string, Set<string>>();
  for (const p of detected) {
    if (!p.className || !isRealPattern(p.patternId)) continue;
    if (!directCandidates.has(p.className)) directCandidates.set(p.className, new Set());
    directCandidates.get(p.className)!.add(canonicalPatternName(p.patternId));
  }

  // Subclass propagation map: child class → first parent tag that
  // produced it. Today the microservice writes parentClassName but not
  // parentPatternId; we use the SUBCLASS_PROPAGATING_PATTERNS set as the
  // bridge — any propagated tag came from a propagating pattern, so we
  // only need the parent name to evaluate liveness.
  const propagatedSubclassParent = new Map<string, string>();
  // Per-child set of canonical pattern names that came from parent
  // propagation. These are subtracted from the child's candidate list
  // before classifying status — only "independent" tags (those the
  // child earned on its own merit, not via parent cascade) count toward
  // the child's pickability.
  const propagatedPatternsByChild = new Map<string, Set<string>>();
  for (const p of detected) {
    if (!p.parentClassName || !p.className) continue;
    if (!propagatedSubclassParent.has(p.className)) {
      propagatedSubclassParent.set(p.className, p.parentClassName);
    }
    if (!propagatedPatternsByChild.has(p.className)) {
      propagatedPatternsByChild.set(p.className, new Set());
    }
    if (isRealPattern(p.patternId)) {
      propagatedPatternsByChild.get(p.className)!.add(canonicalPatternName(p.patternId));
    }
  }

  // Resolved-by-user table. Frozen — never mutated here.
  const resolvedTable: Record<string, string> =
    input.classResolvedPatternsOverride
    ?? run.classResolvedPatterns
    ?? {};

  // Build per-class status. Non-propagated classes classify normally on
  // their full candidate set. Propagated subclasses are placeholders here
  // — their status gets fully decided in the cascade pass below, since
  // the rule depends on the parent's effective pattern.
  const classes = new Map<string, ClassNode>();
  const allClassNames = new Set<string>([
    ...taggedClassNames,
    ...propagatedSubclassParent.keys(),
  ]);
  // Inheritance-driven parents: any class whose direct candidates
  // intersect the propagating set. They always need a re-pick affordance
  // so the user can clear the parent role, even when the candidate set
  // is just one pattern (auto-confirmed unambiguous).
  const inheritanceDrivenParentClassNames = new Set<string>();
  for (const [className, cands] of directCandidates.entries()) {
    for (const c of cands) {
      if (propagatingPatterns.has(c)) {
        inheritanceDrivenParentClassNames.add(className);
        break;
      }
    }
  }

  for (const className of allClassNames) {
    const fromDirect = directCandidates.get(className);
    const fromScope  = inScopePatterns.get(className);
    const candidates = new Set<string>();
    if (fromDirect) for (const c of fromDirect) candidates.add(c);
    if (fromScope)  for (const c of fromScope)  candidates.add(c);

    const isPropagatedSubclass = propagatedSubclassParent.has(className);
    const parentClassName = propagatedSubclassParent.get(className);
    const candidatesList = Array.from(candidates);

    const userPick = resolvedTable[className];
    // Sentinel = "user explicitly cleared this parent." Stored separately
    // from the resolved-pattern flow because it must survive the
    // candidates-set check below (the sentinel isn't in candidates).
    const isExplicitlyCleared =
      userPick === CLASS_RESOLVED_NONE
      && inheritanceDrivenParentClassNames.has(className);
    const resolved = isExplicitlyCleared
      ? CLASS_RESOLVED_NONE
      : (userPick && candidates.has(userPick) ? userPick : undefined);

    let status: ClassStatus;
    if (isPropagatedSubclass) {
      // Placeholder; cascade pass below sets the real status.
      status = 'subclass_pending';
    } else if (isExplicitlyCleared) {
      // Cleared parent: the propagating pattern is no longer effective.
      // Treat as ambiguous_pending so the picker stays open and the
      // user can re-pick. Single-candidate parents would otherwise
      // auto-confirm and the override would be invisible.
      status = candidatesList.length > 1 ? 'ambiguous_pending' : 'ambiguous_pending';
    } else if (resolved) {
      status = candidatesList.length > 1 ? 'ambiguous_resolved' : 'unambiguous';
    } else if (candidatesList.length > 1) {
      status = 'ambiguous_pending';
    } else {
      status = 'unambiguous';
    }

    classes.set(className, {
      className,
      candidates: candidatesList,
      resolved,
      status,
      isPropagatedSubclass,
      parentClassName,
    });
  }

  // Subclass cascade. Three branches, in order:
  //
  //   1) Parent pending (no effective pick yet) → child is
  //      `subclass_pending`: grey + non-clickable. The child cannot
  //      decide before its parent.
  //   2) Parent picks a SUBCLASS_PROPAGATING_PATTERNS entry → child is
  //      LOCKED to that pattern. Independent candidates are ignored
  //      here on purpose (per spec: "lahat pati subclass nya na tagged
  //      as strategy concrete, automatic na locked in"). Status =
  //      unambiguous on parent's pattern.
  //   3) Parent picks a non-propagating pattern → the parent-driven
  //      tag is subtracted from the child's candidate set. What
  //      remains decides:
  //        - 0 → child has no tag at all → `subclass_dropped`.
  //        - 1 → auto-take that pattern → unambiguous.
  //        - >1 → child becomes its own decision: `ambiguous_pending`
  //          (the user's "papa piliin ulit si user").
  for (const node of classes.values()) {
    if (!node.isPropagatedSubclass || !node.parentClassName) continue;
    const parent = classes.get(node.parentClassName);
    if (!parent) continue;
    // CLASS_RESOLVED_NONE sentinel = user explicitly cleared the parent.
    // It is NOT a real pattern; the cascade treats it as a non-propagating
    // effective pick so the drop branch fires for all propagated children.
    const parentClearedExplicitly = parent.resolved === CLASS_RESOLVED_NONE;
    const parentEffective = parentClearedExplicitly
      ? CLASS_RESOLVED_NONE
      : (parent.resolved ?? (parent.candidates.length === 1 ? parent.candidates[0] : undefined));

    if (!parentEffective) {
      node.status = 'subclass_pending';
      node.candidates = [];
      node.resolved = undefined;
      continue;
    }

    if (parentEffective !== CLASS_RESOLVED_NONE && propagatingPatterns.has(parentEffective)) {
      node.candidates = [parentEffective];
      node.status = 'unambiguous';
      node.resolved = undefined;
      continue;
    }

    // Non-propagating parent pick (or explicit clear via sentinel).
    // Subtract the propagated tag(s) the microservice attached to this
    // child and reclassify on the leftover.
    const propagatedTags = propagatedPatternsByChild.get(node.className) ?? new Set<string>();
    const fromDirect = directCandidates.get(node.className) ?? new Set<string>();
    const fromScope  = inScopePatterns.get(node.className)  ?? new Set<string>();
    const remaining = new Set<string>([...fromDirect, ...fromScope]);
    for (const t of propagatedTags) remaining.delete(t);

    const remainingList = Array.from(remaining);
    node.candidates = remainingList;

    const childPick = resolvedTable[node.className];
    const childResolved = childPick && remaining.has(childPick) ? childPick : undefined;
    node.resolved = childResolved;

    if (remainingList.length === 0) {
      node.status = 'subclass_dropped';
    } else if (childResolved) {
      node.status = remainingList.length > 1 ? 'ambiguous_resolved' : 'unambiguous';
    } else if (remainingList.length === 1) {
      node.status = 'unambiguous';
    } else {
      node.status = 'ambiguous_pending';
    }
  }

  // Slice the result into the convenience sets the existing UI consumes.
  const pickerEligibleClassNames    = new Set<string>();
  const resolvedClassNames          = new Set<string>();
  const unambiguousClassNames       = new Set<string>();
  const subclassPendingClassNames   = new Set<string>();
  const droppedClassNames           = new Set<string>();
  for (const node of classes.values()) {
    switch (node.status) {
      case 'ambiguous_pending':  pickerEligibleClassNames.add(node.className); break;
      case 'ambiguous_resolved': resolvedClassNames.add(node.className); break;
      case 'unambiguous':        unambiguousClassNames.add(node.className); break;
      case 'subclass_pending':   subclassPendingClassNames.add(node.className); break;
      case 'subclass_dropped':   droppedClassNames.add(node.className); break;
    }
  }

  // Greyed chrome: picker-eligible classes (the user owes a pick here)
  // plus subclass-pending classes (the parent owes a pick, child waits).
  const greyClassNames = new Set<string>([
    ...pickerEligibleClassNames,
    ...subclassPendingClassNames,
  ]);

  // Live patterns = original detected patterns minus tags whose class was
  // either dropped by cascade or is currently pending its parent's pick.
  // Subclass-pending tags must not appear in legends or chip strips with
  // their pattern colour — they have not been confirmed.
  const inertSubclassClasses = new Set<string>([
    ...subclassPendingClassNames,
    ...droppedClassNames,
  ]);
  const activePatterns = detected.filter((p) =>
    p.className ? !droppedClassNames.has(p.className) : true,
  );

  // Legend = unambiguous + ambiguous_resolved. Subclass classes (pending
  // or dropped) contribute nothing — they have not earned a chip. A
  // subclass that has been activated by parent confirmation is classified
  // as `unambiguous` here and contributes its canonical pattern.
  const legendSet = new Set<string>();
  for (const node of classes.values()) {
    if (node.status !== 'unambiguous' && node.status !== 'ambiguous_resolved') continue;
    if (inertSubclassClasses.has(node.className)) continue;
    const name = node.resolved ?? node.candidates[0];
    if (name) legendSet.add(name);
  }
  const legendPatterns = Array.from(legendSet);

  // Chrome greying: usage lines of any picker-eligible class get greyed.
  const usageLinesByAmbiguousClass = new Map<number, string>();
  const bindings = run.classUsageBindings || {};
  for (const [cls, list] of Object.entries(bindings)) {
    if (!pickerEligibleClassNames.has(cls)) continue;
    for (const b of list || []) {
      const ln = typeof b?.line === 'number' ? b.line : null;
      if (ln !== null && !usageLinesByAmbiguousClass.has(ln)) {
        usageLinesByAmbiguousClass.set(ln, cls);
      }
    }
  }

  return {
    classLocations,
    ambiguousLines,
    inScopePatterns,
    classes,
    pickerEligibleClassNames,
    resolvedClassNames,
    unambiguousClassNames,
    subclassPendingClassNames,
    droppedClassNames,
    inheritanceDrivenParentClassNames,
    greyClassNames,
    activePatterns,
    legendPatterns,
    usageLinesByAmbiguousClass,
  };
}
