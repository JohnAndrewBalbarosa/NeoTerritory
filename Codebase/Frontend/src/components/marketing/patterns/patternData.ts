// Pattern reference + learning data. Sources:
//   - The CodiNeo thesis (FINAL THESIS 3 PAPER.pdf at the repo root).
//   - Nesteruk, D. (2022) "Design Patterns in Modern C++20" (Apress) -
//     cited by the thesis Chapter 1.1 + Chapter 2.
//   - The existing learning module content at
//     Codebase/Frontend/src/data/learningContent.ts. Per user direction,
//     lesson content lives on the per-pattern detail pages so /patterns
//     is the single learning + reference surface.
//
// Per D59 (this turn): the focus is GoF. We do NOT distinguish "All" vs
// "GoF" in the UI; the catalog below is the patterns we cover, period.
// Method Chaining, Repository, and PIMPL are in the catalog because the
// CodiNeo thesis explicitly lists them as supported detections — they are
// not GoF but they are first-class members of OUR detection catalog.
//
// PatternEntry's learning fields are optional so a new pattern can ship
// with reference-only content first and gain lesson content later.

export interface PatternStructureRule {
  label: string;
  tokens: string[];
  why: string;
}

export interface PatternStructure {
  mustHave: PatternStructureRule[];
  mustNotHave?: PatternStructureRule[];
  whyItWorks: string;
}

export type PatternSourceKind = 'book' | 'paper' | 'article' | 'repo' | 'thesis';

export interface PatternSource {
  kind: PatternSourceKind;
  citation: string;
  chapter?: string;
  url?: string;
}

export interface PatternEntry {
  slug: string;
  name: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  intent: string;
  problem: string;
  solution: string;
  codeSketch: string;
  detection: string;
  catalogFile: string | null;
  // ---- Learning fields (merged from learningContent.ts) ----
  oneLiner?: string;
  whatItIs?: string;
  whenToUse?: string;
  everydayExample?: string;
  prerequisites?: string[];
  correctStructure?: PatternStructure;
  // ---- Required ----
  readabilityBenefit?: string;
  sources?: ReadonlyArray<PatternSource>;
  // ---- Source attribution (legacy; kept for backward compat) ----
  /** @deprecated Use `sources` instead. Still rendered when `sources` is absent. */
  nesterukChapter?: string;
}

const NESTERUK = 'Nesteruk, D. (2022). Design Patterns in Modern C++20. Apress.';
const GOF = 'Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley.';

const nesterukSource = (chapter: string): PatternSource => ({
  kind: 'book',
  citation: NESTERUK,
  chapter,
});

const gofSource = (chapter: string): PatternSource => ({
  kind: 'book',
  citation: GOF,
  chapter,
});

export const WHY_GOF_EXPLAINER =
  'The catalog is anchored on the four "Gang of Four" patterns first codified by Gamma, Helm, Johnson, and Vlissides in 1994. Their book named the recurring object-oriented arrangements that working engineers kept reinventing - Singleton, Factory, Adapter, Strategy and the rest - and gave each shape a vocabulary item that survives across languages. Nesteruk 2022 modernises those same patterns for C++20 (smart pointers, deduction, ranges) without changing what the patterns are. We anchor on GoF because the names are the lingua franca every reviewer already knows, and because the structural fingerprints (virtual interfaces, ownership handles, self-returning setters) translate cleanly into the token-level checks our analyser runs. A handful of non-GoF entries (Method Chaining, Repository, PIMPL) sit alongside them because the CodiNeo thesis explicitly lists them as detection targets.';


