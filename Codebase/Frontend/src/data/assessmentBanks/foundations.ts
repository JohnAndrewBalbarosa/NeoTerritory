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

// ---- foundations-interface-principle : Program to an interface (R/U/Apply) ----
const mk = (
  id: string, paired: string, taxonomy: 'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating',
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate', competencyId: string, difficulty: 'easy' | 'moderate' | 'difficult',
  question: string, options: [string, string, string, string], correctIndex: 0 | 1 | 2 | 3, rationale: string, sources: ReadonlyArray<string>,
): ObjectiveAssessmentQuestion => ({
  id, form: id.includes(':A') ? 'A' : 'B', pairedQuestionId: paired, type: 'mcq', taxonomy, bloomLevel, competencyId, difficulty,
  question, options, correctIndex, rationale, sourceReferences: sources, validationStatus: 'draft',
});

const CI = 'interface-principle';
const interfaceA: Form = [
  mk('foundations-interface-principle:A1', 'foundations-interface-principle:B1', 'remembering', 'remember', CI, 'easy',
    "What does “program to an interface, not an implementation” mean?",
    ['Always use abstract classes for everything', 'Write all code in header files', 'Depend on a shared abstraction instead of one specific concrete class', 'Avoid interfaces to reduce the file count'], 2,
    'The principle says to depend on a shared abstraction (capability) rather than a specific concrete class. It is not about abstract classes everywhere, header files, or avoiding interfaces.', [SRC_FOUNDATION, SRC_GOF]),
  mk('foundations-interface-principle:A2', 'foundations-interface-principle:B2', 'understanding', 'understand', CI, 'moderate',
    'Why does depending on an abstraction make a system easier to change?',
    ['It always reduces the number of classes', 'Callers are decoupled from concrete types, so implementations can be swapped without editing callers', 'It makes the program run faster', 'It removes the need for tests'], 1,
    'Decoupling callers from concrete types lets implementations be substituted without changing the callers. It does not inherently reduce classes, improve speed, or remove tests.', [SRC_FOUNDATION]),
  mk('foundations-interface-principle:A3', 'foundations-interface-principle:B3', 'applying', 'apply', CI, 'moderate',
    'A team must support several payment providers and switch between them without changing checkout code. Which approach applies the principle?',
    ['Inline every provider into the checkout code', 'Store the active provider in a global variable', 'Hard-code one default provider', 'Have checkout depend on a payment abstraction that each provider implements'], 3,
    'Depending on a payment abstraction implemented by each provider lets checkout stay unchanged while providers vary — the principle in action. The other options couple checkout to concretes.', [SRC_FOUNDATION]),
];
const interfaceB: Form = [
  mk('foundations-interface-principle:B1', 'foundations-interface-principle:A1', 'remembering', 'remember', CI, 'easy',
    '“Program to an interface” tells you to depend on ___.',
    ['a shared abstraction rather than a specific concrete class', 'the most-derived class available', 'only static free functions', 'the standard library'], 0,
    'The rule is to depend on a shared abstraction rather than a specific concrete class. The other options misstate it.', [SRC_FOUNDATION, SRC_GOF]),
  mk('foundations-interface-principle:B2', 'foundations-interface-principle:A2', 'understanding', 'understand', CI, 'moderate',
    'A module depends on an abstraction rather than a concrete class. What does this most enable?',
    ['Guaranteed lower memory use', 'Fewer source files in all cases', 'The ability to substitute implementations without changing the dependent module', 'Automatic multithreading'], 2,
    'An abstraction dependency enables substituting implementations without editing the dependent module. It gives no memory, file-count, or threading guarantee.', [SRC_FOUNDATION]),
  mk('foundations-interface-principle:B3', 'foundations-interface-principle:A3', 'applying', 'apply', CI, 'moderate',
    'A logging component must write to console, file, or network sinks chosen at runtime without changing callers. Which approach applies the principle?',
    ['Duplicate the logger for each sink', 'Depend on a sink abstraction that each backend implements', 'Put a large switch statement in every caller', 'Make every sink a global object'], 1,
    'Depending on a sink abstraction implemented by each backend lets the sink vary at runtime without changing callers. The alternatives couple callers to concretes.', [SRC_FOUNDATION]),
];

