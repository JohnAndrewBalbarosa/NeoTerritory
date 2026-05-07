import React, { useMemo, useState } from 'react';
import { Annotation, DetectedPatternFull } from '../../types/api';
import { colorFor, patternFromAnnotation, canonicalPatternName, isRealPattern, PatternColor, AMBIGUOUS_COLOR } from '../../lib/patterns';
import { useAppStore } from '../../store/appState';
import LinePopover from './LinePopover';

interface SourceViewProps {
  sourceText: string;
  annotations: Annotation[];
  detectedPatterns: DetectedPatternFull[];
  classResolvedPatterns?: Record<string, string>;
  // Per-class usage sites the analyzer flagged. When the user tags a class
  // we also propagate the choice to every line listed here under that class
  // name, so global-function references inherit the same pattern.
  classUsageBindings?: Record<string, Array<{ line?: number; boundClass?: string }>>;
  // Map of className -> distinct pattern keys hitting any line inside the
  // class's declaration scope (the "scope union"). Used to populate the
  // class-decl-line rival picker when the matcher detected diversity
  // across the class body even though no single line is multi-tagged
  // (e.g. ShapeFactory → {Factory, Strategy}, Factory at decl line,
  // Strategy at make()).
  inScopePatternsByClass?: Map<string, Set<string>>;
  // Set of classes to render in AMBIGUOUS_COLOR (grey chrome). Includes
  // both picker-eligible classes (the user owes a pick here) and
  // subclass-pending classes (the parent owes a pick, child waits).
  // Greying alone does NOT imply clickability; that's gated separately
  // via `subclassPendingClassNames` and `subclassDroppedClassNames`.
  coloringAmbiguousClassNames?: Set<string>;
  // Subclass classes whose parent has not yet effectively resolved.
  // Their lines render grey but are NOT clickable — there is no rival
  // picker to offer, the decision belongs to the parent.
  subclassPendingClassNames?: Set<string>;
  // Subclass classes whose parent picked a non-propagating pattern.
  // Their tag is cancelled; lines render neutral and are not clickable.
  subclassDroppedClassNames?: Set<string>;
  // Reverse index keyed by line number: which ambiguous class does this
  // line reference (as an external usage)? Used to grey out global helpers
  // and call-sites that touch an ambiguous class.
  usageLinesByAmbiguousClass?: Map<number, string>;
  onLineClick?: (commentId: string) => void;
}

interface PopoverState {
  line: number;
  annotations: Annotation[];
  anchorRect: DOMRect | null;
}

interface ClassScope {
  className: string;
  patternKey: string;
  min: number;
  max: number;
}

interface ClassDominance {
  dominantKey: string | null;  // null = tied → whole scope grey
  color: PatternColor;         // solid dominant color, or AMBIGUOUS_COLOR if tied
}

interface RenderedLine {
  lineNo: number;
  text: string;
  anns: Annotation[];     // overrides applied — drives color computation
  rawAnns: Annotation[];  // original, unfiltered — drives popover display
  scope: ClassScope | null;
  isScopeStart: boolean;
}

// Walk forward from the class's opening brace and find the matching `}` so
// the scope spans the entire class body. Without this, methods declared
// after the last documentation target (e.g. QueryBuilder::build() following
// table()/where() anchors) fall outside the scope and never inherit the
// resolved-pattern color.
function findClassEndLine(sourceLines: string[], startLine: number): number {
  let depth = 0;
  let seenOpen = false;
  for (let i = startLine - 1; i < sourceLines.length; i++) {
    const raw = sourceLines[i] || '';
    const noLine = raw.replace(/\/\/.*$/, '');
    const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const ch of noBlock) {
      if (ch === '{') { depth += 1; seenOpen = true; }
      else if (ch === '}') {
        depth -= 1;
        if (seenOpen && depth === 0) return i + 1;
      }
    }
  }
  return sourceLines.length;
}

