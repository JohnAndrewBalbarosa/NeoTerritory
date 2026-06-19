// Authored Foundation formal Form A/B objective items.
//
// Foundation modules are conceptual: they use only the applicable lower Bloom
// levels (Remember / Understand, occasionally Apply) — they are NOT padded to
// six levels, and they have no Create practical task. Form A (pre-test) and
// Form B (post-test) are parallel: same competency + Bloom level, distinct
// wording/scenario, no shared correct text. All newly authored items are
// validationStatus: 'draft' (no qualified-reviewer validation yet).

import type { ObjectiveAssessmentQuestion } from '../learningModules';

type Form = ReadonlyArray<ObjectiveAssessmentQuestion>;

const SRC_FOUNDATION = 'CodiNeo Foundations module content';
const SRC_GOF = 'Gamma, Helm, Johnson, Vlissides (1994), Design Patterns, ch. 1';

// ---- foundations-why-matters : Why design patterns matter (Remember/Understand) ----
const whyMattersA: Form = [
  {
    id: 'foundations-why-matters:A1', form: 'A', pairedQuestionId: 'foundations-why-matters:B1',
    type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'why-patterns-matter', difficulty: 'easy',
    question: 'What is the main practical benefit of a shared design-pattern vocabulary on a team?',
    options: [
      'It lets a recognised name stand in for a paragraph of structural explanation',
      'It makes the compiled program run faster',
      'It removes the need for any code comments',
      'It guarantees the code has no bugs',
    ],
    correctIndex: 0,
    rationale: 'Pattern names are a communication tool: one agreed term conveys a known structure and intent, shortening design discussion and review. They do not affect runtime speed or correctness.',
    sourceReferences: [SRC_FOUNDATION, SRC_GOF],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-why-matters:A2', form: 'A', pairedQuestionId: 'foundations-why-matters:B2',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'why-patterns-matter', difficulty: 'moderate',
    question: 'Why does recognising a pattern in existing code help a reviewer?',
    options: [
      'It proves the code is the fastest possible implementation',
      'It lets the reviewer infer intent and expected structure quickly, focusing review on real risks',
      'It means the code needs no tests',
      'It shows the author used the newest language features',
    ],
    correctIndex: 1,
    rationale: 'Recognising intent lets the reviewer reason about responsibilities and collaborations instead of re-deriving them, so attention goes to genuine risks. It says nothing about speed, tests, or language features.',
    sourceReferences: [SRC_FOUNDATION],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-why-matters:A3', form: 'A', pairedQuestionId: 'foundations-why-matters:B3',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'why-patterns-matter', difficulty: 'moderate',
    question: 'Which statement best explains a limitation of patterns?',
    options: [
      'A pattern guarantees the design is correct for every problem',
      'Patterns can only be used in object-oriented languages',
      'Applying a pattern where it is not needed can add complexity without benefit',
      'Patterns make code impossible to refactor later',
    ],
    correctIndex: 2,
    rationale: 'Patterns are solutions to specific recurring problems; forcing one where the problem is absent adds indirection and complexity for no gain. They are not universally correct, are not OO-exclusive, and do not block refactoring.',
    sourceReferences: [SRC_FOUNDATION, SRC_GOF],
    validationStatus: 'draft',
  },
];
const whyMattersB: Form = [
  {
    id: 'foundations-why-matters:B1', form: 'B', pairedQuestionId: 'foundations-why-matters:A1',
    type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'why-patterns-matter', difficulty: 'easy',
    question: 'Two engineers say “let’s use the Observer here.” What has the pattern name primarily given them?',
    options: [
      'A faster program at runtime',
      'A guarantee the feature is bug-free',
      'A way to skip writing the class entirely',
      'A shared, compact way to communicate a known structure and intent',
    ],
    correctIndex: 3,
    rationale: 'The value is communication: the name conveys an agreed structure/intent so the team need not spell it out. It does not change runtime behaviour, remove bugs, or avoid implementation.',
    sourceReferences: [SRC_FOUNDATION, SRC_GOF],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-why-matters:B2', form: 'B', pairedQuestionId: 'foundations-why-matters:A2',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'why-patterns-matter', difficulty: 'moderate',
    question: 'A new hire reads a module and recognises a familiar pattern. How does that most help them?',
    options: [
      'They can predict the responsibilities and collaborations without re-reading every line',
      'They no longer need to run the test suite',
      'They can be sure it is the most efficient code possible',
      'They know it uses the latest standard-library features',
    ],
    correctIndex: 0,
    rationale: 'Recognition transfers prior knowledge of the pattern’s roles and interactions, speeding comprehension. It does not imply optimal performance, remove the need for tests, or indicate language features.',
    sourceReferences: [SRC_FOUNDATION],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-why-matters:B3', form: 'B', pairedQuestionId: 'foundations-why-matters:A3',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'why-patterns-matter', difficulty: 'moderate',
    question: 'When can adopting a design pattern be the wrong choice?',
    options: [
      'When the team already understands the pattern',
      'When the underlying recurring problem the pattern solves is not actually present',
      'Whenever the language supports inheritance',
      'When the code must be unit tested',
    ],
    correctIndex: 1,
    rationale: 'A pattern earns its complexity only when its target problem exists; applying it speculatively adds indirection without benefit. Team familiarity, inheritance support, and testing are not reasons to avoid it.',
    sourceReferences: [SRC_FOUNDATION, SRC_GOF],
    validationStatus: 'draft',
  },
];

