import { useEffect, useRef } from 'react';
import { Annotation } from '../../types/api';
import { colorFor, patternFromAnnotation } from '../../lib/patterns';

interface LinePopoverProps {
  line: number;
  annotations: Annotation[];
  anchorRect: DOMRect | null;
  onClose: () => void;
}

interface CardProps {
  annotation: Annotation;
}

function AnnotationCard({ annotation: a }: CardProps): JSX.Element {
  const patternKey = a.patternKey || patternFromAnnotation(a);
  const c = colorFor(patternKey);
  const titleParts = (a.title || '').split(' :: ');
  const head = titleParts[0] || a.stage || 'Comment';
  const label = titleParts.slice(1).join(' :: ') || a.kind || '';
  return (
    <article
      className="src-popover-item"
      style={{ borderLeft: `4px solid ${c.border}`, background: c.bg }}
    >
      <header className="src-popover-head">
        <span className="src-popover-pattern" style={{ color: c.text }}>{head}</span>
        {a.className && (
          <span
            className="src-popover-class"
            style={{ borderColor: c.border, color: c.text }}
          >
            {a.className}
          </span>
        )}
        {label && <span className="src-popover-label">{label}</span>}
        {a.line && (
          <span className="src-popover-line">
            L{a.line}{a.lineEnd && a.lineEnd > a.line ? `–${a.lineEnd}` : ''}
          </span>
        )}
      </header>
      {a.comment && <p className="src-popover-comment">{a.comment}</p>}
      {a.excerpt && (
        <pre className="src-popover-excerpt" style={{ borderColor: c.border }}>{a.excerpt}</pre>
      )}
    </article>
  );
}

interface RivalChipProps {
  patternKey: string;
}

function RivalChip({ patternKey }: RivalChipProps): JSX.Element {
  const c = colorFor(patternKey);
  return (
    <span
      className="src-popover-rival"
      style={{ borderColor: c.border, color: c.text, background: c.bg }}
    >
      {patternKey}
    </span>
  );
}

export default function LinePopover({ line, annotations, anchorRect, onClose }: LinePopoverProps): JSX.Element | null {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      // ignore clicks on the source-view line that opened us — SourceView toggles
      const lineEl = (target instanceof Element ? target.closest('.src-line') : null) as HTMLElement | null;
      if (lineEl && lineEl.dataset.line === String(line)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [line, onClose]);

  if (!annotations.length) return null;

  const distinctPatterns = Array.from(
    new Set(annotations.map(a => a.patternKey || patternFromAnnotation(a)))
  );
  const ambiguous = distinctPatterns.length > 1;

  const top = anchorRect ? anchorRect.bottom + 4 : 80;
  const left = anchorRect ? Math.min(anchorRect.left, window.innerWidth - 460) : 80;

  return (
    <div
      ref={popoverRef}
      id="src-popover"
      className="src-popover"
      role="dialog"
      aria-label={`Annotations for line ${line}`}
      style={{ position: 'fixed', top, left, maxWidth: 440 }}
    >
      <button
        className="src-popover-close"
        type="button"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      {ambiguous && (
        <div className="src-popover-ambiguous-badge">
          {distinctPatterns.length} possible patterns at this line — pick the one that matches:
          <div className="src-popover-rivals">
            {distinctPatterns.map(p => <RivalChip key={p} patternKey={p} />)}
          </div>
        </div>
      )}
      <div className="src-popover-body">
        {annotations.map(a => <AnnotationCard key={a.id} annotation={a} />)}
      </div>
    </div>
  );
}
