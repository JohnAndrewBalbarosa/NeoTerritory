// Sidebar for the docs surface. Reads DOCS_SECTIONS from the registry,
// groups entries by their group id, and renders each group as a
// collapsible block of buttons. Clicking a leaf calls onSelect(id);
// the active leaf is highlighted. No anchors — the parent shell owns
// active state and renders only the selected section in the main pane.

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

export default function DocsSidebar({ activeId, onSelect }: DocsSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<DocsGroupId, boolean>>({
    overview: false,
    studio: false,
    admin: false,
    technical: false,
  });

  function toggleGroup(id: DocsGroupId): void {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
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
          const isCollapsed = collapsed[group.id];
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
