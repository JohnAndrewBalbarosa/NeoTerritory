// Public documentation surface. Serves both /docs and /docs/full (the
// modal-style /docs popup is retired). State holds the active sidebar
// leaf; clicking a leaf renders only that section in the main pane. The
// default landing is the Overview section so a cold visitor sees
// something meaningful instead of an empty pane.

import { useState } from 'react';
import DocsHeader from './sections/DocsHeader';
import DocsSidebar from './sections/DocsSidebar';
import {
  DEFAULT_SECTION_ID,
  DOCS_SECTIONS,
  findSection,
} from './sections/registry';

export default function DocsFullPage() {
  const [activeId, setActiveId] = useState<string | null>(DEFAULT_SECTION_ID);
  const active = findSection(activeId);

  return (
    <main className="nt-docs" id="main" data-testid="docs-full-shell">
      <DocsHeader />
      <div className="nt-docs__layout">
        <DocsSidebar activeId={activeId} onSelect={setActiveId} />
        <div className="nt-docs__main" data-testid="docs-active-section">
          {active ? (
            active.render()
          ) : (
            <section className="nt-docs__how">
              <p className="nt-section-eyebrow">Nothing selected</p>
              <h2 className="nt-docs__section-title">Pick a section from the sidebar</h2>
              <p>
                Each Studio tab, Admin tab, and technical reference page has its own
                entry on the left. Choose one to read about it — nothing else will
                load until you do.
              </p>
              <p className="nt-docs__meta">
                {DOCS_SECTIONS.length} sections available.
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
