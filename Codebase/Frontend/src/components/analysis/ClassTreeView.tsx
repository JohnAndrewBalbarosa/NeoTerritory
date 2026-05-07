// Single class-rooted tree surface.
//
// One row per tagged class. Click target attaches ONLY when the row's
// status is 'review'; 'clean' and 'resolved' rows render as locked badges
// — direct fulfilment of the "wag mong baguhin yung walang ambiguity"
// rule. Children render once per LineNode (declaration first, then
// usage). When a LineNode is itself 'review', its semicolon-split
// segments display as sub-rows so a multi-statement source line is
// visually decomposed; segments are display-only.

import { useState, useRef } from 'react';
import type { ClassTreeNode, LineNode } from '../../lib/classTreeModel';
import { colorFor } from '../../lib/patterns';
import ClassRootPicker from './ClassRootPicker';

interface ClassTreeViewProps {
  nodes: ClassTreeNode[];
  // Union of every canonical pattern that fired anywhere in the class
  // scope, indexed by className. Sourced from
  // `model.inScopePatterns[className]` so the tree stays in lockstep with
  // the existing line-level popover.
  pickerCandidatesByClass: Map<string, Set<string>>;
  onPickClass: (className: string, patternKey: string) => void;
  onLineFlash?: (line: number) => void;
}

