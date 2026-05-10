// Pattern reference data. Sourced from the doc blueprint at
// docs/Codebase/Frontend/src/components/marketing/patterns/PatternsPage.tsx.md
// and the pattern catalog at Codebase/Microservice/pattern_catalog/.
//
// Adding a new pattern: drop an entry here AND ship a catalog JSON. The
// public detail page at /patterns/<slug> is rendered from this array; the
// "Detects from" badge points to the catalog file when present.

export interface PatternEntry {
  slug: string;
  name: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  intent: string;
  problem: string;
  solution: string;
  codeSketch: string;
  detection: string; // pointer into the catalog shape
  catalogFile: string | null; // null when reference-only
}

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
      'Wrap the incompatible component in an Adapter that exposes the expected interface and forwards calls — possibly translating arguments — to the wrapped component.',
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
  },
];

export function findPattern(slug: string): PatternEntry | undefined {
  return PATTERNS.find((p) => p.slug === slug);
}
