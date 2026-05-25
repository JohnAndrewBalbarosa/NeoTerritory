// Pre-test / post-test assessment bank for the /patterns/learn surface.
//
// WHY THIS EXISTS: the thesis panel rejected a plain Likert questionnaire as a
// learning measure — a learner can guess agreement without actually knowing
// the material. This bank is KNOWLEDGE-BASED: every item has a correct answer,
// so a score is objective. We compare a PRE score (before the path/section)
// with a POST score (after) to measure real improvement.
//
// DESIGN:
//   - Two levels of assessment (both requested by the project owner):
//       • scope 'path'  → one pre before the whole path, one post after it.
//       • scope '<family>' → a pre before each section and a post after it.
//   - PARALLEL FORMS: the pre and post forms for a scope are DIFFERENT items
//     that test the SAME constructs (matched by `topic`), so a learner can't
//     just memorise the pre answers. Each pre item has a post counterpart at
//     equal difficulty.
//   - Item kinds: 'mcq' (conceptual) and 'code-reading' (identify the pattern
//     from a C++ snippet). Both are multiple-choice with one correct option.
//
// CONTENT STATUS: this is a DRAFT bank authored for wiring + first testing.
// Wording, correctness, and difficulty are to be validated by the supervising
// professor; the professor also sets the proficiency score ranges, which the
// statistician then validates. Those ranges live in admin-configurable
// settings (see backend app_settings 'proficiency_bands'); DEFAULT_PROFICIENCY_BANDS
// below is only the fallback shown before an admin tunes them.

import { CATEGORY_META, type LearningCategory } from './learningModules';

export type AssessmentScope = 'path' | LearningCategory;
export type AssessmentPhase = 'pre' | 'post';
export type AssessmentItemKind = 'mcq' | 'code-reading';

export interface AssessmentItem {
  // Stable id, namespaced by scope + phase, e.g. 'creational.pre.q1'. The id
  // is what the backend stores per answer, so it must never be reused for a
  // different question.
  id: string;
  kind: AssessmentItemKind;
  // The construct under test. Pre and post items that share a topic are
  // isomorphic counterparts — this is what makes the forms parallel.
  topic: string;
  prompt: string;
  // Present only for 'code-reading' items: the C++ snippet to inspect.
  code?: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
}

export interface AssessmentForm {
  scope: AssessmentScope;
  phase: AssessmentPhase;
  title: string;
  intro: string;
  items: ReadonlyArray<AssessmentItem>;
}

export interface ProficiencyBand {
  // Inclusive lower bound and upper bound as PERCENT (0–100).
  min: number;
  max: number;
  label: string;
}

// Fallback bands. The authoritative ranges are admin-configurable and set by
// the professor (validated by the statistician). Mirrors the backend default.
export const DEFAULT_PROFICIENCY_BANDS: ReadonlyArray<ProficiencyBand> = [
  { min: 0, max: 49, label: 'Beginning' },
  { min: 50, max: 74, label: 'Developing' },
  { min: 75, max: 89, label: 'Proficient' },
  { min: 90, max: 100, label: 'Advanced' },
];

// ─── Item banks ────────────────────────────────────────────────────────────
// Each scope provides a `pre` and a `post` array. Items at the same array
// index share a `topic` so the forms stay parallel.

const FOUNDATIONS_PRE: ReadonlyArray<AssessmentItem> = [
  {
    id: 'foundations.pre.q1', kind: 'mcq', topic: 'definition',
    prompt: 'In the Gang of Four sense, a design pattern is best described as:',
    options: [
      'A reusable, named solution to a recurring object-oriented design problem',
      'A finished library you import into a project',
      'A programming language feature like a loop or a class',
      'A compiler optimisation applied automatically',
    ],
    correctIndex: 0,
  },
  {
    id: 'foundations.pre.q2', kind: 'mcq', topic: 'families',
    prompt: 'The Gang of Four group patterns into three families. Which set is correct?',
    options: [
      'Creational, Structural, Behavioural',
      'Frontend, Backend, Database',
      'Static, Dynamic, Hybrid',
      'Public, Private, Protected',
    ],
    correctIndex: 0,
  },
  {
    id: 'foundations.pre.q3', kind: 'mcq', topic: 'purpose',
    prompt: 'Why does sharing a pattern vocabulary help a development team?',
    options: [
      'It compresses a paragraph of structural explanation into one named term a reviewer can look up',
      'It makes the program run measurably faster at runtime',
      'It removes the need to write any documentation',
      'It guarantees the absence of bugs',
    ],
    correctIndex: 0,
  },
];

