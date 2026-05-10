import teamData from '../../data/team.json';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';

// Per Sprint 0 doc blueprint at
// docs/Codebase/Frontend/src/components/marketing/AboutPage.tsx.md and per
// the user direction: thesis-specific narrative, not a job-resume page.
//
// Sections, in fixed order: research question → why existing tools fall
// short → hypothesis → method → expected contribution → acknowledgements →
// optional small team strip (names only, no bios).

interface TeamMember {
  slug: string;
  name: string;
  role: string;
}

interface TeamData {
  members: TeamMember[];
}

const team = teamData as TeamData;

export default function AboutPage() {
  return (
    <main className="nt-about" id="main">
      <header className="nt-about__head">
        <p className="nt-section-eyebrow">About this thesis</p>
        <h1 className="nt-about__title">What we set out to prove.</h1>
      </header>

      <section className="nt-about__section" aria-labelledby="about-rq">
        <h2 id="about-rq" className="nt-about__section-title">
          Research question
        </h2>
        <p>
          Can a lexical-tagging plus virtual-parse-tree algorithm, paired with a JSON-driven
          pattern catalog and a thin AI documentation layer, lower the readability and review
          cost of AI-generated C++ code without sacrificing detection determinism?
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-gap">
        <h2 id="about-gap" className="nt-about__section-title">
          Why existing tools fall short
        </h2>
        <ul className="nt-about__list">
          <li>
            Off-the-shelf static analysers do not name design patterns; they flag style violations
            that a reviewer still has to interpret.
          </li>
          <li>
            Pure LLM passes over source produce different verdicts on the same file across runs;
            the structural ground truth keeps shifting.
          </li>
          <li>
            Pattern detectors built around AST shape couple the catalog to the parser, so adding a
            new pattern means a recompile and a release.
          </li>
        </ul>
      </section>

      <section className="nt-about__section" aria-labelledby="about-hyp">
        <h2 id="about-hyp" className="nt-about__section-title">
          Hypothesis
        </h2>
        <p>
          Separating &ldquo;what does this token mean in the language&rdquo; from &ldquo;does this
          construct fit the program&rdquo; is the lever. If lexical categories are a fixed
          language fact and pattern signatures are JSON, the catalog can grow without touching
          the engine, the engine can stay deterministic, and the AI layer can do exactly one job
          — describe an already-tagged class to a human.
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-method">
        <h2 id="about-method" className="nt-about__section-title">
          Method
        </h2>
        <p>
          A C++ microservice performs lexical tagging, builds a virtual parse tree alongside the
          actual one, cross-references usages per class, and matches each class against the
          pattern catalog. A thin Node backend orchestrates the AI documentation pass. A research
          studio collects per-run accuracy ratings and end-of-session reviews so the catalog can
          be tuned against the data it actually meets.
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-contribution">
        <h2 id="about-contribution" className="nt-about__section-title">
          Expected contribution
        </h2>
        <p>
          A reproducible, JSON-extensible C++ pattern detector with an integrated documentation
          and test-scaffold pipeline; a public dataset of structural-fact runs paired with human
          accuracy ratings; and a study-grade comparison of AI-only versus structural-plus-AI
          documentation against reading-speed and review-time outcomes.
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-ack">
        <h2 id="about-ack" className="nt-about__section-title">
          Acknowledgements
        </h2>
        <p>
          We thank our adviser and panel for their early guidance, and the volunteers from devcon
          and the wider student community whose fresh-eye reviews repeatedly forced the design
          back to the audience profile.
        </p>
      </section>

      {team.members.length > 0 ? (
        <section className="nt-about__section" aria-labelledby="about-team">
          <h2 id="about-team" className="nt-about__section-title">
            Team
          </h2>
          <ul className="nt-about__team-strip">
            {team.members.map((m) => (
              <li key={m.slug} className="nt-about__team-chip">
                <span className="nt-about__team-name">{m.name}</span>
                <span className="nt-about__team-role">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="nt-about__cta-band">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
