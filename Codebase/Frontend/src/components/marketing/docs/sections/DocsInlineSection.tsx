// Sidebar-friendly inline renderer for /docs. Replaces the bento-tile
// click-to-popup pattern with plain inline sections, per user direction
// this turn ("gawin nalang side bar wag na mag pa bento"). Each tile
// becomes a <section> with title + body paragraphs + sources rendered
// in-place; the page becomes a long-form read with a TOC sidebar
// (DocsSidebar) anchoring to each <section id>.

import type { BentoTile } from '../docsTiles';

interface DocsInlineSectionProps {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Stable id for the section landmark — DocsSidebar anchors to this. */
  ariaId: string;
  tiles: ReadonlyArray<BentoTile>;
}

export default function DocsInlineSection(props: DocsInlineSectionProps) {
  const { eyebrow, title, lede, ariaId, tiles } = props;
  // ariaId is used as the anchor target (#dp-xxx) on the <section>,
  // and as the aria-labelledby target on a separate inner heading id
  // so we never duplicate an id in the same DOM subtree.
  const headingId = `${ariaId}-heading`;
  return (
    <section className="nt-docs__section" id={ariaId} aria-labelledby={headingId}>
      <header className="nt-docs__section-head">
        <p className="nt-section-eyebrow">{eyebrow}</p>
        <h2 id={headingId} className="nt-docs__section-title">
          {title}
        </h2>
        {lede ? <p className="nt-docs__section-lede">{lede}</p> : null}
      </header>

      <div className="nt-docs__inline-list">
        {tiles.map((tile) => (
          <article
            key={tile.id}
            className="nt-docs__inline-tile"
            id={`tile-${tile.id}`}
            data-pending={tile.citationPending ? 'true' : undefined}
          >
            <h3 className="nt-docs__inline-tile-title">{tile.title}</h3>
            <p className="nt-docs__inline-tile-hook">{tile.hook}</p>
            <div className="nt-docs__inline-tile-body">
              {tile.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {tile.sources && tile.sources.length > 0 ? (
              <div className="nt-docs__inline-tile-sources">
                <p className="nt-docs__inline-tile-sources-label">Sources</p>
                <ol>
                  {tile.sources.map((s, i) => (
                    <li key={`${s.citation}-${i}`}>
                      <span className="nt-docs__inline-tile-source-kind">[{s.kind}]</span>{' '}
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.citation}
                          {s.chapter ? ` — ${s.chapter}` : ''}
                        </a>
                      ) : (
                        <>
                          {s.citation}
                          {s.chapter ? ` — ${s.chapter}` : ''}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
                {tile.citationPending ? (
                  <p className="nt-docs__inline-tile-pending">
                    Citation placeholder — the claim still holds; the source is being finalised.
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
