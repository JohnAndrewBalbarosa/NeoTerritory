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

// Master-list entry per the explicit JSON shape requested by the user:
//
//   TaggedClassName: {
//     patterns:      string[]    // 1+, canonical pattern names
//     subclasses:    string[]    // 0+, child class names
//     parent:        string|null // 0 or 1
//     taggedLines:   {
//       declaration: number[]    // 1+, lines INSIDE the class's declaration
//                                //     range that the matcher tagged
//       usage:       number[]    // 0+, usage lines OUTSIDE the declaration
//     }
//   }
//
// The masterlist is **only** for tagged classes — untagged source classes
// are never included. Two parallel copies live on the model:
//
//   originalMasterlist  immutable snapshot from the API response. Every
//                       cascade-undo / per-class revert reads from here.
//   workingMasterlist   the UI's effective view. Cascade rules apply:
//                         · pure-cascade subclass whose parent dropped the
//                           propagating pattern → REMOVED from working
//                           entirely (matches the user's "tanggalin na sya
//                           sa subclass" rule).
//                         · subclass with independent patterns of its own
//                           keeps those independents, drops the propagated
//                           pattern, and becomes a SIBLING (parent cleared,
//                           parent's `subclasses` updated to drop it).
//                         · per-class revert (caller-supplied `revertedClasses`
//                           set) forces an entry back to its original shape
//                           regardless of cascade.
export interface TaggedClassEntry {
  className: string;
  patterns: string[];        // canonical names; 1+ in original, 1+ in working unless removed
  subclasses: string[];      // child class names, 0+
  parent: string | null;     // single parent or null
  taggedLines: {
    declaration: number[];   // lines inside the class scope that carry a tag (1+)
    usage: number[];         // usage lines outside the scope (0+)
  };
  // User-confirmed patterns after picker resolution + hierarchy propagation.
  // Populated by applyPatternTag; multiple entries possible when the class
  // participates in patterns confirmed at different hierarchy nodes.
  chosenPatterns: string[];
  // True when chosenPatterns.length > 0. Quick guard for renderers that
  // want to skip unconfirmed classes during color/application passes.
  isTagged: boolean;
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

  // Tagged-class masterlist (per the user's explicit JSON shape). Only
  // tagged classes appear here. Working applies cascade + revert rules;
  // original is the immutable snapshot for undo.
  originalMasterlist: Map<string, TaggedClassEntry>;
  workingMasterlist: Map<string, TaggedClassEntry>;

  // Convenience sets the existing components are wired against. Each is a
  // strict slice of `classes`.
  pickerEligibleClassNames: Set<string>;     // status === 'ambiguous_pending'
  resolvedClassNames: Set<string>;           // status === 'ambiguous_resolved'
  unambiguousClassNames: Set<string>;        // status === 'unambiguous'
  subclassPendingClassNames: Set<string>;    // status === 'subclass_pending'
  droppedClassNames: Set<string>;            // status === 'subclass_dropped'

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
  // Per-class undo: any class name listed here is forced back to its
  // original masterlist entry, ignoring cascade. UI handlers wire this
  // when the user clicks "revert" on a specific tagged class. Empty /
  // undefined = no reverts.
  revertedClasses?: ReadonlySet<string>;
}

