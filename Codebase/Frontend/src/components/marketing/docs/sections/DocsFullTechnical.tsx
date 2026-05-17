// /docs/full main column. Full technical documentation visible to the
// public — Method, Trade-offs, Bibliography, JSON schema reference for
// the pattern catalog. Sits inside the existing nt-docs layout shell so
// it inherits sidebar + header styles.

export default function DocsFullTechnical() {
  return (
    <div className="nt-docs__main">
      <section
        id="df-method"
        aria-labelledby="df-method-h"
        className="nt-docs__how"
      >
        <p className="nt-section-eyebrow">Method</p>
        <h2 id="df-method-h" className="nt-docs__section-title">
          How analysis works end-to-end
        </h2>
        <p>
          The C++ microservice tokenizes the source, then runs each class through a
          per-pattern rule set. Rules are written against syntactic features (member
          signatures, instantiation form, inheritance) and emit per-pattern evidence
          with confidence scores. When multiple patterns clear the threshold for the
          same class, the front-end surfaces both with their differentiating tokens so
          the reader can decide instead of being told.
        </p>
        <p>
          Analysis is intentionally split from execution. Pattern detection runs in
          Node-side service code; only compile-and-run test cases hit the Docker
          sandbox. That split keeps the slow path bounded.
        </p>
      </section>

      <section
        id="df-tradeoffs"
        aria-labelledby="df-tradeoffs-h"
        className="nt-docs__how"
      >
        <p className="nt-section-eyebrow">Trade-offs</p>
        <h2 id="df-tradeoffs-h" className="nt-docs__section-title">
          What the tool will and will not do
        </h2>
        <ul className="nt-docs__list">
          <li>
            Recognition is structural, not semantic. A correctly-shaped Strategy with
            misleading naming is still a Strategy here.
          </li>
          <li>
            Ambiguous classes are not auto-resolved. Two competing patterns are both
            shown with their differentiators.
          </li>
          <li>
            The catalog is Gang-of-Four anchored. Modern idioms (CRTP, type-erased
            wrappers) appear under the Idiom family rather than being forced into a
            classical bucket.
          </li>
        </ul>
      </section>

      <section
        id="df-catalog-schema"
        aria-labelledby="df-catalog-schema-h"
        className="nt-docs__how"
      >
        <p className="nt-section-eyebrow">Catalog schema</p>
        <h2 id="df-catalog-schema-h" className="nt-docs__section-title">
          Pattern catalog JSON reference
        </h2>
        <p>
          Each pattern is described by a JSON file under{' '}
          <code>Codebase/Microservice/pattern_catalog/&lt;family&gt;/</code>. Admins
          can upload additional catalog JSON via the admin Catalogs tab; uploaded
          payloads are stored per-organization and surfaced to that org&rsquo;s
          developers alongside the public open-standards catalog.
        </p>
        <p>Minimum shape:</p>
        <pre className="nt-docs__code" aria-label="Pattern catalog JSON example">
{`{
  "slug": "strategy",
  "family": "behavioural",
  "name": "Strategy",
  "intent": "Encapsulate an algorithm in an interchangeable object.",
  "structural_signals": [
    "polymorphic_interface",
    "owning_context",
    "no_state_in_strategy"
  ],
  "must_have_tokens": ["virtual", "override"],
  "citations": ["Gamma1994", "Nesteruk2022"]
}`}
        </pre>
      </section>

      <section
        id="df-bibliography"
        aria-labelledby="df-bibliography-h"
        className="nt-docs__how"
      >
        <p className="nt-section-eyebrow">Bibliography</p>
        <h2 id="df-bibliography-h" className="nt-docs__section-title">
          Source material
        </h2>
        <ul className="nt-docs__list">
          <li>
            Gamma, E., Helm, R., Johnson, R., &amp; Vlissides, J. (1994). <em>Design
            Patterns: Elements of Reusable Object-Oriented Software</em>.
            Addison-Wesley.
          </li>
          <li>
            Nesteruk, D. (2022). <em>Design Patterns in Modern C++20</em>. Apress.
          </li>
          <li>ISO C++ Core Guidelines (latest).</li>
        </ul>
      </section>
    </div>
  );
}