export const PATTERNS: ReadonlyArray<PatternEntry> = [
  {
    slug: 'singleton',
    name: 'Singleton',
    family: 'Creational',
    intent:
      'Ensure a class has exactly one instance and provide a global access point to it.',
    problem:
      'Some resources only make sense as a single instance: a configuration registry, a logger, a connection pool. Letting code accidentally create two of them silently breaks invariants the rest of the program assumes.',
    solution:
      'Make the constructor private. Expose a static accessor that lazily constructs and caches the instance. Modern C++ uses Meyer-style local statics so the construction is thread-safe by language guarantee.',
    codeSketch: `class Logger {
public:
  static Logger& instance() {
    static Logger inst;
    return inst;
  }
  Logger(const Logger&) = delete;
  Logger& operator=(const Logger&) = delete;
private:
  Logger() = default;
};`,
    detection:
      'Catalog entry uses signature_categories: ["object_instantiation", "static_storage_access"]. Negative gates rule out classes that ship ownership handles or virtual interfaces.',
    catalogFile: 'pattern_catalog/creational/singleton.json',
    oneLiner: 'One instance. One global access point. Always the same object.',
    whatItIs:
      'A class that hands out the same instance every time you ask for it. The first call creates it; later calls return the same one.',
    whenToUse:
      'When the object holds shared state that must not duplicate: a configuration registry, a logger, a database connection pool.',
    everydayExample:
      'The phone in the kitchen. There is one. Anyone in the house picks it up; everyone gets the same line. Adding a second phone in the same line would not change anything - it is still the one phone.',
    prerequisites: [
      'Private constructors and access modifiers.',
      'Static member functions and static local variables (Meyer\'s singleton).',
      'Copy/move deletion (= delete) to prevent duplication.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Static accessor',
          tokens: ['static', '&'],
          why: 'A function that returns a reference to the single instance, declared static so callers do not need an instance to start.',
        },
        {
          label: 'Static local instance',
          tokens: ['static'],
          why: 'The single instance is stored as a function-local static so construction is thread-safe by language rule.',
        },
      ],
      mustNotHave: [
        {
          label: 'Public constructor',
          tokens: ['public', ':'],
          why: 'A public constructor allows duplication, which is the exact thing the pattern forbids.',
        },
      ],
      whyItWorks:
        'The combination of a private constructor and a static accessor is structural evidence the class can have only one instance. The detector confirms with object_instantiation + static_storage_access categories.',
    },
    readabilityBenefit:
      'Following Singleton makes the code more readable because the moment a reader sees `Logger::instance()`, they know there is exactly one logger, full stop - no hunting for a second constructor call.',
    sources: [
      nesterukSource('Chapter on Singleton'),
      gofSource('Singleton (Creational Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Singleton',
  },
  {
    slug: 'factory-method',
    name: 'Factory Method',
    family: 'Creational',
    intent:
      'Define an interface for creating an object, but let subclasses decide which class to instantiate.',
    problem:
      'A class needs to construct collaborators it cannot name in advance. Hardcoding the concrete type couples the class to a specific implementation and blocks substitution.',
    solution:
      'Replace direct construction with a virtual factory method. Subclasses override the factory to return their own collaborator. The calling code keeps depending on the abstract interface.',
    codeSketch: `class ButtonFactory {
public:
  virtual ~ButtonFactory() = default;
  virtual std::unique_ptr<Button> createButton(int kind) {
    if (kind == 1) return std::make_unique<RoundButton>();
    return std::make_unique<SquareButton>();
  }
};`,
    detection:
      'Catalog entry uses ordered_checks looking for branching create/make returning a base type with at least two concrete derived returns.',
    catalogFile: 'pattern_catalog/creational/factory.json',
    oneLiner: 'Ask a helper to make the right object. You do not pick the subclass.',
    whatItIs:
      'A helper that decides which concrete type to create. The caller asks for the abstract product; the factory hands back a concrete one.',
    whenToUse:
      'When the calling code should not have to pick between several similar subclasses on its own. You ask for a Shape; the factory hands back a Circle or a Square.',
    everydayExample:
      'A vending machine. You press the button for soda. The machine decides whether to give you a bottle or a can. You do not pick the brand of plastic.',
    prerequisites: [
      'Inheritance and virtual functions (a base class with derived subtypes).',
      'Smart pointers: std::unique_ptr<Base> as the factory return type.',
      'Polymorphism through a base-class pointer or reference.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Object instantiation in return position',
          tokens: ['return', 'new'],
          why: 'A factory hands back a freshly created object. The combo "return new" is the most direct way to express that without naming the method.',
        },
        {
          label: 'Or a stdlib instantiation symbol',
          tokens: ['std::make_unique'],
          why: 'Modern factories return smart pointers. The presence of std::make_unique (or std::make_shared) is enough on its own.',
        },
      ],
      whyItWorks:
        'A factory is identified by the act of creating-and-returning, not by the method being named create() or make(). Token combos like "return new" or a bare "std::make_unique" are language-level evidence that does not depend on what the developer chose to call the method.',
    },
    readabilityBenefit:
      'Following Factory Method makes the code more readable because the calling site asks for an abstract product and never names a concrete subclass - reviewers stop scanning for which subtype was hardcoded where.',
    sources: [
      nesterukSource('Chapter on Factory + Abstract Factory'),
      gofSource('Factory Method (Creational Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Factory + Abstract Factory',
  },
  {
    slug: 'builder',
    name: 'Builder',
    family: 'Creational',
    intent:
      'Construct a complex object step by step, allowing different configurations without telescoping constructors.',
    problem:
      'Constructors with seven optional parameters are unreadable, error-prone (positional mistakes), and force every caller to know all the knobs even when most should stay default.',
    solution:
      'Move construction into a Builder. Each setter returns *this so calls chain. A terminal build() method returns the finished object. Optional knobs stay optional; required knobs are enforced by the builder.',
    codeSketch: `class RequestBuilder {
  std::string method_;
  std::string body_;
public:
  RequestBuilder& withMethod(const std::string& m) { method_ = m; return *this; }
  RequestBuilder& withBody(const std::string& b)   { body_   = b; return *this; }
  std::unique_ptr<Request> build() {
    return std::make_unique<Request>(method_, body_);
  }
};`,
    detection:
      'Catalog entry uses signature_categories: ["self_return"]. ordered_checks requires both fluent setters returning *this AND a terminal build/Build identifier.',
    catalogFile: 'pattern_catalog/creational/builder.json',
    oneLiner: 'Set parts one at a time, then ask for the finished object.',
    whatItIs:
      'A way to build a complex object piece by piece. You set each part on its own line, then call a final method that returns the finished thing.',
    whenToUse:
      'When an object has many optional parts, or when calling its constructor with all the arguments would be hard to read.',
    everydayExample:
      'Ordering a custom pizza. You add cheese. Then you add pepperoni. Then olives. At the end you say done, and the cashier hands you the finished pizza.',
    prerequisites: [
      'Classes with public member functions.',
      'Returning *this by reference so calls can chain.',
      'A final build() that returns the finished object.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Self-return chain',
          tokens: ['return', '*', 'this'],
          why: 'The setter returns the same object so calls chain. Without this, it is just a normal class.',
        },
      ],
      whyItWorks:
        'Builder and Method Chaining look the same at this token level. The analyzer flags a class with "return *this" as both candidates at once and marks the result ambiguous. The reader picks the right one based on whether the class also has a separate finishing method that returns a finished product (Builder) or just keeps mutating (Method Chaining).',
    },
    readabilityBenefit:
      'Following Builder makes the code more readable because each optional knob lands on its own line with its own name, instead of being a nameless positional argument inside an eight-parameter constructor.',
    sources: [
      nesterukSource('Chapter on Builder'),
      gofSource('Builder (Creational Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Builder',
  },
  {
    slug: 'method-chaining',
    name: 'Method Chaining',
    family: 'Creational',
    intent:
      'Allow multiple method calls on the same object in sequence by returning the object from each method.',
    problem:
      'Configuring an object across many setter calls produces visual clutter when each call is a standalone statement on its own line repeating the variable name.',
    solution:
      'Have each setter return *this. Calls fluently chain on a single expression. Reads like a sentence: subject, verb, verb, verb.',
    codeSketch: `class QueryConfig {
  std::vector<std::string> filters_;
  int limit_ = 0;
public:
  QueryConfig& where(const std::string& clause) { filters_.push_back(clause); return *this; }
  QueryConfig& orderBy(const std::string& col)  { filters_.push_back("order:" + col); return *this; }
  QueryConfig& limit(int n)                     { limit_ = n; return *this; }
};`,
    detection:
      'Catalog entry uses signature_categories: ["self_return"] but does NOT require a build/Build identifier. When both Method Chaining and Builder match, both emit (per D21 co-emit rule); the AI disambiguates.',
    catalogFile: 'pattern_catalog/creational/method_chaining.json',
    oneLiner: 'Set many options on the same object in one line.',
    whatItIs:
      'A style where each method returns the same object so you can call several methods in a row, all chained together.',
    whenToUse:
      'When you want a clean, readable way to set many options on one object without writing the variable name over and over.',
    everydayExample:
      'Picking filters in a settings screen. You tap dark mode, then large text, then no notifications. Each tap leaves you on the same screen so the next tap can follow right away.',
    prerequisites: [
      'Member functions and the implicit this pointer.',
      'Reference return types: return *this so the caller keeps the same object.',
      'Awareness of const-correctness so chains read predictably.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Self-return chain',
          tokens: ['return', '*', 'this'],
          why: 'Each call leaves the caller pointed at the same instance, so the next call can hang off the previous one without naming the variable again.',
        },
      ],
      whyItWorks:
        'Method Chaining is structurally identical to Builder at the token level: both rely on "return *this". The analyzer surfaces both as candidates and marks the class ambiguous. The reader resolves it by asking: is there a finishing method that produces a different product (Builder) or do all calls just mutate the same object (Method Chaining)?',
    },
    readabilityBenefit:
      'Following Method Chaining makes the code more readable because related configuration calls collapse into one fluent expression that reads top-to-bottom like a sentence, with no repeated variable name in between.',
    sources: [
      nesterukSource('Chapter on Fluent Interfaces'),
      {
        kind: 'article',
        citation:
          'Fowler, M. (2005). FluentInterface. martinfowler.com.',
        url: 'https://martinfowler.com/bliki/FluentInterface.html',
      },
      {
        kind: 'thesis',
        citation:
          'CodiNeo thesis (2026), Chapter 1.1 - lists Method Chaining as a first-class detection target outside the GoF set.',
      },
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Fluent Interfaces',
  },
  {
    slug: 'adapter',
    name: 'Adapter',
    family: 'Structural',
    intent:
      'Convert the interface of a class into another interface clients expect, letting incompatible classes work together.',
    problem:
      'A new component fits the system everywhere except its method signatures do not match what the rest of the code calls. Rewriting either side is expensive and risky.',
    solution:
      'Wrap the incompatible component in an Adapter that exposes the expected interface and forwards calls - possibly translating arguments - to the wrapped component.',
    codeSketch: `class JsonResponse {
  LegacyXml inner;
public:
  std::string body() const {
    return xml_to_json(inner.payload());
  }
};`,
    detection:
      'Catalog entry uses ordered_checks for "class wraps a member and forwards a call." Adapter, Proxy, and Decorator co-emit on the same shape per D21; AI picks the role.',
    catalogFile: 'pattern_catalog/structural/adapter.json',
    oneLiner: 'Wrap a class to make it look like another class.',
    whatItIs:
      'A wrapper class that owns an inner object with one shape and exposes a different shape to its callers, translating between them.',
    whenToUse:
      'When you need to plug a third-party library into your codebase but its method names and types do not match what the rest of your code expects.',
    everydayExample:
      'A travel power adapter. The wall socket has one shape; your charger has another. The adapter sits between them and translates without either side knowing.',
    prerequisites: [
      'Class composition (a member of another class type).',
      'Method forwarding through a member access (. or ->).',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Class wraps a member and forwards',
          tokens: ['.', '('],
          why: 'The forwarding call (inner.method(...) or p->method(...)) is the structural fingerprint of every wrapping pattern.',
        },
      ],
      mustNotHave: [
        {
          label: 'Ownership handle',
          tokens: ['std::unique_ptr'],
          why: 'A pure-forwarder Adapter typically does not own its wrappee through a smart pointer; that ownership pattern is more often Strategy.',
        },
      ],
      whyItWorks:
        'Adapter, Proxy, and Decorator share the same wrapping signature at the token level. The detector emits all three as candidates and uses negative gates to disambiguate; the AI doc layer picks the role based on context.',
    },
    readabilityBenefit:
      'Following Adapter makes the code more readable because the rest of the codebase keeps speaking one shape - the translation between incompatible APIs is isolated to one wrapper class, not sprinkled across call sites.',
    sources: [
      nesterukSource('Chapter on Adapter'),
      gofSource('Adapter (Structural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Adapter',
  },
  {
    slug: 'proxy',
    name: 'Proxy',
    family: 'Structural',
    intent:
      'Provide a surrogate or placeholder for another object to control access to it.',
    problem:
      'Direct access to a resource is too expensive (lazy loading), too sensitive (access control), or too remote (network call) to expose unfiltered to callers.',
    solution:
      'Substitute a Proxy with the same interface as the real subject. The Proxy decides when (and whether) to forward calls to the subject, adding caching, auth, or remoting along the way.',
    codeSketch: `class CachedFetcher {
  std::unique_ptr<RealFetcher> real_;
  std::unordered_map<Url, Response> cache_;
  std::mutex mu_;
public:
  Response get(const Url& u) {
    std::lock_guard<std::mutex> lock(mu_);
    if (auto it = cache_.find(u); it != cache_.end()) return it->second;
    if (!real_) real_ = std::make_unique<RealFetcher>();
    auto r = real_->get(u);
    cache_[u] = r;
    return r;
  }
};`,
    detection:
      'Same wrapping signature as Adapter. Distinguished by negative gates: Proxy classes typically include access_control_caching (mutex/lock_guard) or ownership_handle.',
    catalogFile: 'pattern_catalog/structural/proxy.json',
    oneLiner: 'Stand in front of an object. Decide what gets through.',
    whatItIs:
      'A class that mirrors another class\' interface but sits between the caller and the real object, adding caching, access control, or remoting.',
    whenToUse:
      'When the real object is expensive to construct, sensitive to expose, or located across a network boundary.',
    everydayExample:
      'A receptionist at an office. They take your message, decide whether the boss is in, and forward only the calls that matter.',
    prerequisites: [
      'Class composition (the proxy owns the real subject).',
      'Smart pointer or mutex usage for caching/locking.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Forwarding call',
          tokens: ['.', '('],
          why: 'The proxy delegates to the real subject through a member access.',
        },
        {
          label: 'Access control or caching',
          tokens: ['std::lock_guard'],
          why: 'A Proxy commonly serializes access through a mutex or guards a cache; this is what distinguishes it from a plain Adapter.',
        },
      ],
      whyItWorks:
        'The wrapping signature alone is ambiguous; the access_control_caching category is what tilts the verdict toward Proxy.',
    },
    readabilityBenefit:
      'Following Proxy makes the code more readable because cross-cutting concerns (cache, mutex, auth) live in one named class rather than being scattered across every call site that touches the real subject.',
    sources: [
      nesterukSource('Chapter on Proxy'),
      gofSource('Proxy (Structural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Proxy',
  },
  {
    slug: 'decorator',
    name: 'Decorator',
    family: 'Structural',
    intent:
      'Attach additional responsibilities to an object dynamically, providing a flexible alternative to subclassing for extending functionality.',
    problem:
      'Adding optional behaviour through inheritance produces a combinatorial explosion of subclasses. The user wants composable add-ons (logging + retry + caching), not a class for every combination.',
    solution:
      'Wrap the object in a Decorator with the same interface. The Decorator forwards calls to the inner object and adds behaviour around the call. Decorators stack: each layer is itself decoratable.',
    codeSketch: `class LoggingFetcher : public Fetcher {
  std::unique_ptr<Fetcher> inner_;
public:
  explicit LoggingFetcher(std::unique_ptr<Fetcher> w) : inner_(std::move(w)) {}
  Response get(const Url& u) override {
    log("GET " + u.str());
    return inner_->get(u);
  }
};`,
    detection:
      'Same wrapping signature as Adapter and Proxy. Distinguished by interface_polymorphism (virtual / override) so the decorator can stack.',
    catalogFile: 'pattern_catalog/structural/decorator.json',
    oneLiner: 'Wrap an object to add a behaviour. Stack as many wrappers as you like.',
    whatItIs:
      'A wrapper that owns an inner object of the same interface and adds extra behaviour around the forwarded call. Multiple decorators stack; the order of stacking determines the order of effects.',
    whenToUse:
      'When you want to mix and match optional behaviours (logging, retry, caching, auth) without subclassing every combination.',
    everydayExample:
      'Sandwich toppings. The bread is the inner object. Each topping (lettuce, cheese, mustard) is a decorator that adds a layer without changing what is underneath.',
    prerequisites: [
      'Polymorphism through a base interface.',
      'Class composition (a member of the same interface type).',
      'Awareness of stacking order in constructors.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Same-interface forwarding',
          tokens: ['virtual'],
          why: 'A Decorator implements the same virtual interface as its wrappee so the next layer can stack on top.',
        },
      ],
      whyItWorks:
        'Decorator differs from Adapter and Proxy by using interface_polymorphism: the wrapper itself is virtual so it can be stacked.',
    },
    readabilityBenefit:
      'Following Decorator makes the code more readable because optional behaviours stack as named wrappers (`Logging(Retry(Cached(inner)))`) instead of exploding into a combinatorial set of subclasses or boolean flag parameters.',
    sources: [
      nesterukSource('Chapter on Decorator'),
      gofSource('Decorator (Structural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Decorator',
  },
  {
    slug: 'strategy',
    name: 'Strategy',
    family: 'Behavioural',
    intent:
      'Define a family of algorithms, encapsulate each one, and make them interchangeable.',
    problem:
      'A class needs to vary behaviour at runtime but using if/else or switch on a kind tag spreads decisions across the codebase and resists extension.',
    solution:
      'Pull the variable behaviour into an abstract Strategy interface. Concrete strategies implement it. The host class holds a Strategy reference and delegates without caring which concrete one it has.',
    codeSketch: `class SortStrategy { public: virtual void sort(Vec&) = 0; };
class QuickSort : public SortStrategy { /* ... */ };
class MergeSort : public SortStrategy { /* ... */ };

class Sorter {
  std::unique_ptr<SortStrategy> s;
public:
  void run(Vec& v) { s->sort(v); }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` operation method, paired with a subclass.json that detects concrete strategies. Co-emits with State and Command on the shared virtual-interface shape (per D21).',
    catalogFile: null,
    oneLiner: 'Swap the algorithm at runtime. The caller stays the same.',
    whatItIs:
      'A family of interchangeable algorithms with a shared interface. The host class delegates to a strategy reference and never names a concrete one.',
    whenToUse:
      'When several algorithms could solve the same problem and you want to choose between them at runtime: sorting, compression, pricing, payment.',
    everydayExample:
      'Picking a route on a map app. The destination is fixed; "fastest", "shortest", "avoid tolls" are strategies. You swap the strategy without changing where you are going.',
    prerequisites: [
      'Inheritance and virtual functions.',
      'Smart pointers (std::unique_ptr<Strategy>) for ownership.',
      'Polymorphism through a base-interface reference.',
    ],
    correctStructure: {
      mustHave: [
        {
          label: 'Polymorphic interface',
          tokens: ['virtual'],
          why: 'The host class depends on an abstract interface, not a concrete strategy.',
        },
        {
          label: 'Owned strategy',
          tokens: ['std::unique_ptr'],
          why: 'The host owns its strategy through a smart pointer so the concrete one can be swapped.',
        },
      ],
      whyItWorks:
        'Strategy and State look similar because both inject a polymorphic collaborator. Strategy lacks state-transition methods; that absence is the differentiator.',
    },
    readabilityBenefit:
      'Following Strategy makes the code more readable because the host class shrinks to one delegate call - the long if/else ladder that used to switch on a kind tag is replaced by the name of the chosen algorithm.',
    sources: [
      nesterukSource('Chapter on Strategy'),
      gofSource('Strategy (Behavioural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Strategy',
  },
  {
    slug: 'observer',
    name: 'Observer',
    family: 'Behavioural',
    intent:
      'Define a one-to-many dependency so that when one object changes state, all its dependents are notified automatically.',
    problem:
      'Several objects need to react when something changes: an updated value, a new event, a network message. Letting the source poll every consumer or know about every consumer hardcodes the relationship.',
    solution:
      'A Subject keeps a list of Observers. State changes notify the list; observers update themselves. The Subject does not need to know what each Observer does with the notification.',
    codeSketch: `class Subject {
  std::vector<Observer*> observers;
public:
  void attach(Observer* o)   { observers.push_back(o); }
  void notify(const Event& e){ for (auto* o : observers) o->update(e); }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a class with a `virtual` update/notify-named method. Co-emits with Strategy on the shared virtual-interface shape (per D21); the AI disambiguates on the update/observer naming.',
    catalogFile: 'pattern_catalog/behavioural/observer.json',
    oneLiner: 'When something changes, everyone who cares finds out.',
    whatItIs:
      'A subject that maintains a list of observers and notifies them on every change. Each observer decides what to do with the notification.',
    whenToUse:
      'When the source of a change does not know all its consumers: UI views, log subscribers, real-time dashboards.',
    everydayExample:
      'A group chat. One person posts; everyone in the chat sees the message. The poster does not need to send it individually.',
    prerequisites: [
      'Polymorphism (an Observer base interface).',
      'Containers: std::vector or similar to hold the observer list.',
    ],
    readabilityBenefit:
      'Following Observer makes the code more readable because the Subject expresses "something happened" once, and every reaction lives in its own named class - reviewers stop chasing a fan-out of direct method calls from the change site.',
    sources: [
      nesterukSource('Chapter on Observer'),
      gofSource('Observer (Behavioural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Observer',
  },
  {
    slug: 'iterator',
    name: 'Iterator',
    family: 'Behavioural',
    intent:
      'Provide a way to access the elements of a collection sequentially without exposing its underlying representation.',
    problem:
      'Consumers want to walk a collection without knowing whether it is an array, a linked list, or a tree. Hardcoding the traversal couples consumer code to the storage shape.',
    solution:
      'Define an iterator that exposes begin / end / advance / dereference. The collection returns iterators; the consumer uses them. The collection can change its internal storage without breaking consumers.',
    codeSketch: `for (auto it = c.begin(); it != c.end(); ++it) {
  process(*it);
}`,
    detection:
      'Catalog entry uses ordered_checks for a class that overloads `operator++` or `operator*` (the canonical traversal operators). No signature_categories gate — the operator-overload shape is distinctive on its own.',
    catalogFile: 'pattern_catalog/behavioural/iterator.json',
    oneLiner: 'Walk through a collection. The collection picks the order.',
    whatItIs:
      'An object that knows where you are in a collection and how to move to the next element.',
    whenToUse:
      'Whenever you walk a collection. The C++ standard library is built on this pattern.',
    everydayExample:
      'A bookmark in a book. It knows the page you are on; turning the page moves the bookmark forward. The book does not change.',
    prerequisites: [
      'Operator overloading (++, *, !=).',
      'The C++ standard library iterator concept.',
    ],
    readabilityBenefit:
      'Following Iterator makes the code more readable because the traversal shape is the same for every collection - readers learn one idiom (`for (auto it = c.begin(); it != c.end(); ++it)`) and never have to relearn how to walk a new container.',
    sources: [
      nesterukSource('Chapter on Iterator'),
      gofSource('Iterator (Behavioural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Iterator',
  },
  {
    slug: 'command',
    name: 'Command',
    family: 'Behavioural',
    intent:
      'Encapsulate a request as an object so it can be queued, logged, undone, or parameterised.',
    problem:
      'You want to record what an action did so you can replay it, undo it, or pass it across a queue. A bare function call leaves no trace.',
    solution:
      'Wrap each action in a Command object with execute() and (optionally) undo() methods. Pass commands instead of calling functions directly.',
    codeSketch: `class Command { public: virtual void execute() = 0; virtual void undo() = 0; };
class MoveCmd : public Command {
  Entity& e; Pos delta;
public:
  void execute() override { e.pos += delta; }
  void undo()    override { e.pos -= delta; }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` execute/undo/redo-named method. Co-emits with Strategy on execute/run (per D21); the AI splits them on the undo/redo and receiver signals.',
    catalogFile: 'pattern_catalog/behavioural/command.json',
    oneLiner: 'Wrap an action in an object. Replay it. Undo it. Queue it.',
    whatItIs:
      'A Command object captures the call: which method, which arguments, on which receiver. Calling execute() runs it; calling undo() reverses it.',
    whenToUse:
      'When you need undo/redo, command queues, macros, or transactional actions.',
    everydayExample:
      'A coffee shop ticket. The barista does not memorise your order; the ticket records what to make and for whom. If you cancel, the ticket records that too.',
    prerequisites: [
      'Polymorphism (a Command base interface).',
      'Capturing state in member fields.',
    ],
    readabilityBenefit:
      'Following Command makes the code more readable because every action carries a name and a record - `UndoLastMove()` is more obvious than reverse-engineering an inverse-call sequence from history.',
    sources: [
      nesterukSource('Chapter on Command'),
      gofSource('Command (Behavioural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Command',
  },
  {
    slug: 'composite',
    name: 'Composite',
    family: 'Structural',
    intent:
      'Compose objects into tree structures so that clients treat individual objects and compositions uniformly.',
    problem:
      'A consumer wants to operate on a single thing or a group of things without writing different code for each case. Hardcoding the difference duplicates traversal code.',
    solution:
      'Both the leaf and the container implement the same Component interface. The container stores Components and forwards operations to its children. Clients never branch on leaf-vs-container.',
    codeSketch: `class Component { public: virtual int weight() const = 0; };
class Leaf : public Component { /* ... */ };
class Box  : public Component {
  std::vector<std::unique_ptr<Component>> items;
public:
  int weight() const override {
    int w = 0;
    for (auto& i : items) w += i->weight();
    return w;
  }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for an add/remove-child operation and a child container (vector/list/children_). Co-emits with Decorator on the held-member shape (per D21).',
    catalogFile: 'pattern_catalog/structural/composite.json',
    oneLiner: 'A leaf and a tree look the same to whoever asks.',
    whatItIs:
      'A pattern where a container of Components is itself a Component. Operations on the container recurse into children automatically.',
    whenToUse:
      'When your data is naturally tree-shaped: file systems, GUI widgets, math expressions, and you want the same operations on a node and a subtree.',
    everydayExample:
      'A folder on your computer. A folder can contain files or other folders. Asking "how big is this folder?" works the same whether it is a single file or a deep tree.',
    prerequisites: [
      'Inheritance and virtual functions.',
      'Recursive containers (std::vector<std::unique_ptr<Base>>).',
    ],
    readabilityBenefit:
      'Following Composite makes the code more readable because operations on a single node and operations on a whole subtree share the same call - readers stop tracking which arm of a leaf-vs-container if/else they are in.',
    sources: [
      nesterukSource('Chapter on Composite'),
      gofSource('Composite (Structural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Composite',
  },
  {
    slug: 'template-method',
    name: 'Template Method',
    family: 'Behavioural',
    intent:
      'Define the skeleton of an algorithm in a base class, deferring some steps to subclasses without changing the algorithm\'s structure.',
    problem:
      'Several subclasses share a high-level algorithm but differ in one or two steps. Duplicating the whole algorithm in each subclass invites drift between them.',
    solution:
      'The base class implements the algorithm and calls virtual hook methods at the variable steps. Subclasses override only the hooks; the algorithm shape stays in one place.',
    codeSketch: `class Report {
public:
  void render() {            // template method
    open();
    writeBody();
    close();
  }
protected:
  virtual void writeBody() = 0;
  void open()  { /* shared */ }
  void close() { /* shared */ }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for an orchestrator method (run/process/generate) followed by `virtual` hook methods. Co-emits with Strategy on the virtual-interface shape (per D21).',
    catalogFile: 'pattern_catalog/behavioural/template_method.json',
    oneLiner: 'A base class owns the algorithm. Subclasses fill in a few blanks.',
    whatItIs:
      'A base method that runs a fixed sequence of steps and calls virtual hooks at the variable points. Subclasses override the hooks, not the sequence.',
    whenToUse:
      'When several subclasses share a high-level algorithm and differ only in specific steps.',
    everydayExample:
      'Recipes that share a cooking method but vary in one ingredient. The base recipe says "cook for 30 minutes, season, serve"; each variant fills in what to season with.',
    prerequisites: [
      'Inheritance and virtual / pure-virtual functions.',
      'Discipline to keep the template method itself non-virtual.',
    ],
    readabilityBenefit:
      'Following Template Method makes the code more readable because the algorithm sits in one obvious place at the top of the base class - subclasses are easy to compare because they only differ in the named hook overrides.',
    sources: [
      nesterukSource('Chapter on Template Method'),
      gofSource('Template Method (Behavioural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Template Method',
  },
  {
    slug: 'state',
    name: 'State',
    family: 'Behavioural',
    intent:
      'Allow an object to alter its behaviour when its internal state changes. The object will appear to change its class.',
    problem:
      'Your class has many if (state == ...) branches scattered across methods. Adding a new state means editing every method.',
    solution:
      'Pull each state into its own class implementing a shared interface. The host holds a pointer to the current state object and delegates. Transitions swap the pointer.',
    codeSketch: `class State { public: virtual std::unique_ptr<State> handle() = 0; };
class Idle    : public State { /* ... */ };
class Running : public State { /* ... */ };

class Machine {
  std::unique_ptr<State> state;
public:
  void tick() { state = state->handle(); }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` handle/request-named method. Structurally near-identical to Strategy, so the two co-emit (per D21); the AI separates them on the context state-transition signal.',
    catalogFile: 'pattern_catalog/behavioural/state.json',
    oneLiner: 'Different mode, different rules. Same object.',
    whatItIs:
      'A pattern where each state of an object is its own class. The host delegates behaviour to its current state and switches state objects to change behaviour.',
    whenToUse:
      'When an object has distinct modes that change which methods are valid or what they do: connection states, game phases, document workflow stages.',
    everydayExample:
      'Traffic lights. Red, yellow, green are states. The intersection behaves differently depending on which state is active, but it is the same intersection.',
    prerequisites: [
      'Polymorphism (a State base interface).',
      'Smart pointers for owning the current state.',
    ],
    readabilityBenefit:
      'Following State makes the code more readable because each mode is a named class with its own valid transitions - scattered `if (state == ...)` branches collapse into one delegate call that means "do whatever the current state says."',
    sources: [
      nesterukSource('Chapter on State'),
      gofSource('State (Behavioural Patterns)'),
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on State',
  },
  {
    slug: 'repository',
    name: 'Repository',
    family: 'Structural',
    intent:
      'Encapsulate data access behind an interface that hides storage details from the rest of the program.',
    problem:
      'Business logic peppered with raw SQL or filesystem calls is impossible to test, hard to mock, and fragile to schema changes.',
    solution:
      'Define a Repository interface (findById, save, delete, query) and put the storage details behind it. Tests substitute an in-memory implementation; production swaps in the real one.',
    codeSketch: `class UserRepository {
public:
  virtual std::optional<User> findById(int id) = 0;
  virtual void save(const User&) = 0;
  virtual ~UserRepository() = default;
};`,
    detection:
      'Catalog entry (planned): interface_polymorphism + uniform CRUD-style method set (find, save, delete, etc.).',
    catalogFile: null,
    oneLiner: 'Hide the database. Code talks to a clean interface.',
    whatItIs:
      'A facade over data storage. The rest of the program asks for entities; the repository handles where they come from.',
    whenToUse:
      'In any layered application that talks to a persistent store. The thesis lists Repository among the patterns CodiNeo learners are expected to recognise.',
    everydayExample:
      'A library counter. You ask for a book; the librarian fetches it. You do not walk into the stacks yourself. Tomorrow they could move the books and your interface would not change.',
    prerequisites: [
      'Inheritance and virtual functions.',
      'Smart pointers for owning concrete repositories.',
      'Optional types (std::optional) for "not found" responses.',
    ],
    readabilityBenefit:
      'Following Repository makes the code more readable because business logic reads as `users.findById(id)` instead of an inline SQL string - reviewers stop context-switching between domain language and storage syntax on every line.',
    sources: [
      {
        kind: 'book',
        citation:
          'Evans, E. (2003). Domain-Driven Design: Tackling Complexity in the Heart of Software. Addison-Wesley.',
        chapter: 'Chapter 6 - Repositories',
      },
      {
        kind: 'book',
        citation:
          'Fowler, M. (2002). Patterns of Enterprise Application Architecture. Addison-Wesley.',
        chapter: 'Repository (Object-Relational Metadata Mapping Patterns)',
      },
      {
        kind: 'thesis',
        citation:
          'CodiNeo thesis (2026), Chapter 1.1 - lists Repository as a first-class detection target outside the GoF set.',
      },
    ],
    nesterukChapter:
      'Mentioned in CodiNeo Chapter 1.1; not a GoF pattern, but widely used in modern C++ apps and discussed in Nesteruk 2022.',
  },
  {
    slug: 'pimpl',
    name: 'PIMPL (Pointer to Implementation)',
    family: 'Idioms',
    intent:
      'Hide the implementation of a class behind a forward-declared inner type, exposed only through a smart pointer.',
    problem:
      'Header-level changes to private members force every translation unit that includes the header to recompile. ABI-stable libraries cannot expose their internals at all.',
    solution:
      'Move all private members into a forward-declared Impl struct. The public class holds a std::unique_ptr<Impl>. Callers see only the public methods; the Impl can change without touching the header.',
    codeSketch: `// header
class Widget {
public:
  Widget();
  ~Widget();
  void doThing();
private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

// .cpp
struct Widget::Impl { /* private state */ };
Widget::Widget() : impl_(std::make_unique<Impl>()) {}
Widget::~Widget() = default;`,
    detection:
      'Catalog entry uses signature_categories: ["ownership_handle"]. ordered_checks look for a forward-declared inner Impl struct and a unique_ptr<Impl> member.',
    catalogFile: 'pattern_catalog/idiom/pimpl.json',
    oneLiner: 'Hide the private members behind a pointer. The header stays stable.',
    whatItIs:
      'A C++ idiom where a class\' private state lives in a forward-declared inner Impl struct, owned through a smart pointer.',
    whenToUse:
      'When you need ABI stability across releases or when including the full private definition would pull in too many headers.',
    everydayExample:
      'A magician\'s box. The audience sees the outside (the public API). The trick mechanism inside (the Impl) can change between shows without anyone noticing.',
    prerequisites: [
      'Smart pointers, especially std::unique_ptr.',
      'Forward declarations.',
      'Defining the destructor in the .cpp file (so the compiler sees Impl when it generates the destructor).',
    ],
    readabilityBenefit:
      'Following PIMPL makes the code more readable because the public header lists only what callers can do - readers no longer wade through private members and dependent #includes to find the API.',
    sources: [
      nesterukSource('Chapter on Modern C++ idioms (PIMPL)'),
      {
        kind: 'book',
        citation:
          'Meyers, S. (2014). Effective Modern C++. O\'Reilly.',
        chapter: 'Item 22 - When using the Pimpl Idiom, define special member functions in the implementation file',
      },
      {
        kind: 'article',
        citation:
          'Sutter, H. (1998). GotW #28 - The Fast Pimpl Idiom. herbsutter.com.',
        url: 'https://herbsutter.com/gotw/_028/',
      },
    ],
    nesterukChapter: 'Nesteruk 2022, Chapter on Modern C++ idioms',
  },
  {
    slug: 'prototype',
    name: 'Prototype',
    family: 'Creational',
    intent:
      'Create new objects by copying an existing instance (the prototype) rather than constructing from scratch.',
    problem:
      'A caller needs a new object of the same dynamic type as one it already holds, but it only has a base-class pointer and must not hardcode the concrete class.',
    solution:
      'Give the base class a virtual clone() that each concrete type implements to return a copy of itself. Callers clone through the base pointer and never name the concrete type.',
    codeSketch: `class Shape {
public:
  virtual ~Shape() = default;
  virtual std::unique_ptr<Shape> clone() const = 0;
};
class Circle : public Shape {
  std::unique_ptr<Shape> clone() const override { return std::make_unique<Circle>(*this); }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` method named clone/copy/duplicate. Co-emits with Strategy on the virtual-interface shape (per D21); the clone naming is the disambiguator.',
    catalogFile: 'pattern_catalog/creational/prototype.json',
    oneLiner: 'Copy an existing object instead of building a new one from nothing.',
    readabilityBenefit:
      'Reading clone() at the call site says "make me another of whatever this is" without a chain of if/else over concrete types - the polymorphism carries the intent.',
    sources: [nesterukSource('Chapter on Prototype'), gofSource('Prototype (Creational Patterns)')],
  },
  {
    slug: 'abstract-factory',
    name: 'Abstract Factory',
    family: 'Creational',
    intent:
      'Provide an interface for creating families of related objects without specifying their concrete classes.',
    problem:
      'A program must build several products that have to match (a button and a checkbox from the same UI theme), but it should not be wired to one concrete family.',
    solution:
      'Declare a factory interface with one virtual create method per product. Each concrete factory builds one coherent family. Client code holds the factory interface and stays family-agnostic.',
    codeSketch: `class GUIFactory {
public:
  virtual ~GUIFactory() = default;
  virtual std::unique_ptr<Button>   createButton()   = 0;
  virtual std::unique_ptr<Checkbox> createCheckbox() = 0;
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for two `virtual create*` methods in one interface. Co-emits with Factory Method (per D21); the multiple-product-family shape is the differentiator.',
    catalogFile: 'pattern_catalog/creational/abstract_factory.json',
    oneLiner: 'One factory that makes a whole matching set of objects.',
    readabilityBenefit:
      'Grouping the create methods on one interface makes the product family explicit - a reviewer sees at a glance which products are meant to vary together.',
    sources: [nesterukSource('Chapter on Abstract Factory'), gofSource('Abstract Factory (Creational Patterns)')],
  },
  {
    slug: 'bridge',
    name: 'Bridge',
    family: 'Structural',
    intent:
      'Decouple an abstraction from its implementation so the two can vary independently.',
    problem:
      'An abstraction and its implementation are both expected to grow (shapes × renderers). Binding them by inheritance produces a combinatorial class explosion.',
    solution:
      'Hold the implementor through a pointer in the abstraction and forward operations to it. The abstraction hierarchy and the implementor hierarchy then evolve separately.',
    codeSketch: `class Shape {
  std::unique_ptr<Renderer> renderer_;
public:
  void draw() { renderer_->renderCircle(radius_); }
};`,
    detection:
      'Catalog entry gates on signature_categories: ["ownership_handle"] and ordered_checks for a smart-pointer-owned implementor member that is forwarded to. Co-emits with PIMPL/Adapter on the owned-member shape (per D21).',
    catalogFile: 'pattern_catalog/structural/bridge.json',
    oneLiner: 'Split "what it is" from "how it is done" so each can change alone.',
    readabilityBenefit:
      'The forwarding through renderer_-> makes the seam between abstraction and implementation visible in one line, instead of hiding it inside a deep inheritance tree.',
    sources: [nesterukSource('Chapter on Bridge'), gofSource('Bridge (Structural Patterns)')],
  },
  {
    slug: 'facade',
    name: 'Facade',
    family: 'Structural',
    intent:
      'Provide a single simplified interface to a larger body of code or a set of subsystems.',
    problem:
      'Using a subsystem correctly requires calling several objects in the right order. Every caller repeating that choreography couples them all to the internals.',
    solution:
      'Introduce one class that owns the subsystem objects and exposes a few high-level methods that perform the choreography internally.',
    codeSketch: `class ComputerFacade {
  CPU cpu_; Memory memory_;
public:
  void start() { cpu_.freeze(); memory_.load(0, "boot"); cpu_.jump(0); }
};`,
    detection:
      'Catalog entry uses ordered_checks for a class that delegates to two or more distinct subsystem members. No signature gate. Co-emits with Adapter/Proxy on the forwarding shape (per D21).',
    catalogFile: 'pattern_catalog/structural/facade.json',
    oneLiner: 'One simple front door over a complicated back room.',
    readabilityBenefit:
      'start() reads as a single intention; the subsystem ordering it hides would otherwise be copy-pasted into every caller.',
    sources: [nesterukSource('Chapter on Facade'), gofSource('Facade (Structural Patterns)')],
  },
  {
    slug: 'flyweight',
    name: 'Flyweight',
    family: 'Structural',
    intent:
      'Use sharing to support large numbers of fine-grained objects efficiently.',
    problem:
      'Creating one object per element (a glyph per character) wastes memory when most of the state is identical and intrinsic.',
    solution:
      'Keep a pool keyed by the intrinsic state and hand out shared instances. Extrinsic state is passed in per call instead of stored.',
    codeSketch: `class GlyphFactory {
  std::unordered_map<char, std::shared_ptr<Glyph>> pool_;
public:
  std::shared_ptr<Glyph> getGlyph(char key) {
    auto& slot = pool_[key];
    if (!slot) slot = std::make_shared<Glyph>();
    return slot;
  }
};`,
    detection:
      'Catalog entry gates on signature_categories: ["ownership_handle"] and ordered_checks for a shared-pool getter (getFlyweight/get) plus a map/cache/pool member. Co-emits with Factory on the creation shape (per D21).',
    catalogFile: 'pattern_catalog/structural/flyweight.json',
    oneLiner: 'Share one copy of identical things instead of making thousands.',
    readabilityBenefit:
      'The pool_ lookup states the sharing policy in one place; readers see immediately that instances are interned, not duplicated.',
    sources: [nesterukSource('Chapter on Flyweight'), gofSource('Flyweight (Structural Patterns)')],
  },
  {
    slug: 'chain-of-responsibility',
    name: 'Chain of Responsibility',
    family: 'Behavioural',
    intent:
      'Pass a request along a chain of handlers; each handler decides to process it or forward it.',
    problem:
      'Several objects could handle a request and the right one is not known in advance. Hardcoding the dispatch couples the sender to every potential handler.',
    solution:
      'Give each handler a link to the next and a virtual handle(). A handler either processes the request or delegates to its successor.',
    codeSketch: `class Handler {
  Handler* next_ = nullptr;
public:
  void setNext(Handler* n) { next_ = n; }
  virtual void handle(int r) { if (next_) next_->handle(r); }
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` handle method and a next_/successor link. Co-emits with State/Strategy on the virtual shape (per D21); the successor link is the discriminator.',
    catalogFile: 'pattern_catalog/behavioural/chain_of_responsibility.json',
    oneLiner: 'Hand the request down the line until someone takes it.',
    readabilityBenefit:
      'The next_->handle() forward makes the fallback path explicit, so a reviewer can follow who gets a shot at the request without a giant switch.',
    sources: [nesterukSource('Chapter on Chain of Responsibility'), gofSource('Chain of Responsibility (Behavioural Patterns)')],
  },
  {
    slug: 'mediator',
    name: 'Mediator',
    family: 'Behavioural',
    intent:
      'Define an object that encapsulates how a set of objects interact, so they no longer refer to each other directly.',
    problem:
      'Many components that talk to each other directly form a dense web of dependencies that is hard to change.',
    solution:
      'Route all interaction through a mediator. Components notify the mediator, which decides who else needs to react.',
    codeSketch: `class Mediator {
public:
  virtual ~Mediator() = default;
  virtual void notify(int senderId, int event) = 0;
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` notify/send method. Co-emits with Observer on the notify naming (per D21); the AI separates them on the central-hub vs subscriber-list shape.',
    catalogFile: 'pattern_catalog/behavioural/mediator.json',
    oneLiner: 'Components talk through one hub instead of to each other.',
    readabilityBenefit:
      'A single notify() entry point concentrates the interaction rules in one class, so reviewers stop tracing N-to-N call chains between components.',
    sources: [nesterukSource('Chapter on Mediator'), gofSource('Mediator (Behavioural Patterns)')],
  },
  {
    slug: 'visitor',
    name: 'Visitor',
    family: 'Behavioural',
    intent:
      'Represent an operation to be performed on the elements of an object structure without changing their classes.',
    problem:
      'You need to add new operations across a class hierarchy often, but editing every element class for each new operation is invasive.',
    solution:
      'Move the operation into a visitor with one visit() per element type. Elements expose accept(Visitor&) and call back the matching visit().',
    codeSketch: `class Visitor {
public:
  virtual ~Visitor() = default;
  virtual void visit(Circle& c) = 0;
  virtual void visit(Square& s) = 0;
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` visit/accept method. Co-emits with Strategy on the virtual shape (per D21); the visit naming is the discriminator.',
    catalogFile: 'pattern_catalog/behavioural/visitor.json',
    oneLiner: 'Add new operations to a hierarchy without touching its classes.',
    readabilityBenefit:
      'Each new operation lives in its own visitor class, so a reviewer reads one cohesive file instead of a method scattered across every element type.',
    sources: [nesterukSource('Chapter on Visitor'), gofSource('Visitor (Behavioural Patterns)')],
  },
  {
    slug: 'interpreter',
    name: 'Interpreter',
    family: 'Behavioural',
    intent:
      'Given a language, define a representation for its grammar and an interpreter that uses the representation to interpret sentences.',
    problem:
      'A simple, recurring language (arithmetic, rules, queries) needs to be evaluated, and parsing it ad hoc each time is error-prone.',
    solution:
      'Model each grammar rule as a class implementing a virtual interpret(Context&). Composite expressions interpret their children to produce a result.',
    codeSketch: `class Expression {
public:
  virtual ~Expression() = default;
  virtual int interpret(Context& ctx) = 0;
};`,
    detection:
      'Catalog entry uses signature_categories: ["interface_polymorphism"] plus ordered_checks for a `virtual` interpret/evaluate method. Co-emits with Strategy on the virtual shape (per D21); the interpret naming is the discriminator.',
    catalogFile: 'pattern_catalog/behavioural/interpreter.json',
    oneLiner: 'Turn each grammar rule into a class that knows how to evaluate itself.',
    readabilityBenefit:
      'interpret(ctx) on each node makes the grammar map one-to-one onto classes, so the language structure is readable in the type hierarchy.',
    sources: [nesterukSource('Chapter on Interpreter'), gofSource('Interpreter (Behavioural Patterns)')],
  },
  {
    slug: 'memento',
    name: 'Memento',
    family: 'Behavioural',
    intent:
      "Capture and externalize an object's internal state so it can be restored later, without violating encapsulation.",
    problem:
      'Undo, snapshots, and checkpoints require saving and restoring an object\'s state without exposing its private fields to the outside world.',
    solution:
      'The originator produces a Memento holding its state via save(), and restores from one via restore(). Only the originator can read the memento\'s contents.',
    codeSketch: `class Editor {
  std::string text_;
public:
  Memento save() const         { return Memento(text_); }
  void restore(const Memento& m){ text_ = m.getState(); }
};`,
    detection:
      'Catalog entry uses ordered_checks for a save/restore (or createMemento/setMemento) method pair. No signature gate — the save/restore naming carries the signal. May co-emit with Adapter on incidental forwarding.',
    catalogFile: 'pattern_catalog/behavioural/memento.json',
    oneLiner: "Snapshot an object's state now so you can put it back later.",
    readabilityBenefit:
      'save()/restore() name the undo seam directly, so a reviewer finds the checkpoint boundary without hunting through field-by-field copies.',
    sources: [nesterukSource('Chapter on Memento'), gofSource('Memento (Behavioural Patterns)')],
  },
];

export function findPattern(slug: string): PatternEntry | undefined {
  return PATTERNS.find((p) => p.slug === slug);
}

export const PATTERN_BOOK_CITATION = NESTERUK;
