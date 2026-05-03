import { useEffect, useRef } from 'react';
import { Annotation } from '../../types/api';
import { colorFor, patternFromAnnotation, CATALOG_PATTERNS } from '../../lib/patterns';

interface LinePopoverProps {
  line: number;
  annotations: Annotation[];
  anchorRect: DOMRect | null;
  resolvedPattern?: string;
  isClassDeclLine?: boolean;
  onResolve?: (line: number, patternKey: string) => void;
  onUnresolve?: (line: number) => void;
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
  onClick?: () => void;
  // True when the C++ matcher actually fired this pattern for the class.
  // Renders at full opacity with a ✓ marker. Undetected catalog options
  // render at reduced emphasis but stay clickable so the user can override.
  detected?: boolean;
}

function RivalChip({ patternKey, onClick, detected }: RivalChipProps): JSX.Element {
  const c = colorFor(patternKey);
  const baseStyle: React.CSSProperties = {
    borderColor: c.border,
    color: c.text,
    background: c.bg,
    opacity: detected ? 1 : 0.55,
  };
  const label = detected ? `✓ ${patternKey}` : patternKey;
  if (onClick) {
    return (
      <button
        type="button"
        className={`src-popover-rival src-popover-rival--btn${detected ? ' src-popover-rival--detected' : ''}`}
        style={baseStyle}
        onClick={onClick}
        title={detected ? `Detected: ${patternKey}` : `Override to ${patternKey}`}
      >
        {label}
      </button>
    );
  }
  return (
    <span
      className={`src-popover-rival${detected ? ' src-popover-rival--detected' : ''}`}
      style={baseStyle}
    >
      {label}
    </span>
  );
}

export default function LinePopover({ line, annotations, anchorRect, resolvedPattern, isClassDeclLine, onResolve, onUnresolve, onClose }: LinePopoverProps): JSX.Element | null {
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
  const detectedSet = new Set(distinctPatterns);
  // Catalog ordering with detected patterns lifted to the front so the hot
  // options stay scannable. Patterns the matcher fired but aren't in the
  // canonical UI catalog (rare — generated colors) still render at the end.
  const orderedRivals: string[] = [
    ...CATALOG_PATTERNS.filter((p) => detectedSet.has(p)),
    ...distinctPatterns.filter((p) => !CATALOG_PATTERNS.includes(p)),
    ...CATALOG_PATTERNS.filter((p) => !detectedSet.has(p)),
  ];

  // Pinned to the top-right of the viewport — the source view stays visible
  // and the popover never covers the line being inspected. anchorRect is no
  // longer used for positioning; kept on the props for API stability.
  void anchorRect;

  return (
    <div
      ref={popoverRef}
      id="src-popover"
      className="src-popover src-popover--pinned"
      role="dialog"
      aria-label={`Annotations for line ${line}`}
    >
      <button
        className="src-popover-close"
        type="button"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      {/* The rival picker / resolved chip lives on the class-declaration line
          only — body lines of the same class still open the popover for
          context, but routing every "pick a pattern" prompt through the class
          name keeps the surface uniform. */}
      {isClassDeclLine && resolvedPattern ? (
        <div className="src-popover-ambiguous-badge src-popover-ambiguous-badge--resolved">
          {(() => { const c = colorFor(resolvedPattern); return (
            <span className="src-popover-rival" style={{ borderColor: c.border, color: c.text, background: c.bg }}>
              {resolvedPattern}
            </span>
          ); })()}
          {onUnresolve && (
            <button type="button" className="src-popover-undo-btn" onClick={() => onUnresolve(line)}>
              Undo
            </button>
          )}
        </div>
      ) : (isClassDeclLine && (
        <div className="src-popover-ambiguous-badge">
          {distinctPatterns.length === 0
            ? 'Choose the pattern for this class:'
            : distinctPatterns.length === 1
              ? <>Detected: <strong>{distinctPatterns[0]}</strong>. Pick a different pattern to override:</>
              : <>{distinctPatterns.length} patterns detected — pick the one that matches:</>}
          <div className="src-popover-rivals">
            {orderedRivals.map(p => (
              <RivalChip
                key={p}
                patternKey={p}
                detected={detectedSet.has(p)}
                onClick={onResolve ? () => onResolve(line, p) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="src-popover-body">
        {annotations.map(a => <AnnotationCard key={a.id} annotation={a} />)}
      </div>
    </div>
  );
}
