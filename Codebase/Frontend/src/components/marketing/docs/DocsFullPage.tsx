// /docs/full — public full technical documentation surface. Reuses the
// existing nt-docs shell (header + sidebar) but swaps the main column
// for DocsFullTechnical (method, trade-offs, catalog schema,
// bibliography).

import DocsHeader from './sections/DocsHeader';
import DocsSidebar from './sections/DocsSidebar';
import DocsFullTechnical from './sections/DocsFullTechnical';

export default function DocsFullPage() {
  return (
    <main className="nt-docs" id="main" data-testid="docs-full-shell">
      <DocsHeader />
      <div className="nt-docs__layout">
        <DocsSidebar />
        <DocsFullTechnical />
      </div>
    </main>
  );
}
