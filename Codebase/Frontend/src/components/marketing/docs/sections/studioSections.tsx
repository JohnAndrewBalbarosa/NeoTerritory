// Per-tab docs for the Studio surface. Each component is rendered alone
// when its sidebar entry is the active selection.

import { ReactElement } from 'react';

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactElement | ReactElement[] }) {
  return (
    <section className="nt-docs__how" aria-labelledby={`docs-${eyebrow.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="nt-section-eyebrow">{eyebrow}</p>
      <h2 id={`docs-${eyebrow.toLowerCase().replace(/\s+/g, '-')}`} className="nt-docs__section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function OverviewSection() {
  return (
    <Shell eyebrow="Overview" title="What CodiNeo does">
      <p>
        CodiNeo analyzes C++ source for Gang of Four design patterns (Creational,
        Structural, Behavioral) plus a small idiom family. It is built around three
        surfaces: <strong>Studio</strong> where developers, students, and guests run
        analyses; <strong>Admin</strong> where the platform is configured and cohort
        activity is reviewed; and the <strong>Technical reference</strong>
        for understanding the analyzer&rsquo;s method and limits.
      </p>
      <p>
        Use the sidebar on the left to pick a section. Nothing is shown by default
        beyond this overview — each Studio or Admin tab has its own dedicated page so
        you can read about exactly what you are looking at instead of scrolling
        through the entire manual.
      </p>
    </Shell>
  );
}

export function SubmitSection() {
  return (
    <Shell eyebrow="Studio · Submit" title="Submit C++ source for analysis">
      <p>
        The Submit tab is the entry point of every Studio run. Paste a single C++ file
        or upload one from disk. The form ships the source to the backend
        <code> /api/analysis </code> route, which forwards it to the C++ microservice
        for tokenization and per-pattern scoring.
      </p>
      <ul className="nt-docs__list">
        <li>Source stays in-memory for the duration of the run; nothing is persisted unless you are signed in as a developer or PM.</li>
        <li>The Submit tab is sequentially gated: until a run completes, the Patterns / Tests / Docs / Self-check tabs stay disabled.</li>
        <li>Errors from the analyzer (parse failures, oversized input) are surfaced inline at the bottom of the editor.</li>
      </ul>
    </Shell>
  );
}

export function PatternsTabSection() {
  return (
    <Shell eyebrow="Studio · Patterns" title="Detected patterns and per-class evidence">
      <p>
        Once an analysis completes, the Patterns tab shows each class the analyzer
        examined and the pattern(s) that scored above the disambiguation threshold.
        When a class is ambiguous between two patterns, both are shown side by side
        with the lexemes that differentiate them — never auto-resolved.
      </p>
      <p>
        From this tab developers can also annotate their understanding: agree, disagree,
        or flag for review. The annotations feed the admin Reviews tab when
        <code> reviews_required </code> is enabled by an admin.
      </p>
    </Shell>
  );
}

export function TestsTabSection() {
  return (
    <Shell eyebrow="Studio · Tests" title="Run unit tests against the submitted source">
      <p>
        The Tests tab compiles the submitted source together with a generated harness
        and runs the resulting binary inside a sandbox. The compile and run phases are
        separated so a failure in compilation is reported differently from a runtime
        failure.
      </p>
      <p>
        The sandbox is opt-in: out-of-box, <code>ENABLE_TEST_RUNNER</code> is unset and
        the Tests tab reports <code>verdict: &quot;sandbox_disabled&quot;</code>. Operators
        wire firejail (Linux), sandbox-exec (macOS), or a Docker pod via
        <code> TEST_RUNNER_SANDBOX </code> before the tab can execute real binaries.
      </p>
    </Shell>
  );
}

export function DocsTabSection() {
  return (
    <Shell eyebrow="Studio · Docs" title="AI-generated documentation for each detected pattern">
      <p>
        The in-Studio Docs tab uses the configured AI provider (set under
        Admin · AI) to draft a short explanation of why each pattern was detected in
        the user&rsquo;s code. It is intentionally a documentation layer on top of the
        analyzer — it does not change detection results.
      </p>
      <p>
        When no API key is configured the tab returns
        <code> status: &quot;pending_provider&quot; </code> instead of throwing, so the
        Studio remains usable without a paid provider.
      </p>
    </Shell>
  );
}

export function SelfCheckSection() {
  return (
    <Shell eyebrow="Studio · Self-check" title="Validate understanding after an analysis">
      <p>
        The Self-check tab only appears when an admin has enabled
        <code> reviews_required </code>. It asks the user a small number of questions
        about the detected patterns and ambiguous cases, then records the answers
        against the run. The admin Reviews tab aggregates these responses.
      </p>
    </Shell>
  );
}
