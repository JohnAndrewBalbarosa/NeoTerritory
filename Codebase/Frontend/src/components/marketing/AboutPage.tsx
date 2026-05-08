import teamData from '../../data/team.json';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import TeamCard from './TeamCard';

interface Highlight {
  image: string;
  caption: string;
}

interface TeamMember {
  slug: string;
  name: string;
  role: string;
  bio: string;
  photoPath: string;
  skills?: string[];
  highlights?: Highlight[];
  links: {
    github?: string;
    linkedin?: string;
    facebook?: string;
    website?: string;
  };
}

interface TeamData {
  members: TeamMember[];
}

const team = teamData as TeamData;

export default function AboutPage() {
  return (
    <main className="nt-about" id="main">
      <section className="nt-about__hero" aria-labelledby="about-heading">
        <p className="nt-section-eyebrow">Meet your coders</p>
        <h1 id="about-heading" className="nt-about__title">
          <SplitText text="Built by a small research team." as="span" />
        </h1>
        <p className="nt-about__lede">
          CodiNeo began as a study tool: how do design patterns actually change reading speed,
          AI documentation cost, and unit-test maintenance? The team below carries the answer
          across C++, the backend adapter, the studio, and the research instrument.
        </p>
      </section>

      <ScrollReveal as="section" className="nt-about__grid-section">
        <div className="nt-about__grid">
          {team.members.map((m, i) => (
            <TeamCard key={m.slug} member={m} index={i} />
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-about__principles">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">How we work</p>
          <h2 className="nt-section-title">Three rules we hold ourselves to</h2>
        </header>
        <ol className="nt-principles">
          <li>
            <h3>The docs are the source of truth.</h3>
            <p>
              When the code and the docs disagree, the docs win — we move the code to match the
              spec, not the other way around. The blueprint under <code>docs/Codebase/</code>
              defines both the logic and the folder shape.
            </p>
          </li>
          <li>
            <h3>The microservice never calls the network.</h3>
            <p>
              Structural detection is deterministic. AI orchestration lives one layer up so the
              same input always produces the same evidence files.
            </p>
          </li>
          <li>
            <h3>A pattern is a JSON file.</h3>
            <p>
              Adding a new pattern does not require a recompile. Adding a new family does. We pay
              that cost intentionally.
            </p>
          </li>
        </ol>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-about__cta">
        <h2 className="nt-section-title">Run it on your code</h2>
        <p className="nt-section-lede">
          The studio runs the same five-stage pipeline you saw on the Hero. Drop in a file and
          watch it tag itself.
        </p>
        <div className="nt-hero__ctas">
          <MagneticButton variant="primary" onClick={() => navigate('/app')}>
            Open studio
          </MagneticButton>
          <MagneticButton variant="ghost" onClick={() => navigate('/learn')}>
            Read the deep dive
          </MagneticButton>
        </div>
      </ScrollReveal>
    </main>
  );
}
