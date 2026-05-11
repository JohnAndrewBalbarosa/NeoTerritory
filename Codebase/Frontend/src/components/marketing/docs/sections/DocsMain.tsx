// Main column on /docs. Per user direction this turn: drop the bento
// grid; render every section inline as long-form content with a left
// sidebar (DocsSidebar) acting as the TOC. The Testing Trophy section
// previously lived inside /mechanics — moved here so /how-it-works
// stays focused on the algorithm, not the test strategy.

import { RESEARCH_TILES } from '../docsTiles';
import DocsInlineSection from './DocsInlineSection';
import TradeOffsSection from './TradeOffsSection';
import BibliographySection from './BibliographySection';

export default function DocsMain() {
  return (
    <div className="nt-docs__main">
      <DocsInlineSection
        eyebrow="Scope"
        title="Scope and delimitations"
        ariaId="dp-scope"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'scope')}
      />

      <DocsInlineSection
        eyebrow="Why this approach"
        title="Design rationale"
        ariaId="dp-rationale"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'rationale')}
      />

      <DocsInlineSection
        eyebrow="Method"
        title="The algorithmic analysis pipeline"
        lede="Ten deterministic stages on every submission. Each entry below carries the full thesis paragraph and the citation that grounds it."
        ariaId="dp-method"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'method')}
      />

      <TradeOffsSection />

      <DocsInlineSection
        eyebrow="Contribution"
        title="Expected contribution"
        ariaId="dp-contribution"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'contribution')}
      />

      <DocsInlineSection
        eyebrow="Testing strategy"
        title="The Testing Trophy"
        lede="What the shipped studio actually verifies on every user submission, and what stays in the thesis alpha-testing chapter only. Integration and E2E layers are methodology constructs — they are NOT runtime test loops the studio runs against user code."
        ariaId="dp-trophy"
        tiles={RESEARCH_TILES.filter((t) => t.group === 'trophy')}
      />

      <BibliographySection />
    </div>
  );
}