// ---- foundations-code-structure : Understanding software structure (R/U) ----
const CC = 'code-structure-analysis';
const codeStructureA: Form = [
  mk('foundations-code-structure:A1', 'foundations-code-structure:B1', 'remembering', 'remember', CC, 'easy',
    'What does CodiNeo’s analyser inspect to detect patterns?',
    ['Only the code comments', 'The program’s runtime speed', 'Class relationships and structure via a parse tree (AST)', 'The source file names'], 2,
    'Detection works over class relationships/structure captured in a parse tree (AST), not comments, runtime speed, or file names.', [SRC_FOUNDATION]),
  mk('foundations-code-structure:A2', 'foundations-code-structure:B2', 'understanding', 'understand', CC, 'moderate',
    'Why can patterns be detected from code structure rather than from names?',
    ['Because every pattern class is named after its pattern', 'Because patterns are defined by relationships and responsibilities, not identifiers', 'Because the compiler emits pattern tags', 'Because comments declare the pattern'], 1,
    'Patterns are defined by relationships/responsibilities, so structure is the real evidence; names, compilers, and comments are not reliable signals.', [SRC_FOUNDATION]),
];
const codeStructureB: Form = [
  mk('foundations-code-structure:B1', 'foundations-code-structure:A1', 'remembering', 'remember', CC, 'easy',
    'Which representation lets a tool analyse class relationships and dependencies?',
    ['A rendered screenshot of the code', 'An abstract syntax tree (parse tree) of the source', 'A list of file sizes', 'The commit history'], 1,
    'An abstract syntax tree (parse tree) exposes structure/relationships for analysis; the other options carry no structural information.', [SRC_FOUNDATION]),
  mk('foundations-code-structure:B2', 'foundations-code-structure:A2', 'understanding', 'understand', CC, 'moderate',
    'A class is named “ObserverManager” but never notifies dependents. Why won’t a structure-based analyser tag it as Observer?',
    ['Because the name is misspelled', 'Because Observer must live in its own file', 'Because “Manager” classes can never be patterns', 'Because detection relies on structural evidence, not the class name'], 3,
    'Structure-based detection requires the observer/notify relationship; the name alone is not evidence, so the class is not tagged.', [SRC_FOUNDATION]),
];

// ---- foundations-real-software : Design patterns in real software (R/U) ----
const CR = 'patterns-in-practice';
const realSoftwareA: Form = [
  mk('foundations-real-software:A1', 'foundations-real-software:B1', 'remembering', 'remember', CR, 'easy',
    'Where do design patterns appear?',
    ['Only in textbooks', 'Only in academic exercises', 'In production systems across many industries', 'Only inside compilers'], 2,
    'Patterns appear in real production systems across industries, not only in textbooks or exercises.', [SRC_FOUNDATION]),
  mk('foundations-real-software:A2', 'foundations-real-software:B2', 'understanding', 'understand', CR, 'moderate',
    'Why does it matter to a beginner that patterns appear in real software?',
    ['It means they can skip learning patterns', 'Recognising patterns helps them read and contribute to real codebases sooner', 'It guarantees employment', 'It makes their code run faster'], 1,
    'Recognising patterns speeds reading and contributing to real codebases — the practical payoff. The other options are false.', [SRC_FOUNDATION]),
];
const realSoftwareB: Form = [
  mk('foundations-real-software:B1', 'foundations-real-software:A1', 'remembering', 'remember', CR, 'easy',
    'In industry, design patterns are best described as ___.',
    ['common, reused solutions found in real production systems', 'purely academic curiosities', 'one vendor’s proprietary framework', 'deprecated techniques no longer used'], 0,
    'In practice they are common, reused solutions in real systems; the other options misrepresent their role.', [SRC_FOUNDATION]),
  mk('foundations-real-software:B2', 'foundations-real-software:A2', 'understanding', 'understand', CR, 'moderate',
    'How does pattern familiarity most help a new engineer joining a team?',
    ['They can rewrite the whole system', 'They can skip code review', 'They recognise intent in unfamiliar code faster, easing onboarding', 'They no longer need tests'], 2,
    'Familiarity lets them recognise intent in unfamiliar code, easing onboarding. The other options are not benefits.', [SRC_FOUNDATION]),
];

