import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { Annotation, ClassUsageBinding, DetectedPatternFull } from '../../types/api';
import { colorFor, USAGE_KIND_LABEL, PatternColor } from '../../lib/patterns';

interface ClassBindingsProps {
  bindings: Record<string, ClassUsageBinding[]>;
  detectedPatterns?: DetectedPatternFull[];
  classResolvedPatterns?: Record<string, string>;
  onLineFlash?: (line: number) => void;
}

interface ChipStyle extends React.CSSProperties {
  '--chip-color'?: string;
}

interface PopoutPosition {
  top: number;
  left: number;
}

interface ClassPopoutProps {
  className: string;
  patternKey: string;
  color: PatternColor;
  rows: ClassUsageBinding[];
  notes: Annotation[];
  position: PopoutPosition;
  onClose: () => void;
  onLineFlash?: (line: number) => void;
}

function ClassPopout({
  className,
  patternKey,
  color,
  rows,
  notes,
  position,
  onClose,
  onLineFlash
}: ClassPopoutProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="class-popout"
      style={{ top: position.top, left: position.left, borderTop: `3px solid ${color.border}` }}
      role="dialog"
    >
      <button type="button" className="class-popout-close" aria-label="Close" onClick={onClose}>×</button>
      <div className="class-popout-head">
        <span className="class-popout-name">{className}</span>
        <span
          className="class-popout-pattern"
          style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
        >
          {patternKey}
        </span>
        <button
          type="button"
          className="ghost-btn class-popout-retag"
          title={`Open the verify-pattern picker for ${className}.`}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('pattern:retag-request', {
              detail: { className, candidates: [] }
            }));
            onClose();
          }}
        >
          Verify pattern
        </button>
      </div>
      <div className="class-popout-summary">{rows.length} usage{rows.length === 1 ? '' : 's'}</div>
      <div className="pattern-row-list">
        {rows.map((u, i) => {
          const label = USAGE_KIND_LABEL[u.kind] || u.kind;
          const target = u.varName
            ? `${u.varName}${u.methodName ? '.' + u.methodName : ''}`
            : (u.methodName ? `${u.boundClass || className}::${u.methodName}` : (u.boundClass || className));
          return (
            <button
              key={i}
              type="button"
              className="pattern-row"
              onClick={() => onLineFlash?.(u.line)}
            >
              <span className="row-kind">{label}</span>
              <code>{target}</code>
              <span className="row-line">line {u.line || '?'}</span>
            </button>
          );
        })}
      </div>
      {notes.length > 0 && (
        <>
          <div className="class-popout-notes-head">Notes</div>
          <div className="class-popout-notes">
            {notes.map(n => (
              <article
                key={n.id}
                className="comment-card"
                data-line={n.line || ''}
                style={{ borderLeft: `4px solid ${color.border}`, background: color.bg }}
              >
                <header className="cc-head">
                  <span className="cc-pattern" style={{ color: color.text }}>{patternKey}</span>
                  {n.line && <span className="cc-line">L{n.line}</span>}
                </header>
                <p className="cc-comment">{n.comment}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ClassBindings({ bindings, detectedPatterns, classResolvedPatterns, onLineFlash }: ClassBindingsProps) {
  const annotations = useAppStore(s => s.currentRun?.annotations || []);
  const classNames = Object.keys(bindings || {});

  const [openClass, setOpenClass] = useState<string | null>(null);
  const [position, setPosition] = useState<PopoutPosition>({ top: 0, left: 0 });

  if (!classNames.length) return <div id="class-bindings" />;

  const classToPattern = new Map<string, string>();
  (detectedPatterns || []).forEach(p => {
    if (p.className && p.patternName) classToPattern.set(p.className, p.patternName);
  });
  // Layer the user's per-class choice on top of the heuristic verdict.
  if (classResolvedPatterns) {
    for (const [cls, pat] of Object.entries(classResolvedPatterns)) {
      if (pat) classToPattern.set(cls, pat);
    }
  }

  function openFor(cls: string, ev: React.MouseEvent<HTMLButtonElement>) {
    if (openClass === cls) {
      setOpenClass(null);
      return;
    }
    const rect = ev.currentTarget.getBoundingClientRect();
    setPosition({
      top:  rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX
    });
    setOpenClass(cls);
  }

  const activePatternKey = openClass ? (classToPattern.get(openClass) || 'Review') : '';
  const activeColor = openClass ? colorFor(activePatternKey) : null;
  const activeRows  = openClass ? (bindings[openClass] || []) : [];
  const activeNotes = openClass
    ? annotations.filter(a => a.className === openClass)
    : [];

  return (
    <div id="class-bindings">
      <div className="class-strip-row" role="tablist">
        {classNames.map(cls => {
          const patternKey = classToPattern.get(cls) || 'Review';
          const c = colorFor(patternKey);
          const style: ChipStyle = { '--chip-color': c.border };
          const usageCount = (bindings[cls] || []).length;
          return (
            <button
              key={cls}
              type="button"
              className="class-chip"
              style={style}
              aria-pressed={openClass === cls}
              onClick={(e) => openFor(cls, e)}
            >
              <span>{cls}</span>
              <span className="class-chip-count">{usageCount}</span>
            </button>
          );
        })}
      </div>
      {openClass && activeColor && (
        <ClassPopout
          className={openClass}
          patternKey={activePatternKey}
          color={activeColor}
          rows={activeRows}
          notes={activeNotes}
          position={position}
          onClose={() => setOpenClass(null)}
          onLineFlash={onLineFlash}
        />
      )}
    </div>
  );
}
