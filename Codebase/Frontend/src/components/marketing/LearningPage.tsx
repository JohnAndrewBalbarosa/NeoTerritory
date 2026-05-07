import { useEffect, useMemo } from 'react';
import { navigate, usePath } from '../../lib/router';
import { useOverflowGuard } from '../../hooks/useOverflowGuard';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import { stashStudioPrefill } from '../../lib/studioPrefill';
import { FAMILIES, familyById, findLesson, Family, Lesson, Sample } from '../../data/learningContent';

interface Route {
  family?: Family;
  lesson?: Lesson;
}

function parseLearnPath(path: string): Route {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'learn' || parts.length < 2) return {};

  // Each pattern has its own top-level route: /learn/<lessonId>
  const direct = findLesson(parts[1]);
  if (direct && parts.length === 2) return direct;

  // Family hub and legacy nested route: /learn/<familyId>[/<lessonId>]
  const family = familyById(parts[1]);
  if (!family) return {};
  if (parts.length < 3) return { family };
  const lesson = family.lessons.find((l) => l.id === parts[2]);
  return { family, lesson };
}

function tryInStudio(sample: Sample): void {
  stashStudioPrefill(sample);
  navigate('/app');
}

export default function LearningPage() {
  useOverflowGuard({ rootSelector: '.nt-learn', tolerancePx: 2 });
  const path = usePath();
  const route = useMemo(() => parseLearnPath(path), [path]);

  // Reset scroll when switching between sub-routes inside /learn so the
  // family heading and lesson body land at the top of the viewport.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [path]);

  if (route.family) {
    return <FamilyView family={route.family} lesson={route.lesson} />;
  }
  return <Overview />;
}

function Overview() {
  return (
    <main className="nt-learn nt-learn--overview" id="main">
      <section className="nt-learn__hero" aria-labelledby="learn-heading">
        <p className="nt-section-eyebrow">Design pattern lessons</p>
        <h1 id="learn-heading" className="nt-learn__title">
          <SplitText text="Learn the shapes." as="span" />
        </h1>
        <p className="nt-learn__lede">
          A design pattern is a name for a shape that shows up again and again in code. Pick a
          family below to read short, plain-language lessons. Each lesson has a button that opens
          the sample inside the studio so you can run it.
        </p>
      </section>

      <ScrollReveal as="section" className="nt-family-grid-section" aria-label="Pattern families">
        <div className="nt-family-grid">
          {FAMILIES.map((f, idx) => (
            <ScrollReveal as="article" key={f.id} className="nt-family-card" delay={idx * 0.06}>
              <p className="nt-family-card__num">{(idx + 1).toString().padStart(2, '0')}</p>
              <h2 className="nt-family-card__name">{f.name}</h2>
              <p className="nt-family-card__gist">{f.gist}</p>
              <p className="nt-family-card__count">
                {f.lessons.length} {f.lessons.length === 1 ? 'lesson' : 'lessons'}
              </p>
              <div className="nt-family-card__cta">
                <MagneticButton
                  variant="primary"
                  onClick={() => navigate(`/learn/${f.id}`)}
                  ariaLabel={`Explore ${f.name} lessons`}
                >
                  Explore {f.name}
                </MagneticButton>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>
    </main>
  );
}

interface FamilyViewProps {
  family: Family;
  lesson?: Lesson;
}

function FamilyView({ family, lesson }: FamilyViewProps) {
  return (
    <main className="nt-learn nt-learn--family" id="main">
      <nav className="nt-learn__crumbs" aria-label="Breadcrumb">
        <button type="button" className="nt-learn__crumb" onClick={() => navigate('/learn')}>
          Lessons
        </button>
        <span className="nt-learn__crumb-sep" aria-hidden>
          /
        </span>
        <span className="nt-learn__crumb nt-learn__crumb--current">{family.name}</span>
        {lesson && (
          <>
            <span className="nt-learn__crumb-sep" aria-hidden>
              /
            </span>
            <span className="nt-learn__crumb nt-learn__crumb--current">{lesson.name}</span>
          </>
        )}
      </nav>

      <header className="nt-family-hero">
        <p className="nt-section-eyebrow">{family.name} family</p>
        <h1 className="nt-family-hero__title">{family.gist}</h1>
      </header>

      <div className="nt-family-layout">
        <aside className="nt-family-sidebar" aria-label={`${family.name} lessons`}>
          <p className="nt-family-sidebar__label">Lessons</p>
          <ul className="nt-family-sidebar__list">
            {family.lessons.map((l) => {
              const active = lesson?.id === l.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={
                      'nt-family-sidebar__item' +
                      (active ? ' nt-family-sidebar__item--active' : '')
                    }
                    onClick={() => navigate(`/learn/${l.id}`)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="nt-family-sidebar__name">{l.name}</span>
                    <span className="nt-family-sidebar__one">{l.oneLiner}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="nt-family-sidebar__back">
            <button
              type="button"
              className="nt-family-sidebar__backbtn"
              onClick={() => navigate('/learn')}
            >
              All families
            </button>
          </div>
        </aside>

        <section className="nt-family-content" aria-live="polite">
          {lesson ? (
            <LessonView family={family} lesson={lesson} />
          ) : (
            <div className="nt-family-empty">
              <p className="nt-family-empty__text">{family.overview}</p>
              <p className="nt-family-empty__hint">Pick a lesson on the left to begin.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

interface LessonViewProps {
  family: Family;
  lesson: Lesson;
}

function LessonView({ family, lesson }: LessonViewProps) {
  return (
    <article className="nt-lesson-page" key={lesson.id}>
      <header className="nt-lesson-page__head">
        <p className="nt-lesson-page__family">{family.name}</p>
        <h2 className="nt-lesson-page__title">{lesson.name}</h2>
        <p className="nt-lesson-page__one">{lesson.oneLiner}</p>
      </header>

      {lesson.prerequisites.length > 0 && (
        <section className="nt-lesson-page__section nt-lesson-page__section--prereq">
          <h3 className="nt-lesson-page__h">Before you start</h3>
          <p className="nt-lesson-page__prereq-lede">
            Read the lesson once even if these are unfamiliar — but to write the pattern yourself
            you should be comfortable with each item below.
          </p>
          <ul className="nt-lesson-page__prereq-list">
            {lesson.prerequisites.map((p, i) => (
              <li key={i} className="nt-lesson-page__prereq-item">
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="nt-lesson-page__section">
        <h3 className="nt-lesson-page__h">What it is</h3>
        <p>{lesson.whatItIs}</p>
      </section>

      <section className="nt-lesson-page__section">
        <h3 className="nt-lesson-page__h">When to use it</h3>
        <p>{lesson.whenToUse}</p>
      </section>

      <section className="nt-lesson-page__section">
        <h3 className="nt-lesson-page__h">A plain example</h3>
        <p>{lesson.example}</p>
      </section>

      <footer className="nt-lesson-page__footer">
        {lesson.sample ? (
          <>
            <MagneticButton
              variant="primary"
              onClick={() => tryInStudio(lesson.sample as Sample)}
              ariaLabel={`Try ${lesson.name} in the studio`}
            >
              Try this in studio
            </MagneticButton>
            <p className="nt-lesson-page__hint">
              Opens the studio with the sample already loaded into slot 1.
            </p>
          </>
        ) : (
          <p className="nt-lesson-page__hint">
            No runnable sample yet for this lesson. Read the explanation and try writing one
            yourself in the studio.
          </p>
        )}
      </footer>
    </article>
  );
}