const FOUNDATIONS_POST: ReadonlyArray<AssessmentItem> = [
  {
    id: 'foundations.post.q1', kind: 'mcq', topic: 'definition',
    prompt: 'Which statement most accurately captures what a design pattern is?',
    options: [
      'A named, idiomatic arrangement of classes and operations that solves a recurring design problem',
      'A specific class you can copy-paste unchanged into any codebase',
      'A keyword built into C++ for object creation',
      'A unit-testing framework',
    ],
    correctIndex: 0,
  },
  {
    id: 'foundations.post.q2', kind: 'mcq', topic: 'families',
    prompt: 'A pattern whose primary concern is HOW OBJECTS ARE CREATED belongs to which family?',
    options: ['Creational', 'Structural', 'Behavioural', 'None — creation is not a pattern concern'],
    correctIndex: 0,
  },
  {
    id: 'foundations.post.q3', kind: 'mcq', topic: 'purpose',
    prompt: 'The main payoff of giving a recurring class arrangement a name is that it:',
    options: [
      'Turns shared architecture into a few familiar shapes the team can reason about quickly',
      'Increases the binary size for better performance',
      'Lets you skip code review',
      'Forces every class to be a singleton',
    ],
    correctIndex: 0,
  },
];

const CREATIONAL_PRE: ReadonlyArray<AssessmentItem> = [
  {
    id: 'creational.pre.q1', kind: 'mcq', topic: 'singleton',
    prompt: 'The Singleton pattern primarily guarantees that:',
    options: [
      'A class has exactly one instance with a global access point',
      'Every call creates a brand-new object',
      'Objects are copied on assignment',
      'A class can never be subclassed',
    ],
    correctIndex: 0,
  },
  {
    id: 'creational.pre.q2', kind: 'code-reading', topic: 'builder',
    prompt: 'Which pattern does this class demonstrate?',
    code: [
      'class HttpRequestBuilder {',
      'public:',
      '  HttpRequestBuilder& url(std::string u) { url_ = std::move(u); return *this; }',
      '  HttpRequestBuilder& header(std::string k, std::string v) { headers_[k] = v; return *this; }',
      '  HttpRequest build() const { return HttpRequest{url_, headers_}; }',
      '};',
    ].join('\n'),
    options: ['Builder', 'Singleton', 'Observer', 'Adapter'],
    correctIndex: 0,
  },
  {
    id: 'creational.pre.q3', kind: 'mcq', topic: 'factory',
    prompt: 'A Factory Method is most useful when:',
    options: [
      'A class should defer which concrete type to instantiate to a dedicated creation method',
      'You want two objects to always be equal',
      'You need to iterate a collection',
      'You want to lock a resource for the duration of a scope',
    ],
    correctIndex: 0,
  },
];

const CREATIONAL_POST: ReadonlyArray<AssessmentItem> = [
  {
    id: 'creational.post.q1', kind: 'mcq', topic: 'singleton',
    prompt: 'You see a class with a private constructor and a static instance() method returning a reference to one shared object. This is:',
    options: ['Singleton', 'Builder', 'Strategy', 'Decorator'],
    correctIndex: 0,
  },
  {
    id: 'creational.post.q2', kind: 'code-reading', topic: 'builder',
    prompt: 'Which pattern does this class demonstrate?',
    code: [
      'class PizzaBuilder {',
      'public:',
      '  PizzaBuilder& size(int s) { size_ = s; return *this; }',
      '  PizzaBuilder& topping(std::string t) { toppings_.push_back(t); return *this; }',
      '  Pizza build() const { return Pizza{size_, toppings_}; }',
      '};',
    ].join('\n'),
    options: ['Builder', 'Factory Method', 'Singleton', 'Proxy'],
    correctIndex: 0,
  },
  {
    id: 'creational.post.q3', kind: 'mcq', topic: 'factory',
    prompt: 'The key intent of the Factory Method pattern is to:',
    options: [
      'Let subclasses decide which concrete product gets created behind a stable creation interface',
      'Ensure a single shared instance',
      'Add behaviour to an object at runtime',
      'Provide a snapshot of object state for undo',
    ],
    correctIndex: 0,
  },
];

