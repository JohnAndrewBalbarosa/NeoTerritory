import { useState } from 'react';
import { FAMILIES, Family, Lesson, Sample } from '../../data/learningContent';
import { navigate } from '../../lib/router';
import { stashStudioPrefill } from '../../lib/studioPrefill';
import { useAppStore } from '../../store/appState';
import MagneticButton from './effects/MagneticButton';

type IntroLesson = {
  id: string;
  title: string;
  eyebrow: string;
  body: string[];
  bullets?: string[];
  examples?: Array<{ label: string; items: string[] }>;
  analogy?: string;
  code?: string;
  note?: string;
};

type CourseStep =
  | { id: string; phase: 'intro'; introIndex: number; title: string; label: string }
  | { id: string; phase: 'pattern'; family: Family; lesson: Lesson; title: string; label: string }
  | { id: string; phase: 'practice'; title: string; label: string };

const INTRO_LESSONS: IntroLesson[] = [
  {
    id: 'intro-pattern-definition',
    title: 'What is a design pattern?',
    eyebrow: 'Lesson 1',
    body: [
      'A design pattern is a reusable solution to a common software design problem.',
      'It is not a library, framework, or copy-paste code.',
      'It is a proven way to organize and design software.',
    ],
    analogy:
      'Like engineers reusing proven house designs for doors, windows, stairs, and layouts, developers reuse design patterns for common coding problems.',
  },
  {
    id: 'intro-pattern-value',
    title: 'Why design patterns matter',
    eyebrow: 'Lesson 2',
    body: [
      'Without patterns, code can become repetitive, hard to maintain, tightly coupled, and confusing.',
      'With patterns, code becomes easier to reuse, maintain, scale, and understand.',
      'Design patterns also help teams share a common vocabulary.',
    ],
  },
  {
    id: 'intro-pattern-categories',
    title: 'Three main pattern categories',
    eyebrow: 'Lesson 3',
    body: ['Design patterns are commonly grouped into three beginner-friendly categories.'],
    bullets: [
      'Creational patterns help create objects.',
      'Structural patterns help organize and connect classes or objects.',
      'Behavioral patterns help objects communicate and choose behavior.',
    ],
    examples: [
      { label: 'Creational', items: ['Singleton', 'Factory', 'Builder'] },
      { label: 'Structural', items: ['Adapter', 'Decorator', 'Facade', 'Proxy'] },
      { label: 'Behavioral', items: ['Observer', 'Strategy', 'State', 'Command'] },
    ],
  },
  {
    id: 'intro-oop-foundations',
    title: 'OOP foundations',
    eyebrow: 'Lesson 4',
    body: ['Design patterns are connected to object-oriented programming.'],
    bullets: [
      'Class: a blueprint.',
      'Object: an instance of a class.',
      'Inheritance: reusing behavior.',
      'Polymorphism: one action, many forms.',
      'Encapsulation: hiding internal details.',
      'Abstraction: simplifying complexity.',
    ],
    code: `class Animal {
public:
  virtual void speak() {
    cout << "Animal sound";
  }
};

class Dog : public Animal {
public:
  void speak() override {
    cout << "Bark";
  }
};`,
  },
  {
    id: 'intro-interface-principle',
    title: 'Program to an interface',
    eyebrow: 'Lesson 5',
    body: [
      'A common design principle is: "Program to an interface, not an implementation."',
      'Instead of depending too much on one exact class, developers depend on shared behavior or abstraction.',
      'This makes the system easier to change, expand, and maintain.',
    ],
  },
  {
    id: 'intro-code-structure',
    title: 'Understanding software structure',
    eyebrow: 'Lesson 6',
    body: [
      'Source code is more than plain text.',
      'A system can look at code structure, class relationships, inheritance, dependencies, and communication flow.',
      'AST means Abstract Syntax Tree. It represents code as a tree-like structure so software tools can analyze syntax and structure.',
      'NeoTerritory uses code structure to help detect design-pattern evidence and generate documentation support.',
    ],
  },
  {
    id: 'intro-real-software',
    title: 'Design patterns in real software',
    eyebrow: 'Lesson 7',
    body: [
      'Design patterns appear in real systems.',
      'Patterns are not only academic. They are used in professional software.',
    ],
    bullets: [
      'Game engines may use Singleton or Observer.',
      'UI frameworks may use MVC and Observer.',
      'Databases may use Singleton.',
      'Compilers may use Visitor.',
      'Operating systems may use Command.',
    ],
  },
  {
    id: 'intro-beginner-mistakes',
    title: 'Common beginner mistakes',
    eyebrow: 'Lesson 8',
    body: ['Learning patterns is easier when you know what to avoid.'],
    bullets: [
      'Overusing patterns. Patterns should solve real problems, not be forced everywhere.',
      'Copy-pasting without understanding. Learn why the pattern exists and when to use it.',
      'Ignoring relationships. Patterns are about structure, communication, and architecture, not only syntax.',
      'Making classes depend too heavily on each other. Loose connections are easier to maintain.',
    ],
  },
  {
    id: 'intro-try-neoterritory',
    title: 'Try NeoTerritory',
    eyebrow: 'Lesson 9',
    body: [
      'Now that you know the basics, continue through the required pattern library before opening the Studio.',
      'You will review each pattern lesson, then practice with real C++ code.',
    ],
    note: 'Before using the analyzer, you may be asked to claim an available session seat.',
  },
];

