// Learning modules for the /patterns/learn surface (D77).
//
// Each module is independent in content: it reads end-to-end without
// pulling material in from other modules. The "See also" footer is a
// read-only pointer set; clicking switches to another module but never
// auto-folds content from one module into another. Round-3 ordering
// (Foundations → Creational → Structural → Behavioural → Idioms) drives
// the linear unlock gate in PatternsLearnPage.

import { PATTERNS } from '../components/marketing/patterns/patternData';

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

export interface LearningQuizPractical {
  kind: 'quiz';
  question: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
  explanation?: string;
}

export interface LearningPatternPractical {
  kind: 'pattern';
  // Slug from PATTERNS (e.g. 'singleton', 'factory-method'). Compared
  // against detection.patternId / patternName via normalize() so the
  // microservice's "creational.singleton" form matches "Singleton" too.
  patternSlug: string;
  // Display name shown to the user in the verdict line.
  patternName: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  // Prompt sentence shown above the textarea.
  prompt: string;
}

export type LearningPractical = LearningQuizPractical | LearningPatternPractical;

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
  // Round-3 (linear-gate) practical check. Foundations modules use a
  // single-question quiz; pattern modules use a /api/analyze code-check
  // against the microservice. Module N unlocks only when module N-1's
  // practical is passed.
  practical?: LearningPractical;
}

export interface LearningCategoryMeta {
  id: LearningCategory;
  name: string;
  gist: string;
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
// Foundations modules — ported from StudentLearningHub.INTRO_LESSONS and
// tightened so each module reads as a standalone reference. Citations
// trimmed to those actually relevant to the module's claim.
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
        heading: 'How NeoTerritory uses it',
        body:
          'NeoTerritory builds a parse tree from the user\'s C++ source, mirrors it into a virtual structural copy, and runs pattern checks against the virtual tree. The original parse tree is never mutated — so every detection result can be traced back to specific lines in the user\'s source.',
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
        heading: 'How NeoTerritory uses this rule',
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
    id: 'foundations-structural-rules',
    category: 'foundations',
    title: 'Each pattern has a structural rule',
    eyebrow: 'Foundations · Module 11',
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
    eyebrow: 'Foundations · Module 12',
    intro:
      'Two teams that both claim to use Builder can write code that looks different. NeoTerritory does not pick one team\'s convention as universal truth — it standardises on language-level structure so detection stays consistent.',
    sections: [
      {
        heading: 'What this means',
        bullets: [
          'Same pattern name can mean different things in different orgs.',
          'Standardising on language-level structure (not naming) is what enables tooling.',
          'NeoTerritory\'s detection feeds into automatic unit-test generation, so a stable rule matters.',
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
    eyebrow: 'Foundations · Module 13',
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
// Practicals — one per module, used as the linear-gate unlock criterion.
// Foundations modules get a single-question multiple-choice quiz; pattern
// modules get a code-submission check that runs against /api/analyze and
// passes iff the target patternId / patternName is in the response.
// -------------------------------------------------------------------------

const FOUNDATIONS_QUIZZES: Record<string, LearningQuizPractical> = {
  'foundations-what-is-pattern': {
    kind: 'quiz',
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
  'foundations-why-matters': {
    kind: 'quiz',
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
  'foundations-categories': {
    kind: 'quiz',
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
  'foundations-oop': {
    kind: 'quiz',
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
  'foundations-interface-principle': {
    kind: 'quiz',
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
  'foundations-code-structure': {
    kind: 'quiz',
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
  'foundations-real-software': {
    kind: 'quiz',
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
  'foundations-beginner-mistakes': {
    kind: 'quiz',
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
  'foundations-ambiguity': {
    kind: 'quiz',
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
  'foundations-connotative-definition': {
    kind: 'quiz',
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
  'foundations-structural-rules': {
    kind: 'quiz',
    question: 'In the matcher’s vocabulary, what does "must-have" mean for a pattern?',
    options: [
      'Every listed token must appear at least once.',
      'At least one combo from the must-have set must fire for the class to match.',
      'The class must contain the pattern name as a comment.',
      'The class must inherit from a sealed base.',
    ],
    correctIndex: 1,
    explanation: 'must-have = at least one combo present. must-not-have = any one match rejects the class.',
  },
  'foundations-context-variation': {
    kind: 'quiz',
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
  'foundations-postrequisite': {
    kind: 'quiz',
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
};

function attachPractical(module: LearningModule): LearningModule {
  if (module.category === 'foundations') {
    const quiz = FOUNDATIONS_QUIZZES[module.id];
    if (quiz) return { ...module, practical: quiz };
    return module;
  }
  // Pattern modules: derive the target pattern from the slug embedded in
  // the module id (`${category}-${pattern.slug}`). The slug is stable
  // because buildPatternModule emitted it.
  const slug = module.id.replace(/^[a-z]+-/, '');
  const pattern = PATTERNS.find((p) => p.slug === slug);
  if (!pattern) return module;
  const familyName = pattern.family as LearningPatternPractical['family'];
  const practical: LearningPatternPractical = {
    kind: 'pattern',
    patternSlug: pattern.slug,
    patternName: pattern.name,
    family: familyName,
    prompt: `Write a small C++ class (or two) that demonstrates the ${pattern.name} pattern. The analyser passes you when the response tags include ${pattern.name}, even if other patterns also fire on the same class.`,
  };
  return { ...module, practical };
}

const FOUNDATIONS_MODULES_WITH_PRACTICAL: ReadonlyArray<LearningModule> =
  FOUNDATIONS_MODULES.map(attachPractical);

const PATTERN_MODULES: ReadonlyArray<LearningModule> = PATTERN_MODULES_RAW.map(attachPractical);

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export const LEARNING_MODULES: ReadonlyArray<LearningModule> = [
  ...FOUNDATIONS_MODULES_WITH_PRACTICAL,
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