const STRUCTURAL_PRE: ReadonlyArray<AssessmentItem> = [
  {
    id: 'structural.pre.q1', kind: 'mcq', topic: 'adapter',
    prompt: 'The Adapter pattern exists to:',
    options: [
      'Convert one interface into another the client expects, without changing either side',
      'Create exactly one instance of a class',
      'Notify many observers of a change',
      'Build an object step by step',
    ],
    correctIndex: 0,
  },
  {
    id: 'structural.pre.q2', kind: 'code-reading', topic: 'decorator',
    prompt: 'Which pattern does this class demonstrate?',
    code: [
      'class LoggingProxy : public Service {',
      '  Service& inner_;',
      'public:',
      '  explicit LoggingProxy(Service& s) : inner_(s) {}',
      '  void handle() override { log("before"); inner_.handle(); log("after"); }',
      '};',
    ].join('\n'),
    options: [
      'Decorator / Proxy (wrapping a wrapped object of the same interface)',
      'Singleton',
      'Factory Method',
      'Builder',
    ],
    correctIndex: 0,
  },
  {
    id: 'structural.pre.q3', kind: 'mcq', topic: 'pimpl',
    prompt: 'The PIMPL idiom hides a class’s implementation by:',
    options: [
      'Forward-declaring an inner Impl type and holding it behind a unique_ptr<Impl>',
      'Marking every member public',
      'Making the class a template',
      'Returning *this from each method',
    ],
    correctIndex: 0,
  },
];

const STRUCTURAL_POST: ReadonlyArray<AssessmentItem> = [
  {
    id: 'structural.post.q1', kind: 'mcq', topic: 'adapter',
    prompt: 'A class that wraps a legacy logger and exposes the modern ILogger interface the rest of the code calls is an example of:',
    options: ['Adapter', 'Observer', 'Singleton', 'Builder'],
    correctIndex: 0,
  },
  {
    id: 'structural.post.q2', kind: 'code-reading', topic: 'decorator',
    prompt: 'Which pattern does this class demonstrate?',
    code: [
      'class TimingDecorator : public Handler {',
      '  Handler& wrapped_;',
      'public:',
      '  explicit TimingDecorator(Handler& h) : wrapped_(h) {}',
      '  void run() override { auto t0 = now(); wrapped_.run(); record(now() - t0); }',
      '};',
    ].join('\n'),
    options: [
      'Decorator (adds behaviour around an object of the same interface)',
      'Factory Method',
      'Singleton',
      'Strategy',
    ],
    correctIndex: 0,
  },
  {
    id: 'structural.post.q3', kind: 'mcq', topic: 'pimpl',
    prompt: 'Which member declaration is the structural giveaway of the PIMPL idiom?',
    options: [
      'A pointer to a forward-declared inner type, e.g. std::unique_ptr<Impl> impl_;',
      'A static instance() accessor',
      'A virtual destructor only',
      'An overloaded operator==',
    ],
    correctIndex: 0,
  },
];

const BEHAVIOURAL_PRE: ReadonlyArray<AssessmentItem> = [
  {
    id: 'behavioural.pre.q1', kind: 'mcq', topic: 'strategy',
    prompt: 'The Strategy pattern lets you:',
    options: [
      'Select an interchangeable algorithm at runtime behind a common interface',
      'Guarantee a single shared instance',
      'Convert one interface to another',
      'Construct an object incrementally',
    ],
    correctIndex: 0,
  },
  {
    id: 'behavioural.pre.q2', kind: 'code-reading', topic: 'strategy',
    prompt: 'Which pattern does this code demonstrate?',
    code: [
      'class Sorter {',
      '  CompareStrategy& cmp_;',
      'public:',
      '  explicit Sorter(CompareStrategy& c) : cmp_(c) {}',
      '  void sort(std::vector<int>& v) { /* uses cmp_.less(a, b) */ }',
      '};',
    ].join('\n'),
    options: ['Strategy', 'Singleton', 'Builder', 'Adapter'],
    correctIndex: 0,
  },
  {
    id: 'behavioural.pre.q3', kind: 'mcq', topic: 'observer',
    prompt: 'The Observer pattern is primarily about:',
    options: [
      'Notifying many dependents automatically when one subject changes state',
      'Creating one and only one instance',
      'Hiding implementation behind a pointer',
      'Returning *this for chaining',
    ],
    correctIndex: 0,
  },
];

