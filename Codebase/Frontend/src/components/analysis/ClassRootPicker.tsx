// Root-level disambiguation popover for a class with status='review'.
//
// Surfaces the union of every canonical pattern that fired anywhere in
// the class's scope (sourced from `model.inScopePatterns[className]`).
// Picking a chip lifts the choice to the parent via `onPick`, which
// ultimately calls `patchCurrentRun({ classResolvedPatterns })` and lets
// the existing model derivation cascade through the rest of the UI.
//
// We intentionally do NOT mutate annotations or replicate cascade logic
// here — the single source of truth is `deriveAnnotatedModel`.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { colorFor, canonicalPatternName } from '../../lib/patterns';

interface ClassRootPickerProps {
  className: string;
  candidates: string[];           // canonical pattern names
  anchorRect: DOMRect | null;
  onPick: (className: string, patternKey: string) => void;
  onClose: () => void;
}

export default function ClassRootPicker({
  className, candidates, anchorRect, onPick, onClose,
}: ClassRootPickerProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — same affordances as LinePopover
  // so the two surfaces feel consistent.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
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

  if (!anchorRect) return null;
  if (candidates.length === 0) return null;

  const top = anchorRect.bottom + 6 + window.scrollY;
  const left = anchorRect.left + window.scrollX;

  const node = (
    <div
      ref={ref}
      className="class-root-picker"
      role="dialog"
      aria-label={`Resolve design pattern for class ${className}`}
      style={{
        position: 'absolute',
        top,
        left,
        zIndex: 50,
        background: 'var(--surface-bg, #fff)',
        border: '1px solid var(--surface-border, #ddd)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        padding: '0.6rem 0.75rem',
        borderRadius: 6,
        minWidth: 240,
        maxWidth: 360,
      }}
    >
      <header style={{ marginBottom: '0.4rem' }}>
        <strong>{className}</strong>
        <span style={{ marginLeft: '0.4rem', opacity: 0.7, fontSize: '0.85em' }}>
          ({candidates.length} candidate{candidates.length === 1 ? '' : 's'})
        </span>
      </header>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {candidates.map((raw) => {
          const key = canonicalPatternName(raw);
          const c = colorFor(key);
          return (
            <li key={key} style={{ marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => onPick(className, key)}
                className="class-root-picker-chip"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.35rem 0.55rem',
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  color: c.text || 'inherit',
                  borderRadius: 4,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                {key}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return createPortal(node, document.body);
}
