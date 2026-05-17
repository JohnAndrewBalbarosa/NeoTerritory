// Per-tab docs for the Admin / PM surface. PM and Admin share the same
// surface in this project (per design choice), so this file covers both
// roles. Each component renders alone when its sidebar entry is the
// active selection.

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

export function RunsSection() {
  return (
    <Shell eyebrow="Admin · Runs" title="Activity log of every analysis the system has executed">
      <p>
        The Runs tab lists every analysis kicked off across the platform: who
        triggered it, which source was submitted, how long detection took, and which
        patterns were emitted. PMs use it to see cohort activity at a glance;
        operators use it to spot stuck runs or repeated failures.
      </p>
      <ul className="nt-docs__list">
        <li>Filters: by user, by pattern family, by time window.</li>
        <li>Each row links to the full pattern result and any attached AI documentation.</li>
        <li>Old runs are retained until manually purged — there is no automatic TTL.</li>
      </ul>
    </Shell>
  );
}

export function ComplexitySection() {
  return (
    <Shell eyebrow="Admin · Complexity" title="Thesis-cohort-only complexity metrics">
      <p>
        Complexity is a thesis-only tab: it computes per-submission complexity
        metrics (cyclomatic, depth, member count) and groups them by participant. It
        exists for the research cohort to correlate code complexity with pattern
        recognisability and is not part of the day-to-day product flow.
      </p>
    </Shell>
  );
}

export function UsersSection() {
  return (
    <Shell eyebrow="Admin · Users" title="Manage testers, guest seats, and developer accounts">
      <p>
        The Users tab is the operator&rsquo;s seat board. It shows every tester
        account, which guest seats are currently claimed, who claimed them, and
        whether a session is still active. Admins can reclaim a stuck seat, hide the
        tester pool from the public popup, or change the maximum number of
        concurrent guest seats.
      </p>
    </Shell>
  );
}

export function ReviewsSection() {
  return (
    <Shell eyebrow="Admin · Reviews" title="Per-pattern reviewer answers and survey feedback">
      <p>
        Reviews surfaces what users submitted in the Studio Self-check tab and any
        open-ended feedback gathered after a run. Admins use it to triage
        misdetections, gather agree/disagree counts per pattern, and feed back into
        catalog tuning.
      </p>
    </Shell>
  );
}

export function AISection() {
  return (
    <Shell eyebrow="Admin · AI" title="Provider configuration for the Docs tab">
      <p>
        Configure the AI provider that powers the Studio Docs tab. Supports OpenAI
        and Anthropic; pick the model, paste the API key, and the backend stores it
        securely. With no key configured, the Docs tab degrades gracefully to a
        &quot;pending provider&quot; placeholder instead of throwing.
      </p>
    </Shell>
  );
}

export function LogsSection() {
  return (
    <Shell eyebrow="Admin · Logs" title="System and per-request logging">
      <p>
        Logs is the unified operator console: backend request logs, microservice
        stderr, and any auth or sandbox warnings. Useful when a Studio run reports
        something opaque to the user (e.g. <code>sandbox_disabled</code>) and you
        need to confirm the root cause.
      </p>
    </Shell>
  );
}

export function CatalogsSection() {
  return (
    <Shell eyebrow="Admin · Catalogs" title="Manage pattern catalog JSON for the analyzer">
      <p>
        The default analyzer ships with the public open-standards catalog. Admins
        can upload additional JSON catalogs scoped to their organization; uploaded
        patterns are surfaced to that org&rsquo;s developers alongside the public
        set, never replacing it. The pattern JSON schema is documented under
        <em> Technical reference · Catalog schema</em>.
      </p>
    </Shell>
  );
}

export function InvitesSection() {
  return (
    <Shell eyebrow="Admin · Invites" title="Generate and track invite codes">
      <p>
        Use Invites to bring new developers or PMs into a specific organization
        without forcing them through the public onboarding flow. Codes are
        single-use unless explicitly marked multi-use, and the tab tracks who has
        consumed which code.
      </p>
    </Shell>
  );
}

export function JoinRequestsSection() {
  return (
    <Shell eyebrow="Admin · Join requests" title="Self-serve org creation approvals">
      <p>
        When a signed-in user requests to create or join an organization, the
        request lands here for admin approval. Approving promotes the user to the
        requested role; denying sends them back to the standard developer view.
      </p>
    </Shell>
  );
}
