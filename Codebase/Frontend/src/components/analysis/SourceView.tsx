import React, { useMemo, useState } from 'react';
import { Annotation, DetectedPatternFull } from '../../types/api';
import { colorFor, patternFromAnnotation, PatternColor, AMBIGUOUS_COLOR, blendColor } from '../../lib/patterns';
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

// For annotated lines that fall outside every class scope (e.g. int main, global functions):
// single-pattern → that pattern's solid color; multiple patterns → AMBIGUOUS_COLOR.
function computeStandaloneColor(anns: Annotation[]): PatternColor {
  const keys = new Set(anns.map(a => patternFromAnnotation(a)));
  return keys.size === 1 ? colorFor([...keys][0]) : AMBIGUOUS_COLOR;
}

// Blend ratio for a single line: 0 = solid dominant, 1 = full grey.
// Scales with how many annotations on this line belong to non-dominant patterns.
function computeLineBlendRatio(lineAnns: Annotation[], dominantKey: string | null): number {
  if (dominantKey === null) return 1;
  if (lineAnns.length === 0) return 0;
  const dominantCount = lineAnns.filter(a => patternFromAnnotation(a) === dominantKey).length;
  return (lineAnns.length - dominantCount) / lineAnns.length;
}

interface LineStyle extends React.CSSProperties {
  '--scope-bg'?:    string;
  '--ann-border'?:  string;
  '--badge-color'?: string;
  '--badge-bg'?:    string;
}

function styleFor(
  baseColor: PatternColor | null,
  blendRatio: number,
  badgeColor: PatternColor | null
): LineStyle {
  const style: LineStyle = {};
  if (baseColor) {
    const effective = blendColor(baseColor, AMBIGUOUS_COLOR, blendRatio);
    style['--scope-bg']   = effective.bg;
    style['--ann-border'] = effective.border;
  }
  // Badge is always solid (dominant color, or AMBIGUOUS_COLOR for tied scope).
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

export default function SourceView({ sourceText, annotations, detectedPatterns, classResolvedPatterns, classUsageBindings, inScopePatternsByClass, onLineClick }: SourceViewProps) {
  const {
    linePatternOverrides,
    setLinePatternOverride, clearLinePatternOverride,
    bulkSetLinePatternOverrides, bulkClearLinePatternOverrides
  } = useAppStore();

  const { rows, scopeDominanceMap } = useMemo(
    () => buildRows(sourceText, annotations, detectedPatterns, linePatternOverrides, classResolvedPatterns),
    [sourceText, annotations, detectedPatterns, linePatternOverrides, classResolvedPatterns]
  );
  const width = String(rows.length).length;
  const [popover, setPopover] = useState<PopoverState | null>(null);

  function handleLineClick(row: RenderedLine, ev: React.MouseEvent<HTMLSpanElement>): void {
    if (!row.rawAnns.length) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (popover && popover.line === row.lineNo) { setPopover(null); return; }
    // Show all (raw) annotations in the popover so the user can pick or undo.
    setPopover({ line: row.lineNo, annotations: row.rawAnns, anchorRect: rect });
    if (onLineClick) onLineClick(row.rawAnns[0].id);
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
      const scopeLines: number[] = [];
      if (scope) {
        for (let l = scope.min; l <= scope.max; l++) scopeLines.push(l);
      }
      // Mirror handleResolve's reach — un-tagging a class also un-tags all
      // of its bound usage sites so the source view stays consistent.
      for (const usageLine of bindingLinesFor(className)) scopeLines.push(usageLine);
      scopeLines.push(line);
      bulkClearLinePatternOverrides(scopeLines);
      const prev = useAppStore.getState().currentRun?.classResolvedPatterns || {};
      const next = { ...prev };
      delete next[className];
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
          const dominance       = row.scope ? (scopeDominanceMap.get(row.scope) ?? null) : null;
          const standaloneColor = (!dominance && row.anns.length > 0) ? computeStandaloneColor(row.anns) : null;
          // Highest-priority colour source: an explicit per-line override.
          // Class-tag propagation writes one of these for every usage-binding
          // site of the resolved class, so they paint in the chosen pattern's
          // colour even when their original annotations belong to another
          // pattern (or when they have no annotation at all). Falls through
          // to dominance / standalone votes when no override is set.
          const lineOverride    = linePatternOverrides[row.lineNo];
          const overrideColor   = lineOverride ? colorFor(lineOverride) : null;
          // When the user has resolved a class, lock every line in its scope
          // to the chosen color — no per-line vote pulling toward grey.
          const scopeResolved   = !!(row.scope && classResolvedPatterns && classResolvedPatterns[row.scope.className]);
          const blendRatio      = (overrideColor || scopeResolved) ? 0 : (dominance ? computeLineBlendRatio(row.anns, dominance.dominantKey) : 0);
          const baseColor       = overrideColor ?? dominance?.color ?? standaloneColor;
          // Badge is always solid — never blended — so the class chip reads clearly.
          const badgeColor      = overrideColor ?? dominance?.color ?? standaloneColor;

          const distinctPatternCount = hasAnnotation
            ? new Set(row.rawAnns.map(a => patternFromAnnotation(a))).size
            : 0;
          const isAmbiguousLine = blendRatio > 0 && hasAnnotation;

          const classNames = [
            'src-line',
            hasAnnotation    ? 'has-annotation'    : '',
            hasAnnotation    ? 'has-comment'        : '',
            isAmbiguousLine  ? 'has-ambiguous'      : '',
            row.isScopeStart ? 'class-scope-start'  : ''
          ].filter(Boolean).join(' ');

          const style = styleFor(baseColor, blendRatio, badgeColor);

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
