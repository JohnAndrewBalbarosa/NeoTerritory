import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import AboutResearchTeam from './sections/AboutResearchTeam';

// Per D64 (this turn): /about is the developer team page and the DevCon
// partnership story. Thesis methodology (research question, objectives,
// scope, method, contribution, panel) has moved to /research where the
// thesis content belongs.

export default function AboutPage() {
  return (
    <main className="nt-about" id="main">
      <section className="nt-about__hero" aria-labelledby="about-heading">
        <p className="nt-section-eyebrow">Meet your coders</p>
        <h1 id="about-heading" className="nt-about__title">
          Built by a small research team.
        </h1>
        <p className="nt-about__lede">
          CodiNeo began as a study tool: how do design patterns actually change reading speed,
          AI documentation cost, and unit-test maintenance? The team below carries the answer
          across C++, the backend adapter, the studio, and the research instrument.
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