const BEHAVIOURAL_POST: ReadonlyArray<AssessmentItem> = [
  {
    id: 'behavioural.post.q1', kind: 'mcq', topic: 'strategy',
    prompt: 'Injecting a PaymentMethod interface so a checkout can swap card/cash/wallet at runtime is an example of:',
    options: ['Strategy', 'Singleton', 'Decorator', 'Factory Method'],
    correctIndex: 0,
  },
  {
    id: 'behavioural.post.q2', kind: 'code-reading', topic: 'strategy',
    prompt: 'Which pattern does this code demonstrate?',
    code: [
      'class Compressor {',
      '  Codec& codec_;',
      'public:',
      '  explicit Compressor(Codec& c) : codec_(c) {}',
      '  Bytes run(const Bytes& in) { return codec_.encode(in); }',
      '};',
    ].join('\n'),
    options: ['Strategy', 'Observer', 'Adapter', 'Builder'],
    correctIndex: 0,
  },
  {
    id: 'behavioural.post.q3', kind: 'mcq', topic: 'observer',
    prompt: 'A subject that keeps a list of subscribers and calls notify() on each when its value changes implements:',
    options: ['Observer', 'Strategy', 'Singleton', 'PIMPL'],
    correctIndex: 0,
  },
];

const IDIOMS_PRE: ReadonlyArray<AssessmentItem> = [
  {
    id: 'idioms.pre.q1', kind: 'mcq', topic: 'raii',
    prompt: 'RAII (Resource Acquisition Is Initialization) ties resource lifetime to:',
    options: [
      'Object scope — the destructor releases the resource automatically',
      'A global flag the programmer must remember to reset',
      'The garbage collector',
      'A static counter',
    ],
    correctIndex: 0,
  },
  {
    id: 'idioms.pre.q2', kind: 'code-reading', topic: 'method-chaining',
    prompt: 'Which idiom does the return type enable here?',
    code: [
      'class Query {',
      'public:',
      '  Query& where(std::string c) { clauses_.push_back(c); return *this; }',
      '  Query& limit(int n) { limit_ = n; return *this; }',
      '};',
    ].join('\n'),
    options: ['Method chaining (fluent interface)', 'Singleton', 'Observer', 'Adapter'],
    correctIndex: 0,
  },
  {
    id: 'idioms.pre.q3', kind: 'mcq', topic: 'pimpl-idiom',
    prompt: 'A practical benefit of the PIMPL idiom is that it:',
    options: [
      'Reduces compile-time coupling by keeping implementation details out of the header',
      'Makes the class run faster at runtime in all cases',
      'Removes the need for a destructor',
      'Forces single-instance semantics',
    ],
    correctIndex: 0,
  },
];

const IDIOMS_POST: ReadonlyArray<AssessmentItem> = [
  {
    id: 'idioms.post.q1', kind: 'mcq', topic: 'raii',
    prompt: 'A std::lock_guard that locks a mutex in its constructor and unlocks in its destructor is a textbook use of:',
    options: ['RAII', 'Singleton', 'Strategy', 'Observer'],
    correctIndex: 0,
  },
  {
    id: 'idioms.post.q2', kind: 'code-reading', topic: 'method-chaining',
    prompt: 'What does returning *this from each setter enable?',
    code: [
      'class StyleBuilder {',
      'public:',
      '  StyleBuilder& color(std::string c) { color_ = c; return *this; }',
      '  StyleBuilder& weight(int w) { weight_ = w; return *this; }',
      '};',
    ].join('\n'),
    options: ['Fluent method chaining', 'RAII', 'Observer notification', 'Interface adaptation'],
    correctIndex: 0,
  },
  {
    id: 'idioms.post.q3', kind: 'mcq', topic: 'pimpl-idiom',
    prompt: 'Moving private members into a forward-declared Impl held by unique_ptr mainly improves:',
    options: [
      'Compilation firewall / ABI stability — callers don’t recompile when the impl changes',
      'Runtime memory usage to zero',
      'The need for a virtual table',
      'Thread count',
    ],
    correctIndex: 0,
  },
];