const PATTERN_STEPS = FAMILIES.flatMap((family) =>
  family.lessons.map((lesson) => ({
    family,
    lesson,
  })),
);

const FIRST_SAMPLE = PATTERN_STEPS.find((item) => item.lesson.sample)?.lesson.sample;

const REQUIRED_STEPS: CourseStep[] = [
  ...INTRO_LESSONS.map((lesson, introIndex) => ({
    id: lesson.id,
    phase: 'intro' as const,
    introIndex,
    title: lesson.title,
    label: lesson.eyebrow,
  })),
  ...PATTERN_STEPS.map(({ family, lesson }) => ({
    id: `pattern-${lesson.id}`,
    phase: 'pattern' as const,
    family,
    lesson,
    title: lesson.name,
    label: family.name,
  })),
  {
    id: 'practice',
    phase: 'practice' as const,
    title: 'Practice with sample code',
    label: 'Practice',
  },
];

function openSampleInStudentStudio(sample: Sample): void {
  stashStudioPrefill(sample);
  navigate('/student-studio');
}

export default function StudentLearningHub() {
  const { token, user } = useAppStore();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [lockedMessage, setLockedMessage] = useState('');

  const hasSession = !!(token && user);

  if (!hasSession) {
    return (
      <main className="nt-student nt-student-course" id="main">
        <section className="nt-student-session-gate" aria-labelledby="student-session-heading">
          <p className="nt-section-eyebrow">Student learning</p>
          <h1 id="student-session-heading" className="nt-student__title">
            Claim a session seat to start learning
          </h1>
          <p className="nt-student__lede">
            Your learning session uses an available seat. Claim one first, then complete the
            modules under the same session.
          </p>
          <div className="nt-student-session-gate__actions">
            <MagneticButton
              variant="primary"
              onClick={() => navigate('/student-studio?next=/student-learning')}
            >
              Claim a seat
            </MagneticButton>
            <MagneticButton variant="ghost" onClick={() => navigate('/choose')}>
              Back to choices
            </MagneticButton>
          </div>
        </section>
      </main>
    );
  }

  const activeStep = REQUIRED_STEPS[activeStepIndex];
  const isFirst = activeStepIndex === 0;
  const isPractice = activeStep.phase === 'practice';
  const isPracticeComplete = completedStepIds.has('practice');
  const completedCount = completedStepIds.size;
  const progress = Math.round((completedCount / REQUIRED_STEPS.length) * 100);

  function isUnlocked(index: number): boolean {
    if (index === 0) return true;
    return completedStepIds.has(REQUIRED_STEPS[index - 1].id);
  }

  function goToStep(index: number) {
    if (!isUnlocked(index)) {
      setLockedMessage('Finish the previous lesson first.');
      return;
    }
    setLockedMessage('');
    setActiveStepIndex(index);
  }

  function completeCurrentStep() {
    setCompletedStepIds((current) => {
      const next = new Set(current);
      next.add(activeStep.id);
      return next;
    });
    setLockedMessage('');
  }

  function completeAndContinue() {
    completeCurrentStep();
    if (activeStepIndex < REQUIRED_STEPS.length - 1) {
      setActiveStepIndex(activeStepIndex + 1);
    }
  }

  function goPrevious() {
    if (isFirst) return;
    setLockedMessage('');
    setActiveStepIndex((current) => current - 1);
  }

  return (
    <main className="nt-student nt-student-course" id="main">
      <section className="nt-course-hero" aria-labelledby="student-heading">
        <div>
          <p className="nt-section-eyebrow">Student learning</p>
          <h1 id="student-heading" className="nt-student__title">
            Student Learning Path
          </h1>
          <p className="nt-student__lede">
            Complete the guided course, pattern library, and practice step before opening the
            Studio.
          </p>
          <p className="nt-course-hero__audience">
            You already have a session seat. Continue through the modules, then open Studio to try
            the analyzer.
          </p>
        </div>
        <div className="nt-course-progress" aria-label={`Course progress ${progress}%`}>
          <span>{progress}%</span>
          <p>{completedCount}/{REQUIRED_STEPS.length} required items done</p>
          <div className="nt-course-progress__bar" aria-hidden>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="nt-course-shell" aria-label="Student learning path">
        <aside className="nt-course-sidebar" aria-label="Learning path outline">
          <div className="nt-course-sidebar__head">
            <p>Required path</p>
            <span>
              {activeStepIndex + 1}/{REQUIRED_STEPS.length}
            </span>
          </div>

          <CourseSection label="Section 1 · Beginner Course">
            <ol className="nt-course-outline">
              {INTRO_LESSONS.map((lesson, index) => (
                <CourseStepButton
                  key={lesson.id}
                  index={index}
                  step={REQUIRED_STEPS[index]}
                  activeStepIndex={activeStepIndex}
                  completedStepIds={completedStepIds}
                  isUnlocked={isUnlocked(index)}
                  onClick={() => goToStep(index)}
                />
              ))}
            </ol>
          </CourseSection>

          <CourseSection label="Section 2 · Pattern Library">
            <ol className="nt-course-outline">
              {PATTERN_STEPS.map(({ lesson }, patternIndex) => {
                const stepIndex = INTRO_LESSONS.length + patternIndex;
                return (
                  <CourseStepButton
                    key={lesson.id}
                    index={stepIndex}
                    step={REQUIRED_STEPS[stepIndex]}
                    activeStepIndex={activeStepIndex}
                    completedStepIds={completedStepIds}
                    isUnlocked={isUnlocked(stepIndex)}
                    onClick={() => goToStep(stepIndex)}
                  />
                );
              })}
            </ol>
          </CourseSection>

          <CourseSection label="Section 3 · Practice">
            <button
              type="button"
              className="nt-course-practice-link"
              data-active={activeStep.phase === 'practice' ? 'true' : undefined}
              data-completed={isPracticeComplete ? 'true' : undefined}
              disabled={!isUnlocked(REQUIRED_STEPS.length - 1)}
              onClick={() => goToStep(REQUIRED_STEPS.length - 1)}
            >
              <span>Practice with sample code</span>
              <small>{isPracticeComplete ? 'Done' : isUnlocked(REQUIRED_STEPS.length - 1) ? 'Current' : 'Locked'}</small>
            </button>
          </CourseSection>

          {lockedMessage && <p className="nt-course-locked-message">{lockedMessage}</p>}
        </aside>

        <article className="nt-lesson-panel">
          {activeStep.phase === 'intro' && (
            <IntroLessonView lesson={INTRO_LESSONS[activeStep.introIndex]} />
          )}
          {activeStep.phase === 'pattern' && (
            <PatternLessonView family={activeStep.family} lesson={activeStep.lesson} />
          )}
          {activeStep.phase === 'practice' && <PracticeView isComplete={isPracticeComplete} />}

          <footer className="nt-lesson-controls">
            <button type="button" className="nt-lesson-button" disabled={isFirst} onClick={goPrevious}>
              Previous
            </button>

            {!isPractice && (
              <>
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={completeAndContinue}
                >
                  {activeStep.phase === 'pattern' ? 'Next pattern' : 'Next lesson'}
                </button>
                <button type="button" className="nt-lesson-button" disabled>
                  Complete all lessons to unlock Studio
                </button>
              </>
            )}

            {isPractice && !isPracticeComplete && (
              <>
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={completeCurrentStep}
                >
                  Mark practice complete
                </button>
                <button type="button" className="nt-lesson-button" disabled>
                  Complete all lessons to unlock Studio
                </button>
              </>
            )}

            {isPractice && isPracticeComplete && (
              <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
                Proceed to Studio
              </MagneticButton>
            )}
          </footer>
        </article>
      </section>
    </main>
  );
}

function CourseSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nt-course-section">
      <p className="nt-course-section__label">{label}</p>
      {children}
    </div>
  );
}

function CourseStepButton({
  index,
  step,
  activeStepIndex,
  completedStepIds,
  isUnlocked,
  onClick,
}: {
  index: number;
  step: CourseStep;
  activeStepIndex: number;
  completedStepIds: Set<string>;
  isUnlocked: boolean;
  onClick: () => void;
}) {
  const isActive = index === activeStepIndex;
  const isCompleted = completedStepIds.has(step.id);
  const status = isCompleted ? 'Done' : isActive ? 'Current' : isUnlocked ? 'Ready' : 'Locked';

  return (
    <li>
      <button
        type="button"
        disabled={!isUnlocked}
        data-active={isActive ? 'true' : undefined}
        data-completed={isCompleted ? 'true' : undefined}
        data-locked={!isUnlocked ? 'true' : undefined}
        onClick={onClick}
        title={!isUnlocked ? 'Finish the previous lesson first.' : undefined}
      >
        <span className="nt-course-outline__dot" aria-hidden>
          {isCompleted ? 'ok' : index + 1}
        </span>
        <span>
          <small>{step.label} · {status}</small>
          {step.title}
        </span>
      </button>
    </li>
  );
}

function IntroLessonView({ lesson }: { lesson: IntroLesson }) {
  return (
    <>
      <header className="nt-lesson-panel__head">
        <p className="nt-section-eyebrow">{lesson.eyebrow}</p>
        <h2>{lesson.title}</h2>
      </header>
      <LessonBody lesson={lesson} />
    </>
  );
}