function buildClassScopes(
  detectedPatterns: DetectedPatternFull[],
  classResolvedPatterns?: Record<string, string>,
  sourceText?: string
): ClassScope[] {
  const scopes: ClassScope[] = [];
  const lines = (sourceText || '').replace(/\r\n/g, '\n').split('\n');
  detectedPatterns.forEach(p => {
    if (!p.className) return;
    const targets = p.documentationTargets || [];
    if (!targets.length) return;
    let min = Infinity;
    let anchorMax = -Infinity;
    targets.forEach(t => {
      if (typeof t.line !== 'number') return;
      if (t.line < min) min = t.line;
      if (t.line > anchorMax) anchorMax = t.line;
    });
    if (!Number.isFinite(min) || !Number.isFinite(anchorMax)) return;
    const braceEnd = lines.length > 0 ? findClassEndLine(lines, min) : anchorMax;
    const max = Math.max(anchorMax, braceEnd);
    const resolved = classResolvedPatterns && classResolvedPatterns[p.className];
    const patternKey = resolved || p.patternName || 'Review';
    scopes.push({ className: p.className, patternKey, min, max });
  });
  return scopes;
}

function buildLineToScope(scopes: ClassScope[], lineCount: number): Map<number, ClassScope> {
  const out = new Map<number, ClassScope>();
  for (let line = 1; line <= lineCount; line++) {
    let best: ClassScope | null = null;
    let bestSize = Infinity;
    for (const s of scopes) {
      if (line < s.min || line > s.max) continue;
      const size = s.max - s.min;
      if (size < bestSize) { best = s; bestSize = size; }
    }
    if (best) out.set(line, best);
  }
  return out;
}

function buildLineToAnnotations(
  annotations: Annotation[],
  linePatternOverrides: Record<number, string>
): { raw: Map<number, Annotation[]>; filtered: Map<number, Annotation[]> } {
  const raw = new Map<number, Annotation[]>();
  annotations.forEach(a => {
    if (a.scope === 'file') return;
    if (a.line == null) return;
    const start = a.line;
    const end   = a.lineEnd ?? a.line;
    for (let l = start; l <= end; l++) {
      const list = raw.get(l);
      if (list) list.push(a);
      else raw.set(l, [a]);
    }
  });

  // Apply user overrides: keep matching annotations preferentially, but if
  // the override doesn't match anything on the line we keep the raw set so
  // the line still has content to render. Class-tag propagation can write
  // an override to usage-binding lines whose own annotations belong to
  // unrelated patterns; dropping those entirely was leaving the line blank.
  // The override is now a colour signal, not a content filter — final
  // colour priority is enforced in the row loop below.
  const filtered = new Map<number, Annotation[]>();
  raw.forEach((anns, lineNo) => {
    const chosen = linePatternOverrides[lineNo];
    if (chosen) {
      const kept = anns.filter(a => patternFromAnnotation(a) === chosen);
      filtered.set(lineNo, kept.length > 0 ? kept : anns);
    } else {
      filtered.set(lineNo, anns);
    }
  });

  return { raw, filtered };
}

// For a given scope, determine which pattern "owns" the most annotated lines.
// Ties (two patterns with equal coverage) → no dominant, whole scope is grey.
// When the user has explicitly resolved this class to a pattern (retag), we
// short-circuit the vote and lock the whole scope to that pattern. This is
// what makes lines like `Repository* m_inner;` flip color along with the rest
// of the class — without this lock, a member whose type is *another* class
// (Repository) carries a foreign annotation that splits the dominance vote.
function computeClassDominance(
  scope: ClassScope,
  lineToAnnotations: Map<number, Annotation[]>,
  classResolvedPatterns?: Record<string, string>
): ClassDominance {
  const resolved = classResolvedPatterns && classResolvedPatterns[scope.className];
  if (resolved) {
    return { dominantKey: resolved, color: colorFor(resolved) };
  }
  const patternLineCounts = new Map<string, number>();
  for (let line = scope.min; line <= scope.max; line++) {
    const anns = lineToAnnotations.get(line) || [];
    const seenKeys = new Set<string>();
    for (const a of anns) {
      const k = patternFromAnnotation(a);
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        patternLineCounts.set(k, (patternLineCounts.get(k) || 0) + 1);
      }
    }
  }
  if (patternLineCounts.size === 0) {
    return { dominantKey: scope.patternKey, color: colorFor(scope.patternKey) };
  }
  const maxCount = Math.max(...patternLineCounts.values());
  const winners = [...patternLineCounts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([k]) => k);
  if (winners.length === 1) {
    return { dominantKey: winners[0], color: colorFor(winners[0]) };
  }
  return { dominantKey: null, color: AMBIGUOUS_COLOR };
}