// ---- foundations-beginner-mistakes : Common beginner mistakes (R/U) ----
const CB = 'pattern-misuse-awareness';
const beginnerA: Form = [
  mk('foundations-beginner-mistakes:A1', 'foundations-beginner-mistakes:B1', 'remembering', 'remember', CB, 'easy',
    'Which is a common beginner mistake with design patterns?',
    ['Reading the catalog carefully', 'Forcing a pattern where the underlying problem does not exist', 'Writing unit tests', 'Using version control'], 1,
    'Over-applying a pattern where its problem is absent is a classic trap; the other options are good practices.', [SRC_FOUNDATION]),
  mk('foundations-beginner-mistakes:A2', 'foundations-beginner-mistakes:B2', 'understanding', 'understand', CB, 'moderate',
    'Why is naming a class after a pattern not evidence the pattern is implemented?',
    ['Because names are case-sensitive', 'Because the pattern must be in a separate file', 'Because a name is only a label; structure and intent determine the pattern', 'Because compilers reject pattern names'], 2,
    'A name is just a label; the pattern exists only if the structure/intent are present. The other options are incorrect.', [SRC_FOUNDATION]),
];
const beginnerB: Form = [
  mk('foundations-beginner-mistakes:B1', 'foundations-beginner-mistakes:A1', 'remembering', 'remember', CB, 'easy',
    'Over-applying design patterns most often leads to ___.',
    ['faster code', 'fewer source files', 'guaranteed correctness', 'unnecessary complexity and indirection'], 3,
    'Forcing patterns adds indirection/complexity without benefit; it does not improve speed, file count, or correctness.', [SRC_FOUNDATION]),
  mk('foundations-beginner-mistakes:B2', 'foundations-beginner-mistakes:A2', 'understanding', 'understand', CB, 'moderate',
    'A learner adds “Factory” to a class name to “use the pattern.” What is the flaw?',
    ['The name should be lowercase', 'Renaming does not create the pattern’s structure or intent', 'Factories must be singletons', 'Patterns cannot be named at all'], 1,
    'Renaming alone does not create the required structure/intent, so the pattern is not implemented. The other options are wrong.', [SRC_FOUNDATION]),
];

