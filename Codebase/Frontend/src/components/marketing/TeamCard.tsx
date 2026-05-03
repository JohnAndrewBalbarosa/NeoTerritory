import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

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

interface TeamCardProps {
  member: TeamMember;
  index: number;
}

function gradientFromSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, oklch(72% 0.18 ${h1}), oklch(48% 0.22 ${h2}))`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function TeamCard({ member, index }: TeamCardProps) {
  const reduce = useReducedMotion();
  const gradient = useMemo(() => gradientFromSlug(member.slug), [member.slug]);
  const skills = member.skills ?? [];
  const highlights = member.highlights ?? [];

  return (
    <motion.article
      className="nt-team-card"
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
      whileHover={reduce ? undefined : { y: -4 }}
    >
      <div className="nt-team-card__photo" style={{ background: gradient }}>
        {member.photoPath ? (
          <img src={member.photoPath} alt={`${member.name}, ${member.role}`} loading="lazy" />
        ) : (
          <span className="nt-team-card__initials" aria-hidden>
            {initials(member.name)}
          </span>
        )}
      </div>
      <div className="nt-team-card__body">
        <p className="nt-team-card__role">{member.role}</p>
        <h3 className="nt-team-card__name">{member.name}</h3>
        <p className="nt-team-card__bio">{member.bio}</p>

        {skills.length > 0 && (
          <ul className="nt-team-card__skills" aria-label={`${member.name} — skills`}>
            {skills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}

        {highlights.length > 0 && (
          <figure className="nt-team-card__gallery" aria-label={`${member.name} — highlights`}>
            <div className="nt-team-card__gallery-strip">
              {highlights.map((h) => (
                <a
                  key={h.image}
                  href={h.image}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="nt-team-card__gallery-item"
                  title={h.caption}
                >
                  <img src={h.image} alt={h.caption} loading="lazy" />
                </a>
              ))}
            </div>
            <figcaption className="nt-team-card__gallery-caption">
              {highlights.length} milestones · click to enlarge
            </figcaption>
          </figure>
        )}

        <ul className="nt-team-card__links">
          {member.links.github && (
            <li>
              <a href={member.links.github} target="_blank" rel="noreferrer noopener">
                GitHub
              </a>
            </li>
          )}
          {member.links.linkedin && (
            <li>
              <a href={member.links.linkedin} target="_blank" rel="noreferrer noopener">
                LinkedIn
              </a>
            </li>
          )}
          {member.links.facebook && (
            <li>
              <a href={member.links.facebook} target="_blank" rel="noreferrer noopener">
                Facebook
              </a>
            </li>
          )}
          {member.links.website && (
            <li>
              <a href={member.links.website} target="_blank" rel="noreferrer noopener">
                Website
              </a>
            </li>
          )}
        </ul>
      </div>
    </motion.article>
  );
}
