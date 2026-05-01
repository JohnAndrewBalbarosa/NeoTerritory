import React, { useMemo, useState } from 'react';
import { Annotation, DetectedPatternFull } from '../../types/api';
import { colorFor, patternFromAnnotation, PatternColor, AMBIGUOUS_COLOR, blendColor } from '../../lib/patterns';
import { useAppStore } from '../../store/appState';
import LinePopover from './LinePopover';

interface SourceViewProps {
  sourceText: string;
  annotations: Annotation[];
  detectedPatterns: DetectedPatternFull[];
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

function buildClassScopes(detectedPatterns: DetectedPatternFull[]): ClassScope[] {
  const scopes: ClassScope[] = [];
  detectedPatterns.forEach(p => {
    if (!p.className) return;
    const targets = p.documentationTargets || [];
    if (!targets.length) return;
    let min = Infinity;
    let max = -Infinity;
    targets.forEach(t => {
      if (typeof t.line !== 'number') return;
      if (t.line < min) min = t.line;
      if (t.line > max) max = t.line;
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    scopes.push({ className: p.className, patternKey: p.patternName || 'Review', min, max });
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

  // Apply user overrides: for resolved lines keep only the chosen pattern.
  const filtered = new Map<number, Annotation[]>();
  raw.forEach((anns, lineNo) => {
    const chosen = linePatternOverrides[lineNo];
    if (chosen) {
      const kept = anns.filter(a => patternFromAnnotation(a) === chosen);
      filtered.set(lineNo, kept);
    } else {
      filtered.set(lineNo, anns);
    }
  });

  return { raw, filtered };
}

// For a given scope, determine which pattern "owns" the most annotated lines.
// Ties (two patterns with equal coverage) → no dominant, whole scope is grey.
function computeClassDominance(
  scope: ClassScope,
  lineToAnnotations: Map<number, Annotation[]>
): ClassDominance {
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
  linePatternOverrides: Record<number, string>
): { rows: RenderedLine[]; scopeDominanceMap: Map<ClassScope, ClassDominance> } {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const scopes = buildClassScopes(detectedPatterns);
  const lineToScope = buildLineToScope(scopes, lines.length);
  const { raw, filtered } = buildLineToAnnotations(annotations, linePatternOverrides);

  const scopeDominanceMap = new Map<ClassScope, ClassDominance>();
  for (const scope of scopes) {
    scopeDominanceMap.set(scope, computeClassDominance(scope, filtered));
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

export default function SourceView({ sourceText, annotations, detectedPatterns, onLineClick }: SourceViewProps) {
  const {
    linePatternOverrides,
    setLinePatternOverride, clearLinePatternOverride,
    bulkSetLinePatternOverrides, bulkClearLinePatternOverrides
  } = useAppStore();

  const { rows, scopeDominanceMap } = useMemo(
    () => buildRows(sourceText, annotations, detectedPatterns, linePatternOverrides),
    [sourceText, annotations, detectedPatterns, linePatternOverrides]
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

  function handleResolve(line: number, patternKey: string): void {
    const scope = rows.find(r => r.lineNo === line)?.scope ?? null;
    if (scope) {
      const bulk: Record<number, string> = {};
      for (let l = scope.min; l <= scope.max; l++) {
        const r = rows.find(r => r.lineNo === l);
        if (r && r.rawAnns.length > 0) bulk[l] = patternKey;
      }
      bulkSetLinePatternOverrides(bulk);
    } else {
      setLinePatternOverride(line, patternKey);
    }
    setPopover(null);
  }

  function handleUnresolve(line: number): void {
    const scope = rows.find(r => r.lineNo === line)?.scope ?? null;
    if (scope) {
      const scopeLines: number[] = [];
      for (let l = scope.min; l <= scope.max; l++) scopeLines.push(l);
      bulkClearLinePatternOverrides(scopeLines);
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
          const blendRatio      = dominance ? computeLineBlendRatio(row.anns, dominance.dominantKey) : 0;
          const baseColor       = dominance?.color ?? standaloneColor;
          // Badge is always solid — never blended — so the class chip reads clearly.
          const badgeColor      = dominance?.color ?? standaloneColor;

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
      {popover && (
        <LinePopover
          line={popover.line}
          annotations={popover.annotations}
          anchorRect={popover.anchorRect}
          resolvedPattern={linePatternOverrides[popover.line]}
          onResolve={handleResolve}
          onUnresolve={handleUnresolve}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
