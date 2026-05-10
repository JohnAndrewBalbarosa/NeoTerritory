import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';

// Per Sprint 0 doc blueprint and per the actual thesis metadata sourced
// from FINAL THESIS 3 PAPER.pdf at the repo root.
//
// This page is thesis-specific narrative, not a job-resume page.

const AUTHORS: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'John Andrew Balbarosa', role: 'Researcher' },
  { name: 'Miryl Z. De Leon', role: 'Researcher' },
  { name: 'Josephine J. Santander', role: 'Researcher' },
];

const PANEL: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'Dr. Hadji Tejuco', role: 'Head Panelist' },
  { name: 'Ms. May Florence San Pablo', role: 'Panelist' },
  { name: 'Dr. Dennis B. Gonzales', role: 'Panelist' },
];

export default function AboutPage() {
  return (
    <main className="nt-about" id="main">
      <header className="nt-about__head">
        <p className="nt-section-eyebrow">About this thesis</p>
        <h1 className="nt-about__title">CodiNeo.</h1>
        <p className="nt-about__subtitle">
          A documentation-generation system using a hash-based virtual structural-copy algorithm
          for design-pattern learning in DEVCON Luzon.
        </p>
        <p className="nt-about__meta">
          FEU Institute of Technology · BS Computer Science (Software Engineering) · March 2026
        </p>
      </header>

      <section className="nt-about__section" aria-labelledby="about-rq">
        <h2 id="about-rq" className="nt-about__section-title">
          Research question
        </h2>
        <p>
          Can a hash-based virtual structural-copy algorithm, paired with a JSON-driven pattern
          catalog and a documentation-oriented AI layer, help interns and novice C++ developers
          recognise design patterns in real source code, generate evidence-grounded documentation,
          and bridge the gap between pattern theory and practical code understanding?
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-gap">
        <h2 id="about-gap" className="nt-about__section-title">
          Why existing tools fall short
        </h2>
        <ul className="nt-about__list">
          <li>
            Off-the-shelf static analysers do not name design patterns; they flag style violations
            that a learner still has to interpret without the underlying vocabulary.
          </li>
          <li>
            Pure large-language-model passes over source produce different verdicts on the same
            file across runs; the structural ground truth keeps shifting (Hou et al., 2024).
          </li>
          <li>
            Manual documentation drifts away from implementation as soon as the code moves on,
            and the drift compounds the comprehension gap for new contributors (Romeo et al.,
            2024).
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
          — describe an already-tagged class to a learner.
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-method">
        <h2 id="about-method" className="nt-about__section-title">
          Method
        </h2>
        <p>
          A C++ microservice performs lexical tagging, builds a virtual structural copy alongside
          the actual parse tree, simultaneously hashes nodes during traversal, cross-references
          usages per class, and matches each class against a JSON-driven pattern catalog grounded
          in Nesteruk&rsquo;s <em>Design Patterns in Modern C++20</em> (2022). A Node backend
          orchestrates a documentation-oriented AI pass, with deterministic static fallbacks per
          pattern. A research studio collects per-run accuracy ratings and end-of-session reviews
          so the catalog can be tuned against the data it actually meets in DEVCON Luzon
          internships.
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-contribution">
        <h2 id="about-contribution" className="nt-about__section-title">
          Expected contribution
        </h2>
        <p>
          A reproducible, JSON-extensible C++ pattern detector with an integrated documentation
          and unit-test-scaffold pipeline; a public dataset of structural-fact runs paired with
          human accuracy ratings collected from DEVCON Luzon intern volunteers; and a study-grade
          comparison of AI-only versus structural-plus-AI documentation against reading-speed and
          design-pattern-recognition outcomes for novice C++ developers.
        </p>
      </section>

      <section className="nt-about__section" aria-labelledby="about-authors">
        <h2 id="about-authors" className="nt-about__section-title">
          Authors
        </h2>
        <ul className="nt-about__team-strip">
          {AUTHORS.map((a) => (
            <li key={a.name} className="nt-about__team-chip">
              <span className="nt-about__team-name">{a.name}</span>
              <span className="nt-about__team-role">{a.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="nt-about__section" aria-labelledby="about-advising">
        <h2 id="about-advising" className="nt-about__section-title">
          Advising and panel
        </h2>
        <ul className="nt-about__team-strip">
          <li className="nt-about__team-chip">
            <span className="nt-about__team-name">Ms. Kim Giselle Bautista</span>
            <span className="nt-about__team-role">Thesis Adviser</span>
          </li>
          <li className="nt-about__team-chip">
            <span className="nt-about__team-name">Ms. Elisa Malasaga</span>
            <span className="nt-about__team-role">Course Adviser</span>
          </li>
          <li className="nt-about__team-chip">
            <span className="nt-about__team-name">Dr. Shaneth C. Ambat</span>
            <span className="nt-about__team-role">Department Head</span>
          </li>
          {PANEL.map((p) => (
            <li key={p.name} className="nt-about__team-chip">
              <span className="nt-about__team-name">{p.name}</span>
              <span className="nt-about__team-role">{p.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="nt-about__section" aria-labelledby="about-ack">
        <h2 id="about-ack" className="nt-about__section-title">
          Acknowledgements
        </h2>
        <p>
          We thank our adviser, panel, and the DEVCON Luzon community whose internship and
          bootcamp programs are the audience this work is written for. The fresh-eye reviews
          from devcon volunteers repeatedly forced the design back to the audience profile.
        </p>
      </section>

      <section className="nt-about__cta-band">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
