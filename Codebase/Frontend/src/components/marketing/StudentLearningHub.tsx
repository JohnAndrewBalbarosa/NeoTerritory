import { useEffect, useState } from 'react';
import { FAMILIES, Family, Lesson, Sample, CorrectStructure } from '../../data/learningContent';
import { navigate } from '../../logic/router';
import { stashStudioPrefill } from '../../logic/studioPrefill';
import MagneticButton from './effects/MagneticButton';

// Sidebar accordion section identifiers. Only one section can be open
// at a time — that invariant is enforced just by holding a single
// `openSectionId` value in state (no need for a counter, the type
// system makes "two open" impossible).
type CourseSectionId = 'intro' | 'patterns' | 'practice';

// sessionStorage keys for the learner's per-session state. sessionStorage
// (not localStorage) is intentional: the persistence is scoped to the
// current browser tab, matching the user's "saved progress per session"
// framing. Closing the tab clears it.
const SESSION_KEY_ACTIVE_STEP   = 'nt-student-learning:active-step';
const SESSION_KEY_OPEN_SECTION  = 'nt-student-learning:open-section';
const SESSION_KEY_COMPLETED     = 'nt-student-learning:completed';

function readSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function writeSession(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* private mode / quota */ }
}

function readPersistedActiveStepIndex(): number {
  const raw = readSession(SESSION_KEY_ACTIVE_STEP);
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function readPersistedOpenSection(): CourseSectionId | null {
  const raw = readSession(SESSION_KEY_OPEN_SECTION);
  if (raw === 'intro' || raw === 'patterns' || raw === 'practice') return raw;
  return null;
}

function readPersistedCompletedStepIds(): Set<string> {
  const raw = readSession(SESSION_KEY_COMPLETED);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch { /* corrupt — start fresh */ }
  return new Set();
}

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
      'CodiNeo uses code structure to help detect design-pattern evidence and generate documentation support.',
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
    id: 'intro-pattern-ambiguity',
    title: 'Ambiguity is built in to design patterns',
    eyebrow: 'Lesson 9',
    body: [
      'Some design patterns look almost identical when you only read the code. Builder and Method Chaining both use return *this. Adapter, Decorator, and Proxy all wrap a held member and forward calls. This is not a bug in your code or in the analyzer — it is a property of the patterns themselves.',
      'When two patterns share the same structural shape, no automatic tool can pick a single winner from the code alone. The honest answer is to surface BOTH candidates and tell the reader the class is ambiguous between them.',
      'Ambiguity is not failure. It is information. It tells you the next decision (which pattern this really is) needs human judgment plus extra context the code does not yet carry.',
    ],
    bullets: [
      'Builder vs Method Chaining — both rely on return *this.',
      'Adapter vs Decorator vs Proxy — all forward calls to a wrapped member.',
      'Strategy concrete vs Decorator — both override a polymorphic method.',
    ],
    analogy:
      'Two siblings can look almost the same in a photograph. You cannot decide who is older from the photo alone. You need extra information — a birthday, a story — that the photo does not contain.',
  },
  {
    id: 'intro-connotative-definition',
    title: 'The connotative-definition rule',
    eyebrow: 'Lesson 10',
    body: [
      'The way to reduce ambiguity is to add context to the definition itself, not to guess. This is exactly how connotative meaning works in language.',
      'Lumalalim ang kahulugan (connotative): kapag nagdadagdag ka ng mga descriptions sa isang salita, mas espesipiko ang kahulugan. Mula sa "parent", kapag dinagdagan mo ng "female", nagiging "female parent" — mas tiyak na.',
      'Nabawasan ang sakop (denotative): habang dumarami ang descriptions, nababawasan ang bilang ng bagay o tao na pasok sa depinisyon. Mas marami ang pumapasok sa "parent" kaysa sa "female parent".',
      'CodiNeo applies the same rule to design patterns. Each pattern is defined not by a single keyword but by a small SET of structural descriptions — token combos that, taken together, narrow what counts as that pattern. Adding the right set of descriptions reduces ambiguity without resorting to method names that vary by team.',
    ],
    bullets: [
      'Connotation = adding descriptions to make meaning more specific.',
      'A single keyword like virtual is too thin — many classes have it.',
      'A combo like (virtual ~) or (override {) carries enough context to be a real signal.',
      'The analyzer rejects bare keywords as basis and accepts only stdlib symbols or multi-token combos.',
    ],
  },
  {
    id: 'intro-pattern-structure-rules',
    title: 'Each pattern has a structural rule',
    eyebrow: 'Lesson 11',
    body: [
      'Each design pattern in this course comes with a "correct structure" section that lists the exact token combos the analyzer requires.',
      'Read the must-have list as: at least one of these combos must appear in the class body.',
      'Read the must-not-have list as: if any of these combos fires, the class is rejected for that pattern even if the rest matches.',
      'These rules are not lookups for method names. They are language-level signals — keywords combined with their immediate neighbors, or stdlib symbols whose presence alone is structural evidence.',
    ],
    note: 'You will see "Correct structure" appear on every pattern lesson in this course.',
  },
  {
    id: 'intro-patterns-vary-by-context',
    title: 'Patterns vary by context and organisation',
    eyebrow: 'Lesson 12',
    body: [
      'Two teams that both claim to use Builder can write code that looks different. One team may insist on a final build() method; another may just chain setters and return *this. Same pattern name, different conventions.',
      'CodiNeo does not pick one team’s convention as the universal truth. Instead, it standardises on language-level structure so that detection is consistent regardless of which team wrote the class. This is what makes automatic unit-test scaffolding feasible — the analyzer agrees with itself across every codebase, even when humans disagree.',
      'The takeaway: if your team has stricter conventions, layer them on top. The analyzer answers the structural question. The conventions answer the cultural one.',
    ],
    bullets: [
      'Same pattern name can mean different things in different orgs.',
      'Standardising on language-level structure (not naming) is what enables tooling.',
      'NT detection feeds into automatic unit-test generation, so a stable rule matters.',
    ],
  },
  {
    id: 'intro-postrequisite-questions',
    title: 'Post-requisite open notes',
    eyebrow: 'Lesson 13',
    body: [
      'Before the Studio unlocks, sit with the questions below. They are intentionally open-ended — there is no single right answer, but every working developer should have an opinion on each.',
    ],
    bullets: [
      'Unit testing — when the analyzer flags a class as Builder, what unit tests would you write to confirm it behaves like a Builder rather than a Method Chain?',
      'Value to a company — how does a shared vocabulary of patterns reduce onboarding cost for new hires? Where does it fail?',
      'Readability — when does naming a pattern in code (a comment, a class name) help, and when does it just lock in the wrong abstraction?',
      'Ambiguity in your own code — pick one class you have written. If a tool tagged it as two patterns at once, would you push back, or would you accept the ambiguity?',
    ],
    note: 'Bring your answers to your next code review. The course does not grade them — your team does.',
  },
  {
    id: 'intro-try-neoterritory',
    title: 'Try CodiNeo',
    eyebrow: 'Lesson 14',
    body: [
      'You now have the concept module behind you. Continue through the required pattern library and you will see the structural rule for each pattern you read about.',
      'After the patterns, the practice step opens a real C++ sample in the Studio so you can see the analyzer fire.',
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
  // Per user direction this turn: Student Learning does NOT require
  // sign-in to read lessons. Sign-in is only required when the learner
  // wants to try the studio. The studio entry for student-learning
  // routes through the Developer Google sign-in flow (NOT the tester
  // picker), so the learner ends up on the same authenticated studio a
  // developer uses. The prefill stays in sessionStorage and is picked
  // up after the Google callback lands the user in /studio.
  stashStudioPrefill(sample);
  // Stamp the entry-flow so MainLayout treats this as a real-account
  // user (skips ConsentGate + Pretest) once the Google callback lands.
  try { sessionStorage.setItem('nt-entry-flow', 'developer'); } catch { /* private mode */ }
  navigate('/developer/login');
}

// Maps a step index to the sidebar section that should host it. Used
// both for the initial accordion-open decision and for auto-opening
// the right section when the active step changes (e.g., user pressed
// Next at the end of the intro lessons → patterns section opens).
function sectionForStepIndex(index: number): CourseSectionId {
  if (index < INTRO_LESSONS.length) return 'intro';
  if (index < REQUIRED_STEPS.length - 1) return 'patterns';
  return 'practice';
}

export default function StudentLearningHub() {
  // Per D47 (Sprint -1a auth-gate fix): the session-gate panel that
  // previously redirected unauthenticated visitors to /student-studio is
  // removed. Lessons render immediately for any visitor. The "Try this in
  // the studio" sample-launch buttons inside the lessons remain the only
  // points that may trigger sign-in — they navigate to /student-studio,
  // which gates itself. Reading is free; running code requires a seat.
  //
  // Progress state (`completedStepIds`) stays in-memory for the current
  // browser tab. Nothing is persisted server-side for an unauthenticated
  // visitor.
  // sessionStorage-backed state: restoring the learner's last screen
  // when they come back to the tab. Per user direction this turn the
  // open section, the active step, and completed step IDs all persist
  // for the session so a refresh / re-visit lands exactly where they
  // left off. Storage is best-effort — private mode / quota errors
  // fall back to in-memory defaults.
  const [activeStepIndex, setActiveStepIndex] = useState<number>(() => readPersistedActiveStepIndex());
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => readPersistedCompletedStepIds());
  const [lockedMessage, setLockedMessage] = useState('');
  // Accordion: only one section can be open at a time. Default to 'intro'
  // on a fresh session (no persisted open-section AND no progress yet) so
  // the very first thing a new learner sees is the opened first lesson —
  // not three collapsed section labels. After the first manual toggle or
  // Next click, the persisted value / step-derived section take over.
  const [openSectionId, setOpenSectionId] = useState<CourseSectionId>(() => {
    const persisted = readPersistedOpenSection();
    if (persisted) return persisted;
    const stepIndex = readPersistedActiveStepIndex();
    if (stepIndex === 0) return 'intro';
    return sectionForStepIndex(stepIndex);
  });

  // Persist state to sessionStorage on every change. Three separate
  // effects so a write failure in one (e.g., bad JSON for the Set)
  // does not block the others. Stringification of the completed-set
  // is the only non-trivial bit — Sets don't JSON.stringify directly.
  useEffect(() => { writeSession(SESSION_KEY_ACTIVE_STEP, String(activeStepIndex)); }, [activeStepIndex]);
  useEffect(() => { writeSession(SESSION_KEY_OPEN_SECTION, openSectionId); }, [openSectionId]);
  useEffect(() => {
    writeSession(SESSION_KEY_COMPLETED, JSON.stringify([...completedStepIds]));
  }, [completedStepIds]);

  // When the active step changes (Next / Previous / Mark complete),
  // auto-open the section that contains the new step so the learner
  // can see where they are. Manual accordion toggles override this on
  // the next user click.
  useEffect(() => {
    setOpenSectionId(sectionForStepIndex(activeStepIndex));
  }, [activeStepIndex]);

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
            Reading the lessons is free — no sign-in needed. Continue through the modules, then
            sign in with Google when you are ready to try the analyzer in Studio.
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

          <CourseSection
            id="intro"
            label="Section 1 · Beginner Course"
            isOpen={openSectionId === 'intro'}
            onToggle={setOpenSectionId}
          >
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

          <CourseSection
            id="patterns"
            label="Section 2 · Pattern Library"
            isOpen={openSectionId === 'patterns'}
            onToggle={setOpenSectionId}
          >
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

          <CourseSection
            id="practice"
            label="Section 3 · Practice"
            isOpen={openSectionId === 'practice'}
            onToggle={setOpenSectionId}
          >
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
              <MagneticButton
                variant="primary"
                onClick={() => {
                  // Same gate as openSampleInStudentStudio: route the
                  // "Proceed to Studio" click through the Developer
                  // Google sign-in. Reading lessons stays free; running
                  // code requires the developer flow.
                  try { sessionStorage.setItem('nt-entry-flow', 'developer'); } catch { /* private mode */ }
                  navigate('/developer/login');
                }}
              >
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
  id,
  label,
  isOpen,
  onToggle,
  children,
}: {
  id: CourseSectionId;
  label: string;
  isOpen: boolean;
  onToggle: (id: CourseSectionId) => void;
  children: React.ReactNode;
}) {
  // Accordion section. The body uses `hidden` rather than conditional
  // rendering so the inner ol mounts once and React doesn't tear down
  // CourseStepButton state every time a sibling section opens.
  const bodyId = `nt-course-section-body-${id}`;
  return (
    <div className={`nt-course-section${isOpen ? ' is-open' : ''}`} data-section={id}>
      <button
        type="button"
        className="nt-course-section__label"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => onToggle(id)}
      >
        <span>{label}</span>
        <span className="nt-course-section__chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
      </button>
      <div id={bodyId} className="nt-course-section__body" hidden={!isOpen}>
        {children}
      </div>
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

        {lesson.correctStructure && (
          <CorrectStructureSection structure={lesson.correctStructure} />
        )}

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

function CorrectStructureSection({ structure }: { structure: CorrectStructure }) {
  const hasMustHave = structure.mustHave.length > 0;
  const hasMustNotHave = (structure.mustNotHave?.length ?? 0) > 0;
  return (
    <section className="nt-student-pattern-section nt-student-pattern-section--structure">
      <h3>Correct structure</h3>
      <p className="nt-student-pattern-section__lede">
        These are the exact token combos the analyzer requires. Read them as language-level
        structure, not as method names.
      </p>

      {hasMustHave && (
        <div className="nt-structure-block">
          <h4 className="nt-structure-block__h">Must have at least one of</h4>
          <ul className="nt-structure-list">
            {structure.mustHave.map((item) => (
              <li key={item.label} className="nt-structure-item">
                <p className="nt-structure-item__label">{item.label}</p>
                <code className="nt-structure-item__tokens">{item.tokens.join(' ')}</code>
                <p className="nt-structure-item__why">{item.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasMustHave && (
        <p className="nt-structure-empty">
          No positive combo is required for this pattern — the analyzer relies entirely on the
          must-not-have list to identify it as the residual structural shape.
        </p>
      )}

      {hasMustNotHave && (
        <div className="nt-structure-block nt-structure-block--negative">
          <h4 className="nt-structure-block__h">Must NOT have any of</h4>
          <ul className="nt-structure-list">
            {structure.mustNotHave!.map((item) => (
              <li key={item.label} className="nt-structure-item">
                <p className="nt-structure-item__label">{item.label}</p>
                <code className="nt-structure-item__tokens">{item.tokens.join(' ')}</code>
                <p className="nt-structure-item__why">{item.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="nt-structure-why">{structure.whyItWorks}</p>
    </section>
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
          You have completed the beginner lessons and pattern library. You can now try CodiNeo
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
