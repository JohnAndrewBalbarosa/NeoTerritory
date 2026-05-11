// "Trade-offs and limitations" section on /docs. Renders the
// PATTERN_EVIDENCE entries with formal column labels (Strengths /
// Trade-offs / Limitations) — the previous wording "Pros / Cons /
// Limits" was too informal for the academic surface.

import { PATTERN_EVIDENCE, EVIDENCE_DOMAIN_LABEL } from '../patternEvidence';

export default function TradeOffsSection() {
  return (
    <section className="nt-research__section" aria-labelledby="dp-tradeoffs">
      <p className="nt-section-eyebrow">Industry evidence</p>
      <h2 id="dp-tradeoffs" className="nt-research__section-title">
        Trade-offs and limitations
      </h2>
      <p className="nt-research__section-lede">
        The catalog at <code>/patterns</code> covers what each pattern is and how to recognise
        it. This section covers <strong>why</strong> the pattern still earns its keep in
        production — strengths, trade-offs, and limitations — scoped per domain (HFT/quant,
        low-latency AI, systems, maintainability). Every claim carries a numbered footnote
        tying it to a primary 2020-2026 source.
      </p>
      {PATTERN_EVIDENCE.length === 0 ? (
        <p className="nt-research__section-lede">
          <em>
            Evidence entries are being authored from primary 2020-2026 sources. Check back.
          </em>
        </p>
      ) : (
        <ul className="nt-research__evidence-list">
          {PATTERN_EVIDENCE.map((ev, idx) => (
            <li key={`${ev.domain}-${idx}`} className="nt-research__evidence">
              <p className="nt-research__evidence-domain">
                {EVIDENCE_DOMAIN_LABEL[ev.domain]}
                {ev.relatedPatternSlug ? (
                  <>
                    {' '}&middot;{' '}
                    <a href={`/patterns/${ev.relatedPatternSlug}`}>
                      {ev.relatedPatternSlug}
                    </a>
                  </>
                ) : null}
              </p>
              <p className="nt-research__evidence-claim">{ev.claim}</p>
              <div className="nt-research__evidence-grid">
                <div>
                  <p className="nt-research__evidence-label">Strengths</p>
                  <ul className="nt-research__evidence-pros">
                    {ev.pros.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="nt-research__evidence-label">Trade-offs</p>
                  <ul className="nt-research__evidence-cons">
                    {ev.cons.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="nt-research__evidence-label">Limitations</p>
                  <ul className="nt-research__evidence-limits">
                    {ev.limits.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <ol className="nt-research__evidence-sources">
                {ev.sources.map((s, i) => (
                  <li key={`${s.citation}-${i}`}>
                    <span className="nt-research__evidence-source-kind">[{s.kind}]</span>{' '}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
