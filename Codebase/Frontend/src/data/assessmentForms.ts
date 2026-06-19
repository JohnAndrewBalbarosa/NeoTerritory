// Formal-assessment objective forms (separate from the in-module theoreticalExam
// array, which is left untouched for mastery retries + practice analytics).
//
//   Form A  -> formal pre-test
//   Form B  -> formal post-test (distinct but equivalent items; zero overlap)
//   Creating -> stays in the practical / Studio activity, never here.
//
// Every item carries a STABLE id (e.g. 'creational-builder:A3'); the formal
// assessment is keyed by id, not by the in-module positional questionIndex.
// Correct-answer positions are deliberately spread across options.

import type { ObjectiveAssessmentQuestion } from './learningModules';
import { FOUNDATION_ASSESSMENT_FORMS } from './assessmentBanks/foundations';
import { CREATIONAL_ASSESSMENT_FORMS } from './assessmentBanks/creational';
import { STRUCTURAL_ASSESSMENT_FORMS } from './assessmentBanks/structural';
import { BEHAVIOURAL_ASSESSMENT_FORMS } from './assessmentBanks/behavioural';
import { IDIOM_ASSESSMENT_FORMS } from './assessmentBanks/idioms';

export type AssessmentFormsData = {
  A: ReadonlyArray<ObjectiveAssessmentQuestion>;
  B: ReadonlyArray<ObjectiveAssessmentQuestion>;
};

const SRC_FOUNDATION = ['CodiNeo Foundations module content', 'Gamma, Helm, Johnson, Vlissides (1994), Design Patterns, ch. 1'];
const SRC_BUILDER = ['Gamma et al. (1994), Design Patterns — Builder', 'Nesteruk (2022), Design Patterns in Modern C++ — Builder'];

