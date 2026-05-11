import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import AboutResearchTeam from './sections/AboutResearchTeam';

// Per D64 (this turn): /about is the developer team page and the DevCon
// partnership story. Thesis methodology (research question, objectives,
// scope, method, contribution, panel) has moved to /research where the
// thesis content belongs.

interface Developer {
  slug: string;
  name: string;
  role: string;
  blurb: string;
}

const DEVELOPERS: ReadonlyArray<Developer> = [
  {
    slug: 'balbarosa',
    name: 'John Andrew Balbarosa',
    role: 'Algorithm + microservice',
    blurb:
      'Designed and implemented the C++ hash-based virtual structural-copy algorithm and the deterministic pattern-detection microservice that powers NeoTerritory.',
  },
  {
    slug: 'de-leon',
    name: 'Miryl Z. De Leon',
    role: 'Studio + backend integration',
    blurb:
      'Built the Node backend that orchestrates the microservice, the AI documentation layer, and the studio UI surfaces.',
  },
  {
    slug: 'santander',
    name: 'Josephine J. Santander',
    role: 'Research instrument + evaluation',
    blurb:
      'Designed the per-run reviews, end-of-session survey instruments, and the evaluation methodology for DEVCON Luzon intern testing.',
  },
];

export default function AboutPage() {
  return (
    <main className="nt-about" id="main">
      <header className="nt-about__head">
        <p className="nt-section-eyebrow">About us</p>
        <h1 className="nt-about__title">Who built NeoTerritory, and for whom.</h1>
        <p className="nt-about__subtitle">
          NeoTerritory is a thesis project from FEU Institute of Technology, built in partnership
          with DEVCON Luzon to support intern and novice developer learning.
        </p>
      </header>

      <section className="nt-about__section" aria-labelledby="ab-who">
        <h2 id="ab-who" className="nt-about__section-title">
          The team
        </h2>
        <p className="nt-about__section-lede">
          We are three Computer Science students from FEU Institute of Technology, completing the
          Bachelor of Science in Computer Science (Software Engineering) in March 2026. NeoTerritory
          is our partial fulfilment of degree requirements - and a tool we genuinely want DEVCON
          Luzon volunteers to use.
        </p>
        <div className="nt-about__dev-grid">
          {DEVELOPERS.map((d) => (
            <article key={d.slug} className="nt-about__dev">
              <span className="nt-about__dev-monogram" aria-hidden="true">
                {d.name
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <h3 className="nt-about__dev-name">{d.name}</h3>
              <p className="nt-about__dev-role">{d.role}</p>
              <p className="nt-about__dev-blurb">{d.blurb}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nt-about__section" aria-labelledby="ab-for-whom">
        <h2 id="ab-for-whom" className="nt-about__section-title">
          Who this is for
        </h2>
        <p>
          NeoTerritory is built for <strong>DEVCON Luzon interns, novice developers, and
          chapter volunteers</strong> who write C++ as part of their training and want a faster way
          to recognise design patterns in real code. The system is intended to bridge the gap
          between learning design-pattern theory in lessons and recognising those patterns in actual
          C++ source code.
        </p>
        <p>
          Interns in DEVCON Luzon&rsquo;s internship program are usually recruited from chapter
          volunteers and rotate through bootcamps, professional development projects, and
          community-driven contributions. NeoTerritory targets the moment in that rotation where a
          new contributor is reading an unfamiliar C++ codebase for the first time and needs
          structural help to make sense of it.
        </p>
      </section>

      <section className="nt-about__section nt-about__partner" aria-labelledby="ab-partnership">
        <h2 id="ab-partnership" className="nt-about__section-title">
          In partnership with DEVCON Luzon
        </h2>
        <p>
          <strong>DEVCON Philippines</strong> is the country&rsquo;s largest and longest-running
          SEC-registered, BIR-compliant non-profit volunteer technology community, with eleven
          regional chapters nationwide. Its Luzon chapters connect Filipino technology
          enthusiasts to learning, mentorship, and community-driven projects.
        </p>
        <p>
          NeoTerritory was developed with the partnership and blessing of{' '}
          <strong>Sir Ghrassel Dungca</strong>, DEVCON co-lead, whose endorsement opened the door
          for this thesis to land its evaluation inside DEVCON Luzon&rsquo;s internship program.
          The research instruments, the testing cohort, and the contextualisation of the work in
          the DEVCON learning environment all exist because of his support.
        </p>
        <p>
          We are grateful to <strong>Sir Ghrassel</strong> and the DEVCON Luzon volunteers who
          gave us fresh-eye reviews, intern feedback, and the operational grounding that turned an
          academic prototype into a tool we can hand to actual learners.
        </p>
      </section>

      <AboutResearchTeam />

      <section className="nt-about__section" aria-labelledby="ab-acks">
        <h2 id="ab-acks" className="nt-about__section-title">
          Acknowledgements
        </h2>
        <p>
          Our thanks to our thesis adviser <strong>Ms. Kim Giselle Bautista</strong>, course
          adviser <strong>Ms. Elisa Malasaga</strong>, department head{' '}
          <strong>Dr. Shaneth C. Ambat</strong>, and the panel of{' '}
          <strong>Dr. Hadji Tejuco</strong> (head panelist),{' '}
          <strong>Ms. May Florence San Pablo</strong>, and{' '}
          <strong>Dr. Dennis B. Gonzales</strong> for the academic grounding and the rigorous
          critique that shaped this work.
        </p>
        <p>
          To the DEVCON Luzon intern volunteers who tested early drafts and the FEU classmates who
          forced the design back to its audience repeatedly: thank you. The fresh-eye feedback in
          group chats and over coffee is what made this presentable.
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
