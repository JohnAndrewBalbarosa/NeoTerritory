// Learning modules for the /patterns/learn surface (D77).
//
// Each module is independent in content: it reads end-to-end without
// pulling material in from other modules. The "See also" footer is a
// read-only pointer set; clicking switches to another module but never
// auto-folds content from one module into another. Round-3 ordering
// (Foundations → Creational → Structural → Behavioural → Idioms) drives
// the linear unlock gate in PatternsLearnPage.

import {
  PATTERNS,
  PATTERN_BOOK_CITATION,
  WHY_GOF_EXPLAINER,
} from '../components/marketing/patterns/patternData';

export type LearningCategory =
  | 'foundations'
  | 'creational'
  | 'structural'
  | 'behavioural'
  | 'idioms';

export interface LearningSection {
  heading: string;
  body?: string;
  bullets?: ReadonlyArray<string>;
  code?: string;
  note?: string;
}

export interface LearningSeeAlso {
  moduleId: string;
  label: string;
}

export type BloomTaxonomy =
  | 'remembering'
  | 'understanding'
  | 'applying'
  | 'analyzing'
  | 'evaluating'
  | 'creating';

export const FOUNDATION_CATEGORY: LearningCategory = 'foundations';
export const FOUNDATION_BYPASS_TAXONOMIES = ['remembering', 'understanding', 'applying'] as const;

export function isFoundationModule(module: Pick<LearningModule, 'category'>): boolean {
  return module.category === FOUNDATION_CATEGORY;
}

// D86: a module ends with a Theoretical Exam (every module) and, for
// pattern/idiom modules, a Practical Exam. The two replace the old single
// `practical` (quiz-OR-code) union.

// One multiple-choice item in a theoretical exam bank.
export interface ExamQuestion {
  question: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
  explanation?: string;
  // D92 (Track D): code-bearing differentiation question — the learner reads
  // the C++ snippet and picks the pattern by SEMANTIC intent, not structure.
  // Rendered as a read-only code block above the options; grading is still
  // entirely client-side via `correctIndex` (no analyser, no auto-tag). Rides
  // inside theoreticalExam.questions[] → theoretical_json, so it is opaque JSON
  // to the backend/DB — the seed dump carries it; no schema migration needed.
  code?: string;
  taxonomy?: BloomTaxonomy;
}

// Theoretical Exam — a small MCQ bank. Pass = every question answered
// correctly (threshold is the full length). Every module has one.
export interface TheoreticalExam {
  kind: 'theoretical';
  questions: ReadonlyArray<ExamQuestion>;
}

// Practical Exam — a /api/analyze code-check against the microservice. Only
// pattern/idiom modules whose pattern the catalog can detect get one;
// Foundations and non-detectable patterns (Repository) end at the theoretical.
export interface PracticalExam {
  kind: 'practical';
  // Detection slug (alias-resolved), e.g. 'singleton', 'factory'. Compared
  // against detection.patternId / patternName via normalize() so the
  // microservice's "creational.singleton" form matches "Singleton" too.
  patternSlug: string;
  // Display name shown to the user in the verdict line.
  patternName: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  // Prompt sentence shown above the Studio.
  prompt: string;
  // Optional editor seed. Patterns with a strict structural shape (e.g.
  // PIMPL needs a forward-declared inner Impl + unique_ptr<Impl> in order)
  // ship a scaffold so the learner can run-then-modify instead of guessing
  // the exact token shape the analyser requires.
  starterCode?: string;
  taxonomy?: BloomTaxonomy;
  // D92 pass-mode gate. 'detection' (default / today's behaviour): the
  // practical passes the instant the analyser tags the target pattern.
  // 'detection_and_tests': it also requires every Studio unit test to pass
  // (the gdbAllPassedForRun store flag) before completing. Absent ⇒ 'detection'.
  passMode?: 'detection' | 'detection_and_tests';
}

export interface LearningModule {
  id: string;
  category: LearningCategory;
  title: string;
  eyebrow: string;
  intro: string;
  sections: ReadonlyArray<LearningSection>;
  keyTerms?: ReadonlyArray<{ term: string; definition: string }>;
  summary?: string;
  seeAlso?: ReadonlyArray<LearningSeeAlso>;
  // Exams (D86). The theoretical exam gates the practical within a module; a
  // module is complete when the theoretical passes (Foundations) and the
  // practical passes if one exists (patterns). The linear cross-module gate
  // then unlocks module N+1.
  theoreticalExam?: TheoreticalExam;
  practicalExam?: PracticalExam;
  // D92 auto-tagging. When true (default), the practical auto-resolves the
  // module's target pattern from the analyser's tags — no manual tag step
  // required (manual tagging stays available). When false, the learner must
  // confirm the tag manually. Absent ⇒ true (today's behaviour).
  autoTag?: boolean;
}

// D92: the DB-backed CMS (learning_modules table) stores and serves modules in
// exactly this shape. LearningModuleDTO is the frozen wire contract between the
// backend (GET /api/learning/modules + admin CRUD) and the client; it equals
// LearningModule so the learner page is source-agnostic (static seed or DB).
export type LearningModuleDTO = LearningModule;

