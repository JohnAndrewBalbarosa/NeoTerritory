// Main column on /docs. Composes Method, Trade-offs, Contribution,
// Trophy, and Bibliography. The page-level file (DocsPage.tsx) only
// composes <DocsHeader />, <DocsSidebar />, and <DocsMain />.

import ResearchBento from '../ResearchBento';
import { RESEARCH_TILES } from '../docsTiles';
import TradeOffsSection from './TradeOffsSection';
import BibliographySection from './BibliographySection';

export default function DocsMain() {
  return (
    <div className="nt-docs__main">
      <ResearchBento
        eyebrow="Method"
        title="The algorithmic analysis pipeline"
        lede="Ten deterministic stages on every submission. Click any tile for the full thesis paragraph + citation."
        ariaId="dp-method"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'method')}
      />

      <TradeOffsSection />

      <ResearchBento
        eyebrow="Contribution"
        title="Expected contribution"
        ariaId="dp-contribution"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'contribution')}
      />

      <ResearchBento
        eyebrow="Testing strategy"
        title="The Testing Trophy — applied to NeoTerritory itself"
        lede="What this page describes is what the website runs on its OWN source. It is intentionally separate from the studio Tests tab, which runs cppcheck + compile + unit tests on the USER'S submitted C++ code. Same trophy idea, different subject under test."
        ariaId="dp-trophy"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'trophy')}
      />

      <BibliographySection />
    </div>
  );
}