export default function ClassTreeView({
  nodes, pickerCandidatesByClass, onPickClass, onLineFlash,
}: ClassTreeViewProps): JSX.Element | null {
  const [openClassName, setOpenClassName] = useState<string | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rootBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  if (nodes.length === 0) return null;

  function toggleCollapsed(className: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  }

  function openPicker(className: string): void {
    const btn = rootBtnRefs.current.get(className);
    if (!btn) return;
    setPickerAnchor(btn.getBoundingClientRect());
    setOpenClassName(className);
  }

  function handlePick(className: string, patternKey: string): void {
    onPickClass(className, patternKey);
    setOpenClassName(null);
    setPickerAnchor(null);
  }

  return (
    <section className="class-tree-view" aria-label="Class-rooted design pattern tree">
      <header className="class-tree-header">
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
          Class tree
        </h3>
      </header>
      <ul className="class-tree-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {nodes.map((node) => {
          const isCollapsed = collapsed.has(node.className);
          return (
            <li key={node.className} className="class-tree-row">
              <ClassRootRow
                node={node}
                isCollapsed={isCollapsed}
                onToggleCollapsed={() => toggleCollapsed(node.className)}
                onClickRoot={() => openPicker(node.className)}
                rootBtnRef={(el) => {
                  if (el) rootBtnRefs.current.set(node.className, el);
                  else rootBtnRefs.current.delete(node.className);
                }}
              />
              {!isCollapsed && node.children.length > 0 && (
                <ul
                  className="class-tree-children"
                  style={{ listStyle: 'none', margin: '0 0 0 1.25rem', padding: 0 }}
                >
                  {node.children.map((child) => (
                    <LineRow
                      key={`${child.kind}-${child.line}`}
                      node={child}
                      onClick={onLineFlash ? () => onLineFlash(child.line) : undefined}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {openClassName && (
        <ClassRootPicker
          className={openClassName}
          candidates={Array.from(pickerCandidatesByClass.get(openClassName) ?? [])}
          anchorRect={pickerAnchor}
          onPick={handlePick}
          onClose={() => {
            setOpenClassName(null);
            setPickerAnchor(null);
          }}
        />
      )}
    </section>
  );
}

interface ClassRootRowProps {
  node: ClassTreeNode;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onClickRoot: () => void;
  rootBtnRef: (el: HTMLButtonElement | null) => void;
}

function ClassRootRow({
  node, isCollapsed, onToggleCollapsed, onClickRoot, rootBtnRef,
}: ClassRootRowProps): JSX.Element {
  const isReview = node.status === 'review';
  const isResolved = node.status === 'resolved';

  // When the user has confirmed patterns via the picker (isTagged), render
  // the full chosen-patterns stack. Otherwise fall back to the single
  // analysis-derived badge (existing behaviour for clean/resolved classes
  // that have not gone through the propagation flow yet).
  const showChosenBadges = node.isTagged && node.chosenPatterns.length > 0;
  const fallbackBadgeColor = (!showChosenBadges && node.mainDesignPattern)
    ? colorFor(node.mainDesignPattern)
    : null;

  return (
    <div
      className={`class-tree-root class-tree-root--${node.status}${node.isTagged ? ' class-tree-root--tagged' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={isCollapsed ? 'Expand class' : 'Collapse class'}
        style={{
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          padding: 0,
          width: '1rem',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        {isCollapsed ? '▸' : '▾'}
      </button>
      <strong className="class-tree-name">{node.className}</strong>
      {node.parent && (
        <span className="class-tree-parent" style={{ opacity: 0.6, fontSize: '0.85em' }}>
          (parent: {node.parent})
        </span>
      )}
      {isReview && (
        <button
          ref={rootBtnRef}
          type="button"
          onClick={onClickRoot}
          className="class-tree-review-cta"
          style={{
            border: '1px solid #94a3b8',
            background: 'rgba(148, 163, 184, 0.18)',
            color: 'inherit',
            padding: '0.15rem 0.5rem',
            borderRadius: 4,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          (review — {node.classPatterns.length} patterns)
        </button>
      )}
      {!isReview && showChosenBadges && (
        // Multi-pattern badge stack for confirmed (propagated) patterns
        <span
          className="class-tree-chosen-badges"
          style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}
        >
          {node.chosenPatterns.map((p) => {
            const c = colorFor(p);
            return c ? (
              <span
                key={p}
                className="class-tree-badge class-tree-badge--chosen"
                style={{
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  color: c.text,
                  padding: '0.1rem 0.45rem',
                  borderRadius: 4,
                  fontSize: '0.85em',
                }}
              >
                {p}
              </span>
            ) : null;
          })}
        </span>
      )}
      {!isReview && !showChosenBadges && fallbackBadgeColor && (
        <span
          className="class-tree-badge"
          style={{
            border: `1px solid ${fallbackBadgeColor.border}`,
            background: fallbackBadgeColor.bg,
            color: fallbackBadgeColor.text,
            padding: '0.1rem 0.45rem',
            borderRadius: 4,
            fontSize: '0.85em',
          }}
        >
          {node.mainDesignPattern}
          {isResolved ? ' ✓' : ''}
        </span>
      )}
    </div>
  );
}

interface LineRowProps {
  node: LineNode;
  onClick?: () => void;
}

function LineRow({ node, onClick }: LineRowProps): JSX.Element {
  const interactive = !!onClick;
  const isReview = node.status === 'review';
  const mainColor = node.mainDesignPattern ? colorFor(node.mainDesignPattern) : null;

  return (
    <li
      className={`class-tree-line class-tree-line--${node.kind} class-tree-line--${node.status}`}
      style={{ padding: '0.15rem 0' }}
    >
      <button
        type="button"
        onClick={interactive ? onClick : undefined}
        disabled={!interactive}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 0,
          padding: 0,
          font: 'inherit',
          cursor: interactive ? 'pointer' : 'default',
          color: 'inherit',
        }}
      >
        <span className="class-tree-line-no" style={{ opacity: 0.6, marginRight: '0.5rem' }}>
          L{node.line}
        </span>
        <span className="class-tree-line-kind" style={{ opacity: 0.7, marginRight: '0.5rem' }}>
          {node.kind}
        </span>
        {isReview ? (
          <span
            className="class-tree-line-tags class-tree-line-tags--review"
            style={{
              border: '1px solid #94a3b8',
              background: 'rgba(148, 163, 184, 0.18)',
              padding: '0.05rem 0.35rem',
              borderRadius: 4,
              fontSize: '0.85em',
            }}
            title={`Review: ${node.taggedPatterns.join(', ')}`}
          >
            [{node.taggedPatterns.join(', ')}]
          </span>
        ) : (
          mainColor && (
            <span
              className="class-tree-line-tag"
              style={{
                border: `1px solid ${mainColor.border}`,
                background: mainColor.bg,
                color: mainColor.text,
                padding: '0.05rem 0.35rem',
                borderRadius: 4,
                fontSize: '0.85em',
              }}
            >
              {node.mainDesignPattern}
            </span>
          )
        )}
      </button>
      {isReview && node.segments.length > 1 && (
        <ul
          className="class-tree-line-segments"
          style={{
            listStyle: 'none',
            margin: '0.15rem 0 0 1.5rem',
            padding: 0,
            opacity: 0.85,
            fontSize: '0.85em',
          }}
        >
          {node.segments.map((seg, idx) => (
            <li key={`${seg.offset}-${idx}`} className="class-tree-line-segment">
              <code style={{ background: 'transparent' }}>{seg.text}</code>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