export interface LearningCategoryMeta {
  id: LearningCategory;
  name: string;
  gist: string;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: ReadonlyArray<T>, seed: string): T[] {
  const out = [...items];
  let state = hashString(seed) || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function inferBloomTaxonomy(question: ExamQuestion, index: number, moduleId: string): BloomTaxonomy {
  if (question.taxonomy) return question.taxonomy;
  const raw = `${moduleId} ${question.question} ${question.explanation || ''} ${(question.code || '')}`.toLowerCase();
  if (/(design|write|create|build|refactor|implement|construct)/.test(raw)) return 'creating';
  if (/(evaluate|better|best|trade[- ]?off|compliance|judge|critique)/.test(raw)) return 'evaluating';
  if (/(analyz|compare|why does|why is|detect|spot|break down|distinguish|difference|which of these|which pattern)/.test(raw)) return 'analyzing';
  if (/(apply|use|scenario|what would you do|how would you|choose the right|solve)/.test(raw)) return 'applying';
  if (/(understand|explain|describe|summarize|why does this mean|in your own words)/.test(raw)) return 'understanding';
  if (/(what is|which of the following|define|name|identify|list|match)/.test(raw)) return 'remembering';
  return (index % 2 === 0 ? 'understanding' : 'applying');
}

function tagQuestions(moduleId: string, questions: ReadonlyArray<ExamQuestion>): ExamQuestion[] {
  const tagged = questions.map((q, index) => ({ ...q, taxonomy: inferBloomTaxonomy(q, index, moduleId) }));
  return seededShuffle(tagged, `${moduleId}:theory`);
}

export const CATEGORY_META: ReadonlyArray<LearningCategoryMeta> = [
  {
    id: 'foundations',
    name: 'Foundations',
    gist: 'What design patterns are, why they exist, and the OOP basics they sit on.',
  },
  {
    id: 'creational',
    name: 'Creational',
    gist: 'Patterns that decide how new objects are made.',
  },
  {
    id: 'structural',
    name: 'Structural',
    gist: 'Patterns that organise and connect classes or objects.',
  },
  {
    id: 'behavioural',
    name: 'Behavioural',
    gist: 'Patterns that decide how objects communicate and choose behavior.',
  },
  {
    id: 'idioms',
    name: 'Idioms',
    gist: 'C++ idioms that are not GoF but appear often enough to detect.',
  },
];

// -------------------------------------------------------------------------
// Foundations modules — the canonical intro lessons (formerly the legacy
// StudentLearningHub's INTRO_LESSONS, since retired) tightened so each module
// reads as a standalone reference. Citations trimmed to those actually
// relevant to the module's claim.
// -------------------------------------------------------------------------

const FOUNDATIONS_MODULES: ReadonlyArray<LearningModule> = [
  {
    id: 'foundations-what-is-pattern',
    category: 'foundations',
    title: 'What is a design pattern?',
    eyebrow: 'Foundations · Module 1',
    intro:
      'A design pattern is a reusable solution to a common software design problem. It is not a library, framework, or copy-paste code — it is a proven way to organise and design software.',
    sections: [
      {
        heading: 'Plain definition',
        body:
          'A design pattern is a named, idiomatic arrangement of classes and operations that solves a recurring object-oriented design problem. Each pattern gives the recurring shape a name so that one word can replace a paragraph of structural explanation.',
      },
      {
        heading: 'Analogy',
        body:
          'Engineers reuse proven house designs for doors, windows, stairs, and layouts. Developers reuse design patterns for common coding problems the same way — pick a shape that already works, adapt it, ship it.',
      },
      {
        heading: 'Where these definitions come from',
        body:
          `The intent, problem, solution, and idiomatic implementation for every pattern in this catalog are paraphrased from ${PATTERN_BOOK_CITATION} and cross-checked against the original Gang of Four reference (Gamma et al., 1994). Every pattern detail page lists its sources explicitly.`,
        note:
          'Nesteruk’s framing: a design pattern is a named, idiomatic arrangement of classes and operations that solves a recurring object-oriented design problem. The same problem keeps appearing because the underlying language facts (inheritance, ownership, virtual dispatch) keep producing the same shapes. Naming each shape turns a paragraph of structural explanation into one word a reviewer can look up.',
      },
    ],
    keyTerms: [
      {
        term: 'Pattern',
        definition: 'A named, structural arrangement that solves a recurring design problem.',
      },
      {
        term: 'Idiomatic',
        definition: 'The conventional way most experienced practitioners would write it.',
      },
    ],
    summary:
      'A design pattern is a named shape, not a piece of code. The same shape appears in many programs because the underlying language facts keep producing it.',
    seeAlso: [
      { moduleId: 'foundations-why-matters', label: 'Why design patterns matter' },
      { moduleId: 'foundations-categories', label: 'Three main pattern categories' },
    ],
  },
  {
    id: 'foundations-why-matters',
    category: 'foundations',
    title: 'Why design patterns matter',
    eyebrow: 'Foundations · Module 2',
    intro:
      'Without patterns, code becomes repetitive, tightly coupled, and confusing. With patterns, code is easier to reuse, maintain, scale, and understand — and teams share a common vocabulary.',
    sections: [
      {
        heading: 'Industry evidence',
        body:
          'Studies between 2020 and 2024 quantify the gap between teams with and without disciplined design practice.',
        bullets: [
          'Poor software quality cost US firms an estimated $2.41 trillion in 2022 (CISQ).',
          'Elite DevOps teams recover from failures 2,604× faster than low performers, an outcome tied to code-clarity and trunk-based discipline (DORA, 2023).',
          'Classes implementing GoF design patterns show measurably lower change-proneness under maintenance than ad-hoc structures of comparable size (Ampatzoglou et al., 2020).',
          'AI assistants ship code ~55% faster but shift comprehension load onto reviewers (GitHub, 2022, 2024).',
        ],
      },
      {
        heading: 'Why this affects a beginner',
        body:
          'Reviewers and senior developers usually do not have time to explain every class. When the code carries a recognisable pattern name, the reviewer reads it in seconds instead of minutes — and you ship faster.',
      },
    ],
    summary:
      'Patterns are not academic vocabulary. They compress engineering decisions into one shared word that reviewers, mentors, and tools can all use.',
    seeAlso: [
      { moduleId: 'foundations-what-is-pattern', label: 'What is a design pattern?' },
      { moduleId: 'foundations-real-software', label: 'Design patterns in real software' },
    ],
  },
  {
    id: 'foundations-categories',
    category: 'foundations',
    title: 'Three main pattern categories',
    eyebrow: 'Foundations · Module 3',
    intro:
      'Design patterns are commonly grouped into three beginner-friendly categories based on what the pattern is responsible for.',
    sections: [
      {
        heading: 'Creational',
        body: 'Patterns that help create objects.',
        bullets: ['Singleton', 'Factory', 'Builder'],
      },
      {
        heading: 'Structural',
        body: 'Patterns that organise and connect classes or objects.',
        bullets: ['Adapter', 'Decorator', 'Facade', 'Proxy'],
      },
      {
        heading: 'Behavioural',
        body: 'Patterns that decide how objects communicate and choose behavior.',
        bullets: ['Observer', 'Strategy', 'State', 'Command'],
      },
      {
        heading: 'A fourth bucket — Idioms',
        body:
          'Modern C++ adds idioms that are not strictly GoF but appear often enough to be detectable: Method Chaining, Repository, and PIMPL. This site treats them as a fourth category alongside the three above.',
      },
      {
        heading: 'Why the catalog is Gang-of-Four anchored',
        body: WHY_GOF_EXPLAINER,
      },
    ],
    summary:
      'Creational makes objects. Structural connects them. Behavioural decides how they talk. Idioms are common shapes the catalog also detects.',
    seeAlso: [
      { moduleId: 'foundations-what-is-pattern', label: 'What is a design pattern?' },
    ],
  },
  {
    id: 'foundations-oop',
    category: 'foundations',
    title: 'OOP foundations',
    eyebrow: 'Foundations · Module 4',
    intro:
      'Design patterns are built on object-oriented programming. Six concepts cover most of what you need before reading the catalog.',
    sections: [
      {
        heading: 'The six concepts',
        bullets: [
          'Class: a blueprint.',
          'Object: an instance of a class.',
          'Inheritance: reusing behavior.',
          'Polymorphism: one action, many forms.',
          'Encapsulation: hiding internal details.',
          'Abstraction: simplifying complexity.',
        ],
      },
      {
        heading: 'Example in C++',
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
    ],
    keyTerms: [
      { term: 'Class', definition: 'The blueprint that describes how objects of a type are built.' },
      { term: 'Object', definition: 'A concrete instance of a class — what actually exists at runtime.' },
      { term: 'Polymorphism', definition: 'A single action that behaves differently per actual object type.' },
    ],
    summary:
      'Classes blueprint; objects instantiate; inheritance reuses; polymorphism varies behaviour; encapsulation hides; abstraction simplifies.',
    seeAlso: [
      { moduleId: 'foundations-interface-principle', label: 'Program to an interface' },
      { moduleId: 'foundations-code-structure', label: 'Understanding software structure' },
    ],
  },
  {
    id: 'foundations-interface-principle',
    category: 'foundations',
    title: 'Program to an interface',
    eyebrow: 'Foundations · Module 5',
    intro:
      '"Program to an interface, not an implementation" — instead of depending on one exact class, depend on shared behaviour or abstraction. The system becomes easier to change, expand, and maintain.',
    sections: [
      {
        heading: 'What this means in practice',
        body:
          'Take a list of payment processors. A bad design hard-codes one implementation (PayPalProcessor) into every caller. A pattern-aware design defines an interface (PaymentProcessor) and routes through it, so swapping PayPal for Stripe touches one factory, not every caller.',
      },
      {
        heading: 'Where this appears in patterns',
        body:
          'Strategy, Factory, Adapter, and Bridge all rest on this principle. They give the abstraction a name and a recognisable shape.',
      },
    ],
    summary:
      'Depend on what something does, not who is doing it. Patterns formalise this principle into named shapes.',
    seeAlso: [{ moduleId: 'foundations-oop', label: 'OOP foundations' }],
  },
  {
    id: 'foundations-code-structure',
    category: 'foundations',
    title: 'Understanding software structure',
    eyebrow: 'Foundations · Module 6',
    intro:
      'Source code is more than plain text. A system can analyse class relationships, inheritance chains, dependencies, and communication flow — and patterns appear as recognisable shapes in that structure.',
    sections: [
      {
        heading: 'The AST',
        body:
          'AST means Abstract Syntax Tree. It represents code as a tree-like structure so software tools can analyse syntax and structure without re-reading raw text. Most static analysis (including this site\'s pattern detector) operates on ASTs.',
      },
      {
        heading: 'How CodiNeo uses it',
        body:
          'CodiNeo builds a parse tree from the user\'s C++ source, mirrors it into a virtual structural copy, and runs pattern checks against the virtual tree. The original parse tree is never mutated — so every detection result can be traced back to specific lines in the user\'s source.',
      },
    ],
    keyTerms: [
      { term: 'AST', definition: 'Abstract Syntax Tree — the tree-shaped representation of parsed source code.' },
      { term: 'Static analysis', definition: 'Code analysis that reads the source without running it.' },
    ],
    summary:
      'Code is a tree, not a string. Patterns are shapes in that tree, and tools detect them by walking the tree, not by reading text.',
    seeAlso: [
      { moduleId: 'foundations-structural-rules', label: 'Each pattern has a structural rule' },
    ],
  },
  {
    id: 'foundations-real-software',
    category: 'foundations',
    title: 'Design patterns in real software',
    eyebrow: 'Foundations · Module 7',
    intro:
      'Patterns are not academic. They appear in production systems written by working engineers across many industries.',
    sections: [
      {
        heading: 'Where they show up',
        bullets: [
          'Game engines may use Singleton or Observer.',
          'UI frameworks may use MVC and Observer.',
          'Databases may use Singleton.',
          'Compilers may use Visitor.',
          'Operating systems may use Command.',
        ],
      },
      {
        heading: 'Why this matters to a beginner',
        body:
          'Recognising patterns in production code is one of the fastest ways to read a codebase you did not write. New contributors often spend their first weeks inferring conventions; pattern literacy collapses that period.',
      },
    ],
    summary:
      'Patterns are everywhere you actually work. Learning their shapes is the fastest path to reading unfamiliar code. When documentation drifts away from the code (which it eventually does), the recognisable shape is what survives.',
    seeAlso: [
      { moduleId: 'foundations-why-matters', label: 'Why design patterns matter' },
    ],
  },
  {
    id: 'foundations-beginner-mistakes',
    category: 'foundations',
    title: 'Common beginner mistakes',
    eyebrow: 'Foundations · Module 8',
    intro: 'Learning patterns is easier when you know what to avoid.',
    sections: [
      {
        heading: 'Four traps',
        bullets: [
          'Overusing patterns. Patterns should solve real problems, not be forced everywhere.',
          'Copy-pasting without understanding. Learn why the pattern exists and when to use it.',
          'Ignoring relationships. Patterns are about structure, communication, and architecture — not only syntax.',
          'Making classes depend too heavily on each other. Loose connections are easier to maintain.',
        ],
      },
    ],
    summary:
      'Use patterns to solve problems you actually have. Loose coupling beats premature abstraction every time.',
    seeAlso: [
      { moduleId: 'foundations-interface-principle', label: 'Program to an interface' },
    ],
  },
  {
    id: 'foundations-ambiguity',
    category: 'foundations',
    title: 'Ambiguity is built in to design patterns',
    eyebrow: 'Foundations · Module 9',
    intro:
      'Some patterns look almost identical at the code level. Builder and Method Chaining both use `return *this`. Adapter, Decorator, and Proxy all wrap a held member and forward calls. This is not a bug — it is a property of the patterns themselves.',
    sections: [
      {
        heading: 'When two patterns share a shape',
        bullets: [
          'Builder vs Method Chaining — both rely on `return *this`.',
          'Adapter vs Decorator vs Proxy — all forward calls to a wrapped member.',
          'Strategy concrete vs Decorator — both override a polymorphic method.',
        ],
      },
      {
        heading: 'Why this is the honest answer',
        body:
          'When two patterns share the same structural shape, no automatic tool can pick a single winner from the code alone. The right response is to surface both candidates and tell the reader the class is structurally ambiguous between them. Picking a winner needs human context the code does not yet carry.',
      },
      {
        heading: 'Analogy',
        body:
          'Two siblings can look almost the same in a photograph. You cannot decide who is older from the photo alone. You need extra information — a birthday, a story — that the photo does not contain.',
      },
    ],
    summary:
      'Ambiguity between two patterns is information, not failure. It tells you human judgement is required.',
    seeAlso: [
      { moduleId: 'foundations-connotative-definition', label: 'The connotative-definition rule' },
      { moduleId: 'foundations-structural-rules', label: 'Each pattern has a structural rule' },
    ],
  },
  {
    id: 'foundations-connotative-definition',
    category: 'foundations',
    title: 'The connotative-definition rule',
    eyebrow: 'Foundations · Module 10',
    intro:
      'The way to reduce ambiguity is to add context to the definition itself, not to guess. This works the same way connotative meaning works in language.',
    sections: [
      {
        heading: 'Connotation and denotation',
        body:
          'Lumalalim ang kahulugan (connotative): kapag nagdadagdag ka ng mga descriptions sa isang salita, mas espesipiko ang kahulugan. Mula sa "parent", kapag dinagdagan mo ng "female", nagiging "female parent" — mas tiyak na. Nabawasan ang sakop (denotative): habang dumarami ang descriptions, nababawasan ang bilang ng bagay o tao na pasok sa depinisyon. Mas marami ang pumapasok sa "parent" kaysa sa "female parent".',
      },
      {
        heading: 'How CodiNeo uses this rule',
        body:
          'Each pattern is defined not by a single keyword but by a small SET of structural descriptions — token combos that, taken together, narrow what counts as that pattern. The analyser rejects bare keywords as basis and accepts only stdlib symbols or multi-token combos.',
        bullets: [
          'Connotation = adding descriptions to make meaning more specific.',
          'A single keyword like `virtual` is too thin — many classes have it.',
          'A combo like (virtual ~) or (override {) carries enough context to be a real signal.',
        ],
      },
    ],
    summary:
      'Add structural descriptions until ambiguity disappears. Single keywords are noise; multi-token combos and stdlib symbols are signal.',
    seeAlso: [
      { moduleId: 'foundations-ambiguity', label: 'Ambiguity is built in to design patterns' },
    ],
  },
  {
    id: 'foundations-same-structure',
    category: 'foundations',
    title: 'When two patterns look identical',
    eyebrow: 'Foundations · Module 11',
    intro:
      'Module 9 said ambiguity is built in. This module is the resolving idea: when two patterns share the same class diagram, you tell them apart by INTENT, and intent shows up in the lexemes, the collaborators, and the call-site shape — never in the skeleton itself. This is the same vocabulary the analyser uses to break a near-tie.',
    sections: [
      {
        heading: 'Structure alone is ambiguous — three classic collisions',
        body:
          'A class diagram answers "what shape is this?" It does not answer "what is this FOR?" Several Gang-of-Four patterns deliberately share one shape, so the diagram cannot separate them:',
        bullets: [
          'Strategy vs State — both are a context holding a pointer to a polymorphic interface and delegating to it. Identical UML.',
          'Adapter vs Decorator vs Proxy — all three own (or hold) one member of an interface type and forward calls to it. Same wrapping skeleton.',
          'Builder vs plain method-chaining — both have setters that end in `return *this` so calls can be chained. Same fluent shape.',
        ],
        note:
          'If you only read the boxes and arrows, each pair above is the same picture. That is by design, not a defect in the catalog.',
      },
      {
        heading: 'The resolving idea: intent lives in the lexemes',
        body:
          'Intent leaves fingerprints in the tokens. The analyser groups those tokens into lexeme categories (see pattern_catalog/lexeme_categories.json) and reads the COMBINATION, not any single keyword. A few concrete C++ cues:',
        bullets: [
          'Self-return `return *this` (the self_return category) → a fluent/chaining shape. To call it Builder rather than bare method-chaining, you also need a terminator that returns a *product* (a `build()` / `finalize()` that hands back the constructed object). No terminator ⇒ it is just chaining.',
          'An owned member of an interface type that is forwarded to, PLUS an added responsibility around the forward (logging, a new method, behaviour layered on the call) → Decorator. A bare forward with no added behaviour, just translating one interface to another → plain Adapter.',
          'A nested wrap at the call site — `new Loud(new Plain())` or `make_unique<Loud>(make_unique<Plain>())` → confident Decorator composition; the Adapter detector treats that exact nesting as a NEGATIVE (a "Decorator giveaway").',
          'A held state object combined with a transition call that swaps it — `setState(...)` / `changeState(...)` / `this->state_ = ...` → State. If the policy object is set once by the CALLER and never self-swapped, that is Strategy.',
        ],
        code:
          'class Pizza {\n'
          + 'public:\n'
          + '  Pizza& setSize(int s)    { size_ = s; return *this; }   // self_return → fluent\n'
          + '  Pizza& addTopping(T t)   { tops_.push_back(t); return *this; }\n'
          + '  Recipe build() const;    // terminator returns a PRODUCT → Builder, not bare chaining\n'
          + 'private:\n'
          + '  int size_; std::vector<T> tops_;\n'
          + '};',
      },
      {
        heading: 'Intent also shows in collaborators and call-site shape',
        bullets: [
          'Collaborators — what other types must be present for this to make sense? Decorator and the thing it decorates implement the SAME interface (so a decorator can wrap another decorator); an Adapter bridges TWO unrelated interfaces. Same skeleton, different cast of collaborators.',
          'Call-site shape — how the object is built and used. Builder reads as a chain that ends in a terminator; Decorator reads as a constructor wrapping a constructor; State reads as a transition call flipping the held member mid-flight.',
          'Negative signals — the absence of an expected token is evidence too. "Fluent setters but no terminator" argues against Builder; "a wrapped member but no forwarding call" argues against Decorator.',
        ],
        note:
          'This is the connotative-definition rule (Module 10) applied to disambiguation: add descriptions — lexeme combos, collaborators, call-site shape — until only one pattern still fits.',
      },
      {
        heading: 'How an analyser scores a near-tie',
        body:
          'When two candidates share a shape, a tool should not bluff a confident pick. CodiNeo scores each candidate per LINE, then compares them. The mechanics, conceptually:',
        bullets: [
          'Each catalog pattern carries weighted signals — callsites, expected collaborators, global functions — plus negative signals with negative weights. Every regex hit adds (or, for negatives, subtracts) its catalog-authored weight on the line it fired.',
          'Per line, the pattern wins that line only if its own signal weight beats the opposing weight (rival patterns\' hits on that line PLUS this pattern\'s own negative-signal weight). Wins become "successes"; every non-blank in-scope line is a "trial".',
          'The line score is the Wilson score-interval lower bound of successes/trials (a 95% lower bound, z = 1.96) — not the raw average. Wilson is deliberately conservative: a pattern that wins 3 of 3 lines does NOT get a perfect score, because three trials is thin evidence.',
          'A candidate is "confident" only above ~0.85. If the top two scores sit within ~0.10 of each other, the verdict flips to "ambiguous" and BOTH candidates are surfaced — exactly the honest answer from Module 9, now produced by the math instead of a guess.',
        ],
        note:
          'So identical structure does not force a wrong confident pick. It surfaces as a near-tie, and a near-tie is reported as ambiguity for a human to resolve with the intent context the code does not carry.',
      },
    ],
    keyTerms: [
      {
        term: 'lexeme',
        definition:
          'A meaningful token (or fixed combo of consecutive tokens) the analyser reads as a signal — e.g. `return *this`, `make_unique`, `override {`. Bare single keywords are rejected as too thin.',
      },
      {
        term: 'callsite signal',
        definition:
          'A regex over how the class is constructed and used at the call site (e.g. a nested `new X(new Y())` wrap, or chained fluent setters) — evidence of intent that the class body alone may not show.',
      },
      {
        term: 'collaborator',
        definition:
          'Another type that must be present for the pattern to make sense (e.g. a Decorator and its component share one interface; an Adapter bridges two). The cast of collaborators separates same-shaped patterns.',
      },
      {
        term: 'negative signal',
        definition:
          'A catalog signal with a NEGATIVE weight whose presence argues AGAINST a pattern (e.g. nested constructors count against Adapter because they are a Decorator giveaway). Absence of an expected token is evidence too.',
      },
      {
        term: 'ambiguity',
        definition:
          'When the top two candidate scores fall within the delta (~0.10), the analyser reports BOTH rather than bluffing a confident pick — the structural tie made explicit.',
      },
      {
        term: 'Wilson lower bound',
        definition:
          'The 95% Wilson score-interval lower bound of per-line wins/trials (z = 1.96). A conservative score that refuses to be confident on thin evidence, so near-ties surface as ambiguous.',
      },
    ],
    summary:
      'Identical structure is resolved by intent, and intent lives in the lexemes, collaborators, and call-site shape — not the class diagram. A line-by-line Wilson score lets near-ties surface as "ambiguous" instead of a wrong confident pick.',
    seeAlso: [
      { moduleId: 'foundations-ambiguity', label: 'Ambiguity is built in to design patterns' },
      { moduleId: 'foundations-connotative-definition', label: 'The connotative-definition rule' },
    ],
  },
  {
    id: 'foundations-structural-rules',
    category: 'foundations',
    title: 'Each pattern has a structural rule',
    eyebrow: 'Foundations · Module 12',
    intro:
      'Each design pattern in this catalog comes with a "correct structure" section that lists the exact token combos the analyser requires.',
    sections: [
      {
        heading: 'How to read the rules',
        bullets: [
          'Read the must-have list as: at least one of these combos must appear in the class body.',
          'Read the must-not-have list as: if any of these combos fires, the class is rejected for that pattern even if the rest matches.',
          'These rules are language-level signals — keywords combined with their immediate neighbours, or stdlib symbols whose presence alone is structural evidence.',
        ],
      },
      {
        heading: 'Where to see them',
        note:
          'Every pattern detail page under the catalog has a "Correct structure" section. The same rules drive the analyser.',
      },
    ],
    summary:
      'must-have = at least one combo present. must-not-have = if any combo fires, the class is rejected. Same vocabulary as the analyser itself.',
    seeAlso: [
      { moduleId: 'foundations-connotative-definition', label: 'The connotative-definition rule' },
    ],
  },
  {
    id: 'foundations-context-variation',
    category: 'foundations',
    title: 'Patterns vary by team and codebase',
    eyebrow: 'Foundations · Module 13',
    intro:
      'Two teams that both claim to use Builder can write code that looks different. CodiNeo does not pick one team\'s convention as universal truth — it standardises on language-level structure so detection stays consistent.',
    sections: [
      {
        heading: 'What this means',
        bullets: [
          'Same pattern name can mean different things in different orgs.',
          'Standardising on language-level structure (not naming) is what enables tooling.',
          'CodiNeo\'s detection feeds into automatic unit-test generation, so a stable rule matters.',
        ],
      },
      {
        heading: 'How to live with the variation',
        body:
          'If your team has stricter conventions, layer them on top. The analyser answers the structural question. The conventions answer the cultural one.',
      },
    ],
    summary:
      'Standardise on language structure for tooling. Layer team conventions on top for culture.',
    seeAlso: [
      { moduleId: 'foundations-structural-rules', label: 'Each pattern has a structural rule' },
    ],
  },
  {
    id: 'foundations-postrequisite',
    category: 'foundations',
    title: 'Post-Foundations open questions',
    eyebrow: 'Foundations · Module 14',
    intro:
      'Before you move into the pattern catalog, sit with the questions below. They are intentionally open-ended — there is no single right answer, but every working developer should have an opinion on each.',
    sections: [
      {
        heading: 'Four questions',
        bullets: [
          'Unit testing — when the analyser flags a class as Builder, what unit tests would you write to confirm it behaves like a Builder rather than a Method Chain?',
          'Value to a company — how does a shared vocabulary of patterns reduce onboarding cost for new hires? Where does it fail?',
          'Readability — when does naming a pattern in code (a comment, a class name) help, and when does it just lock in the wrong abstraction?',
          'Ambiguity in your own code — pick one class you have written. If a tool tagged it as two patterns at once, would you push back, or would you accept the ambiguity?',
        ],
      },
      {
        heading: 'Note',
        note:
          'Bring your answers to your next code review. This module does not grade them — your team does.',
      },
    ],
    summary:
      'Patterns are also a conversation. The interesting questions are organisational, not just structural.',
    seeAlso: [
      { moduleId: 'foundations-context-variation', label: 'Patterns vary by team and codebase' },
    ],
  },
];

// -------------------------------------------------------------------------
// Per-pattern modules — built dynamically from patternData so the catalog
// (reference) and the learning surface (learn-then-regurgitate) stay in
// sync. Each pattern is one module under its family category. The module
// quotes the pattern's intent, what-it-is, when-to-use, and the must-have
// structural rules without auto-folding any cross-pattern content.
// -------------------------------------------------------------------------

function buildPatternModule(slug: string): LearningModule | null {
  const pattern = PATTERNS.find((p) => p.slug === slug);
  if (!pattern) return null;

  const category = pattern.family.toLowerCase() as LearningCategory;
  const sections: LearningSection[] = [];

  if (pattern.whatItIs) {
    sections.push({ heading: 'What it is', body: pattern.whatItIs });
  }
  if (pattern.whenToUse) {
    sections.push({ heading: 'When to use it', body: pattern.whenToUse });
  }
  if (pattern.everydayExample) {
    sections.push({ heading: 'Everyday example', body: pattern.everydayExample });
  }
  sections.push({ heading: 'The shape in code', body: pattern.solution, code: pattern.codeSketch });
  if (pattern.correctStructure) {
    sections.push({
      heading: 'Must-have structural rule',
      body: pattern.correctStructure.whyItWorks,
      bullets: pattern.correctStructure.mustHave.map((r) => `${r.label} — ${r.why}`),
    });
  }


  // See-also: other patterns in the same family, capped at 3.
  const seeAlso: LearningSeeAlso[] = PATTERNS.filter(
    (p) => p.family === pattern.family && p.slug !== pattern.slug,
  )
    .slice(0, 3)
    .map((p) => ({ moduleId: `${category}-${p.slug}`, label: p.name }));

  return {
    id: `${category}-${pattern.slug}`,
    category,
    title: pattern.name,
    eyebrow: `${pattern.family} · ${pattern.name}`,
    intro: pattern.oneLiner || pattern.intent,
    sections,
    summary: pattern.readabilityBenefit,
    seeAlso,
  };
}

const PATTERN_MODULES_RAW: ReadonlyArray<LearningModule> = PATTERNS.map((p) =>
  buildPatternModule(p.slug),
).filter((m): m is LearningModule => m !== null);

// -------------------------------------------------------------------------
// Theoretical exams (D86) — one MCQ bank per module, the first gate before a
// module's practical. Foundations modules end here (no practical exam);
// pattern modules also expose a Studio practical exam. Pass = every question
// in the bank answered correctly. Banks were expanded from the round-3
// single-question quizzes so the exam reads as a real comprehension check.
// -------------------------------------------------------------------------

const FOUNDATIONS_THEORY: Record<string, ReadonlyArray<ExamQuestion>> = {
  'foundations-what-is-pattern': [
    {
      question: 'Which best describes a design pattern?',
      options: [
        'A copy-pasteable code library you import.',
        'A named structural arrangement that solves a recurring design problem.',
        'A specific framework like Spring or React.',
        'A unit test template applied to every class.',
      ],
      correctIndex: 1,
      explanation: 'A design pattern is a named, idiomatic shape — not code you import.',
    },
    {
      question: 'Why does naming a recurring shape help a team?',
      options: [
        'One word replaces a paragraph of structural explanation.',
        'It makes the compiler emit faster code.',
        'It forces every class to inherit from a base.',
        'It guarantees the design is correct.',
      ],
      correctIndex: 0,
      explanation: 'Naming the shape turns structure into shared vocabulary.',
    },
    {
      question: 'Why does the same design problem keep reappearing across programs?',
      options: [
        'Because programmers copy each other’s files.',
        'Because the underlying language facts (inheritance, ownership, dispatch) keep producing the same shapes.',
        'Because the C++ standard mandates it.',
        'Because IDEs auto-generate it.',
      ],
      correctIndex: 1,
      explanation: 'The recurring shape is a consequence of the language, so it is worth naming.',
    },
  ],
  'foundations-why-matters': [
    {
      question: 'What is the practical value of knowing pattern names?',
      options: [
        'They make reviewers and tools share one vocabulary so a recognised shape replaces a paragraph of explanation.',
        'They guarantee the code will be bug-free.',
        'They replace the need for testing.',
        'They are required by the C++ standard.',
      ],
      correctIndex: 0,
      explanation: 'Patterns compress engineering decisions into one shared word.',
    },
    {
      question: 'How do patterns affect a beginner joining a team?',
      options: [
        'They slow onboarding because there is more to memorise.',
        'A recognised pattern name lets a reviewer read intent in seconds, so the beginner ships faster.',
        'They make code reviews unnecessary.',
        'They only matter to architects, not new hires.',
      ],
      correctIndex: 1,
      explanation: 'Pattern literacy collapses the time spent inferring a codebase’s conventions.',
    },
  ],
  'foundations-categories': [
    {
      question: 'Which sentence correctly maps the three main families?',
      options: [
        'Creational connects classes, Structural decides communication, Behavioural makes objects.',
        'Creational makes objects, Structural connects them, Behavioural decides how they communicate.',
        'All three families do the same thing under different names.',
        'Structural is a subset of Behavioural in modern C++.',
      ],
      correctIndex: 1,
      explanation: 'Creational → make. Structural → connect. Behavioural → talk.',
    },
    {
      question: 'Why does this site treat Idioms as a fourth bucket alongside the three GoF families?',
      options: [
        'Because the Gang of Four defined four families.',
        'Because modern C++ idioms (PIMPL, Method Chaining) are not GoF but appear often enough to detect.',
        'Because every idiom is also a Creational pattern.',
        'Because idioms replace Structural patterns.',
      ],
      correctIndex: 1,
      explanation: 'Idioms are common detectable shapes the catalog adds beyond the 23 GoF patterns.',
    },
  ],
  'foundations-oop': [
    {
      question: 'Why are design patterns described in terms of classes and objects?',
      options: [
        'Because patterns predate procedural programming.',
        'Because patterns formalise object-oriented design choices — encapsulation, inheritance, polymorphism — into reusable shapes.',
        'Because every language must use OOP.',
        'Because the C++ compiler enforces patterns natively.',
      ],
      correctIndex: 1,
      explanation: 'Patterns are an OOP vocabulary built on encapsulation, inheritance, and polymorphism.',
    },
    {
      question: 'Which definition matches polymorphism?',
      options: [
        'Hiding the internal details of a class.',
        'A single action that behaves differently depending on the actual object type.',
        'The blueprint that describes how objects are built.',
        'Reusing behaviour from a base class.',
      ],
      correctIndex: 1,
      explanation: 'Polymorphism = one action, many forms, resolved by the runtime type.',
    },
  ],
  'foundations-interface-principle': [
    {
      question: '"Program to an interface, not an implementation" means…',
      options: [
        'Always use C++ pure virtual classes.',
        'Code should depend on what something does, not which concrete class is doing it.',
        'Replace every class with a template.',
        'Avoid writing concrete classes entirely.',
      ],
      correctIndex: 1,
      explanation: 'Depend on contracts (what), not identities (who).',
    },
    {
      question: 'Which patterns rest directly on this principle?',
      options: [
        'Strategy, Factory, Adapter, and Bridge.',
        'Only Singleton.',
        'No patterns — it is unrelated to patterns.',
        'Only Creational patterns.',
      ],
      correctIndex: 0,
      explanation: 'They give the abstraction a name and a recognisable shape.',
    },
  ],
  'foundations-code-structure': [
    {
      question: 'Why do pattern detectors walk an AST instead of grep-searching source text?',
      options: [
        'Because grep is too slow.',
        'Because code is a tree; patterns are shapes in that tree, and matching needs structural context.',
        'Because AST parsers are required by ISO C++.',
        'Because text search is forbidden on Linux.',
      ],
      correctIndex: 1,
      explanation: 'Patterns are tree shapes, not text shapes.',
    },
    {
      question: 'How does CodiNeo keep a detection result traceable to the user’s source?',
      options: [
        'It rewrites the source in place.',
        'It mirrors the parse tree into a virtual copy and runs checks there, never mutating the original.',
        'It only reports line numbers, never structure.',
        'It discards the parse tree after analysis.',
      ],
      correctIndex: 1,
      explanation: 'The original parse tree is never mutated, so every result maps back to specific lines.',
    },
  ],
  'foundations-real-software': [
    {
      question: 'Why does recognising patterns matter in real-world codebases?',
      options: [
        'Documentation drifts; the recognisable shape survives and lets you read unfamiliar code fast.',
        'Patterns are mandated by every linter.',
        'They make compilation faster.',
        'They eliminate the need for code review.',
      ],
      correctIndex: 0,
      explanation: 'When docs go stale, the shape is what is still true.',
    },
    {
      question: 'Which pairing of system and pattern is plausible?',
      options: [
        'A compiler using Visitor to walk its syntax tree.',
        'A compiler that cannot use any pattern.',
        'An operating system that forbids Command.',
        'A UI framework that never observes state.',
      ],
      correctIndex: 0,
      explanation: 'Visitor is a classic fit for traversing compiler ASTs; patterns appear across real systems.',
    },
  ],
  'foundations-beginner-mistakes': [
    {
      question: 'What is the most common beginner mistake with design patterns?',
      options: [
        'Refusing to use any patterns at all.',
        'Forcing a pattern onto a problem that does not need it ("pattern fever").',
        'Always preferring composition over inheritance.',
        'Reading too many books.',
      ],
      correctIndex: 1,
      explanation: 'Use patterns to solve problems you actually have — not for their own sake.',
    },
    {
      question: 'Why is making classes depend heavily on each other a trap?',
      options: [
        'Tight coupling is always faster at runtime.',
        'Loose connections are easier to change and maintain; tight coupling resists change.',
        'The compiler rejects loosely coupled code.',
        'Coupling has no effect on maintenance.',
      ],
      correctIndex: 1,
      explanation: 'Loose coupling beats premature abstraction and rigid dependencies.',
    },
  ],
  'foundations-ambiguity': [
    {
      question: 'When two patterns fit the same class, the detector should…',
      options: [
        'Silently pick one and hide the other.',
        'Surface both and ask the human — ambiguity is information, not failure.',
        'Reject the class entirely.',
        'Rewrite the source to remove ambiguity.',
      ],
      correctIndex: 1,
      explanation: 'Ambiguity tells you human judgement is required.',
    },
    {
      question: 'Which pair genuinely shares a structural shape?',
      options: [
        'Builder and Method Chaining, which both rely on `return *this`.',
        'Singleton and Observer, which share no structure.',
        'Factory and Iterator, which are identical.',
        'Adapter and Singleton, which both restrict instances.',
      ],
      correctIndex: 0,
      explanation: 'Shared shapes (like `return *this`) are why some classes are structurally ambiguous.',
    },
  ],
  'foundations-connotative-definition': [
    {
      question: 'What kinds of tokens are most useful for distinguishing one pattern from another?',
      options: [
        'Any single keyword that appears in the class.',
        'Multi-token combos and stdlib symbols — single keywords are noise, combos are signal.',
        'Comments only.',
        'Function lengths.',
      ],
      correctIndex: 1,
      explanation: 'Add structural descriptions until ambiguity disappears.',
    },
    {
      question: 'How does adding descriptions change a definition (connotation)?',
      options: [
        'It widens what counts, so more things qualify.',
        'It narrows what counts, so the meaning gets more specific.',
        'It has no effect on specificity.',
        'It only changes the name, not the meaning.',
      ],
      correctIndex: 1,
      explanation: 'More descriptions = more specific meaning and fewer things that qualify.',
    },
  ],
  // D92 (Track D) — the "differentiation exam". MOST items are code-bearing:
  // the learner is GIVEN a structurally-ambiguous C++ class and must pick the
  // pattern by SEMANTIC intent, not the class skeleton. Each code snippet is
  // genuinely the labelled pattern; the explanation names the resolving cue
  // (who drives the swap, added-responsibility vs bare-forward vs access-
  // control, terminator-returns-a-product). Graded entirely client-side via
  // correctIndex — no analyser, no auto-tag. Cues are grounded in
  // pattern_catalog/{behavioural/strategy_interface,state}.json and
  // {structural/adapter,decorator,proxy}.json.
  'foundations-same-structure': [
    {
      // Conceptual anchor (non-code) — keep one as the framing question.
      question:
        'Two classes have the exact same class diagram. What is the ONLY thing that can tell them apart?',
      options: [
        'Nothing — identical structure means they are the same pattern.',
        'The intent, which shows up in the lexemes, collaborators, and call-site shape, not in the diagram.',
        'Whichever class name sorts first alphabetically.',
        'The number of lines in each class.',
      ],
      correctIndex: 1,
      explanation:
        'Several Gang-of-Four patterns share a shape on purpose. The boxes-and-arrows answer "what shape is this?", never "what is this FOR?" — intent leaves fingerprints in the tokens, collaborators, and call-site, and that is what separates same-shaped patterns.',
    },
    {
      // Strategy vs State — identical UML (context holds a polymorphic pointer
      // and delegates). Resolving cue: WHO drives the swap. Here the OBJECT
      // transitions its own held member (changeState within handle) → State.
      question:
        'Both Strategy and State are a context holding a pointer to a polymorphic interface and delegating to it — identical UML. Which pattern is the class below?',
      code:
        'class TrafficLight {\n'
        + 'public:\n'
        + '  void next() {\n'
        + '    state_->handle(*this);   // delegate to the current state...\n'
        + '  }\n'
        + '  void changeState(std::unique_ptr<LightState> s) {\n'
        + '    state_ = std::move(s);   // ...which transitions the held member itself\n'
        + '  }\n'
        + 'private:\n'
        + '  std::unique_ptr<LightState> state_;\n'
        + '};',
      options: [
        'Strategy — the algorithm is chosen once by the client.',
        'State — the object transitions its own held member at runtime.',
        'Adapter — it translates one interface to another.',
        'Proxy — it controls access to a real subject.',
      ],
      correctIndex: 1,
      explanation:
        'The resolving cue is WHO drives the swap. A transition call (changeState / setState / this->state_ = ...) invoked as part of handling input means the object flips its own held member mid-flight — that is State. If the policy object were set once by the caller and never self-swapped, the same skeleton would read as Strategy.',
    },
    {
      // Strategy vs State — the contrast case. Here the policy is injected by
      // the CALLER (constructor + setStrategy) and never self-swapped → Strategy.
      question:
        'Same context-holds-a-polymorphic-pointer skeleton as the previous question. Which pattern is THIS class?',
      code:
        'class Compressor {\n'
        + 'public:\n'
        + '  explicit Compressor(std::unique_ptr<CompressionPolicy> p)\n'
        + '    : policy_(std::move(p)) {}\n'
        + '  void setStrategy(std::unique_ptr<CompressionPolicy> p) {\n'
        + '    policy_ = std::move(p);  // the CLIENT swaps the policy\n'
        + '  }\n'
        + '  Bytes run(const Bytes& in) { return policy_->compress(in); }\n'
        + 'private:\n'
        + '  std::unique_ptr<CompressionPolicy> policy_;\n'
        + '};',
      options: [
        'State — the object drives its own transitions.',
        'Strategy — the client injects/sets the policy; the object never self-swaps it.',
        'Decorator — it wraps a component and adds behaviour.',
        'Builder — it assembles a product step by step.',
      ],
      correctIndex: 1,
      explanation:
        'The swap is driven from OUTSIDE: a constructor injection plus a setStrategy() the caller controls, and run() never reassigns policy_ itself. Client-driven, externally-set policy with no self-transition is Strategy. (Compare the previous question, where the object called changeState on itself → State.)',
    },
    {
      // Adapter vs Decorator vs Proxy — all three hold/own one member of an
      // interface type and forward to it. Resolving cue: this one ADDS a
      // responsibility (logging) around the forward AND shares the wrappee's
      // interface → Decorator. (Nested new X(new Y()) at the call site is the
      // confident Decorator-composition giveaway per the catalog.)
      question:
        'Adapter, Decorator, and Proxy all hold a member of an interface type and forward calls to it — the same wrapping skeleton. Which pattern is the class below?',
      code:
        'class LoggingStream : public Stream {       // SAME interface as the wrappee\n'
        + 'public:\n'
        + '  explicit LoggingStream(std::unique_ptr<Stream> inner)\n'
        + '    : inner_(std::move(inner)) {}\n'
        + '  void write(const std::string& data) override {\n'
        + '    log("writing " + std::to_string(data.size()) + " bytes");  // ADDED responsibility\n'
        + '    inner_->write(data);                    // ...then forward unchanged\n'
        + '  }\n'
        + 'private:\n'
        + '  std::unique_ptr<Stream> inner_;\n'
        + '};\n'
        + '// call site: new LoggingStream(new FileStream())  // nested wrap',
      options: [
        'Adapter — it converts one interface into a different one.',
        'Decorator — it shares the wrappee’s interface and layers behaviour on the forward.',
        'Proxy — it controls or defers access to the real subject.',
        'State — it swaps a held state object.',
      ],
      correctIndex: 1,
      explanation:
        'Two cues resolve it to Decorator: (1) it implements the SAME interface it wraps (`: public Stream`, so a decorator can wrap another decorator), and (2) it ADDS a responsibility — the log() call — around an otherwise-unchanged forward. The nested `new LoggingStream(new FileStream())` at the call site is the confident Decorator-composition signal (and the Adapter detector treats that exact nesting as a "Decorator giveaway" negative). A bare forward that just translated interfaces with no added behaviour would be Adapter.',
    },
    {
      // Adapter vs Proxy — Proxy is distinguished by access_control_caching
      // (lazy init / mutex / cache). This one lazily creates the real subject
      // behind an if-guard → Virtual Proxy. (Adapter declares
      // negative_signature_categories: ["access_control_caching"] precisely so
      // a guarded/lazy class cannot collapse into Adapter.)
      question:
        'This class also holds a member of the same interface and forwards to it. Adapter or Proxy?',
      code:
        'class ImageProxy : public Image {\n'
        + 'public:\n'
        + '  void draw() override {\n'
        + '    if (!real_) {                              // access control: lazy init guard\n'
        + '      real_ = std::make_unique<HiResImage>(path_);\n'
        + '    }\n'
        + '    real_->draw();                             // forward only after the guard\n'
        + '  }\n'
        + 'private:\n'
        + '  std::unique_ptr<HiResImage> real_;\n'
        + '  std::string path_;\n'
        + '};',
      options: [
        'Adapter — it adapts HiResImage to the Image interface.',
        'Proxy — it controls access to the real subject (here, lazy creation).',
        'Decorator — it adds a visible responsibility to draw().',
        'Strategy — the caller injects the algorithm.',
      ],
      correctIndex: 1,
      explanation:
        'The deciding cue is access control: the `if (!real_) … make_unique<HiResImage>()` guard defers creating the real subject until first use — a canonical Virtual Proxy. Forwarding happens only behind that gate. Adapter explicitly declares access_control_caching as a negative signature so a lazy/guarded class cannot be mistaken for it; Adapter is a bare interface translation with no gate.',
    },
    {
      // Builder vs plain method-chaining — both end setters in `return *this`.
      // Resolving cue: a terminator that returns a PRODUCT. Here build()
      // returns Pizza → Builder. Without it, the same fluent shape is bare
      // method chaining.
      question:
        'Both Builder and plain method-chaining use fluent setters that `return *this`. What makes the class below specifically a Builder?',
      code:
        'class PizzaBuilder {\n'
        + 'public:\n'
        + '  PizzaBuilder& setSize(int s)        { size_ = s; return *this; }\n'
        + '  PizzaBuilder& addTopping(Topping t) { tops_.push_back(t); return *this; }\n'
        + '  Pizza build() const;                // terminator hands back a PRODUCT\n'
        + 'private:\n'
        + '  int size_;\n'
        + '  std::vector<Topping> tops_;\n'
        + '};',
      options: [
        'Any class with `return *this` is automatically a Builder.',
        'A terminator method (build()) that returns a constructed product — not just the chainable `*this`.',
        'The class name ends in "Builder".',
        'It stores its fields in a std::vector.',
      ],
      correctIndex: 1,
      explanation:
        'The shared fluent shape is `return *this` on the setters — that alone is just method-chaining. Builder adds a terminator (build() / finalize()) that returns the constructed PRODUCT (here a Pizza). The terminator is the semantic cue; neither the class name nor the field types decide it.',
    },
  ],
  'foundations-structural-rules': [
    {
      question: 'In the matcher’s vocabulary, what does "must-have" mean for a pattern?',
      options: [
        'Every listed token must appear at least once.',
        'At least one combo from the must-have set must fire for the class to match.',
        'The class must contain the pattern name as a comment.',
        'The class must inherit from a sealed base.',
      ],
      correctIndex: 1,
      explanation: 'must-have = at least one combo present.',
    },
    {
      question: 'What does a "must-not-have" combo do when it fires?',
      options: [
        'Nothing — it is only advisory.',
        'It rejects the class for that pattern even if the rest matches.',
        'It adds the pattern as a second candidate.',
        'It renames the class.',
      ],
      correctIndex: 1,
      explanation: 'A single must-not-have match rejects the class for that pattern.',
    },
  ],
  'foundations-context-variation': [
    {
      question: 'How does the analyser handle team-specific naming conventions?',
      options: [
        'It refuses to match anything that does not follow Gang-of-Four naming.',
        'It standardises on language structure for matching; team conventions are layered on top for culture.',
        'It auto-renames the source.',
        'It only matches identifiers spelled in PascalCase.',
      ],
      correctIndex: 1,
      explanation: 'Language structure is the universal ground; team style sits on top.',
    },
    {
      question: 'Why does a stable, structure-based rule matter for CodiNeo specifically?',
      options: [
        'Because detection feeds automatic unit-test generation, which needs a consistent rule.',
        'Because it makes the UI prettier.',
        'Because the C++ standard requires it.',
        'Because team naming is always identical.',
      ],
      correctIndex: 0,
      explanation: 'A stable structural rule is what makes downstream tooling (test generation) reliable.',
    },
  ],
  'foundations-postrequisite': [
    {
      question: 'After Foundations, what kind of question is the catalog NOT trying to answer?',
      options: [
        'Which structural shape this class matches.',
        'Whether the chosen pattern fits the team’s organisational conventions and goals.',
        'Which stdlib symbols are present.',
        'Whether the class declares a constructor.',
      ],
      correctIndex: 1,
      explanation: 'Patterns are also a conversation — the organisational fit is yours to decide.',
    },
    {
      question: 'The post-Foundations questions are intentionally…',
      options: [
        'Closed, with one correct answer the analyser grades.',
        'Open-ended — every working developer should have an opinion, but there is no single right answer.',
        'About C++ syntax only.',
        'Graded by this module before you continue.',
      ],
      correctIndex: 1,
      explanation: 'They are discussion prompts for your next code review, not graded items.',
    },
  ],
};

// Slugs the analyser actually emits — derived from the catalog under
// Codebase/Microservice/pattern_catalog. Modules whose pattern is NOT
// in this set fall back to a quiz practical so the linear gate stays
// pass-able. Aliases map a route slug to the catalog's canonical key
// (e.g. /patterns/factory-method vs catalog `creational.factory`).
// Slugs actually emitted by the microservice — verified against
// Codebase/Microservice/pattern_catalog. The router slug in patternData.ts
// is mapped to the canonical detection slug here via PATTERN_SLUG_ALIAS so
// the front-end practical can pass when the analyser's tag set includes
// the catalog-canonical id. Missing any of these is what makes a learning
// module fall through to the "no practical" branch and lock the next step.
// Kept in sync with Codebase/Microservice/pattern_catalog (now GoF 23/23
// complete + idioms). Values are the *detectionSlug* attachPractical computes
// (alias.slug ?? pattern.slug), normalised at match time by
// normalizePatternKey. Every catalog-detectable pattern gets a code-submission
// practical; only patterns with NO catalog detector (e.g. Repository, which is
// not GoF and ships no catalog JSON) fall back to a quiz. If a new pattern JSON
// is added to the catalog, add its route slug here so the learning module
// switches from quiz/none to a code submission.
const DETECTED_PATTERN_SLUGS = new Set<string>([
  // creational
  'singleton', 'builder', 'method-chaining', 'factory', 'abstract-factory', 'prototype',
  // structural
  'adapter', 'decorator', 'proxy', 'bridge', 'composite', 'facade', 'flyweight',
  // behavioural — 'strategyinterface' is the alias target for the 'strategy'
  // route slug (catalog id behavioural.strategy_interface).
  'strategyinterface', 'observer', 'iterator', 'command', 'state',
  'template-method', 'chain-of-responsibility', 'mediator', 'memento',
  'interpreter', 'visitor',
  // idiom
  'pimpl',
]);
const PATTERN_SLUG_ALIAS: Record<string, { slug: string; name: string }> = {
  // Router slug "factory-method" → microservice tag "creational.factory".
  'factory-method': { slug: 'factory', name: 'Factory' },
  // Router slug "strategy" → microservice tag "behavioural.strategy_interface".
  // Keep the spaces in the display name so the practical UI reads naturally
  // even though the detector's underlying id has an underscore.
  'strategy': { slug: 'strategyinterface', name: 'Strategy Interface' },
};

// Repository ships no catalog JSON (it is not a Gang-of-Four pattern), so its
// module ends at the theoretical exam — no practical. Keyed by router slug.
const NON_DETECTED_THEORY: Record<string, ReadonlyArray<ExamQuestion>> = {
  repository: [
    {
      question: 'Repository is not a Gang of Four pattern. Which sentence captures its purpose best?',
      options: [
        'Hide data-source details (DB, file, API) behind a collection-like interface so business code talks to one shape.',
        'Guarantee a class has only one instance.',
        'Wrap an object so it conforms to a different interface.',
        'Pick which subclass to instantiate at runtime.',
      ],
      correctIndex: 0,
      explanation: 'Repository (Evans 2003, "Domain-Driven Design"): mediates between the domain and data-mapping layers using a collection-like interface. Not in GoF (Gamma et al. 1994), but widely adopted.',
    },
    {
      question: 'Why does Repository have no practical exam on this site?',
      options: [
        'It is too simple to test.',
        'It ships no catalog detector (not a GoF pattern), so the analyser cannot tag it — the module ends at the theoretical exam.',
        'Practical exams only exist for Creational patterns.',
        'Repository is the same as Singleton.',
      ],
      correctIndex: 1,
      explanation: 'Only catalog-detectable patterns get a Studio practical; Repository ends at the theoretical exam.',
    },
  ],
};

// Per-pattern theoretical exam banks, keyed by the detectionSlug attachExams
// computes (alias-resolved). Every detectable pattern/idiom has one so the
// theoretical gate is a real comprehension check, not a single question.
// A pattern missing from this map falls back to a generated question built
// from its catalog copy so the gate always stays pass-able.
const PATTERN_THEORY: Record<string, ReadonlyArray<ExamQuestion>> = {
  // ---- creational ----
  singleton: [
    {
      question: 'What does Singleton guarantee?',
      options: [
        'A class has exactly one instance, with a global access point to it.',
        'A class can be subclassed freely.',
        'Objects are created from a prototype.',
        'Construction is split across a builder.',
      ],
      correctIndex: 0,
      explanation: 'Singleton restricts a class to one instance and provides a single access point.',
    },
    {
      question: 'Which structural signal typically marks a Singleton in C++?',
      options: [
        'A public constructor and many instances.',
        'A private/deleted constructor plus a static accessor returning the one instance.',
        'A pure virtual interface with no implementation.',
        'A `return *this` chain of setters.',
      ],
      correctIndex: 1,
      explanation: 'Hidden constructor + static accessor is the recognisable shape.',
    },
  ],
  builder: [
    {
      question: 'What problem does Builder solve?',
      options: [
        'Constructing a complex object step by step, separating construction from representation.',
        'Ensuring only one instance exists.',
        'Letting objects notify observers of changes.',
        'Adapting one interface to another.',
      ],
      correctIndex: 0,
      explanation: 'Builder assembles a complex object incrementally.',
    },
    {
      question: 'Which token shape co-occurs with Builder’s fluent style?',
      options: [
        '`return *this;` from setter-style methods so calls chain.',
        'A static instance accessor.',
        'A forward-declared inner Impl.',
        'A visitor double-dispatch.',
      ],
      correctIndex: 0,
      explanation: 'Fluent builders return `*this`, which is why Builder and Method Chaining share a shape.',
    },
  ],
  'method-chaining': [
    {
      question: 'What is Method Chaining (a fluent idiom)?',
      options: [
        'Methods return the receiver (`*this`) so calls chain into one expression.',
        'A class guarantees a single instance.',
        'An algorithm is selected at runtime via an interface.',
        'A request is wrapped as an object.',
      ],
      correctIndex: 0,
      explanation: 'Method Chaining returns `*this` to enable fluent call chains.',
    },
    {
      question: 'Why is Method Chaining easy to confuse with Builder?',
      options: [
        'Both rely on `return *this`, so they share a structural shape.',
        'Both restrict instances to one.',
        'Both traverse a tree.',
        'Both notify observers.',
      ],
      correctIndex: 0,
      explanation: 'The shared `return *this` shape is a built-in ambiguity.',
    },
  ],
  factory: [
    {
      question: 'What does Factory Method do?',
      options: [
        'Defines an interface for creating an object but lets subclasses decide which class to instantiate.',
        'Guarantees one instance of a class.',
        'Composes objects into tree structures.',
        'Adds behaviour to an object dynamically.',
      ],
      correctIndex: 0,
      explanation: 'Factory Method defers instantiation to subclasses behind a creation interface.',
    },
    {
      question: 'Which principle does Factory Method rest on?',
      options: [
        'Program to an interface — callers depend on the product abstraction, not a concrete class.',
        'Always inherit, never compose.',
        'Hide every constructor.',
        'Mutate global state.',
      ],
      correctIndex: 0,
      explanation: 'Callers route through the abstraction, so swapping the concrete product is localised.',
    },
  ],
  'abstract-factory': [
    {
      question: 'What does Abstract Factory provide?',
      options: [
        'An interface for creating families of related objects without specifying their concrete classes.',
        'A single global instance.',
        'A way to traverse a collection.',
        'A wrapper that changes an interface.',
      ],
      correctIndex: 0,
      explanation: 'Abstract Factory makes whole families of products interchangeable.',
    },
    {
      question: 'How does Abstract Factory differ from Factory Method?',
      options: [
        'Abstract Factory creates families of products; Factory Method creates one product via subclassing.',
        'They are identical.',
        'Abstract Factory guarantees one instance.',
        'Factory Method composes trees.',
      ],
      correctIndex: 0,
      explanation: 'Abstract Factory groups several related factory methods into one family interface.',
    },
  ],
  prototype: [
    {
      question: 'What does Prototype do?',
      options: [
        'Creates new objects by cloning an existing instance (the prototype).',
        'Restricts a class to one instance.',
        'Selects an algorithm at runtime.',
        'Wraps a request as an object.',
      ],
      correctIndex: 0,
      explanation: 'Prototype produces new objects by copying a prototypical instance.',
    },
    {
      question: 'When is Prototype most useful?',
      options: [
        'When object construction is expensive or its concrete class is unknown, but a copyable instance exists.',
        'When you need exactly one instance.',
        'When you must adapt two interfaces.',
        'When you traverse a tree of nodes.',
      ],
      correctIndex: 0,
      explanation: 'Cloning sidesteps costly or class-specific construction.',
    },
  ],
  // ---- structural ----
  adapter: [
    {
      question: 'What does Adapter do?',
      options: [
        'Converts the interface of a class into another interface clients expect.',
        'Guarantees a single instance.',
        'Adds responsibilities to an object dynamically.',
        'Defines a family of algorithms.',
      ],
      correctIndex: 0,
      explanation: 'Adapter makes incompatible interfaces work together by translating one to the other.',
    },
    {
      question: 'Why can Adapter look like Decorator or Proxy?',
      options: [
        'All three hold a wrapped member and forward calls to it.',
        'All three guarantee one instance.',
        'All three clone a prototype.',
        'All three traverse a collection.',
      ],
      correctIndex: 0,
      explanation: 'The wrap-and-forward shape is shared, so these three are structurally ambiguous.',
    },
  ],
  decorator: [
    {
      question: 'What does Decorator do?',
      options: [
        'Attaches additional responsibilities to an object dynamically, as a flexible alternative to subclassing.',
        'Restricts a class to one instance.',
        'Picks a subclass to instantiate.',
        'Separates an abstraction from its implementation.',
      ],
      correctIndex: 0,
      explanation: 'Decorator layers behaviour around an object without changing its interface.',
    },
    {
      question: 'How does Decorator differ from a plain Adapter?',
      options: [
        'Decorator keeps the same interface and adds behaviour; Adapter changes the interface.',
        'Decorator guarantees a single instance.',
        'Decorator clones objects.',
        'They are identical.',
      ],
      correctIndex: 0,
      explanation: 'Same interface + added behaviour is Decorator; interface translation is Adapter.',
    },
  ],
  proxy: [
    {
      question: 'What does Proxy do?',
      options: [
        'Provides a surrogate or placeholder for another object to control access to it.',
        'Defines a family of related products.',
        'Notifies observers of state changes.',
        'Builds an object step by step.',
      ],
      correctIndex: 0,
      explanation: 'Proxy stands in for the real subject and controls access (lazy load, remote, protection).',
    },
    {
      question: 'What distinguishes Proxy from Decorator structurally in intent?',
      options: [
        'Proxy controls access to the same interface; Decorator adds behaviour to it.',
        'Proxy changes the interface; Decorator restricts instances.',
        'Proxy clones; Decorator traverses.',
        'There is no difference at all.',
      ],
      correctIndex: 0,
      explanation: 'Both wrap-and-forward; intent differs — access control vs added responsibility.',
    },
  ],
  bridge: [
    {
      question: 'What does Bridge do?',
      options: [
        'Decouples an abstraction from its implementation so the two can vary independently.',
        'Guarantees one instance.',
        'Wraps a request as an object.',
        'Clones a prototype.',
      ],
      correctIndex: 0,
      explanation: 'Bridge splits abstraction and implementation into separate hierarchies joined by composition.',
    },
    {
      question: 'Which principle underpins Bridge?',
      options: [
        'Program to an interface — the abstraction holds a pointer to an implementor interface.',
        'Always subclass for every variation.',
        'Hide all constructors.',
        'Mutate shared global state.',
      ],
      correctIndex: 0,
      explanation: 'The abstraction composes an implementor abstraction rather than inheriting concretes.',
    },
  ],
  composite: [
    {
      question: 'What does Composite do?',
      options: [
        'Composes objects into tree structures and lets clients treat individual objects and compositions uniformly.',
        'Restricts a class to one instance.',
        'Converts one interface to another.',
        'Selects an algorithm at runtime.',
      ],
      correctIndex: 0,
      explanation: 'Composite gives leaves and containers a common interface for whole-part trees.',
    },
    {
      question: 'What is the key structural feature of Composite?',
      options: [
        'A component interface that both leaves and containers implement; containers hold a collection of components.',
        'A private constructor and static accessor.',
        'A `return *this` chain.',
        'A forward-declared Impl.',
      ],
      correctIndex: 0,
      explanation: 'Uniform component interface + child collection in the container is the shape.',
    },
  ],
  facade: [
    {
      question: 'What does Facade do?',
      options: [
        'Provides a unified, simpler interface to a set of interfaces in a subsystem.',
        'Guarantees one instance.',
        'Adds behaviour dynamically.',
        'Clones objects.',
      ],
      correctIndex: 0,
      explanation: 'Facade gives a subsystem one simple front door.',
    },
    {
      question: 'Does using a Facade hide the subsystem entirely?',
      options: [
        'No — it offers a simpler entry point but clients can still use the subsystem directly if needed.',
        'Yes — the subsystem becomes inaccessible.',
        'It deletes the subsystem.',
        'It restricts the subsystem to one instance.',
      ],
      correctIndex: 0,
      explanation: 'Facade simplifies access without forbidding direct subsystem use.',
    },
  ],
  flyweight: [
    {
      question: 'What does Flyweight do?',
      options: [
        'Uses sharing to support large numbers of fine-grained objects efficiently by separating intrinsic and extrinsic state.',
        'Guarantees one instance of a class.',
        'Converts one interface to another.',
        'Builds an object step by step.',
      ],
      correctIndex: 0,
      explanation: 'Flyweight shares intrinsic state across many objects; extrinsic state is passed in.',
    },
    {
      question: 'What is "intrinsic" state in Flyweight?',
      options: [
        'State shared and stored in the flyweight, independent of context.',
        'State unique to each use, passed in by the client.',
        'The single global instance.',
        'The wrapped subject.',
      ],
      correctIndex: 0,
      explanation: 'Intrinsic = shareable/context-free; extrinsic = supplied per use.',
    },
  ],
  // ---- behavioural ----
  strategyinterface: [
    {
      question: 'What does Strategy do?',
      options: [
        'Defines a family of algorithms, encapsulates each, and makes them interchangeable behind one interface.',
        'Guarantees a single instance.',
        'Composes objects into trees.',
        'Clones a prototype.',
      ],
      correctIndex: 0,
      explanation: 'Strategy lets the algorithm vary independently of the clients that use it.',
    },
    {
      question: 'How does a context use a Strategy?',
      options: [
        'It holds a pointer to the strategy interface and delegates the varying step to it.',
        'It inherits from every concrete algorithm.',
        'It hides its constructor.',
        'It returns `*this` to chain.',
      ],
      correctIndex: 0,
      explanation: 'The context composes a strategy interface and delegates, so algorithms swap freely.',
    },
  ],
  observer: [
    {
      question: 'What does Observer do?',
      options: [
        'Defines a one-to-many dependency so when one object changes state, its dependents are notified automatically.',
        'Restricts a class to one instance.',
        'Converts one interface to another.',
        'Builds an object step by step.',
      ],
      correctIndex: 0,
      explanation: 'Observer pushes change notifications to a list of subscribers.',
    },
    {
      question: 'What is the subject’s responsibility in Observer?',
      options: [
        'Maintain a list of observers and notify them on state change.',
        'Clone itself on demand.',
        'Translate interfaces.',
        'Guarantee a single instance.',
      ],
      correctIndex: 0,
      explanation: 'The subject keeps the observer list and broadcasts updates.',
    },
  ],
  iterator: [
    {
      question: 'What does Iterator do?',
      options: [
        'Provides sequential access to a collection’s elements without exposing its underlying representation.',
        'Guarantees one instance.',
        'Adds behaviour dynamically.',
        'Decouples abstraction from implementation.',
      ],
      correctIndex: 0,
      explanation: 'Iterator walks a collection without revealing its internal structure.',
    },
    {
      question: 'Why is exposing iteration via an iterator useful?',
      options: [
        'Multiple traversals can run independently and the collection’s internals stay hidden.',
        'It forces the collection to be a singleton.',
        'It clones every element.',
        'It changes the collection’s interface to match a client.',
      ],
      correctIndex: 0,
      explanation: 'The iterator encapsulates position, so traversal is decoupled from storage.',
    },
  ],
  command: [
    {
      question: 'What does Command do?',
      options: [
        'Encapsulates a request as an object, letting you parameterise, queue, log, and undo operations.',
        'Guarantees a single instance.',
        'Composes objects into trees.',
        'Shares fine-grained objects.',
      ],
      correctIndex: 0,
      explanation: 'Command turns an action into a first-class object.',
    },
    {
      question: 'What does turning a request into an object enable?',
      options: [
        'Queuing, logging, and undo/redo of operations.',
        'Guaranteeing one instance.',
        'Interface translation.',
        'Cloning prototypes.',
      ],
      correctIndex: 0,
      explanation: 'A reified request can be stored, replayed, and reversed.',
    },
  ],
  state: [
    {
      question: 'What does State do?',
      options: [
        'Lets an object alter its behaviour when its internal state changes, appearing to change its class.',
        'Guarantees a single instance.',
        'Converts one interface to another.',
        'Builds an object step by step.',
      ],
      correctIndex: 0,
      explanation: 'State delegates behaviour to a state object that can be swapped at runtime.',
    },
    {
      question: 'How does State differ from Strategy structurally?',
      options: [
        'They share a shape (delegate to an interface); State transitions between states internally, Strategy is chosen by the client.',
        'State guarantees one instance.',
        'State clones prototypes.',
        'They are unrelated.',
      ],
      correctIndex: 0,
      explanation: 'Same delegation shape; intent differs — internal transitions vs client-chosen algorithm.',
    },
  ],
  'template-method': [
    {
      question: 'What does Template Method do?',
      options: [
        'Defines the skeleton of an algorithm in a base method, deferring some steps to subclasses.',
        'Guarantees a single instance.',
        'Composes objects into trees.',
        'Encapsulates a request as an object.',
      ],
      correctIndex: 0,
      explanation: 'Template Method fixes the algorithm’s structure and lets subclasses fill in steps.',
    },
    {
      question: 'Which mechanism does Template Method rely on?',
      options: [
        'A non-virtual base method calling overridable (often virtual) primitive steps.',
        'A static accessor returning one instance.',
        '`return *this` chaining.',
        'A forward-declared Impl.',
      ],
      correctIndex: 0,
      explanation: 'The fixed method calls virtual hook steps the subclass overrides.',
    },
  ],
  'chain-of-responsibility': [
    {
      question: 'What does Chain of Responsibility do?',
      options: [
        'Passes a request along a chain of handlers until one handles it, decoupling sender from receiver.',
        'Guarantees one instance.',
        'Adapts one interface to another.',
        'Clones a prototype.',
      ],
      correctIndex: 0,
      explanation: 'Each handler either handles the request or forwards it to the next.',
    },
    {
      question: 'What does each handler hold?',
      options: [
        'A reference to the next handler in the chain.',
        'A static single instance.',
        'A wrapped subject for access control.',
        'A child collection of components.',
      ],
      correctIndex: 0,
      explanation: 'The "next handler" link is what forms the chain.',
    },
  ],
  mediator: [
    {
      question: 'What does Mediator do?',
      options: [
        'Encapsulates how a set of objects interact, so they refer to the mediator instead of each other.',
        'Guarantees a single instance.',
        'Converts one interface to another.',
        'Builds an object step by step.',
      ],
      correctIndex: 0,
      explanation: 'Mediator centralises many-to-many communication into one hub.',
    },
    {
      question: 'What coupling problem does Mediator reduce?',
      options: [
        'Dense object-to-object references; colleagues talk through the mediator instead.',
        'Too few instances of a class.',
        'Interface mismatch between two libraries.',
        'Expensive object construction.',
      ],
      correctIndex: 0,
      explanation: 'Mediator turns a tangle of direct references into spokes around a hub.',
    },
  ],
  memento: [
    {
      question: 'What does Memento do?',
      options: [
        'Captures and externalises an object’s internal state so it can be restored later, without violating encapsulation.',
        'Guarantees one instance.',
        'Adapts one interface to another.',
        'Composes objects into trees.',
      ],
      correctIndex: 0,
      explanation: 'Memento snapshots state for later restore while keeping internals hidden.',
    },
    {
      question: 'Which roles does Memento define?',
      options: [
        'Originator (owns state), Memento (snapshot), Caretaker (holds snapshots).',
        'Subject and Observer.',
        'Abstraction and Implementor.',
        'Component and Leaf.',
      ],
      correctIndex: 0,
      explanation: 'Originator creates/restores; Caretaker stores; Memento is the opaque snapshot.',
    },
  ],
  interpreter: [
    {
      question: 'What does Interpreter do?',
      options: [
        'Defines a grammar representation and an interpreter that evaluates sentences in the language.',
        'Guarantees a single instance.',
        'Converts one interface to another.',
        'Shares fine-grained objects.',
      ],
      correctIndex: 0,
      explanation: 'Interpreter models grammar rules as classes that evaluate expressions.',
    },
    {
      question: 'How are grammar rules usually represented in Interpreter?',
      options: [
        'As a class hierarchy of expression nodes with an `interpret()` operation.',
        'As a single static instance.',
        'As a fluent `return *this` chain.',
        'As a forward-declared Impl.',
      ],
      correctIndex: 0,
      explanation: 'Each rule is an expression class implementing interpret(); composites build the tree.',
    },
  ],
  visitor: [
    {
      question: 'What does Visitor do?',
      options: [
        'Represents an operation to be performed on elements of an object structure, letting you add operations without changing the elements.',
        'Guarantees one instance.',
        'Adapts one interface to another.',
        'Builds an object step by step.',
      ],
      correctIndex: 0,
      explanation: 'Visitor externalises operations so new ones don’t touch the element classes.',
    },
    {
      question: 'Which mechanism makes Visitor work?',
      options: [
        'Double dispatch — element.accept(visitor) calls visitor.visit(element).',
        'A static single-instance accessor.',
        '`return *this` chaining.',
        'A wrapped subject for access control.',
      ],
      correctIndex: 0,
      explanation: 'accept/visit double dispatch routes to the right visit overload per element type.',
    },
  ],
  // ---- idiom ----
  pimpl: [
    {
      question: 'What does the PIMPL idiom (Pointer to Implementation) do?',
      options: [
        'Moves a class’s private members into a hidden implementation type behind a pointer, cutting compile-time coupling.',
        'Guarantees a single instance.',
        'Defines a family of algorithms.',
        'Notifies observers of changes.',
      ],
      correctIndex: 0,
      explanation: 'PIMPL hides implementation details behind an opaque pointer, reducing header dependencies.',
    },
    {
      question: 'Which structural shape does the analyser look for in PIMPL?',
      options: [
        'A forward-declared inner Impl plus a std::unique_ptr<Impl> member that owns it.',
        'A private constructor and static accessor.',
        'A component interface with a child collection.',
        'An accept/visit double dispatch.',
      ],
      correctIndex: 0,
      explanation: 'Forward-declared Impl + unique_ptr<Impl> in order is the recognisable PIMPL shape.',
    },
  ],
};

// Build a single fallback theoretical question from a pattern's catalog copy,
// used only if PATTERN_THEORY has no authored bank for the detection slug. This
// keeps the theoretical gate pass-able for any future catalog pattern.
function buildPatternTheoryFallback(patternName: string, intent: string): ReadonlyArray<ExamQuestion> {
  return [
    {
      question: `Which sentence best describes the ${patternName} pattern?`,
      options: [
        intent || `The ${patternName} pattern as defined by the Gang of Four.`,
        'A pattern that guarantees a class has exactly one instance.',
        'A pattern that converts one interface into another.',
        'A pattern that composes objects into part-whole trees.',
      ],
      correctIndex: 0,
      explanation: `${patternName}: ${intent}`,
    },
  ];
}

// Attach the theoretical exam (every module) and, for detectable pattern/idiom
// modules, the practical exam (Studio code-check). Foundations and Repository
// end at the theoretical exam (D86).
function attachExams(module: LearningModule): LearningModule {
  if (module.category === 'foundations') {
    const questions = FOUNDATIONS_THEORY[module.id];
    if (questions) {
      return { ...module, theoreticalExam: { kind: 'theoretical', questions: tagQuestions(module.id, questions) } };
    }
    return module;
  }
  // Pattern modules: derive the target pattern from the slug embedded in
  // the module id (`${category}-${pattern.slug}`). The slug is stable
  // because buildPatternModule emitted it.
  const slug = module.id.replace(/^[a-z]+-/, '');
  const pattern = PATTERNS.find((p) => p.slug === slug);
  if (!pattern) return module;

  // Non-detectable pattern (Repository): theoretical exam only, no practical.
  const nonDetectedTheory = NON_DETECTED_THEORY[pattern.slug];
  if (nonDetectedTheory) {
    return { ...module, theoreticalExam: { kind: 'theoretical', questions: tagQuestions(module.id, nonDetectedTheory) } };
  }

  // Honor catalog aliases (e.g. factory-method route → catalog `factory`).
  const alias = PATTERN_SLUG_ALIAS[pattern.slug];
  const detectionSlug = alias?.slug ?? pattern.slug;
  const detectionName = alias?.name ?? pattern.name;

  const theoryQuestions =
    PATTERN_THEORY[detectionSlug] ??
    buildPatternTheoryFallback(pattern.name, pattern.intent);
  const theoreticalExam: TheoreticalExam = { kind: 'theoretical', questions: tagQuestions(module.id, theoryQuestions) };

  if (!DETECTED_PATTERN_SLUGS.has(detectionSlug)) {
    // Defensive: pattern is in PATTERNS but not detectable and not in
    // NON_DETECTED_THEORY — ship the theoretical exam alone rather than a
    // practical that cannot pass.
    return { ...module, theoreticalExam };
  }

  const familyName = pattern.family as PracticalExam['family'];
  const starterCode = PATTERN_STARTERS[detectionSlug];
  const practicalExam: PracticalExam = {
    kind: 'practical',
    patternSlug: detectionSlug,
    patternName: detectionName,
    family: familyName,
    taxonomy: pattern.family === 'Structural' ? 'analyzing' : 'applying',
    prompt: `Write a small C++ class (or two) that demonstrates the ${pattern.name} pattern. The analyser passes you when the response tags include ${detectionName}, even if other patterns also fire on the same class.`,
    ...(starterCode ? { starterCode } : {}),
  };
  return { ...module, theoreticalExam, practicalExam };
}

// Editor seeds for patterns whose detector is order-sensitive enough that a
// blank "write a class" prompt leaves learners guessing the exact token shape.
// The scaffold already tags the target pattern, so the learner can Run-check
// (see green), then modify it to learn the moving parts. Keyed by the
// detectionSlug attachPractical computes.
const PATTERN_STARTERS: Record<string, string> = {
  pimpl: `// PIMPL idiom — the analyser passes when it tags "Pimpl".
// The shape it looks for, in order, inside ONE class body:
//   1. a forward-declared inner struct/class (e.g. \`struct Impl;\`)
//   2. a std::unique_ptr<Impl> member that owns it
// Try running this as-is, then rename Impl / add your own methods.
#include <memory>

class Widget {
public:
  Widget();
  ~Widget();
  void doThing();

private:
  struct Impl;                  // forward-declared implementation
  std::unique_ptr<Impl> impl_;  // owns the hidden Impl
};
`,
};

const FOUNDATIONS_MODULES_WITH_EXAMS: ReadonlyArray<LearningModule> =
  FOUNDATIONS_MODULES.map(attachExams);

const PATTERN_MODULES: ReadonlyArray<LearningModule> = PATTERN_MODULES_RAW.map(attachExams);

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export const LEARNING_MODULES: ReadonlyArray<LearningModule> = [
  ...FOUNDATIONS_MODULES_WITH_EXAMS,
  ...PATTERN_MODULES,
];

export function findLearningModule(id: string): LearningModule | undefined {
  return LEARNING_MODULES.find((m) => m.id === id);
}

export function modulesInCategory(
  category: LearningCategory,
): ReadonlyArray<LearningModule> {
  return LEARNING_MODULES.filter((m) => m.category === category);
}
