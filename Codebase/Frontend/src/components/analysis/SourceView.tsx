import React, { useMemo, useState } from 'react';
import { Annotation, DetectedPatternFull } from '../../types/api';
import { colorFor, patternFromAnnotation, PatternColor } from '../../lib/patterns';
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

interface RenderedLine {
  lineNo: number;
  text: string;
  anns: Annotation[];
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
    scopes.push({
      className:  p.className,
      patternKey: p.patternName || 'Review',
      min,
      max
    });
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
      if (size < bestSize) {
        best = s;
        bestSize = size;
      }
    }
    if (best) out.set(line, best);
  }
  return out;
}

function buildLineToAnnotations(annotations: Annotation[]): Map<number, Annotation[]> {
  const map = new Map<number, Annotation[]>();
  annotations.forEach(a => {
    if (a.scope === 'file') return;
    if (a.line == null) return;
    const start = a.line;
    const end   = a.lineEnd ?? a.line;
    for (let l = start; l <= end; l++) {
      const list = map.get(l);
      if (list) list.push(a);
      else map.set(l, [a]);
    }
  });
  return map;
}

function buildRows(
  sourceText: string,
  annotations: Annotation[],
  detectedPatterns: DetectedPatternFull[]
): { rows: RenderedLine[]; lineToScope: Map<number, ClassScope> } {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const scopes = buildClassScopes(detectedPatterns);
  const lineToScope = buildLineToScope(scopes, lines.length);
  const lineToAnns = buildLineToAnnotations(annotations);

  const rows: RenderedLine[] = lines.map((text, idx) => {
    const lineNo = idx + 1;
    const scope = lineToScope.get(lineNo) || null;
    const isScopeStart = !!scope && scope.min === lineNo;
    return {
      lineNo,
      text,
      anns: lineToAnns.get(lineNo) || [],
      scope,
      isScopeStart
    };
  });
  return { rows, lineToScope };
}

interface LineStyle extends React.CSSProperties {
  '--scope-bg'?: string;
  '--ann-border'?: string;
}

function styleFor(scopeColor: PatternColor | null, annColor: PatternColor | null): LineStyle {
  const style: LineStyle = {};
  if (scopeColor) style['--scope-bg'] = scopeColor.bg;
  if (annColor) style['--ann-border'] = annColor.border;
  return style;
}

export default function SourceView({ sourceText, annotations, detectedPatterns, onLineClick }: SourceViewProps) {
  const { rows } = useMemo(
    () => buildRows(sourceText, annotations, detectedPatterns),
    [sourceText, annotations, detectedPatterns]
  );
  const width = String(rows.length).length;
  const [popover, setPopover] = useState<PopoverState | null>(null);

  function handleLineClick(row: RenderedLine, ev: React.MouseEvent<HTMLSpanElement>): void {
    if (!row.anns.length) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (popover && popover.line === row.lineNo) {
      setPopover(null);
      return;
    }
    setPopover({ line: row.lineNo, annotations: row.anns, anchorRect: rect });
    if (onLineClick) onLineClick(row.anns[0].id);
  }

  return (
    <>
      <div id="source-view" className="source-view">
        {rows.map(row => {
          const top = row.anns[0];
          const scopeColor = row.scope ? colorFor(row.scope.patternKey) : null;
          const annColor   = top ? colorFor(top.patternKey || patternFromAnnotation(top)) : null;
          const num = String(row.lineNo).padStart(width, ' ');
          const hasAnnotation = row.anns.length > 0;
          const distinctPatternCount = hasAnnotation
            ? new Set(row.anns.map(a => a.patternKey || patternFromAnnotation(a))).size
            : 0;
          const ambiguous = distinctPatternCount > 1;
          const classNames = [
            'src-line',
            hasAnnotation ? 'has-annotation' : '',
            hasAnnotation ? 'has-comment' : '',
            ambiguous ? 'has-ambiguous' : '',
            row.isScopeStart ? 'class-scope-start' : ''
          ].filter(Boolean).join(' ');
          const style = styleFor(scopeColor, annColor);
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
              {hasAnnotation && (
                <span className="src-line-badge" aria-hidden="true">
                  {ambiguous ? `${distinctPatternCount}×` : ''}
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
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