function LessonBody({ lesson }: { lesson: IntroLesson }) {
  return (
    <div className="nt-lesson-content">
      {lesson.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      {lesson.analogy && (
        <div className="nt-lesson-callout">
          <span>Analogy</span>
          <p>{lesson.analogy}</p>
        </div>
      )}

      {lesson.bullets && (
        <ul className="nt-lesson-list">
          {lesson.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {lesson.examples && (
        <div className="nt-lesson-examples">
          {lesson.examples.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              <div>
                {group.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lesson.code && (
        <pre className="nt-lesson-code">
          <code>{lesson.code}</code>
        </pre>
      )}

      {lesson.note && <p className="nt-student__seat-note">{lesson.note}</p>}
    </div>
  );
}

function PatternLessonView({ family, lesson }: { family: Family; lesson: Lesson }) {
  return (
    <>
      <header className="nt-lesson-panel__head">
        <p className="nt-section-eyebrow">{family.name} pattern</p>
        <h2>{lesson.name}</h2>
        <p className="nt-lesson-panel__one">{lesson.oneLiner}</p>
      </header>
      <div className="nt-lesson-content">
        {lesson.prerequisites.length > 0 && (
          <section className="nt-student-pattern-section">
            <h3>Before you start</h3>
            <p>
              Read the lesson once even if these are unfamiliar. To write the pattern yourself, it
              helps to know these ideas.
            </p>
            <ul className="nt-lesson-list">
              {lesson.prerequisites.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="nt-student-pattern-section">
          <h3>What it is</h3>
          <p>{lesson.whatItIs}</p>
        </section>

        <section className="nt-student-pattern-section">
          <h3>When to use it</h3>
          <p>{lesson.whenToUse}</p>
        </section>

        <section className="nt-student-pattern-section">
          <h3>A plain example</h3>
          <p>{lesson.example}</p>
        </section>

        {lesson.sample ? (
          <div className="nt-student-sample-action">
            <button
              type="button"
              className="nt-lesson-button"
              disabled
            >
              Sample unlocks after course
            </button>
            <p>
              Finish the required path first. Then you can open Studio with this session seat.
            </p>
          </div>
        ) : (
          <p className="nt-student__seat-note">
            No runnable sample yet for this lesson. Continue through the required pattern library
            before opening Studio.
          </p>
        )}
      </div>
    </>
  );
}

function PracticeView({ isComplete }: { isComplete: boolean }) {
  return (
    <>
      <header className="nt-lesson-panel__head">
        <p className="nt-section-eyebrow">Practice</p>
        <h2>Practice with sample code</h2>
      </header>
      <div className="nt-lesson-content">
        <p>
          You have completed the beginner lessons and pattern library. You can now try NeoTerritory
          with real C++ code.
        </p>
        <p className="nt-student__seat-note">
          Before using the analyzer, you may be asked to claim an available session seat.
        </p>
        <div className="nt-student-sample-action">
          {FIRST_SAMPLE && (
            <button
              type="button"
              className="nt-lesson-button nt-lesson-button--primary"
              onClick={() => openSampleInStudentStudio(FIRST_SAMPLE)}
            >
              Try a sample in Studio
            </button>
          )}
          <p>
            {isComplete
              ? 'Studio is unlocked. Proceed when you are ready.'
              : 'Mark practice complete to unlock the final Studio button.'}
          </p>
        </div>
      </div>
    </>
  );
}