export const ASSESSMENT_FORMS: Record<string, AssessmentFormsData> = {
  // Authored Foundation category banks (Form A/B) are merged in below the pilots.
  ...FOUNDATION_ASSESSMENT_FORMS,
  // Authored Creational category banks (Form A/B). creational-builder is the
  // pilot defined later in this file and is intentionally NOT in this spread.
  ...CREATIONAL_ASSESSMENT_FORMS,
  // Authored Structural category banks (Form A/B). structural-repository is a
  // non-GoF enterprise pattern assessed conceptually (no practical / detector).
  ...STRUCTURAL_ASSESSMENT_FORMS,
  // Authored Behavioural category banks (Form A/B).
  ...BEHAVIOURAL_ASSESSMENT_FORMS,
  // Authored Idiom category banks (Form A/B). PIMPL is a C++ idiom, not GoF.
  ...IDIOM_ASSESSMENT_FORMS,

  // ---- Foundation pilot: applicable levels Remember / Understand / Apply ----
  'foundations-what-is-pattern': {
    A: [
      {
        id: 'foundations-what-is-pattern:A1', form: 'A', pairedQuestionId: 'foundations-what-is-pattern:B1',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'pattern-definition', difficulty: 'easy',
        competency: 'Recall the definition of a design pattern',
        question: 'What is a design pattern, most precisely?',
        options: [
          'A named, reusable solution to a recurring object-oriented design problem',
          'A language keyword that enables polymorphism',
          'A base class that every program must extend',
          'A tool that automatically formats source code',
        ],
        correctIndex: 0,
        rationale: 'A design pattern is a named, reusable solution to a recurring OO design problem. It is not a language keyword, a mandatory base class, or a formatting tool.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:A2', form: 'A', pairedQuestionId: 'foundations-what-is-pattern:B2',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'pattern-captures', difficulty: 'easy',
        competency: 'Recall what a pattern captures',
        question: 'A design pattern primarily captures which of the following?',
        options: [
          'A compiler optimization flag',
          'A file-naming convention',
          'A proven structure-and-intent for a recurring design problem',
          'A unit-test framework',
        ],
        correctIndex: 2,
        rationale: 'A pattern captures a proven structure and intent for a recurring problem — not a compiler flag, a naming convention, or a testing framework.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:A3', form: 'A', pairedQuestionId: 'foundations-what-is-pattern:B3',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-value-communication', difficulty: 'moderate',
        competency: 'Explain why shared pattern names help a team',
        question: 'Why does giving a recurring design a shared name help a team?',
        options: [
          'It makes the program run faster',
          'One word can convey a whole structure and intent, reducing explanation',
          'It removes the need for any comments',
          'It guarantees the code compiles',
        ],
        correctIndex: 1,
        rationale: 'A shared name lets one term convey a whole structure/intent, shortening communication. It has no effect on runtime speed, comments, or compilation.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:A4', form: 'A', pairedQuestionId: 'foundations-what-is-pattern:B4',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-vs-other-concepts', difficulty: 'moderate',
        competency: 'Distinguish a design pattern from another software concept',
        question: 'How does a design pattern differ from an algorithm?',
        options: [
          'They are identical',
          'An algorithm is always object-oriented; a pattern never is',
          'A pattern is just a faster algorithm',
          'A pattern arranges classes/objects for a design problem; an algorithm specifies computational steps',
        ],
        correctIndex: 3,
        rationale: 'A pattern arranges classes/objects to solve a design problem; an algorithm specifies computational steps. They are not identical, and neither is OO-exclusive.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:A5', form: 'A', pairedQuestionId: 'foundations-what-is-pattern:B5',
        type: 'mcq', taxonomy: 'applying', bloomLevel: 'apply', competencyId: 'pattern-adoption-value', difficulty: 'moderate',
        competency: 'Apply: recognize the value of adopting a pattern',
        question: 'A team keeps re-solving the same object-arrangement problem slightly differently across modules. What would adopting a design pattern give them?',
        options: [
          'A shared, named solution shape they can reuse and recognize',
          'Automatically fixed bugs',
          'A smaller compiled binary',
          'Guaranteed thread safety',
        ],
        correctIndex: 0,
        rationale: 'Adopting a pattern gives a shared, reusable, recognizable solution shape. It does not auto-fix bugs, shrink the binary, or guarantee thread safety.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
    ],
    B: [
      {
        id: 'foundations-what-is-pattern:B1', form: 'B', pairedQuestionId: 'foundations-what-is-pattern:A1',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'pattern-definition', difficulty: 'easy',
        competency: 'Recall the definition of a design pattern',
        question: "Which best identifies what the term 'design pattern' refers to?",
        options: [
          'A debugger feature',
          'A reusable, named template for solving a common design problem',
          'A class that stores global state',
          'A kind of loop',
        ],
        correctIndex: 1,
        rationale: "A design pattern is a reusable, named template for a common design problem — not a debugger feature, a global-state class, or a loop.",
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:B2', form: 'B', pairedQuestionId: 'foundations-what-is-pattern:A2',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'pattern-captures', difficulty: 'easy',
        competency: 'Recall what a pattern captures',
        question: 'A design pattern is best described as ___.',
        options: [
          'a syntax rule',
          'a memory-allocation strategy',
          'a build script',
          'a recurring solution structure with a known intent',
        ],
        correctIndex: 3,
        rationale: 'A pattern is a recurring solution structure with a known intent — not a syntax rule, an allocation strategy, or a build script.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:B3', form: 'B', pairedQuestionId: 'foundations-what-is-pattern:A3',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-value-communication', difficulty: 'moderate',
        competency: 'Explain why shared pattern names help a team',
        question: 'What is the main communication benefit of pattern names on a team?',
        options: [
          'A recognized shape can replace a paragraph of explanation',
          'They eliminate the need for testing',
          'They force everyone to use inheritance',
          'They hide the code from reviewers',
        ],
        correctIndex: 0,
        rationale: 'The benefit is communication: a recognized shape replaces a paragraph of explanation. It does not remove testing, force inheritance, or hide code.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:B4', form: 'B', pairedQuestionId: 'foundations-what-is-pattern:A4',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-vs-other-concepts', difficulty: 'moderate',
        competency: 'Distinguish a design pattern from another software concept',
        question: 'Which statement correctly contrasts a pattern with a data structure?',
        options: [
          'They are the same thing',
          'A data structure is always a pattern',
          'A pattern arranges classes/responsibilities for a design problem; a data structure organizes data for access',
          'A pattern can be used only once',
        ],
        correctIndex: 2,
        rationale: 'A pattern arranges classes/responsibilities for a design problem; a data structure organizes data for access/storage. They are not the same, and a pattern is reusable.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'foundations-what-is-pattern:B5', form: 'B', pairedQuestionId: 'foundations-what-is-pattern:A5',
        type: 'mcq', taxonomy: 'applying', bloomLevel: 'apply', competencyId: 'pattern-adoption-value', difficulty: 'moderate',
        competency: 'Apply: recognize the value of adopting a pattern',
        question: 'Two teams independently arrive at the same class arrangement for the same problem. Recognizing this as a known pattern most directly helps them ___.',
        options: [
          'reduce CPU usage',
          'share vocabulary and reuse a proven solution',
          'avoid writing any classes',
          'skip code review',
        ],
        correctIndex: 1,
        rationale: 'Recognising a shared pattern lets the teams share vocabulary and reuse a proven solution. It does not reduce CPU usage, avoid classes, or skip review.',
        sourceReferences: SRC_FOUNDATION, validationStatus: 'pilot-reviewed',
      },
    ],
  },

  // ---- Design-pattern pilot: Remember / Understand / Apply / Analyze / Evaluate ----
  // Creating stays in the Builder practical/Studio task. A/An/E scenarios never name "Builder".
  'creational-builder': {
    A: [
      {
        id: 'creational-builder:A1', form: 'A', pairedQuestionId: 'creational-builder:B1',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'builder-intent', difficulty: 'easy',
        competency: 'Recall the intent of Builder',
        question: 'What is the primary intent of the Builder pattern?',
        options: [
          'Separate the construction of a complex object from its representation, so the same process can create different representations',
          'Ensure a class has only one instance',
          'Convert one interface into another',
          'Notify dependents when state changes',
        ],
        correctIndex: 0,
        rationale: 'Builder separates constructing a complex object from its representation so one process can yield different representations. The distractors describe Singleton, Adapter, and Observer.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:A2', form: 'A', pairedQuestionId: 'creational-builder:B2',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'builder-construction-organization', difficulty: 'moderate',
        competency: 'Explain how Builder organizes construction',
        question: 'How does the Builder pattern typically organize object construction?',
        options: [
          'By making all fields public and setting them directly',
          'By using a single giant constructor with many parameters',
          'Through a sequence of step methods that assemble parts, then a final build step',
          'By cloning an existing instance',
        ],
        correctIndex: 2,
        rationale: 'Builder assembles parts via step methods then a final build step, avoiding public mutable fields, telescoping constructors, and cloning.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:A3', form: 'A', pairedQuestionId: 'creational-builder:B3',
        type: 'mcq', taxonomy: 'applying', bloomLevel: 'apply', competencyId: 'builder-select-for-requirement', difficulty: 'moderate',
        competency: 'Apply: select the pattern for a construction requirement',
        question: 'A system must assemble configuration objects through a series of optional, ordered steps and produce several different final representations from the same steps. Which pattern best fits?',
        options: ['Singleton', 'Builder', 'Adapter', 'Observer'],
        correctIndex: 1,
        rationale: 'Optional, ordered steps producing different final representations is Builder’s core use case; Singleton, Adapter, and Observer solve unrelated problems.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:A4', form: 'A', pairedQuestionId: 'creational-builder:B4',
        type: 'mcq', taxonomy: 'analyzing', bloomLevel: 'analyze', competencyId: 'builder-identify-from-structure', difficulty: 'difficult',
        competency: 'Analyze: identify the pattern from code structure',
        question: 'A class exposes addPart()/setX() methods that each return the same object, plus a final build() that returns the assembled product; no part is exposed until build(). Which pattern does this structure indicate?',
        options: ['Prototype', 'Facade', 'Composite', 'Builder'],
        correctIndex: 3,
        rationale: 'Chained part-adding methods returning the same object plus a terminal build() that first exposes the product is Builder’s structural signature.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:A5', form: 'A', pairedQuestionId: 'creational-builder:B5',
        type: 'mcq', taxonomy: 'evaluating', bloomLevel: 'evaluate', competencyId: 'builder-evaluate-tradeoff', difficulty: 'difficult',
        competency: 'Evaluate: choose between approaches under constraints',
        question: 'An object has many optional parameters and must remain immutable after creation. Which is more appropriate, and why — a step-based assembler that returns a finished product, or a telescoping set of constructors?',
        options: [
          'The step-based assembler — it handles optional parameters cleanly and yields an immutable result',
          'Telescoping constructors — they are always clearer',
          'Neither; expose public setters instead',
          'A single global instance',
        ],
        correctIndex: 0,
        rationale: 'For many optional parameters plus immutability, a step assembler returning a finished product is clearest and preserves immutability; telescoping constructors and setters do not.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
    ],
    B: [
      {
        id: 'creational-builder:B1', form: 'B', pairedQuestionId: 'creational-builder:A1',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'builder-intent', difficulty: 'easy',
        competency: 'Recall the intent of Builder',
        question: 'The Builder pattern is mainly used to ___.',
        options: [
          'guarantee a single instance',
          'construct a complex object step by step, allowing different final representations',
          'wrap an incompatible interface',
          'define a family of related products',
        ],
        correctIndex: 1,
        rationale: 'Builder constructs a complex object step by step, allowing different representations. The distractors describe Singleton, Adapter, and Abstract Factory.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:B2', form: 'B', pairedQuestionId: 'creational-builder:A2',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'builder-construction-organization', difficulty: 'moderate',
        competency: 'Explain how Builder organizes construction',
        question: 'Why does Builder separate a step sequence from the part-assembly?',
        options: [
          'To make the object a singleton',
          'To avoid writing any classes',
          'To convert interfaces',
          'So the same construction sequence can yield different representations while construction details stay encapsulated',
        ],
        correctIndex: 3,
        rationale: 'Separating the step sequence from assembly lets one sequence yield different representations while hiding construction details — Builder’s rationale.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:B3', form: 'B', pairedQuestionId: 'creational-builder:A3',
        type: 'mcq', taxonomy: 'applying', bloomLevel: 'apply', competencyId: 'builder-select-for-requirement', difficulty: 'moderate',
        question: 'A report generator must build documents through configurable, ordered steps and emit them as PDF or HTML from the same steps. Which pattern is most appropriate?',
        competency: 'Apply: select the pattern for a construction requirement',
        options: ['Strategy', 'Proxy', 'Builder', 'Flyweight'],
        correctIndex: 2,
        rationale: 'Configurable ordered steps emitting PDF or HTML from one process is Builder; Strategy, Proxy, and Flyweight address different concerns.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:B4', form: 'B', pairedQuestionId: 'creational-builder:A4',
        type: 'mcq', taxonomy: 'analyzing', bloomLevel: 'analyze', competencyId: 'builder-identify-from-structure', difficulty: 'difficult',
        competency: 'Analyze: identify the pattern from code structure',
        question: 'You see a fluent class whose methods return *this to chain calls and a terminal build() that produces the final object only at the end. Which pattern is this structural evidence of?',
        options: ['Builder', 'Decorator', 'State', 'Mediator'],
        correctIndex: 0,
        rationale: 'A fluent class returning *this to chain calls with a terminal build() is structural evidence of Builder; the distractors have different shapes.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
      {
        id: 'creational-builder:B5', form: 'B', pairedQuestionId: 'creational-builder:A5',
        type: 'mcq', taxonomy: 'evaluating', bloomLevel: 'evaluate', competencyId: 'builder-evaluate-tradeoff', difficulty: 'difficult',
        competency: 'Evaluate: choose between approaches under constraints',
        question: 'A complex object needs many optional fields and must be validated once, fully assembled. Which approach better meets "assemble incrementally, validate on completion" — a step assembler with a final build, or setting fields directly after construction?',
        options: [
          'Direct field setting after construction',
          'A step assembler with a final build/validate step',
          'A global mutable instance',
          'Cloning a prototype each time',
        ],
        correctIndex: 1,
        rationale: 'Incremental assembly with validation on completion is met by a step assembler with a final build/validate step; direct setters, globals, and cloning do not.',
        sourceReferences: SRC_BUILDER, validationStatus: 'pilot-reviewed',
      },
    ],
  },
};