// ---- foundations-ambiguity : Ambiguity is built in (R/U/Apply/Analyze/Evaluate) ----
const CA = 'pattern-ambiguity';
const ambiguityA: Form = [
  mk('foundations-ambiguity:A1', 'foundations-ambiguity:B1', 'remembering', 'remember', CA, 'easy',
    'What does this module say about some patterns at the code level?',
    ['All patterns look unique in code', 'Some patterns look almost identical in structure', 'Patterns never share code shapes', 'Ambiguity is always a defect'], 1,
    'Some patterns share nearly identical structure (e.g., Builder vs Method Chaining), so ambiguity is inherent — not a defect.', [SRC_FOUNDATION]),
  mk('foundations-ambiguity:A2', 'foundations-ambiguity:B2', 'understanding', 'understand', CA, 'moderate',
    'Why do Builder and Method Chaining look similar in code?',
    ['Both are creational only', 'Both rely on inheritance', 'Both use fluent method chaining (return *this)', 'Both are singletons'], 2,
    'Both express a fluent interface returning *this, so their surface code looks alike though their intent differs.', [SRC_FOUNDATION]),
  mk('foundations-ambiguity:A3', 'foundations-ambiguity:B3', 'applying', 'apply', CA, 'moderate',
    'Two classes each hold a member of the same interface and forward calls to it. To tell which pattern, you should examine ___.',
    ['the file size', 'the intent — e.g. controlling access vs adding behaviour vs adapting an interface', 'only the variable names', 'the compiler output'], 1,
    'Wrappers that forward to a same-interface member are distinguished by intent (control access vs add behaviour vs adapt), not by size, names, or compiler output.', [SRC_FOUNDATION, SRC_GOF]),
  mk('foundations-ambiguity:A4', 'foundations-ambiguity:B4', 'understanding', 'understand', CA, 'difficult',
    'Adapter, Decorator, and Proxy all wrap a held member. Which cue best separates Proxy from Decorator?',
    ['Proxy adds new responsibilities while Decorator restricts access', 'They cannot be distinguished', 'Proxy controls access to a same-interface subject; Decorator augments behaviour through the same interface', 'A Proxy must be abstract'], 2,
    'Proxy’s intent is controlling access to the subject (same interface); Decorator’s intent is augmenting behaviour. That intent difference is the cue.', [SRC_GOF]),
  mk('foundations-ambiguity:A5', 'foundations-ambiguity:B5', 'evaluating', 'evaluate', CA, 'difficult',
    'Given two near-identical implementations, which is the most defensible way to resolve the pattern?',
    ['Pick whichever name sounds best', 'Always choose Decorator', 'Flip a coin', 'Resolve by the intent shown in naming, collaborators, and call-site shape'], 3,
    'The defensible method weighs intent evidence (lexemes, collaborators, call-site shape) rather than guessing or defaulting.', [SRC_FOUNDATION]),
];
const ambiguityB: Form = [
  mk('foundations-ambiguity:B1', 'foundations-ambiguity:A1', 'remembering', 'remember', CA, 'easy',
    'Which statement reflects this module’s honest claim?',
    ['Structural ambiguity between some patterns is inherent', 'Every pattern is structurally unique', 'Ambiguity means the code is wrong', 'Patterns are never similar'], 0,
    'The module’s claim is that structural ambiguity between some patterns is inherent, not a sign of error.', [SRC_FOUNDATION]),
  mk('foundations-ambiguity:B2', 'foundations-ambiguity:A2', 'understanding', 'understand', CA, 'moderate',
    'Why can two patterns share the same class diagram?',
    ['Because diagrams are always inaccurate', 'Because structure alone does not capture intent, which differs', 'Because they are the same pattern', 'Because UML forbids uniqueness'], 1,
    'A class diagram shows structure but not intent; two patterns with the same structure differ in purpose.', [SRC_FOUNDATION]),
  mk('foundations-ambiguity:B3', 'foundations-ambiguity:A3', 'applying', 'apply', CA, 'moderate',
    'A class implements an interface, holds a same-interface member, forwards calls, and adds logging around them. Which intent is most likely?',
    ['Adapting an incompatible interface', 'Ensuring a single instance', 'Adding behaviour transparently (decoration)', 'Creating families of related products'], 2,
    'Forwarding through the same interface while adding behaviour (logging) signals Decorator intent, not adaptation, singleton, or factory.', [SRC_GOF]),
  mk('foundations-ambiguity:B4', 'foundations-ambiguity:A4', 'understanding', 'understand', CA, 'difficult',
    'What evidence best distinguishes Adapter from Decorator?',
    ['They are identical', 'Adapter targets a different/incompatible interface; Decorator keeps the same interface and adds behaviour', 'Decorator changes the interface', 'Adapter exists to add logging'], 1,
    'Adapter converts to a different/incompatible interface; Decorator keeps the same interface and augments behaviour — the defining difference.', [SRC_GOF]),
  mk('foundations-ambiguity:B5', 'foundations-ambiguity:A5', 'evaluating', 'evaluate', CA, 'difficult',
    'Which approach to resolving a near-tie between two patterns is most academically defensible?',
    ['Guess from the class name', 'Always pick the first catalog match', 'Ignore the tie entirely', 'Weigh intent signals and accept genuine ambiguity rather than forcing a single label'], 3,
    'Weighing intent signals and acknowledging genuine ambiguity is defensible; guessing, defaulting, or ignoring the tie is not.', [SRC_FOUNDATION]),
];