// Whole-path forms — a mixed cross-family sampler taken once before and once
// after the entire path. Topics span all four families plus foundations.
const PATH_PRE: ReadonlyArray<AssessmentItem> = [
  FOUNDATIONS_PRE[0],
  CREATIONAL_PRE[0],
  STRUCTURAL_PRE[0],
  BEHAVIOURAL_PRE[0],
  IDIOMS_PRE[0],
];

const PATH_POST: ReadonlyArray<AssessmentItem> = [
  FOUNDATIONS_POST[0],
  CREATIONAL_POST[0],
  STRUCTURAL_POST[0],
  BEHAVIOURAL_POST[0],
  IDIOMS_POST[0],
];

interface ScopeBank {
  pre: ReadonlyArray<AssessmentItem>;
  post: ReadonlyArray<AssessmentItem>;
}

const BANK: Record<AssessmentScope, ScopeBank> = {
  path: { pre: PATH_PRE, post: PATH_POST },
  foundations: { pre: FOUNDATIONS_PRE, post: FOUNDATIONS_POST },
  creational: { pre: CREATIONAL_PRE, post: CREATIONAL_POST },
  structural: { pre: STRUCTURAL_PRE, post: STRUCTURAL_POST },
  behavioural: { pre: BEHAVIOURAL_PRE, post: BEHAVIOURAL_POST },
  idioms: { pre: IDIOMS_PRE, post: IDIOMS_POST },
};

function scopeName(scope: AssessmentScope): string {
  if (scope === 'path') return 'Learning Path';
  return CATEGORY_META.find((c) => c.id === scope)?.name ?? scope;
}

export function getAssessmentForm(
  scope: AssessmentScope,
  phase: AssessmentPhase,
): AssessmentForm {
  const items = BANK[scope][phase];
  const name = scopeName(scope);
  return {
    scope,
    phase,
    title: phase === 'pre' ? `${name} — Pre-test` : `${name} — Post-test`,
    intro:
      phase === 'pre'
        ? `A short knowledge check before you start ${scope === 'path' ? 'the path' : `the ${name} section`}. Answer honestly — this measures your starting point, it is not graded against you.`
        : `The same set of concepts, re-checked now that you have finished ${scope === 'path' ? 'the path' : `the ${name} section`}. Comparing this with your pre-test shows your improvement.`,
    items,
  };
}

export interface AssessmentScoreResult {
  correct: number;
  total: number;
  percent: number; // 0–100, rounded
}

// Score a set of answers (item id → picked option index) against a form.
export function scoreAssessment(
  form: AssessmentForm,
  answers: Readonly<Record<string, number>>,
): AssessmentScoreResult {
  const total = form.items.length;
  let correct = 0;
  for (const item of form.items) {
    if (answers[item.id] === item.correctIndex) correct += 1;
  }
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percent };
}

// Normalized gain ⟨g⟩ = (post − pre) / (100 − pre), the standard Hake gain
// used in education research. Returns null when pre is already 100 (no
// headroom) so callers can show "n/a" instead of dividing by zero.
export function normalizedGain(prePercent: number, postPercent: number): number | null {
  if (prePercent >= 100) return null;
  return (postPercent - prePercent) / (100 - prePercent);
}

export function proficiencyFor(
  percent: number,
  bands: ReadonlyArray<ProficiencyBand> = DEFAULT_PROFICIENCY_BANDS,
): string {
  const hit = bands.find((b) => percent >= b.min && percent <= b.max);
  return hit?.label ?? 'Unscored';
}
