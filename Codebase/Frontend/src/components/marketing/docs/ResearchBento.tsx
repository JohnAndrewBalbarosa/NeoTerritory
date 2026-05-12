import { useEffect, useRef, useState } from 'react';
import type { BentoTile } from './docsTiles';

// Bento renderer + click-to-popup for /research. The grid mirrors the
// HeroLanding bento (`data-size` 1x1 / 2x1 / 1x2 / 2x2) so the visual
// language is consistent across the marketing surface. Clicking a tile
// opens a modal popover with the full thesis paragraph(s) + numbered
// sources — the page itself stays scan-able.

interface ResearchBentoProps {
  eyebrow: string;
  title: string;
  /** Optional one-sentence intro under the title. */
  lede?: string;
  tiles: ReadonlyArray<BentoTile>;
  /** Stable id for the section landmark (used for aria-labelledby). */
  ariaId: string;
  /**
   * 'grid' (default) renders tiles in the bento with their authored
   * data-size (1x1 / 2x1 / 1x2 / 2x2). 'stack' forces every tile to a
   * single-column compact card for use inside a narrow sidebar rail.
   */
  layout?: 'grid' | 'stack';
}

export default function ResearchBento(props: ResearchBentoProps) {
  const { eyebrow, title, lede, tiles, ariaId, layout = 'grid' } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const openTile = openId ? tiles.find((t) => t.id === openId) ?? null : null;

  useEffect(() => {
    if (!openId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openId]);

  function handleClose(): void {
    const closingId = openId;
    setOpenId(null);
    // Return focus to the triggering tile so keyboard users don't lose place.
    if (closingId) {
      const el = triggerRefs.current.get(closingId);
      if (el) {
        // Delay one frame so the popover unmounts first.
        window.requestAnimationFrame(() => el.focus());
      }
    }
  }

  return (
    <section className="nt-research__section" aria-labelledby={ariaId}>
      <p className="nt-section-eyebrow">{eyebrow}</p>
      <h2 id={ariaId} className="nt-research__section-title">
        {title}
      </h2>
      {lede ? <p className="nt-research__section-lede">{lede}</p> : null}

      <div
        className="nt-research__bento-grid"
        data-layout={layout}
      >
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="nt-research__bento-tile"
            data-size={layout === 'stack' ? '1x1' : tile.size}
            data-pending={tile.citationPending ? 'true' : undefined}
            onClick={() => setOpenId(tile.id)}
            ref={(el) => {
              if (el) triggerRefs.current.set(tile.id, el);
              else triggerRefs.current.delete(tile.id);
            }}
            aria-haspopup="dialog"
          >
            <h3 className="nt-research__bento-tile-title">{tile.title}</h3>
            <p className="nt-research__bento-tile-hook">{tile.hook}</p>
            <span className="nt-research__bento-tile-cue" aria-hidden="true">
              Read more →
            </span>
            {tile.citationPending ? (
              <span className="nt-research__bento-tile-pending">citation pending</span>
            ) : null}
          </button>
        ))}
      </div>

      {openTile ? (
        <ResearchTilePopover tile={openTile} onClose={handleClose} />
      ) : null}
    </section>
  );
}

interface PopoverProps {
  tile: BentoTile;
  onClose: () => void;
}

function ResearchTilePopover({ tile, onClose }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Move focus into the panel on open for keyboard users.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className="nt-research__popover" role="dialog" aria-modal="true" aria-labelledby={`pop-${tile.id}`}>
      <div className="nt-research__popover-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="nt-research__popover-panel"
        role="document"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="nt-research__popover-head">
          <h3 id={`pop-${tile.id}`} className="nt-research__popover-title">
            {tile.title}
          </h3>
          <button
            type="button"
            className="nt-research__popover-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="nt-research__popover-body">
          {tile.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {tile.sources && tile.sources.length > 0 ? (
          <div className="nt-research__popover-sources">
            <p className="nt-research__popover-sources-label">Sources</p>
            <ol>
              {tile.sources.map((s, i) => (
                <li key={`${s.citation}-${i}`}>
                  <span className="nt-research__popover-source-kind">[{s.kind}]</span>{' '}
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
              <p className="nt-research__popover-pending-note">
                One or more sources on this tile are placeholders awaiting a locked 2020-2026
                reference. The claim still holds; the citation surface is being finalised.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
