// /docs main column. Slim overview — no family-card teaching block.
// Family-by-family teaching lives at /patterns and /patterns/learn.
// The full technical documentation lives at /docs/full (public).

export default function DocsMain() {
  return (
    <div className="nt-docs__main">
      <section id="dp-overview" aria-labelledby="dp-overview-h" className="nt-docs__overview">
        <p className="nt-section-eyebrow">Overview</p>
        <h2 id="dp-overview-h" className="nt-docs__section-title">
          What CodiNeo does
        </h2>
        <p>
          CodiNeo analyzes C++ source for design patterns (Creational, Structural,
          Behavioral) and helps you learn how they&rsquo;re recognized. Start a run in the
          Studio, walk through the analysis, then verify your understanding with a
          self-check.
        </p>
      </section>

      <section id="dp-how" aria-labelledby="dp-how-h" className="nt-docs__how">
        <p className="nt-section-eyebrow">How it works</p>
        <h2 id="dp-how-h" className="nt-docs__section-title">
          How analysis works
        </h2>
        <p>
          Source is tokenized and each class is scored against pattern rules. When two
          patterns share enough structure to be ambiguous, we surface both for you to
          inspect. A self-check at the end records whether each pattern decision matched
          your intent.
        </p>
      </section>
    </div>
  );
}
