import React, { useMemo } from 'react';
import { Annotation } from '../../types/api';
import { colorFor, patternFromAnnotation } from '../../lib/patterns';

interface SourceViewProps {
  sourceText: string;
  annotations: Annotation[];
  onLineClick?: (commentId: string) => void;
}

interface RenderedLine {
  lineNo: number;
  text: string;
  anns: Annotation[];
}

function buildLines(sourceText: string, annotations: Annotation[]): RenderedLine[] {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const byLine = new Map<number, Annotation[]>();
  annotations.forEach(a => {
    if (!a.line) return;
    const list = byLine.get(a.line);
    if (list) list.push(a);
    else byLine.set(a.line, [a]);
  });
  return lines.map((text, idx) => ({
    lineNo: idx + 1,
    text,
    anns: byLine.get(idx + 1) || []
  }));
}

export default function SourceView({ sourceText, annotations, onLineClick }: SourceViewProps) {
  const rows = useMemo(() => buildLines(sourceText, annotations), [sourceText, annotations]);
  const width = String(rows.length).length;

  return (
    <div id="source-view" className="source-view">
      {rows.map(row => {
        const top = row.anns[0];
        const c = top ? colorFor(patternFromAnnotation(top)) : null;
        const style: React.CSSProperties = c
          ? { background: c.bg, borderLeft: `3px solid ${c.border}` }
          : { borderLeft: '3px solid transparent' };
        const num = String(row.lineNo).padStart(width, ' ');
        const hasComment = row.anns.length > 0;
        return (
          <span
            key={row.lineNo}
            className={`src-line${hasComment ? ' has-comment' : ''}`}
            data-line={row.lineNo}
            style={style}
            onClick={() => {
              if (top && onLineClick) onLineClick(top.id);
            }}
          >
            <span className="src-gutter">{num}</span>
            <span className="src-code">{row.text || '​'}</span>
          </span>
        );
      })}
    </div>
  );
}
