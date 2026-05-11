// Sidebar rail on /docs. Renders Scope and Design rationale as stacked
// click-to-popup tiles. Lives in its own file per user direction:
// "have a folder where all the UI / HTML lives, called from one component."

import ResearchBento from '../ResearchBento';
import { RESEARCH_TILES } from '../docsTiles';

export default function DocsSidebar() {
  return (
    <aside className="nt-docs__sidebar" aria-label="Sidebar — scope and rationale">
      <ResearchBento
        eyebrow="Scope"
        title="Scope and delimitations"
        ariaId="dp-scope"
        layout="stack"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'scope')}
      />
      <ResearchBento
        eyebrow="Why this approach"
        title="Design rationale"
        ariaId="dp-rationale"
        layout="stack"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'rationale')}
      />
    </aside>
  );
}