// ---- foundations-connotative-definition : The connotative-definition rule (R/U) ----
const CD = 'connotative-definition';
const connotativeA: Form = [
  mk('foundations-connotative-definition:A1', 'foundations-connotative-definition:B1', 'remembering', 'remember', CD, 'easy',
    'According to this module, the way to reduce pattern ambiguity is to ___.',
    ['guess the most likely pattern', 'add context to the definition itself (as connotation adds to denotation)', 'rename the class', 'remove the abstraction'], 1,
    'The rule reduces ambiguity by adding contextual intent to the definition, mirroring connotation in language — not guessing, renaming, or removing abstraction.', [SRC_FOUNDATION]),
  mk('foundations-connotative-definition:A2', 'foundations-connotative-definition:B2', 'understanding', 'understand', CD, 'moderate',
    'What does the denotation-vs-connotation analogy imply for pattern definitions?',
    ['Definitions should simply be shorter', 'Patterns need no definition', 'A pattern’s meaning sharpens when intent/context is added to its bare structure', 'Structure alone is always sufficient'], 2,
    'Just as connotation adds meaning beyond denotation, adding intent/context to bare structure sharpens a pattern’s definition.', [SRC_FOUNDATION]),
];
const connotativeB: Form = [
  mk('foundations-connotative-definition:B1', 'foundations-connotative-definition:A1', 'remembering', 'remember', CD, 'easy',
    'To reduce ambiguity, the connotative-definition rule says you should ___.',
    ['add contextual intent to the definition rather than guess', 'pick the shortest pattern name', 'delete the ambiguous code', 'avoid interfaces'], 0,
    'The rule adds contextual intent to the definition rather than guessing; the alternatives do not reduce ambiguity.', [SRC_FOUNDATION]),
  mk('foundations-connotative-definition:B2', 'foundations-connotative-definition:A2', 'understanding', 'understand', CD, 'moderate',
    'How does CodiNeo apply the connotative-definition rule?',
    ['By ignoring intent entirely', 'By using only class names', 'By trusting code comments', 'By enriching a pattern’s structural definition with intent/context cues'], 3,
    'CodiNeo enriches the structural definition with intent/context cues so detection is less ambiguous; the other options ignore intent.', [SRC_FOUNDATION]),
];

