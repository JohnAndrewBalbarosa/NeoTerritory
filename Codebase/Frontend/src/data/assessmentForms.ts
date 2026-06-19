// Formal-assessment objective forms (separate from the in-module theoreticalExam
// array, which is left untouched for mastery retries + practice analytics).
//
//   Form A  -> formal pre-test
//   Form B  -> formal post-test (distinct but equivalent items; zero overlap)
//   Creating -> stays in the practical / Studio activity, never here.
//
// Every item carries a STABLE id (e.g. 'creational-builder:A3'); the formal
// assessment is keyed by id, not by the in-module positional questionIndex.
// Correct-answer positions are deliberately spread across options (not always 0)
// to avoid the position-bias the audit found.
//
// PILOT ONLY: one Foundation module + one design-pattern module. The rest of the
// bank is intentionally absent until the structure + scope + pilot are verified;
// modules without a Form here are simply not formally assessable yet.

import type { ObjectiveAssessmentQuestion } from './learningModules';

export type AssessmentFormsData = {
  A: ReadonlyArray<ObjectiveAssessmentQuestion>;
  B: ReadonlyArray<ObjectiveAssessmentQuestion>;
};

export const ASSESSMENT_FORMS: Record<string, AssessmentFormsData> = {
  // ---- Foundation pilot: distribution 2 Remembering / 2 Understanding / 1 Applying ----
  'foundations-what-is-pattern': {
    A: [
      {
        id: 'foundations-what-is-pattern:A1', type: 'mcq', taxonomy: 'remembering',
        competency: 'Recall the definition of a design pattern',
        question: 'What is a design pattern, most precisely?',
        options: [
          'A named, reusable solution to a recurring object-oriented design problem',
          'A language keyword that enables polymorphism',
          'A base class that every program must extend',
          'A tool that automatically formats source code',
        ],
        correctIndex: 0,
      },
      {
        id: 'foundations-what-is-pattern:A2', type: 'mcq', taxonomy: 'remembering',
        competency: 'Recall what a pattern captures',
        question: 'A design pattern primarily captures which of the following?',
        options: [
          'A compiler optimization flag',
          'A file-naming convention',
          'A proven structure-and-intent for a recurring design problem',
          'A unit-test framework',
        ],
        correctIndex: 2,
      },
      {
        id: 'foundations-what-is-pattern:A3', type: 'mcq', taxonomy: 'understanding',
        competency: 'Explain why shared pattern names help a team',
        question: 'Why does giving a recurring design a shared name help a team?',
        options: [
          'It makes the program run faster',
          'One word can convey a whole structure and intent, reducing explanation',
          'It removes the need for any comments',
          'It guarantees the code compiles',
        ],
        correctIndex: 1,
      },
      {
        id: 'foundations-what-is-pattern:A4', type: 'mcq', taxonomy: 'understanding',
        competency: 'Distinguish a pattern from an algorithm',
        question: 'How does a design pattern differ from an algorithm?',
        options: [
          'They are identical',
          'An algorithm is always object-oriented; a pattern never is',
          'A pattern is just a faster algorithm',
          'A pattern arranges classes/objects for a design problem; an algorithm specifies computational steps',
        ],
        correctIndex: 3,
      },
      {
        id: 'foundations-what-is-pattern:A5', type: 'mcq', taxonomy: 'applying',
        competency: 'Apply: recognize the value of adopting a pattern',
        question: 'A team keeps re-solving the same object-arrangement problem slightly differently across modules. What would adopting a design pattern give them?',
        options: [
          'A shared, named solution shape they can reuse and recognize',
          'Automatically fixed bugs',
          'A smaller compiled binary',
          'Guaranteed thread safety',
        ],
        correctIndex: 0,
      },
    ],
    B: [
      {
        id: 'foundations-what-is-pattern:B1', type: 'mcq', taxonomy: 'remembering',
        competency: 'Recall the definition of a design pattern',
        question: "Which best identifies what the term 'design pattern' refers to?",
        options: [
          'A debugger feature',
          'A reusable, named template for solving a common design problem',
          'A class that stores global state',
          'A kind of loop',
        ],
        correctIndex: 1,
      },
      {
        id: 'foundations-what-is-pattern:B2', type: 'mcq', taxonomy: 'remembering',
        competency: 'Recall what a pattern captures',
        question: 'A design pattern is best described as ___.',
        options: [
          'a syntax rule',
          'a memory-allocation strategy',
          'a build script',
          'a recurring solution structure with a known intent',
        ],
        correctIndex: 3,
      },
      {
        id: 'foundations-what-is-pattern:B3', type: 'mcq', taxonomy: 'understanding',
        competency: 'Explain why shared pattern names help a team',
        question: 'What is the main communication benefit of pattern names on a team?',
        options: [
          'A recognized shape can replace a paragraph of explanation',
          'They eliminate the need for testing',
          'They force everyone to use inheritance',
          'They hide the code from reviewers',
        ],
        correctIndex: 0,
      },
      {
        id: 'foundations-what-is-pattern:B4', type: 'mcq', taxonomy: 'understanding',
        competency: 'Distinguish a pattern from a data structure',
        question: 'Which statement correctly contrasts a pattern with a data structure?',
        options: [
          'They are the same thing',
          'A data structure is always a pattern',
          'A pattern arranges classes/responsibilities for a design problem; a data structure organizes data for access',
          'A pattern can be used only once',
        ],
        correctIndex: 2,
      },
      {
        id: 'foundations-what-is-pattern:B5', type: 'mcq', taxonomy: 'applying',
        competency: 'Apply: recognize the value of adopting a pattern',
        question: 'Two teams independently arrive at the same class arrangement for the same problem. Recognizing this as a known pattern most directly helps them ___.',
        options: [
          'reduce CPU usage',
          'share vocabulary and reuse a proven solution',
          'avoid writing any classes',
          'skip code review',
        ],
        correctIndex: 1,
      },
    ],
  },

  // ---- Design-pattern pilot: Remembering / Understanding / Applying / Analyzing / Evaluating ----
  // Creating stays in the Builder practical/Studio task (module.practicalExam).
  // Applying/Analyzing/Evaluating scenarios NEVER name "Builder".
  'creational-builder': {
    A: [
      {
        id: 'creational-builder:A1', type: 'mcq', taxonomy: 'remembering',
        competency: 'Recall the intent of Builder',
        question: 'What is the primary intent of the Builder pattern?',
        options: [
          'Separate the construction of a complex object from its representation, so the same process can create different representations',
          'Ensure a class has only one instance',
          'Convert one interface into another',
          'Notify dependents when state changes',
        ],
        correctIndex: 0,
      },
      {
        id: 'creational-builder:A2', type: 'mcq', taxonomy: 'understanding',
        competency: 'Explain how Builder organizes construction',
        question: 'How does the Builder pattern typically organize object construction?',
        options: [
          'By making all fields public and setting them directly',
          'By using a single giant constructor with many parameters',
          'Through a sequence of step methods that assemble parts, then a final build step',
          'By cloning an existing instance',
        ],
        correctIndex: 2,
      },
      {
        id: 'creational-builder:A3', type: 'mcq', taxonomy: 'applying',
        competency: 'Apply: select the pattern for a construction requirement',
        question: 'A system must assemble configuration objects through a series of optional, ordered steps and produce several different final representations from the same steps. Which pattern best fits?',
        options: ['Singleton', 'Builder', 'Adapter', 'Observer'],
        correctIndex: 1,
      },
      {
        id: 'creational-builder:A4', type: 'mcq', taxonomy: 'analyzing',
        competency: 'Analyze: identify the pattern from code structure',
        question: 'A class exposes addPart()/setX() methods that each return the same object, plus a final build() that returns the assembled product; no part is exposed until build(). Which pattern does this structure indicate?',
        options: ['Prototype', 'Facade', 'Composite', 'Builder'],
        correctIndex: 3,
      },
      {
        id: 'creational-builder:A5', type: 'mcq', taxonomy: 'evaluating',
        competency: 'Evaluate: choose between approaches under constraints',
        question: 'An object has many optional parameters and must remain immutable after creation. Which is more appropriate, and why — a step-based assembler that returns a finished product, or a telescoping set of constructors?',
        options: [
          'The step-based assembler — it handles optional parameters cleanly and yields an immutable result',
          'Telescoping constructors — they are always clearer',
          'Neither; expose public setters instead',
          'A single global instance',
        ],
        correctIndex: 0,
      },
    ],
    B: [
      {
        id: 'creational-builder:B1', type: 'mcq', taxonomy: 'remembering',
        competency: 'Recall the intent of Builder',
        question: 'The Builder pattern is mainly used to ___.',
        options: [
          'guarantee a single instance',
          'construct a complex object step by step, allowing different final representations',
          'wrap an incompatible interface',
          'define a family of related products',
        ],
        correctIndex: 1,
      },
      {
        id: 'creational-builder:B2', type: 'mcq', taxonomy: 'understanding',
        competency: 'Explain how Builder organizes construction',
        question: 'Why does Builder separate a step sequence from the part-assembly?',
        options: [
          'To make the object a singleton',
          'To avoid writing any classes',
          'To convert interfaces',
          'So the same construction sequence can yield different representations while construction details stay encapsulated',
        ],
        correctIndex: 3,
      },
      {
        id: 'creational-builder:B3', type: 'mcq', taxonomy: 'applying',
        competency: 'Apply: select the pattern for a construction requirement',
        question: 'A report generator must build documents through configurable, ordered steps and emit them as PDF or HTML from the same steps. Which pattern is most appropriate?',
        options: ['Strategy', 'Proxy', 'Builder', 'Flyweight'],
        correctIndex: 2,
      },
      {
        id: 'creational-builder:B4', type: 'mcq', taxonomy: 'analyzing',
        competency: 'Analyze: identify the pattern from code structure',
        question: 'You see a fluent class whose methods return *this to chain calls and a terminal build() that produces the final object only at the end. Which pattern is this structural evidence of?',
        options: ['Builder', 'Decorator', 'State', 'Mediator'],
        correctIndex: 0,
      },
      {
        id: 'creational-builder:B5', type: 'mcq', taxonomy: 'evaluating',
        competency: 'Evaluate: choose between approaches under constraints',
        question: 'A complex object needs many optional fields and must be validated once, fully assembled. Which approach better meets "assemble incrementally, validate on completion" — a step assembler with a final build, or setting fields directly after construction?',
        options: [
          'Direct field setting after construction',
          'A step assembler with a final build/validate step',
          'A global mutable instance',
          'Cloning a prototype each time',
        ],
        correctIndex: 1,
      },
    ],
  },
};
