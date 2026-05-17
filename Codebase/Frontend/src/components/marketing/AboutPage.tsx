import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import teamData from '../../data/team.json';

interface TeamLinks {
  github: string;
  linkedin: string;
  facebook: string;
  website: string;
}

interface TeamMember {
  slug: string;
  name: string;
  role: string;
  bio: string;
  photoPath: string;
  skills: ReadonlyArray<string>;
  links: TeamLinks;
  isPlaceholder?: boolean;
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function members(): ReadonlyArray<TeamMember> {
  return (teamData.members as ReadonlyArray<TeamMember>) ?? [];
}

export default function AboutPage() {
  const team = members();

  return (
    <main className="nt-about" id="main">
      <header className="nt-about__head">
        <p className="nt-section-eyebrow">About</p>
        <h1 className="nt-about__title">About CodiNeo</h1>
        <p className="nt-about__subtitle">
          CodiNeo is a C++ design-pattern learning tool. It detects Creational,
          Structural, and Behavioral patterns in your source, explains why each was
          flagged, and walks you through a guided self-check.
        </p>
      </header>

      <section className="nt-about__section" aria-labelledby="about-team-h">
        <h2 id="about-team-h" className="nt-about__section-title">
          The team
        </h2>
        <p className="nt-about__section-lede">
          CodiNeo is a thesis project from FEU Tech. Three people own different
          slices of the work.
        </p>

        <div className="nt-about__dev-grid" data-testid="about-team-grid">
          {team.map((m) => (
            <article key={m.slug} className="nt-about__dev" data-testid={`about-team-${m.slug}`}>
              <span className="nt-about__dev-monogram" aria-hidden="true">
                {monogram(m.name)}
              </span>
              <h3 className="nt-about__dev-name">{m.name}</h3>
              <p className="nt-about__dev-role">{m.role}</p>
              <p className="nt-about__dev-blurb">{m.bio}</p>
              {m.skills.length > 0 && (
                <ul className="nt-about__list" aria-label={`${m.name} highlights`}>
                  {m.skills.slice(0, 4).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
              {(m.links.linkedin || m.links.facebook || m.links.github || m.links.website) && (
                <p className="nt-about__dev-links">
                  {m.links.linkedin && (
                    <a href={m.links.linkedin} target="_blank" rel="noreferrer noopener">
                      LinkedIn
                    </a>
                  )}
                  {m.links.facebook && (
                    <a href={m.links.facebook} target="_blank" rel="noreferrer noopener">
                      Facebook
                    </a>
                  )}
                  {m.links.github && (
                    <a href={m.links.github} target="_blank" rel="noreferrer noopener">
                      GitHub
                    </a>
                  )}
                  {m.links.website && (
                    <a href={m.links.website} target="_blank" rel="noreferrer noopener">
                      Website
                    </a>
                  )}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="nt-about__cta-band">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