// ---- foundations-same-structure : When two patterns look identical (R/U/Analyze) ----
const CS = 'intent-over-structure';
const sameStructureA: Form = [
  mk('foundations-same-structure:A1', 'foundations-same-structure:B1', 'remembering', 'remember', CS, 'easy',
    'When two patterns share the same class diagram, what do you use to tell them apart?',
    ['File size', 'Intent', 'Line count', 'Author name'], 1,
    'Identical structure is disambiguated by intent; size, line count, and author are irrelevant.', [SRC_FOUNDATION]),
  mk('foundations-same-structure:A2', 'foundations-same-structure:B2', 'understanding', 'understand', CS, 'moderate',
    'Why is intent, rather than structure, the deciding factor when diagrams match?',
    ['Structure is hard to read', 'Intent descriptions are shorter', 'Identical structures can serve different purposes, so intent disambiguates', 'Intent is required by the compiler'], 2,
    'Because the same structure can serve different purposes, the differentiator must be intent — not readability, length, or the compiler.', [SRC_FOUNDATION]),
  mk('foundations-same-structure:A3', 'foundations-same-structure:B3', 'analyzing', 'analyze', CS, 'difficult',
    'Where does intent become analysable evidence the system can read?',
    ['In naming/lexemes, collaborators, and call-site shape', 'Only in code comments', 'Only in the file path', 'Only at runtime'], 0,
    'Intent surfaces in lexemes (naming), collaborators, and call-site shape — signals an analyser can read statically.', [SRC_FOUNDATION]),
];
const sameStructureB: Form = [
  mk('foundations-same-structure:B1', 'foundations-same-structure:A1', 'remembering', 'remember', CS, 'easy',
    'What is the resolving idea of this module?',
    ['Structure is always unique', 'Class names never matter', 'Patterns are interchangeable', 'When diagrams match, intent decides the pattern'], 3,
    'The resolving idea is that when structures match, intent decides which pattern it is.', [SRC_FOUNDATION]),
  mk('foundations-same-structure:B2', 'foundations-same-structure:A2', 'understanding', 'understand', CS, 'moderate',
    'Two classes share a shape but differ in purpose. What determines which pattern each is?',
    ['The number of methods', 'The design intent/responsibility, not the structure alone', 'The access specifiers', 'The constructor count'], 1,
    'Purpose (design intent/responsibility) determines the pattern when structure is shared; counts and specifiers do not.', [SRC_FOUNDATION]),
  mk('foundations-same-structure:B3', 'foundations-same-structure:A3', 'analyzing', 'analyze', CS, 'difficult',
    'When scoring a near-tie between two patterns, an analyser should weigh ___.',
    ['only the class name', 'only inheritance depth', 'intent signals such as lexemes, collaborators, and call-site shape', 'only the file size'], 2,
    'A near-tie is resolved by weighing intent signals (lexemes, collaborators, call-site shape), not a single superficial attribute.', [SRC_FOUNDATION]),
];

// ---- foundations-structural-rules : Each pattern has a structural rule (R/U/Analyze) ----
const CSR = 'structural-rules';
const structuralRulesA: Form = [
  mk('foundations-structural-rules:A1', 'foundations-structural-rules:B1', 'remembering', 'remember', CSR, 'easy',
    'In this catalog, what does each pattern come with?',
    ['A runtime benchmark', 'A UML video', 'A “correct structure” section listing the required token combinations', 'A software license'], 2,
    'Each pattern ships a “correct structure” section listing the token combinations the analyser requires.', [SRC_FOUNDATION]),
  mk('foundations-structural-rules:A2', 'foundations-structural-rules:B2', 'understanding', 'understand', CSR, 'moderate',
    'Why does the catalog list exact token combinations for each pattern?',
    ['To make files larger', 'So the analyser has objective structural evidence to require before tagging', 'To slow detection down', 'To hide the pattern'], 1,
    'Explicit token combinations give the analyser objective, checkable evidence to require — the basis of a defensible tag.', [SRC_FOUNDATION]),
  mk('foundations-structural-rules:A3', 'foundations-structural-rules:B3', 'analyzing', 'analyze', CSR, 'difficult',
    'A class is missing a token combination a pattern’s structural rule requires. What should the analyser do?',
    ['Not tag that pattern, because the structural rule is not satisfied', 'Tag it anyway based on its name', 'Guess the closest pattern', 'Ignore structure entirely'], 0,
    'If the required structural evidence is absent, the rule is unsatisfied and the pattern should not be tagged.', [SRC_FOUNDATION]),
];
const structuralRulesB: Form = [
  mk('foundations-structural-rules:B1', 'foundations-structural-rules:A1', 'remembering', 'remember', CSR, 'easy',
    'The “correct structure” section of a pattern defines ___.',
    ['the pattern’s history', 'the original author', 'the runtime cost', 'the exact structural tokens the analyser requires'], 3,
    'It defines the exact structural tokens the analyser requires — not history, author, or runtime cost.', [SRC_FOUNDATION]),
  mk('foundations-structural-rules:B2', 'foundations-structural-rules:A2', 'understanding', 'understand', CSR, 'moderate',
    'What quality do explicit structural rules give pattern detection?',
    ['Higher speed', 'Smaller code', 'Objective, checkable evidence rather than name-based guessing', 'Fewer files'], 2,
    'Structural rules make detection rest on objective, checkable evidence instead of guessing from names.', [SRC_FOUNDATION]),
  mk('foundations-structural-rules:B3', 'foundations-structural-rules:A3', 'analyzing', 'analyze', CSR, 'difficult',
    'Two candidates differ only in one required token for a pattern. How should the rule be applied?',
    ['Tag both identically', 'Treat the rule as decisive: the candidate satisfying the required tokens matches', 'Ignore the difference', 'Pick alphabetically'], 1,
    'The structural rule is decisive: only the candidate that satisfies the required tokens matches the pattern.', [SRC_FOUNDATION]),
];

