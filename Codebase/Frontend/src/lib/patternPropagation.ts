// Pattern tag propagation utilities.
//
// When a user confirms a pattern for a class, the confirmed tag propagates:
//   · Upward: every ancestor in the inheritance chain receives the tag so
//     the root class knows all patterns present in its entire subtree.
//   · Downward: every descendant (subclasses, their subclasses…) receives
//     the tag so siblings are informed too.
//
// Propagation is additive — adding pattern P to a class that already has it
// is a no-op. All traversals carry a `visited` guard to break cycles.
//
// removePatternTag clears only the specified class — ancestors and
// descendants that accumulated the tag from other sources are not touched.

export interface ClassHierarchyNode {
  parent: string | null;
  subclasses: string[];
}

export function buildHierarchyMap(
  entries: Iterable<{ className: string; parent: string | null; subclasses: string[] }>,
): Map<string, ClassHierarchyNode> {
  const map = new Map<string, ClassHierarchyNode>();
  for (const e of entries) {
    map.set(e.className, { parent: e.parent, subclasses: e.subclasses.slice() });
  }
  return map;
}

function addToClass(
  className: string,
  patternName: string,
  chosen: Record<string, string[]>,
): void {
  const existing = chosen[className];
  if (existing) {
    if (!existing.includes(patternName)) {
      chosen[className] = [...existing, patternName];
    }
  } else {
    chosen[className] = [patternName];
  }
}

function propagateUp(
  className: string,
  patternName: string,
  hierarchy: Map<string, ClassHierarchyNode>,
  chosen: Record<string, string[]>,
  visited: Set<string>,
): void {
  if (visited.has(className)) return;
  visited.add(className);
  addToClass(className, patternName, chosen);
  const node = hierarchy.get(className);
  if (node?.parent) {
    propagateUp(node.parent, patternName, hierarchy, chosen, visited);
  }
}

function propagateDown(
  className: string,
  patternName: string,
  hierarchy: Map<string, ClassHierarchyNode>,
  chosen: Record<string, string[]>,
  visited: Set<string>,
): void {
  if (visited.has(className)) return;
  visited.add(className);
  addToClass(className, patternName, chosen);
  const node = hierarchy.get(className);
  for (const sub of node?.subclasses ?? []) {
    propagateDown(sub, patternName, hierarchy, chosen, visited);
  }
}

// Apply a confirmed pattern tag to a class and propagate it through the
// hierarchy. Returns a new `classChosenPatterns` record; the original is
// never mutated.
export function applyPatternTag(
  className: string,
  patternName: string,
  hierarchy: Map<string, ClassHierarchyNode>,
  currentChosenPatterns: Record<string, string[]>,
): Record<string, string[]> {
  const chosen = { ...currentChosenPatterns };
  addToClass(className, patternName, chosen);
  const node = hierarchy.get(className);
  if (node?.parent) {
    propagateUp(node.parent, patternName, hierarchy, chosen, new Set([className]));
  }
  for (const sub of node?.subclasses ?? []) {
    propagateDown(sub, patternName, hierarchy, chosen, new Set([className]));
  }
  return chosen;
}

// Remove all confirmed tags from a specific class only. Other classes that
// accumulated the same pattern from different sources are unaffected.
export function removePatternTag(
  className: string,
  currentChosenPatterns: Record<string, string[]>,
): Record<string, string[]> {
  const chosen = { ...currentChosenPatterns };
  delete chosen[className];
  return chosen;
}
