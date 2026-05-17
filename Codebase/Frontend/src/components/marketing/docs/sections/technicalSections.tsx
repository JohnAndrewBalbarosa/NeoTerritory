// Technical reference sections. The Method / Trade-offs / Catalog schema
// / Bibliography content was previously rendered all-at-once by
// DocsFullTechnical.tsx; it now lives split per leaf so the sidebar can
// show one section at a time. The Testing Trophy section is new.

import { ReactElement } from 'react';

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactElement | ReactElement[] }) {
  const slug = eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <section className="nt-docs__how" aria-labelledby={`docs-${slug}`}>
      <p className="nt-section-eyebrow">{eyebrow}</p>
      <h2 id={`docs-${slug}`} className="nt-docs__section-title">{title}</h2>
      {children}
    </section>
  );
}

export function MethodSection() {
  return (
    <Shell eyebrow="Method" title="How analysis works end-to-end">
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
    </Shell>
  );
}

export function TradeoffsSection() {
  return (
    <Shell eyebrow="Trade-offs" title="What the tool will and will not do">
      <ul className="nt-docs__list">
        <li>Recognition is structural, not semantic. A correctly-shaped Strategy with misleading naming is still a Strategy here.</li>
        <li>Ambiguous classes are not auto-resolved. Two competing patterns are both shown with their differentiators.</li>
        <li>The catalog is Gang of Four anchored. Modern idioms (CRTP, type-erased wrappers) appear under the Idiom family rather than being forced into a classical bucket.</li>
      </ul>
    </Shell>
  );
}

export function CatalogSchemaSection() {
  return (
    <Shell eyebrow="Catalog schema" title="Pattern catalog JSON reference">
      <p>
        Each pattern is described by a JSON file under{' '}
        <code>Codebase/Microservice/pattern_catalog/&lt;family&gt;/</code>. Admins can
        upload additional catalog JSON via the admin Catalogs tab; uploaded payloads
        are stored per-organization and surfaced to that org&rsquo;s developers
        alongside the public open-standards catalog.
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
    </Shell>
  );
}

export function TestingTrophySection() {
  return (
    <Shell eyebrow="Testing Trophy" title="Why our testing trophy is intentionally incomplete">
      <p>
        Kent C. Dodds&rsquo; Testing Trophy budgets coverage across four layers:
        static analysis (base), integration tests (meat), end-to-end tests
        (critical-flow), and unit tests (surgical). This project documents that
        intent in <em>DESIGN_DECISIONS.md (D44)</em>, but in practice the
        integration and E2E layers are deliberately thin. The reasons are
        structural, not oversight — here is the honest accounting.
      </p>
      <ol className="nt-docs__list">
        <li>
          <strong>The microservice is a built C++ binary, not a library.</strong>{' '}
          Every integration test would need a fresh <code>cmake + ninja</code> build
          (roughly five minutes in CI) and the right
          <code> NEOTERRITORY_BIN </code> and <code> NEOTERRITORY_CATALOG </code>
          environment to load it. There is no stub or mock — the binary is the
          analyzer — so the cost of a single integration assertion is the cost of a
          full build.
        </li>
        <li>
          <strong>The test-runner sandbox is gated off by default.</strong> The
          Studio Tests tab only executes when both
          <code> ENABLE_TEST_RUNNER=1 </code> and a configured
          <code> TEST_RUNNER_SANDBOX </code> are present (firejail, sandbox-exec, or
          Docker). Out-of-box, calls return
          <code> verdict: &quot;sandbox_disabled&quot; </code>, so any integration
          test of the Tests pipeline would be asserting against a degraded path
          rather than the real one.
        </li>
        <li>
          <strong>The AI provider is intentionally absent in CI.</strong> The
          Playwright workflow sets <code>ANTHROPIC_API_KEY</code> to an empty string,
          and the backend correctly degrades to{' '}
          <code>status: &quot;pending_provider&quot;</code>. An E2E that actually
          exercises the Docs or Self-check loop would require a live key with real
          cost and nondeterministic responses — out of scope for a thesis-budget
          project.
        </li>
        <li>
          <strong>Auth flows depend on real Supabase and Google OAuth.</strong> Test
          users are claimed against a seeded seat pool (<code>SEED_TEST_USERS=1</code>,
          <code> MAX_TEST_USERS=20</code>). Cross-user integration scenarios
          contend for the same pool and can leave orphan rows if a global teardown
          crashes. The safe envelope is one happy-path Playwright walk plus the
          manifest-driven smoke; richer multi-user choreography is not stable enough
          to gate merges on.
        </li>
        <li>
          <strong>Long flows blow the 180-second Playwright timeout.</strong> The
          Playwright config caps each spec at 180s with a single worker. Sequencing
          microservice build, analyze, test-run, and AI doc generation in one E2E
          exceeds that budget. The trophy&rsquo;s &quot;meat&quot; layer has been
          replaced in practice by the AWS post-deploy smoke
          (<code>scripts/ci-aws-post-deploy-smoke.mjs</code>), which probes API
          contracts in isolation instead of orchestrating the full pipeline.
        </li>
      </ol>
      <p>
        The result is a trophy that is wide at the base (TypeScript strict, ESLint,
        cppcheck, plus the routes-manifest gate) and at the tip (small targeted unit
        tests under <code>Codebase/Backend/src/__tests__/</code>) but skinny in the
        middle. Treat this as a documented limit of the project scope, not a defect
        to discover at review time.
      </p>
    </Shell>
  );
}

export function BibliographySection() {
  return (
    <Shell eyebrow="Bibliography" title="Source material">
      <ul className="nt-docs__list">
        <li>
          Gamma, E., Helm, R., Johnson, R., &amp; Vlissides, J. (1994).{' '}
          <em>Design Patterns: Elements of Reusable Object-Oriented Software</em>.
          Addison-Wesley.
        </li>
        <li>
          Nesteruk, D. (2022). <em>Design Patterns in Modern C++20</em>. Apress.
        </li>
        <li>
          Dodds, K. C. (2021). <em>The Testing Trophy and Testing Classifications</em>.
          kentcdodds.com.
        </li>
        <li>ISO C++ Core Guidelines (latest).</li>
      </ul>
    </Shell>
  );
}