// ---- foundations-categories : Three main pattern categories (Remember/Understand) ----
const categoriesA: Form = [
  {
    id: 'foundations-categories:A1', form: 'A', pairedQuestionId: 'foundations-categories:B1',
    type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'pattern-families', difficulty: 'easy',
    question: 'Which trio names the three classic Gang-of-Four pattern families?',
    options: [
      'Compiling, Linking, Running',
      'Frontend, Backend, Database',
      'Creational, Structural, Behavioural',
      'Static, Dynamic, Virtual',
    ],
    correctIndex: 2,
    rationale: 'The GoF families are Creational, Structural, and Behavioural. The other groupings are build phases, app tiers, and binding kinds — not pattern families.',
    sourceReferences: [SRC_GOF],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-categories:A2', form: 'A', pairedQuestionId: 'foundations-categories:B2',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-families', difficulty: 'moderate',
    question: 'A pattern’s main job is deciding HOW objects are created. Which family is it in?',
    options: [
      'Creational',
      'Structural',
      'Behavioural',
      'None — creation is never a pattern concern',
    ],
    correctIndex: 0,
    rationale: 'Creational patterns address object creation/instantiation concerns. Structural deals with composition; Behavioural with communication; creation is squarely a Creational concern.',
    sourceReferences: [SRC_GOF],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-categories:A3', form: 'A', pairedQuestionId: 'foundations-categories:B3',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-families', difficulty: 'moderate',
    question: 'Which sentence correctly maps the three families by intent?',
    options: [
      'Creational connects objects; Structural decides communication; Behavioural makes objects',
      'Creational makes objects; Structural composes/connects them; Behavioural decides how they communicate',
      'All three families do the same thing under different names',
      'Structural is a special case of Creational',
    ],
    correctIndex: 1,
    rationale: 'Creational = how objects are made; Structural = how they are composed/related; Behavioural = how responsibilities/communication are organised. The other options swap or conflate these intents.',
    sourceReferences: [SRC_GOF],
    validationStatus: 'draft',
  },
];
const categoriesB: Form = [
  {
    id: 'foundations-categories:B1', form: 'B', pairedQuestionId: 'foundations-categories:A1',
    type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'pattern-families', difficulty: 'easy',
    question: 'The Gang-of-Four catalogue groups patterns into three families. Which option lists them?',
    options: [
      'Behavioural, Structural, Creational',
      'Public, Private, Protected',
      'Stack, Heap, Register',
      'Model, View, Controller',
    ],
    correctIndex: 0,
    rationale: 'The three GoF families are Creational, Structural, and Behavioural (order aside). Access specifiers, memory regions, and MVC are unrelated groupings.',
    sourceReferences: [SRC_GOF],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-categories:B2', form: 'B', pairedQuestionId: 'foundations-categories:A2',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-families', difficulty: 'moderate',
    question: 'A pattern primarily organises how responsibilities are assigned and how objects talk at runtime. Which family?',
    options: [
      'Creational',
      'Structural',
      'Behavioural',
      'None — communication is not a pattern concern',
    ],
    correctIndex: 2,
    rationale: 'Behavioural patterns concern responsibility assignment and runtime communication between objects. Creational is about making objects; Structural about composing them.',
    sourceReferences: [SRC_GOF],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-categories:B3', form: 'B', pairedQuestionId: 'foundations-categories:A3',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'pattern-families', difficulty: 'moderate',
    question: 'Which mapping of family-to-intent is correct?',
    options: [
      'Structural makes objects; Behavioural composes them; Creational handles communication',
      'All families address object creation only',
      'Behavioural is a subset of Structural',
      'Creational = object creation; Structural = composition/relationships; Behavioural = communication/responsibility',
    ],
    correctIndex: 3,
    rationale: 'Only the last option maps each family to its real intent. The others swap intents, over-narrow to creation, or invent a subset relationship.',
    sourceReferences: [SRC_GOF],
    validationStatus: 'draft',
  },
];

