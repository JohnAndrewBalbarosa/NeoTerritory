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
        title="The Testing Trophy"
        lede="Wide static base, fat integration spine, narrow E2E top. Click a layer to read why."
        ariaId="dp-trophy"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'trophy')}
      />

      <BibliographySection />
    </div>
  );
}
