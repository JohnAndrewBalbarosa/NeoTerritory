import { useEffect, useMemo } from 'react';
import { navigate, usePath } from '../../lib/router';
import { useOverflowGuard } from '../../hooks/useOverflowGuard';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import { stashStudioPrefill } from '../../lib/studioPrefill';

import builderSrc from '../../../../Microservice/samples/builder/http_request_builder.cpp?raw';
import factorySrc from '../../../../Microservice/samples/factory/shape_factory.cpp?raw';
import singletonSrc from '../../../../Microservice/samples/singleton/config_registry.cpp?raw';
import methodChainSrc from '../../../../Microservice/samples/method_chaining/query_predicate.cpp?raw';
import strategySrc from '../../../../Microservice/samples/strategy/strategy_basic.cpp?raw';
import wrappingSrc from '../../../../Microservice/samples/wrapping/logging_proxy.cpp?raw';

interface Sample {
  name: string;
  code: string;
}

interface Lesson {
  id: string;
  name: string;
  oneLiner: string;
  whatItIs: string;
  whenToUse: string;
  example: string;
  sample?: Sample;
}

interface Family {
  id: string;
  name: string;
  gist: string;
  overview: string;
  lessons: Lesson[];
}

const FAMILIES: Family[] = [
  {
    id: 'creational',
    name: 'Creational',
    gist:
      'Patterns that decide how new objects are made. Use them when building something is more involved than just calling new.',
    overview:
      'Creational patterns help when an object has many parts, when its construction depends on a choice, or when there should only be one of it. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'builder',
        name: 'Builder',
        oneLiner: 'Set parts one at a time, then ask for the finished object.',
        whatItIs:
          'A way to build a complex object piece by piece. You set each part on its own line, then call a final method that returns the finished thing.',
        whenToUse:
          'When an object has many optional parts, or when calling its constructor with all the arguments would be hard to read.',
        example:
          'Think of ordering a custom pizza. You add cheese. Then you add pepperoni. Then olives. At the end you say done, and the cashier hands you the finished pizza.',
        sample: { name: 'http_request_builder.cpp', code: builderSrc },
      },
      {
        id: 'factory',
        name: 'Factory',
        oneLiner: 'Ask one helper to make the right kind of object for you.',
        whatItIs:
          'A helper class with one method that decides which kind of object to create. The caller does not need to know the exact subclass it is getting.',
        whenToUse:
          'When the calling code should not have to pick between several similar subclasses on its own. You ask for a Shape, and the factory hands back a Circle or a Square.',
        example:
          'A vending machine. You press the button for soda. The machine decides whether to give you a bottle or a can. You do not pick the brand of plastic.',
        sample: { name: 'shape_factory.cpp', code: factorySrc },
      },
      {
        id: 'method-chaining',
        name: 'Method Chaining',
        oneLiner: 'Set many options on the same object in one line.',
        whatItIs:
          'A style where each method returns the same object so you can call several methods in a row, all chained together.',
        whenToUse:
          'When you want a clean, readable way to set many options on one object without writing the variable name over and over.',
        example:
          'Picking filters in a settings screen. You tap dark mode, then large text, then no notifications. Each tap leaves you on the same screen so the next tap can follow right away.',
        sample: { name: 'query_predicate.cpp', code: methodChainSrc },
      },
      {
        id: 'singleton',
        name: 'Singleton',
        oneLiner: 'Allow only one instance of a class to exist at a time.',
        whatItIs:
          'A class that makes sure only one instance of itself exists in the whole program. Other code reaches that instance through a single shared accessor.',
        whenToUse:
          'When you have something that should be shared everywhere, like a settings registry, a logger, or a connection pool.',
        example:
          'The clock on a wall. Everyone in the room reads the same one. There is no second clock in the room with a different time.',
        sample: { name: 'config_registry.cpp', code: singletonSrc },
      },
    ],
  },
  {
    id: 'behavioural',
    name: 'Behavioural',
    gist:
      'Patterns that decide how objects work together. Use them when one piece of code needs to swap how it does its job.',
    overview:
      'Behavioural patterns are about choice at runtime. The shape of the code stays the same, but which step actually runs can change. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'strategy',
        name: 'Strategy',
        oneLiner: 'Swap out the algorithm a class uses without changing the class.',
        whatItIs:
          'A way to keep a single calling spot in your code while letting the actual work be done by one of several interchangeable helpers.',
        whenToUse:
          'When you have several different ways to do the same job and you want to choose between them at runtime.',
        example:
          'A navigation app. Walking, biking, and driving all give you a route from point A to point B. You pick the strategy and the app uses that one.',
        sample: { name: 'strategy_basic.cpp', code: strategySrc },
      },
    ],
  },
  {
    id: 'structural',
    name: 'Structural',
    gist:
      'Patterns that decide how objects fit together to form bigger things. Use them when you need to combine objects without making the code messy.',
    overview:
      'Structural patterns are about composition. They wrap, join, or stand in for other objects so that the calling code stays simple. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'adapter',
        name: 'Adapter',
        oneLiner: 'Let two parts that speak different languages work together.',
        whatItIs:
          'A wrapper class that translates one interface into another. The thing you have on the inside has a different shape from the thing the caller expects on the outside.',
        whenToUse:
          'When you have an old library that expects one shape and a new library that gives you a different shape, and you want them to work together.',
        example:
          'A travel plug adapter. The wall socket and your charger do not match, so you put an adapter between them. The wall does not change, the charger does not change.',
        sample: { name: 'logging_proxy.cpp', code: wrappingSrc },
      },
      {
        id: 'decorator',
        name: 'Decorator',
        oneLiner: 'Wrap something to add extra behavior, without changing the original.',
        whatItIs:
          'A wrapper that has the same interface as the thing it wraps, but adds work before or after each call. Decorators stack, so you can add several layers.',
        whenToUse:
          'When you want to add features one layer at a time, like adding a timestamp to a logger or a border to a button, without rewriting the original.',
        example:
          'Putting a phone case on your phone. The phone still works the same. The case adds protection on top.',
        sample: { name: 'logging_proxy.cpp', code: wrappingSrc },
      },
      {
        id: 'proxy',
        name: 'Proxy',
        oneLiner: 'Stand in for another object and control how it gets used.',
        whatItIs:
          'A wrapper that has the same interface as the real object, but controls how and when the real one gets called. The proxy can check, delay, or even skip the real call.',
        whenToUse:
          'When you want to add access checks, lazy loading, or remote calls in front of an existing object without changing the object itself.',
        example:
          'A receptionist at an office. You do not walk straight to the CEO. You go through the receptionist, who decides if you may pass.',
        sample: { name: 'logging_proxy.cpp', code: wrappingSrc },
      },
    ],
  },
  {
    id: 'idiom',
    name: 'Idiom',
    gist:
      'Patterns that are not from the classic Gang of Four book but show up so often in C++ that they deserve a name of their own.',
    overview:
      'Idioms live next to the classic patterns because they recur with the same regularity. They are language-specific tricks, not universal patterns. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'pimpl',
        name: 'Pimpl',
        oneLiner: 'Hide the inside of a class so the header file does not give it away.',
        whatItIs:
          'A trick that hides a class data members inside a private inner struct. The header file only mentions the inner struct by name, so the inside can change without anyone noticing.',
        whenToUse:
          'When you want the rest of the code to depend only on the public interface, not on the internal layout. Useful for keeping compile times down too.',
        example:
          'A sealed gift box. From the outside it looks the same to everyone. What is inside can change, and people who never open the box never need to know.',
      },
    ],
  },
];

function familyById(id: string): Family | undefined {
  return FAMILIES.find((f) => f.id === id);
}

function findLesson(lessonId: string): { family: Family; lesson: Lesson } | undefined {
  for (const family of FAMILIES) {
    const lesson = family.lessons.find((l) => l.id === lessonId);
    if (lesson) return { family, lesson };
  }
  return undefined;
}

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
