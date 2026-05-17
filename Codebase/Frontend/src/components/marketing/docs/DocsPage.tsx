// /docs now renders the same sidebar-driven surface as /docs/full.
// The previous modal popup (docs-modal-overview) is retired: the user
// asked for full-page sidebar navigation where clicking a sidebar entry
// shows only that section. Both routes resolve to the same component to
// keep old bookmarks working.

import DocsFullPage from './DocsFullPage';

export default function DocsPage() {
  return <DocsFullPage />;
}
