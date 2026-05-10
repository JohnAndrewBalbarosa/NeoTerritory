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
  // ---- Source attribution ----
  nesterukChapter?: string;
}

const NESTERUK = 'Nesteruk, D. (2022). Design Patterns in Modern C++20. Apress.';

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
  Logger() = default;
public:
  static Logger& instance() {
    static Logger inst;
    return inst;
  }
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
    codeSketch: `class Dialog {
public:
  virtual std::unique_ptr<Button> createButton() = 0;
  void render() {
    auto btn = createButton();
    btn->draw();
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
    codeSketch: `Request r = RequestBuilder()
  .withMethod("POST")
  .withHeader("Content-Type", "json")
  .withBody(payload)
  .build();`,
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
    nesterukChapter: 'Nesteruk 2022, Chapter on Builder',
  },
  {
    slug: 'method-chaining',
    name: 'Method Chaining',
    family: 'Behavioural',
    intent:
      'Allow multiple method calls on the same object in sequence by returning the object from each method.',
    problem:
      'Configuring an object across many setter calls produces visual clutter when each call is a standalone statement on its own line repeating the variable name.',
    solution:
      'Have each setter return *this. Calls fluently chain on a single expression. Reads like a sentence: subject, verb, verb, verb.',
    codeSketch: `query
  .where("price", ">", 100)
  .orderBy("created_at")
  .limit(20);`,
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
  RealFetcher real;
  std::unordered_map<Url, Response> cache;
public:
  Response get(Url u) {
    if (auto it = cache.find(u); it != cache.end()) return it->second;
    auto r = real.get(u);
    cache[u] = r;
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
    codeSketch: `class LoggingFetcher {
  Fetcher inner;
public:
  Response get(Url u) {
    log("GET " + u.str());
    return inner.get(u);
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
      'Catalog entry (planned): signature_categories: ["interface_polymorphism", "ownership_handle"]. Distinguishes from State by absence of state-transition methods.',
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
      'Catalog entry (planned): signature_categories: ["interface_polymorphism"], ordered_checks looking for an attach/subscribe + a notify/publish loop over a collection of polymorphic listeners.',
    catalogFile: null,
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
      'Catalog entry (planned): looks for begin/end methods returning a type with operator++ and operator*.',
    catalogFile: null,
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
      'Catalog entry (planned): interface_polymorphism + a member function named execute / run / invoke + state captured in member fields.',
    catalogFile: null,
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
      'Catalog entry (planned): interface_polymorphism + a self-typed container field + a forwarding call inside the parent override.',
    catalogFile: null,
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
      'Catalog entry (planned): non-virtual public method that calls one or more virtual hook methods. Negative gate: pure forwarder Adapter shape.',
    catalogFile: null,
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
      'Catalog entry (planned): interface_polymorphism + ownership_handle + state-transition methods returning a new State (the differentiator from Strategy).',
    catalogFile: null,
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
    nesterukChapter: 'Nesteruk 2022, Chapter on Modern C++ idioms',
  },
];

export function findPattern(slug: string): PatternEntry | undefined {
  return PATTERNS.find((p) => p.slug === slug);
}

export const PATTERN_BOOK_CITATION = NESTERUK;