const EMPTY_MODEL: AnnotatedModel = {
  classLocations: new Map(),
  ambiguousLines: new Set(),
  inScopePatterns: new Map(),
  classes: new Map(),
  originalMasterlist: new Map(),
  workingMasterlist: new Map(),
  pickerEligibleClassNames: new Set(),
  resolvedClassNames: new Set(),
  unambiguousClassNames: new Set(),
  subclassPendingClassNames: new Set(),
  droppedClassNames: new Set(),
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
  // Class → canonical pattern names from entries that DID NOT come from
  // parent cascade (parentClassName empty). Needed for case (e): a child
  // can have its own Strategy detection separate from an inherited
  // StrategyConcrete from the parent route. Without this, subtracting
  // propagated tags from directCandidates loses the own one because
  // they collapse to the same canonical bucket.
  const ownDirectCandidates = new Map<string, Set<string>>();
  for (const p of detected) {
    if (!p.className || !isRealPattern(p.patternId)) continue;
    if (!directCandidates.has(p.className)) directCandidates.set(p.className, new Set());
    directCandidates.get(p.className)!.add(canonicalPatternName(p.patternId));
    if (!p.parentClassName) {
      if (!ownDirectCandidates.has(p.className)) ownDirectCandidates.set(p.className, new Set());
      ownDirectCandidates.get(p.className)!.add(canonicalPatternName(p.patternId));
    }
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

  // Per-class confirmed patterns after propagation. Populated externally by
  // applyPatternTag; may be empty for classes the user has not yet tagged.
  const classChosenPatterns: Record<string, string[]> = run.classChosenPatterns ?? {};

  // Build per-class status. Non-propagated classes classify normally on
  // their full candidate set. Propagated subclasses are placeholders here
  // — their status gets fully decided in the cascade pass below, since
  // the rule depends on the parent's effective pattern.
  const classes = new Map<string, ClassNode>();
  const allClassNames = new Set<string>([
    ...taggedClassNames,
    ...propagatedSubclassParent.keys(),
  ]);
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
    const resolved = userPick && candidates.has(userPick) ? userPick : undefined;

    let status: ClassStatus;
    if (isPropagatedSubclass) {
      // Placeholder; cascade pass below sets the real status.
      status = 'subclass_pending';
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

  // Subclass cascade — fixed-point pass.
  //
  // Per-node rules (each child evaluates against its parent's CURRENT
  // resolution, not the snapshot at iteration start):
  //
  //   - Parent has no effective pick yet (multi-candidate, no user
  //     pick) → child is `subclass_pending` (grey, non-clickable).
  //   - Parent picked a propagating pattern (e.g. Strategy) → child
  //     locked to that pattern, not separately clickable.
  //   - Parent picked a NON-propagating pattern → strip propagated
  //     tags from the child and reclassify on the matcher's directly
  //     attached candidates only.
  //
  // We loop the pass until no node's `status`, `candidates`, or
  // `resolved` change between iterations. This makes the cascade
  // recursive — a grandchild reacts when its parent's status flips
  // because the grandparent's pick rippled down on the previous
  // iteration. `MAX_ITER` is a paranoid safety net; in practice the
  // pass settles in `depth(tree) + 1` iterations.
  const MAX_ITER = 32;
  function evalSubclass(node: ClassNode): void {
    if (!node.isPropagatedSubclass || !node.parentClassName) return;
    const parent = classes.get(node.parentClassName);
    if (!parent) return;
    const parentEffective = parent.resolved
      ?? (parent.candidates.length === 1 ? parent.candidates[0] : undefined);

    if (!parentEffective) {
      node.status = 'subclass_pending';
      node.candidates = [];
      node.resolved = undefined;
      return;
    }

    if (propagatingPatterns.has(parentEffective)) {
      const parentCanonical = canonicalPatternName(parentEffective);
      const childPriorPick  = resolvedTable[node.className];
      const ownCanonicals   = ownDirectCandidates.get(node.className) ?? new Set<string>();

      // Case (a): user already picked something for this subclass
      // BEFORE parent decided. Respect — never overwrite. Even if the
      // pick is canonically equal to parent's, we still preserve the
      // user's explicit decision sa node.resolved.
      if (childPriorPick) {
        const priorCanonical = canonicalPatternName(childPriorPick);
        if (priorCanonical !== parentCanonical) {
          // User chose differently → standalone pick stands.
          // Candidates show own_patterns only (no parent infection).
          node.resolved = childPriorPick;
          const ownList = Array.from(ownCanonicals);
          node.candidates = ownList.length > 0 ? ownList : [childPriorPick];
          node.status = node.candidates.length > 1 ? 'ambiguous_resolved' : 'unambiguous';
          return;
        }
        // Aligned with parent canonically — fall through to (b)/(c)
      }

      // Case (b)/(e): subclass already has a canonical-equivalent own
      // detection (e.g. StrategyConcrete or own Strategy) → no infection
      // needed. Candidates collapse to parentEffective so the UI badges
      // it the same as the parent's pick.
      if (ownCanonicals.has(parentCanonical)) {
        node.candidates = [parentEffective];
        node.status = 'unambiguous';
        if (childPriorPick) node.resolved = childPriorPick;
        return;
      }

      // Case (c): empty-canvas → strict-follow-parent infection.
      node.candidates = [parentEffective];
      node.status = 'unambiguous';
      node.resolved = undefined;
      return;
    }

    // Non-propagating parent pick (case d/f) → strip the propagated
    // tag from this child. Use ownDirectCandidates so that own
    // canonical-equivalent matches survive (case e: child kept its
    // OWN Strategy even though parent picked Singleton).
    const childTags  = new Set<string>(ownDirectCandidates.get(node.className) ?? new Set<string>());
    const remainingList = Array.from(childTags);
    node.candidates = remainingList;

    const childPick = resolvedTable[node.className];
    const childResolved = childPick && childTags.has(childPick) ? childPick : undefined;
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
  function snapshotNode(node: ClassNode): string {
    return `${node.status}|${node.resolved ?? ''}|${node.candidates.join(',')}`;
  }
  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    let changed = false;
    for (const node of classes.values()) {
      const before = snapshotNode(node);
      evalSubclass(node);
      if (snapshotNode(node) !== before) changed = true;
    }
    if (!changed) break;
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
  // Per-(className, canonical-pattern) survival map. Without this, a
  // sibling-promoted subclass like Truck (lost Strategy via cascade,
  // kept Factory) would still see its stripped Strategy tag in
  // activePatterns because the class itself isn't dropped.
  //
  // Derived from `classes` (post-cascade) rather than the not-yet-built
  // workingMasterlist:
  //   • subclass_dropped → not added (fall through filters via
  //     droppedClassNames check below).
  //   • subclass_pending → not added so existing behaviour is preserved
  //     (pending classes keep their detected entries in activePatterns;
  //     legend / chip strip filter them via subclassPendingClassNames).
  //   • resolved (ambiguous_resolved or unambiguous-with-pick) → only
  //     the resolved canonical name survives.
  //   • unambiguous-no-pick / ambiguous_pending → node.candidates
  //     survive (cascade may have already shrunk this).
  const workingPatternsByClass = new Map<string, Set<string>>();
  for (const node of classes.values()) {
    if (node.status === 'subclass_dropped' || node.status === 'subclass_pending') continue;
    const surviving = new Set<string>();
    if (node.resolved) {
      surviving.add(node.resolved);
    } else {
      for (const c of node.candidates) surviving.add(c);
    }
    workingPatternsByClass.set(node.className, surviving);
  }
  const activePatterns = detected.filter((p) => {
    if (!p.className) return true;
    if (droppedClassNames.has(p.className)) return false;
    const surviving = workingPatternsByClass.get(p.className);
    if (!surviving) return true;
    return surviving.has(canonicalPatternName(p.patternId));
  });

  // Strip-aware rebuild of `ambiguousLines` and `inScopePatterns`. The
  // initial pre-cascade copies fed the classification + cascade passes,
  // but they still contain references to patterns the cascade has since
  // stripped (e.g. Truck's strategy_concrete after Vehicle picks
  // Factory). Without rebuilding, the source-view popover would still
  // surface Strategy as a "scope rival" on Truck and the per-line
  // popover-ambiguous trigger would still flash on lines whose only
  // competing tag was the stripped one.
  const stripFilteredAnnotations = annotations.filter((a) => {
    if (!a.className) return true;
    if (droppedClassNames.has(a.className)) return false;
    const surviving = workingPatternsByClass.get(a.className);
    if (!surviving) return true;
    if (!a.patternKey) return true;
    return surviving.has(canonicalPatternName(a.patternKey));
  });
  const filteredAmbiguousLines = buildAmbiguousLines(stripFilteredAnnotations);
  // Replace the pre-cascade snapshot in place so consumers reading
  // model.ambiguousLines / model.inScopePatterns get the strip-aware
  // versions. Mutating the existing maps/sets keeps reference identity
  // for callers that key on them.
  ambiguousLines.clear();
  for (const ln of filteredAmbiguousLines) ambiguousLines.add(ln);
  for (const [className, patterns] of inScopePatterns.entries()) {
    if (droppedClassNames.has(className)) {
      patterns.clear();
      continue;
    }
    const surviving = workingPatternsByClass.get(className);
    if (!surviving) continue;
    for (const p of Array.from(patterns)) {
      if (!surviving.has(p)) patterns.delete(p);
    }
  }

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

  // ---------- Tagged-class masterlist (original + working) ----------
  //
  // ORIGINAL: built straight off the API response — every tagged class
  // gets one entry with its raw matcher patterns, the parent the
  // microservice declared (if any), the subclasses we infer from the
  // parent links, plus declaration/usage line lists. Frozen.
  //
  // WORKING: starts as a structural copy of original, then applies
  // (a) cascade decisions already computed above and (b) the user's
  // per-class revert overrides.

  const originalMasterlist = new Map<string, TaggedClassEntry>();
  const subclassesByParent = new Map<string, Set<string>>();
  for (const [child, parent] of propagatedSubclassParent.entries()) {
    if (!subclassesByParent.has(parent)) subclassesByParent.set(parent, new Set());
    subclassesByParent.get(parent)!.add(child);
  }

  // Per-class declaration-line tags: any documentation-target line that
  // falls inside the class's location range, plus annotation lines in
  // that range, deduped and sorted.
  function declarationLinesFor(name: string): number[] {
    const loc = classLocations.get(name);
    if (!loc) return [];
    const lines = new Set<number>();
    for (const p of detected) {
      for (const t of p.documentationTargets || []) {
        if (typeof t.line === 'number' && t.line >= loc.line && t.line <= loc.endLine) {
          lines.add(t.line);
        }
      }
    }
    for (const a of annotations) {
      if (typeof a.line === 'number' && a.line >= loc.line && a.line <= loc.endLine) {
        lines.add(a.line);
      }
    }
    return Array.from(lines).sort((x, y) => x - y);
  }

  // Per-class usage lines: classUsageBindings for that class, filtered
  // to lines OUTSIDE the class's own declaration range (usage-of-class
  // outside its body).
  // The early `if (!run) return EMPTY_MODEL` guarantees non-null here,
  // but TS does not preserve that narrowing into nested closures, so
  // capture the run reference explicitly for the helpers below.
  const runRef = run;
  function usageLinesFor(name: string): number[] {
    const loc = classLocations.get(name);
    const list = (runRef.classUsageBindings || {})[name] || [];
    const lines = new Set<number>();
    for (const b of list) {
      const ln = typeof b?.line === 'number' ? b.line : null;
      if (ln === null) continue;
      if (loc && ln >= loc.line && ln <= loc.endLine) continue;
      lines.add(ln);
    }
    return Array.from(lines).sort((x, y) => x - y);
  }

  for (const className of taggedClassNames) {
    const directs = directCandidates.get(className);
    const patterns = directs ? Array.from(directs) : [];
    if (patterns.length === 0) continue;
    const decl = declarationLinesFor(className);
    if (decl.length === 0) continue; // honour the "1+ declaration lines" rule
    const subs = Array.from(subclassesByParent.get(className) ?? []);
    const parent = propagatedSubclassParent.get(className) ?? null;
    const chosenForClass = (classChosenPatterns[className] ?? []).slice();
    originalMasterlist.set(className, Object.freeze({
      className,
      patterns: Object.freeze(patterns.slice()) as string[],
      subclasses: Object.freeze(subs.slice()) as string[],
      parent,
      taggedLines: Object.freeze({
        declaration: Object.freeze(decl) as number[],
        usage: Object.freeze(usageLinesFor(className)) as number[],
      }) as TaggedClassEntry['taggedLines'],
      chosenPatterns: Object.freeze(chosenForClass) as string[],
      isTagged: chosenForClass.length > 0,
    }) as TaggedClassEntry);
  }

  // ---------- Build working masterlist ----------
  // Per-class undo is transitive: if the user reverts Vehicle, every
  // descendant (Car, Truck, SportsCar, …) it reached through cascade
  // is also restored to its original entry. The descendant set is
  // computed against `originalMasterlist.subclasses[]` — that's the
  // tree as the matcher saw it, before any user picks rearranged
  // children into siblings. A BFS keeps it linear.
  const explicitReverted = input.revertedClasses ?? new Set<string>();
  const reverted = new Set<string>(explicitReverted);
  if (explicitReverted.size > 0) {
    const queue: string[] = Array.from(explicitReverted);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const entry = originalMasterlist.get(cur);
      if (!entry) continue;
      for (const childName of entry.subclasses) {
        if (!reverted.has(childName)) {
          reverted.add(childName);
          queue.push(childName);
        }
      }
    }
  }
  const workingMasterlist = new Map<string, TaggedClassEntry>();

  for (const [className, originalEntry] of originalMasterlist) {
    // Per-class revert: copy original entry verbatim, ignore cascade.
    if (reverted.has(className)) {
      workingMasterlist.set(className, {
        className,
        patterns: originalEntry.patterns.slice(),
        subclasses: originalEntry.subclasses.slice(),
        parent: originalEntry.parent,
        taggedLines: {
          declaration: originalEntry.taggedLines.declaration.slice(),
          usage: originalEntry.taggedLines.usage.slice(),
        },
        chosenPatterns: originalEntry.chosenPatterns.slice(),
        isTagged: originalEntry.isTagged,
      });
      continue;
    }

    const node = classes.get(className);

    // Pure-cascade subclass dropped by parent's pick → DELETE entirely.
    // Matches the user's "tanggalin na sya sa subclass" rule for children
    // whose only pattern was the propagated one.
    if (node?.status === 'subclass_dropped') continue;

    // Subclass that survived cascade (parent picked propagating, or child
    // had independent tags). Recompute the entry shape:
    //   - patterns: cascade result (`node.candidates` if effectively
    //     decided, otherwise still the original set — the UI is what
    //     renders pending state).
    //   - parent: cleared if the propagated pattern was removed and the
    //     class is now a sibling.
    let patterns = originalEntry.patterns.slice();
    let parent = originalEntry.parent;

    if (node) {
      if (node.status === 'unambiguous' || node.status === 'ambiguous_resolved') {
        const eff = node.resolved ?? node.candidates[0];
        if (eff) patterns = [eff];
      } else if (node.candidates.length > 0) {
        patterns = node.candidates.slice();
      }

      // If this is a propagated subclass whose parent's effective pick
      // is NOT in the propagating set, the propagated pattern was
      // stripped. The remaining patterns are the child's independents,
      // and the parent link should be cleared (sibling status).
      if (node.isPropagatedSubclass && parent) {
        const parentNode = classes.get(parent);
        const parentEff = parentNode?.resolved ?? (
          parentNode?.candidates.length === 1 ? parentNode.candidates[0] : undefined
        );
        if (parentEff && !propagatingPatterns.has(parentEff)) {
          parent = null;
        }
      }
    }

    if (patterns.length === 0) continue;

    const workingChosen = (classChosenPatterns[className] ?? []).slice();
    workingMasterlist.set(className, {
      className,
      patterns,
      subclasses: originalEntry.subclasses.slice(),
      parent,
      taggedLines: {
        declaration: originalEntry.taggedLines.declaration.slice(),
        usage: originalEntry.taggedLines.usage.slice(),
      },
      chosenPatterns: workingChosen,
      isTagged: workingChosen.length > 0,
    });
  }

  // Defensive cleanup pass — strip propagated tags from descendants
  // whenever the parent's working entry no longer carries a propagating
  // pattern. The cascade above already handles this for the standard
  // pick path, but this pass also catches:
  //
  //   • the canonical-name mismatch case the user flagged: parent's
  //     tag is "Strategy" (canonical of strategy_interface) and the
  //     child's tag is "StrategyConcrete" / strategy_concrete. The
  //     comparison here is canonical so the strip works regardless of
  //     which raw form the matcher emitted.
  //   • future "delete a tag" affordances that mutate the parent's
  //     working patterns directly without going through the cascade
  //     pass.
  //
  // Iterates top-down using BFS over original.subclasses so a chain of
  // grandparents → parents → children all settle in one pass.
  const stripQueue: string[] = [];
  for (const entry of workingMasterlist.values()) {
    if (entry.subclasses.length > 0) stripQueue.push(entry.className);
  }
  // Anchor the BFS at every working entry that has a parent in working
  // too — single-level chains also need evaluation, not only roots.
  for (const entry of workingMasterlist.values()) {
    if (entry.parent && !stripQueue.includes(entry.className)) {
      stripQueue.push(entry.className);
    }
  }
  const stripVisited = new Set<string>();
  while (stripQueue.length > 0) {
    const cur = stripQueue.shift()!;
    if (stripVisited.has(cur)) continue;
    stripVisited.add(cur);
    const curEntry = workingMasterlist.get(cur);
    if (!curEntry) continue;

    // Does the parent's working patterns still carry any propagating
    // pattern? If not, every descendant whose tag came from one of
    // those propagating patterns must lose it.
    const parentHasPropagating = curEntry.patterns.some((p) =>
      propagatingPatterns.has(canonicalPatternName(p)),
    );

    for (const childName of curEntry.subclasses) {
      const childEntry = workingMasterlist.get(childName);
      if (!childEntry) continue;

      if (!parentHasPropagating) {
        // Parent lost all propagating patterns — strip from child every
        // pattern that originally came from propagation (as captured in
        // propagatedPatternsByChild), compared by canonical name.
        const propagatedTags = propagatedPatternsByChild.get(childName) ?? new Set<string>();
        if (propagatedTags.size > 0) {
          const before = childEntry.patterns.length;
          childEntry.patterns = childEntry.patterns.filter(
            (p) => !propagatedTags.has(canonicalPatternName(p)),
          );
          if (childEntry.patterns.length !== before) {
            // Child was stripped — it no longer follows this parent.
            childEntry.parent = null;
          }
        }
      }

      // Always recurse so deeper descendants reflect the parent's new
      // working state, regardless of whether stripping happened.
      stripQueue.push(childName);
    }
  }

  // Drop entries whose patterns went to zero after the defensive strip.
  for (const [name, entry] of Array.from(workingMasterlist)) {
    if (entry.patterns.length === 0) workingMasterlist.delete(name);
  }

  // Reconcile parent → subclasses lists in the working masterlist: a
  // parent that no longer cascades must drop the now-sibling children
  // from its `subclasses[]`, and an entry whose parent was deleted from
  // working should clear its parent link.
  for (const entry of workingMasterlist.values()) {
    if (entry.parent && !workingMasterlist.has(entry.parent)) {
      entry.parent = null;
    }
    if (entry.subclasses.length === 0) continue;
    entry.subclasses = entry.subclasses.filter((c) => {
      const child = workingMasterlist.get(c);
      return !!child && child.parent === entry.className;
    });
  }

  return {
    classLocations,
    ambiguousLines,
    inScopePatterns,
    classes,
    originalMasterlist,
    workingMasterlist,
    pickerEligibleClassNames,
    resolvedClassNames,
    unambiguousClassNames,
    subclassPendingClassNames,
    droppedClassNames,
    greyClassNames,
    activePatterns,
    legendPatterns,
    usageLinesByAmbiguousClass,
  };
}

// ---------- Helpers exported for UI handlers ----------

// Pure utility: given the model + a class name, return the original
// entry suitable for "revert this one class to its source-of-truth
// shape". UI revert handlers can either mutate state to add the class
// to `revertedClasses` (preferred — re-derives the whole model) OR
// shallow-copy this entry into their working state.
export function lookupOriginalEntry(
  model: AnnotatedModel,
  className: string,
): TaggedClassEntry | null {
  return model.originalMasterlist.get(className) ?? null;
}

// Cheap shape-equality check for "is this working entry already at
// original?" — useful when the UI wants to disable an Undo button.
export function isAtOriginal(model: AnnotatedModel, className: string): boolean {
  const orig = model.originalMasterlist.get(className);
  const work = model.workingMasterlist.get(className);
  if (!orig || !work) return !orig && !work;
  if (orig.parent !== work.parent) return false;
  if (orig.patterns.length !== work.patterns.length) return false;
  if (orig.subclasses.length !== work.subclasses.length) return false;
  for (let i = 0; i < orig.patterns.length; i++) {
    if (orig.patterns[i] !== work.patterns[i]) return false;
  }
  for (let i = 0; i < orig.subclasses.length; i++) {
    if (orig.subclasses[i] !== work.subclasses[i]) return false;
  }
  if (orig.taggedLines.declaration.length !== work.taggedLines.declaration.length) return false;
  if (orig.taggedLines.usage.length !== work.taggedLines.usage.length) return false;
  return true;
}