// Per-line colour under the strict rule: count distinct CANONICAL pattern
// keys for the line. One canonical key → that pattern's solid colour.
// Two or more → AMBIGUOUS_COLOR (no blending). Returns null when the line
// has no annotations.
//
// Canonicalisation matters: the matcher and AI layer can emit both
// "creational.factory" and "Factory" against the same line — those collapse
// to one canonical key ("Factory"), so the line stays Factory-coloured
// instead of being marked rival just because the same pattern wears two
// names.
function strictLineColor(anns: Annotation[]): { color: PatternColor | null; distinctCount: number } {
  if (anns.length === 0) return { color: null, distinctCount: 0 };
  // Exclude the "Review" sentinel — it is commentary-only / no pattern,
  // not a competing alternative, so it must not bump distinctCount.
  const canonKeys = new Set<string>();
  for (const a of anns) {
    const raw = patternFromAnnotation(a);
    if (!isRealPattern(raw)) continue;
    canonKeys.add(canonicalPatternName(raw));
  }
  if (canonKeys.size === 0) return { color: null, distinctCount: 0 };
  if (canonKeys.size === 1) {
    return { color: colorFor([...canonKeys][0]), distinctCount: 1 };
  }
  return { color: AMBIGUOUS_COLOR, distinctCount: canonKeys.size };
}

interface LineStyle extends React.CSSProperties {
  '--scope-bg'?:    string;
  '--ann-border'?:  string;
  '--badge-color'?: string;
  '--badge-bg'?:    string;
}

function styleFor(
  baseColor: PatternColor | null,
  badgeColor: PatternColor | null
): LineStyle {
  const style: LineStyle = {};
  if (baseColor) {
    style['--scope-bg']   = baseColor.bg;
    style['--ann-border'] = baseColor.border;
  }
  if (badgeColor) {
    style['--badge-color'] = badgeColor.border;
    style['--badge-bg']    = badgeColor.bg;
  }
  return style;
}

function buildRows(
  sourceText: string,
  annotations: Annotation[],
  detectedPatterns: DetectedPatternFull[],
  linePatternOverrides: Record<number, string>,
  classResolvedPatterns?: Record<string, string>
): { rows: RenderedLine[]; scopeDominanceMap: Map<ClassScope, ClassDominance> } {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const scopes = buildClassScopes(detectedPatterns, classResolvedPatterns, sourceText);
  const lineToScope = buildLineToScope(scopes, lines.length);
  const { raw, filtered } = buildLineToAnnotations(annotations, linePatternOverrides);

  const scopeDominanceMap = new Map<ClassScope, ClassDominance>();
  for (const scope of scopes) {
    scopeDominanceMap.set(scope, computeClassDominance(scope, filtered, classResolvedPatterns));
  }

  const rows: RenderedLine[] = lines.map((text, idx) => {
    const lineNo = idx + 1;
    const scope  = lineToScope.get(lineNo) || null;
    return {
      lineNo,
      text,
      anns:         filtered.get(lineNo) || [],
      rawAnns:      raw.get(lineNo) || [],
      scope,
      isScopeStart: !!scope && scope.min === lineNo
    };
  });

  return { rows, scopeDominanceMap };
}

