// Sidebar for the docs surface. Reads DOCS_SECTIONS from the registry,
// groups entries by their group id, and renders each group as an
// accordion block: only one group stays open at a time, so opening a
// different group auto-collapses the previous one and the rail stays
// uncluttered. Clicking a leaf calls onSelect(id); the active leaf is
// highlighted. No anchors — the parent shell owns active state and
// renders only the selected section in the main pane.

import { useState } from 'react';
import {
  DOCS_GROUPS,
  DOCS_SECTIONS,
  DocsGroupId,
  DocsSectionEntry,
} from './registry';

interface DocsSidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

// The group that owns the active leaf should be the one open on mount,
// so a cold visitor lands with their current section's group expanded.
function groupForSection(id: string | null): DocsGroupId {
  const entry = DOCS_SECTIONS.find((s) => s.id === id);
  return entry?.group ?? DOCS_GROUPS[0].id;
}

export default function DocsSidebar({ activeId, onSelect }: DocsSidebarProps) {
  const [openGroup, setOpenGroup] = useState<DocsGroupId | null>(() =>
    groupForSection(activeId),
  );

  // Accordion toggle: open the clicked group as the sole expanded one,
  // or collapse it if it was already the open one.
  function toggleGroup(id: DocsGroupId): void {
    setOpenGroup((prev) => (prev === id ? null : id));
  }

  return (
    <aside className="nt-docs__sidebar" aria-label="Documentation navigation">
      <p className="nt-docs__sidebar-eyebrow">Documentation</p>
      <nav className="nt-docs__sidebar-nav" aria-label="Section list">
        {DOCS_GROUPS.map((group) => {
          const items: DocsSectionEntry[] = DOCS_SECTIONS.filter(
            (s) => s.group === group.id,
          );
          if (items.length === 0) return null;
          const isCollapsed = openGroup !== group.id;
          return (
            <div key={group.id} className="nt-docs__sidebar-group">
              <button
                type="button"
                className="nt-docs__sidebar-group-head"
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="nt-docs__sidebar-group-label">{group.label}</span>
                <span className="nt-docs__sidebar-group-caret" aria-hidden="true">
                  {isCollapsed ? '+' : '−'}
                </span>
              </button>
              {!isCollapsed && (
                <ol className="nt-docs__sidebar-list">
                  {items.map((item) => {
                    const isActive = item.id === activeId;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="nt-docs__sidebar-link"
                          data-active={isActive ? 'true' : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => onSelect(item.id)}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