// ---- foundations-context-variation : Patterns vary by team and codebase (R/U) ----
const CV = 'convention-variation';
const contextA: Form = [
  mk('foundations-context-variation:A1', 'foundations-context-variation:B1', 'remembering', 'remember', CV, 'easy',
    'Two teams that both use Builder may ___.',
    ['produce byte-identical code', 'write code that looks different while following the same intent', 'never compile', 'always disagree on the result'], 1,
    'Teams can implement the same pattern with different surface conventions while keeping the same intent.', [SRC_FOUNDATION]),
  mk('foundations-context-variation:A2', 'foundations-context-variation:B2', 'understanding', 'understand', CV, 'moderate',
    'How does CodiNeo handle convention variation between teams?',
    ['It picks one team’s style as universal truth', 'It rejects all variation', 'It standardises on detectable structural evidence rather than one team’s convention', 'It ignores structure'], 2,
    'CodiNeo standardises on detectable structural evidence rather than crowning one team’s convention, so reasonable variation is tolerated.', [SRC_FOUNDATION]),
];
const contextB: Form = [
  mk('foundations-context-variation:B1', 'foundations-context-variation:A1', 'remembering', 'remember', CV, 'easy',
    'What is the module’s point about coding conventions?',
    ['The same pattern can be written different ways across teams', 'Every team writes identical code', 'Conventions never vary', 'Variation always indicates a bug'], 0,
    'The point is that the same pattern can be written differently across teams; the alternatives are false.', [SRC_FOUNDATION]),
  mk('foundations-context-variation:B2', 'foundations-context-variation:A2', 'understanding', 'understand', CV, 'moderate',
    'To live with convention variation, CodiNeo ___.',
    ['forces one convention on everyone', 'bans alternative styles', 'requires identical formatting', 'detects the pattern by structural evidence, allowing surface variation'], 3,
    'It detects patterns by structural evidence and allows surface variation, instead of forcing or banning styles.', [SRC_FOUNDATION]),
];

// Foundation forms keyed by moduleId; merged into ASSESSMENT_FORMS.
export const FOUNDATION_ASSESSMENT_FORMS: Record<string, { A: Form; B: Form }> = {
  'foundations-interface-principle': { A: interfaceA, B: interfaceB },
  'foundations-code-structure': { A: codeStructureA, B: codeStructureB },
  'foundations-real-software': { A: realSoftwareA, B: realSoftwareB },
  'foundations-beginner-mistakes': { A: beginnerA, B: beginnerB },
  'foundations-ambiguity': { A: ambiguityA, B: ambiguityB },
  'foundations-connotative-definition': { A: connotativeA, B: connotativeB },
  'foundations-same-structure': { A: sameStructureA, B: sameStructureB },
  'foundations-structural-rules': { A: structuralRulesA, B: structuralRulesB },
  'foundations-context-variation': { A: contextA, B: contextB },
  'foundations-why-matters': { A: whyMattersA, B: whyMattersB },
  'foundations-categories': { A: categoriesA, B: categoriesB },
  'foundations-oop': { A: oopA, B: oopB },
};
