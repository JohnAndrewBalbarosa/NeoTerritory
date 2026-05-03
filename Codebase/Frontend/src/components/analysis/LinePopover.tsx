import { useEffect, useRef } from 'react';
import { Annotation } from '../../types/api';
import { colorFor, patternFromAnnotation, canonicalPatternName, isRealPattern } from '../../lib/patterns';

interface LinePopoverProps {
  line: number;
  annotations: Annotation[];
  anchorRect: DOMRect | null;
  resolvedPattern?: string;
  // True when the clicked line is the declaration line of a class scope.
  // The class-decl line is the only place we surface scope-level rivals
  // (the "Factory + Strategy across body" case). Body lines still use
  // the line-only ambiguity rule.
  isClassDeclLine?: boolean;
  // Distinct pattern keys appearing anywhere inside the class scope of
  // the clicked line. Provided only when isClassDeclLine and the union
  // size is >1. Takes precedence over the line-only distinct-pattern set
  // for picker rendering — so a class with Factory at decl + Strategy at
  // a method line still offers both as rivals.
  scopeRivals?: string[];
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
}

function RivalChip({ patternKey, onClick }: RivalChipProps): JSX.Element {
  const c = colorFor(patternKey);
  if (onClick) {
    return (
      <button
        type="button"
        className="src-popover-rival src-popover-rival--btn"
        style={{ borderColor: c.border, color: c.text, background: c.bg }}
        onClick={onClick}
      >
        {patternKey}
      </button>
    );
  }
  return (
    <span
      className="src-popover-rival"
      style={{ borderColor: c.border, color: c.text, background: c.bg }}
    >
      {patternKey}
    </span>
  );
}

export default function LinePopover({ line, annotations, anchorRect, resolvedPattern, isClassDeclLine, scopeRivals, onResolve, onUnresolve, onClose }: LinePopoverProps): JSX.Element | null {
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

  // Render when we have annotations OR a stale override the user might
  // want to undo. Without the resolvedPattern fallback, a line whose
  // annotations were dropped (e.g. by a re-analysis) but whose override
  // colour persists in the store would be dead-clicked.
  if (!annotations.length && !resolvedPattern) return null;

  // Dedupe annotation cards: if the matcher emitted both "creational.factory"
  // and "Factory" against the same class+line, they are the same pattern —
  // collapse to one card. We key by (canonical pattern, className, line)
  // and prefer annotations whose own patternKey is already canonical so the
  // surviving card carries the cleaner label.
  const dedupedAnnotations: Annotation[] = (() => {
    const seen = new Map<string, Annotation>();
    for (const a of annotations) {
      const raw = a.patternKey || patternFromAnnotation(a);
      const canon = canonicalPatternName(raw);
      const id = `${canon}|${a.className || ''}|${a.line ?? 0}`;
      const existing = seen.get(id);
      if (!existing) {
        seen.set(id, a);
        continue;
      }
      // Prefer the entry whose raw key is already the canonical short form.
      const existingRaw = existing.patternKey || patternFromAnnotation(existing);
      if (raw === canon && existingRaw !== canon) seen.set(id, a);
    }
    return Array.from(seen.values());
  })();

  // Distinct patterns now uses canonical names, so the dotted/short pair
  // that previously rendered two chips collapses to one. The "Review"
  // sentinel is dropped — it is commentary-only / no detected pattern,
  // not a selectable alternative, so it must not appear as a rival chip.
  const linePatterns = (() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const a of dedupedAnnotations) {
      const raw = a.patternKey || patternFromAnnotation(a);
      if (!isRealPattern(raw)) continue;
      const canon = canonicalPatternName(raw);
      if (seen.has(canon)) continue;
      seen.add(canon);
      out.push(canon);
    }
    return out;
  })();

  // Picker source: scope-union rivals win on class decl lines, otherwise
  // fall back to the canonical line-only set. Either way, ambiguous = >1.
  const distinctPatterns = (isClassDeclLine && scopeRivals && scopeRivals.length > 1)
    ? Array.from(new Set(
        scopeRivals.filter(isRealPattern).map((p) => canonicalPatternName(p))
      ))
    : linePatterns;
  const ambiguous = distinctPatterns.length > 1;

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
      {resolvedPattern ? (
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
      ) : ambiguous && (
        <div className="src-popover-ambiguous-badge">
          {distinctPatterns.length} possible patterns at this line — pick the one that matches:
          <div className="src-popover-rivals">
            {distinctPatterns.map(p => (
              <RivalChip
                key={p}
                patternKey={p}
                onClick={onResolve ? () => onResolve(line, p) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      <div className="src-popover-body">
        {dedupedAnnotations.map(a => <AnnotationCard key={a.id} annotation={a} />)}
      </div>
    </div>
  );
}