export default function SourceView({ sourceText, annotations, detectedPatterns, classResolvedPatterns, classUsageBindings, inScopePatternsByClass, coloringAmbiguousClassNames, subclassPendingClassNames, subclassDroppedClassNames, usageLinesByAmbiguousClass, onLineClick }: SourceViewProps) {
  const {
    linePatternOverrides,
    setLinePatternOverride, clearLinePatternOverride,
    bulkSetLinePatternOverrides, bulkClearLinePatternOverrides
  } = useAppStore();

  const { rows } = useMemo(
    () => buildRows(sourceText, annotations, detectedPatterns, linePatternOverrides, classResolvedPatterns),
    [sourceText, annotations, detectedPatterns, linePatternOverrides, classResolvedPatterns]
  );
  const width = String(rows.length).length;
  const [popover, setPopover] = useState<PopoverState | null>(null);

  function handleLineClick(row: RenderedLine, ev: React.MouseEvent<HTMLSpanElement>): void {
    // Subclass-tag lines are non-decision lines: their pattern is purely
    // a function of the parent's pick. Don't open a picker on them — it
    // would either offer one option (pointless) or imply the user can
    // override locally (they can't; the parent owns the call).
    const cls = row.scope?.className ?? null;
    if (cls) {
      if (subclassPendingClassNames?.has(cls)) return;
      if (subclassDroppedClassNames?.has(cls)) return;
    }
    // Open the popover when there's something the user can act on:
    // any annotation, or a stale line-pattern override they may want to
    // undo (e.g. propagated from a class resolve whose source binding
    // no longer applies). Without the override fallback, an
    // override-coloured line with no annotations is dead-clicked.
    const hasOverride = !!linePatternOverrides[row.lineNo];
    if (!row.rawAnns.length && !hasOverride) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (popover && popover.line === row.lineNo) { setPopover(null); return; }
    setPopover({ line: row.lineNo, annotations: row.rawAnns, anchorRect: rect });
    if (onLineClick && row.rawAnns[0]) onLineClick(row.rawAnns[0].id);
  }

  // Walk the in-memory binding map for `className` and return every source
  // line it points to. These are the global-function / call-site references
  // that should inherit the same pattern when the class is tagged.
  function bindingLinesFor(className: string): number[] {
    const list = (classUsageBindings && classUsageBindings[className]) || [];
    return list.map(b => b?.line).filter((n): n is number => typeof n === 'number');
  }

  // Reverse lookup: given a line that the user clicked, find the class
  // (declaration scope OR usage binding) that owns it. The popover uses
  // this so tagging a single line in a global function still resolves the
  // class as a whole (and the rest of the class's lines pick up the tag).
  function classForLine(line: number): string | null {
    const r = rows.find(r => r.lineNo === line);
    if (r?.scope) return r.scope.className;
    if (classUsageBindings) {
      for (const [cls, list] of Object.entries(classUsageBindings)) {
        if ((list || []).some(b => b?.line === line)) return cls;
      }
    }
    return null;
  }

  function handleResolve(line: number, patternKey: string): void {
    const className = classForLine(line);
    if (className) {
      // Verification: warn if picked pattern has no structural detection for this class.
      const detectedForClass = (useAppStore.getState().currentRun?.detectedPatterns || [])
        .filter(p => p.className === className)
        .map(p => canonicalPatternName(p.patternId || p.patternName));
      const canonical = canonicalPatternName(patternKey);
      if (!detectedForClass.includes(canonical)) {
        console.warn(`[NT] verification failed (line popover): ${className} has no structural match for "${patternKey}". Detected: [${detectedForClass.join(', ')}]`);
      }

      const scope = rows.find(r => r.lineNo === line)?.scope
                 ?? rows.map(r => r.scope).find(s => s?.className === className)
                 ?? null;
      const bulk: Record<number, string> = {};
      if (scope) {
        for (let l = scope.min; l <= scope.max; l++) {
          const r = rows.find(r => r.lineNo === l);
          if (r && r.rawAnns.length > 0) bulk[l] = patternKey;
        }
      }
      // Propagate the choice to every recorded usage of this class — global
      // helper functions, call-site instantiations, etc. — so a tag picked
      // anywhere in the related-line array applies to all of them.
      for (const usageLine of bindingLinesFor(className)) {
        bulk[usageLine] = patternKey;
      }
      bulk[line] = patternKey;
      bulkSetLinePatternOverrides(bulk);
      const prev = useAppStore.getState().currentRun?.classResolvedPatterns || {};
      useAppStore.getState().patchCurrentRun({
        classResolvedPatterns: { ...prev, [className]: patternKey },
        userResolvedPattern: patternKey
      });
      console.log(`[NT] user tagged (line popover)  class=${className}  pattern=${patternKey}  line=${line}`);
    } else {
      setLinePatternOverride(line, patternKey);
    }
    setPopover(null);
  }

  function handleUnresolve(line: number): void {
    const className = classForLine(line);
    const scope = rows.find(r => r.lineNo === line)?.scope
               ?? (className ? (rows.map(r => r.scope).find(s => s?.className === className) ?? null) : null);
    if (className) {
      // Transitive subtree undo (the masterlist revert behaviour, exposed
      // through the existing Undo affordance instead of a separate chip).
      // BFS over detectedPatterns' parentClassName edges to collect every
      // descendant the matcher attached through inheritance — so undoing
      // Vehicle also clears Car / Truck / SportsCar's picks and line
      // overrides in one beat. Self is included.
      const dets = useAppStore.getState().currentRun?.detectedPatterns || [];
      const childrenByParent = new Map<string, Set<string>>();
      for (const p of dets) {
        if (!p.parentClassName || !p.className) continue;
        if (!childrenByParent.has(p.parentClassName)) childrenByParent.set(p.parentClassName, new Set());
        childrenByParent.get(p.parentClassName)!.add(p.className);
      }
      const subtree = new Set<string>([className]);
      const queue: string[] = [className];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const child of childrenByParent.get(cur) ?? []) {
          if (!subtree.has(child)) {
            subtree.add(child);
            queue.push(child);
          }
        }
      }

      // Collect line ranges to clear: each class's declaration scope +
      // its bound usage sites + the popover's anchor line.
      const scopeLines: number[] = [];
      if (scope) {
        for (let l = scope.min; l <= scope.max; l++) scopeLines.push(l);
      }
      const rowScopes = rows.map(r => r.scope);
      for (const c of subtree) {
        const otherScope = rowScopes.find(s => s?.className === c);
        if (otherScope) {
          for (let l = otherScope.min; l <= otherScope.max; l++) scopeLines.push(l);
        }
        for (const usageLine of bindingLinesFor(c)) scopeLines.push(usageLine);
      }
      scopeLines.push(line);
      bulkClearLinePatternOverrides(scopeLines);

      // Drop every subtree class's pick from classResolvedPatterns in a
      // single patch so the model re-derives once.
      const prev = useAppStore.getState().currentRun?.classResolvedPatterns || {};
      const next = { ...prev };
      for (const c of subtree) delete next[c];
      useAppStore.getState().patchCurrentRun({ classResolvedPatterns: next });
    } else {
      clearLinePatternOverride(line);
    }
    setPopover(null);
  }

  return (
    <>
      <div id="source-view" className="source-view">
        {rows.map(row => {
          const num           = String(row.lineNo).padStart(width, ' ');
          const hasAnnotation = row.rawAnns.length > 0;

          // Strict per-line colour from canonical-key count, excluding
          // the "Review" sentinel so a real pattern + Review commentary
          // doesn't false-flag as ambiguous.
          const strict = strictLineColor(row.anns);
          const distinctPatternCount = hasAnnotation
            ? new Set(
                row.rawAnns
                  .map(a => patternFromAnnotation(a))
                  .filter(isRealPattern)
                  .map(canonicalPatternName)
              ).size
            : 0;
          const lineKeysAmbiguous = distinctPatternCount > 1;

          // Highest-priority colour source: an explicit per-line override.
          // Class-tag propagation writes one of these for every usage-binding
          // site of the resolved class, so they paint in the chosen pattern's
          // colour even when their original annotations belong to another
          // pattern (or when they have no annotation at all). Overrides win
          // over the chrome-greying rules below — once the user has
          // resolved a class, the picked colour is authoritative.
          const lineOverride  = linePatternOverrides[row.lineNo];
          const overrideColor = lineOverride ? colorFor(lineOverride) : null;
          const scopeResolved = !!(row.scope && classResolvedPatterns && classResolvedPatterns[row.scope.className]);

          // Chrome greying: a class with at least one multi-tag line is
          // "ambiguous-for-coloring". Its declaration line and every
          // external usage of it render in AMBIGUOUS_COLOR. Single-tag
          // body lines inside the class keep their own colour (handled
          // implicitly: only the class decl line and binding lines are
          // forced grey here; body lines fall through to `strict.color`).
          const classChromeAmbiguous =
            !overrideColor && !scopeResolved &&
            !!row.isScopeStart && !!row.scope &&
            !!coloringAmbiguousClassNames?.has(row.scope.className);
          const usageOfAmbiguous =
            !overrideColor && !scopeResolved &&
            !!usageLinesByAmbiguousClass?.has(row.lineNo);

          // Resolve the final colour. Order:
          //   1. user override                         → that pattern's colour
          //   2. class is in coloringAmbiguousClassNames AND this is its
          //      declaration line / external usage     → AMBIGUOUS_COLOR
          //   3. line itself has >1 canonical keys     → AMBIGUOUS_COLOR
          //      (this is `strict.color` for keys.size > 1)
          //   4. line has exactly 1 canonical key      → that pattern's colour
          //      (`strict.color` for keys.size === 1)
          //   5. no annotations                        → null (no fill)
          const baseColor: PatternColor | null = overrideColor
            ?? ((classChromeAmbiguous || usageOfAmbiguous) ? AMBIGUOUS_COLOR : null)
            ?? strict.color;
          const badgeColor = baseColor;

          const isAmbiguousLine =
            hasAnnotation &&
            (lineKeysAmbiguous || classChromeAmbiguous || usageOfAmbiguous) &&
            !overrideColor;

          const classNames = [
            'src-line',
            hasAnnotation    ? 'has-annotation'    : '',
            hasAnnotation    ? 'has-comment'        : '',
            isAmbiguousLine  ? 'has-ambiguous'      : '',
            row.isScopeStart ? 'class-scope-start'  : ''
          ].filter(Boolean).join(' ');

          const style = styleFor(baseColor, badgeColor);

          return (
            <span
              key={row.lineNo}
              className={classNames}
              data-line={row.lineNo}
              data-class-name={row.isScopeStart ? row.scope?.className : undefined}
              style={style}
              onClick={(ev) => handleLineClick(row, ev)}
            >
              <span className="src-gutter">{num}</span>
              <span className="src-code">{row.text || '​'}</span>
              {hasAnnotation && isAmbiguousLine && (
                <span className="src-line-badge" aria-hidden="true">
                  {`${distinctPatternCount}×`}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {popover && (() => {
        // If the popover line is the START of a class scope AND the scope
        // union has >1 distinct patterns, surface those as rivals — even
        // when the clicked line itself only carries one annotation. This
        // is what catches ShapeFactory: Factory at decl line, Strategy at
        // make() — the decl line popover should still let the user pick.
        const popRow = rows.find(r => r.lineNo === popover.line);
        const popScope = popRow?.scope || null;
        const isClassDeclLine = !!(popRow?.isScopeStart && popScope);
        const scopeRivals: string[] | undefined = (() => {
          if (!isClassDeclLine || !popScope || !inScopePatternsByClass) return undefined;
          const set = inScopePatternsByClass.get(popScope.className);
          if (!set || set.size <= 1) return undefined;
          return Array.from(set);
        })();
        return (
          <LinePopover
            line={popover.line}
            annotations={popover.annotations}
            anchorRect={popover.anchorRect}
            resolvedPattern={linePatternOverrides[popover.line]}
            isClassDeclLine={isClassDeclLine}
            scopeRivals={scopeRivals}
            onResolve={handleResolve}
            onUnresolve={handleUnresolve}
            onClose={() => setPopover(null)}
          />
        );
      })()}
    </>
  );
}