// ---- foundations-oop : OOP foundations (Remember/Understand) ----
const oopA: Form = [
  {
    id: 'foundations-oop:A1', form: 'A', pairedQuestionId: 'foundations-oop:B1',
    type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'oop-foundations', difficulty: 'easy',
    question: 'Which OOP mechanism lets one interface call be served by different concrete implementations at runtime?',
    options: [
      'Encapsulation',
      'Polymorphism',
      'Macro expansion',
      'Static linking',
    ],
    correctIndex: 1,
    rationale: 'Polymorphism (via virtual dispatch) lets a call through a base interface run different concrete behaviour. Encapsulation hides state; macros and linking are unrelated build-time mechanisms.',
    sourceReferences: [SRC_FOUNDATION],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-oop:A2', form: 'A', pairedQuestionId: 'foundations-oop:B2',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'oop-foundations', difficulty: 'moderate',
    question: 'Why do many design patterns depend on programming to an interface (abstraction) rather than a concrete class?',
    options: [
      'It lets implementations vary independently of the code that uses them',
      'It always reduces the number of classes',
      'It makes the program use less memory',
      'It removes the need for constructors',
    ],
    correctIndex: 0,
    rationale: 'Depending on an abstraction decouples clients from concrete types, so implementations can change/substitute without touching callers — the basis of many patterns. It does not inherently reduce classes/memory or remove constructors.',
    sourceReferences: [SRC_FOUNDATION, SRC_GOF],
    validationStatus: 'draft',
  },
];
const oopB: Form = [
  {
    id: 'foundations-oop:B1', form: 'B', pairedQuestionId: 'foundations-oop:A1',
    type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember', competencyId: 'oop-foundations', difficulty: 'easy',
    question: 'A base-class pointer invokes a method and the derived class’s version runs. Which OOP concept is this?',
    options: [
      'Static binding',
      'Encapsulation',
      'Polymorphism',
      'Preprocessing',
    ],
    correctIndex: 2,
    rationale: 'Dispatching to the derived override through a base pointer is runtime polymorphism. Static binding resolves at compile time; encapsulation and preprocessing are different concepts.',
    sourceReferences: [SRC_FOUNDATION],
    validationStatus: 'draft',
  },
  {
    id: 'foundations-oop:B2', form: 'B', pairedQuestionId: 'foundations-oop:A2',
    type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand', competencyId: 'oop-foundations', difficulty: 'moderate',
    question: 'What does depending on an abstraction (interface) buy a design that depending on a concrete class does not?',
    options: [
      'Guaranteed lower memory use',
      'Substitutable implementations without changing client code',
      'Fewer total source files in every case',
      'Automatic thread safety',
    ],
    correctIndex: 1,
    rationale: 'An interface dependency lets concrete implementations be swapped without editing clients — enabling extension and testing. It gives no memory, file-count, or thread-safety guarantee.',
    sourceReferences: [SRC_FOUNDATION, SRC_GOF],
    validationStatus: 'draft',
  },
];

// Foundation forms keyed by moduleId; merged into ASSESSMENT_FORMS.
export const FOUNDATION_ASSESSMENT_FORMS: Record<string, { A: Form; B: Form }> = {
  'foundations-why-matters': { A: whyMattersA, B: whyMattersB },
  'foundations-categories': { A: categoriesA, B: categoriesB },
  'foundations-oop': { A: oopA, B: oopB },
};
