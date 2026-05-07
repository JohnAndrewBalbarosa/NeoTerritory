import builderSrc from '../../../Microservice/samples/builder/http_request_builder.cpp?raw';
import factorySrc from '../../../Microservice/samples/factory/shape_factory.cpp?raw';
import singletonSrc from '../../../Microservice/samples/singleton/config_registry.cpp?raw';
import methodChainSrc from '../../../Microservice/samples/method_chaining/query_predicate.cpp?raw';
import strategySrc from '../../../Microservice/samples/strategy/strategy_basic.cpp?raw';
import wrappingSrc from '../../../Microservice/samples/wrapping/logging_proxy.cpp?raw';

export interface Sample {
  name: string;
  code: string;
}

// Structural connotation rule for one design pattern as the NT detector
// applies it. mustHave entries are token combos that MUST appear at least
// once in the class body. mustNotHave entries are combos that, if present,
// disqualify the class from this pattern. Entries are written as plain
// token sequences (e.g. ["return", "*", "this"]) so the lesson reader can
// match them against real source code with their eyes.
export interface CorrectStructure {
  mustHave: Array<{
    label: string;
    tokens: string[];
    why: string;
  }>;
  mustNotHave?: Array<{
    label: string;
    tokens: string[];
    why: string;
  }>;
  whyItWorks: string;
}

export interface Lesson {
  id: string;
  name: string;
  oneLiner: string;
  whatItIs: string;
  whenToUse: string;
  example: string;
  // C++ concepts the reader should already be comfortable with before this
  // lesson lands.
  prerequisites: string[];
  sample?: Sample;
  // The exact structural rule the NT detector enforces for this pattern.
  // Lets students see "what makes the analyzer say this IS a Builder" in
  // the same vocabulary the analyzer itself uses. Optional only because
  // some lessons are too short for a structural section yet.
  correctStructure?: CorrectStructure;
}

export interface Family {
  id: string;
  name: string;
  gist: string;
  overview: string;
  lessons: Lesson[];
}

export const FAMILIES: Family[] = [
  {
    id: 'creational',
    name: 'Creational',
    gist:
      'Patterns that decide how new objects are made. Use them when building something is more involved than just calling new.',
    overview:
      'Creational patterns help when an object has many parts, when its construction depends on a choice, or when there should only be one of it. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'builder',
        name: 'Builder',
        oneLiner: 'Set parts one at a time, then ask for the finished object.',
        whatItIs:
          'A way to build a complex object piece by piece. You set each part on its own line, then call a final method that returns the finished thing.',
        whenToUse:
          'When an object has many optional parts, or when calling its constructor with all the arguments would be hard to read.',
        example:
          'Think of ordering a custom pizza. You add cheese. Then you add pepperoni. Then olives. At the end you say done, and the cashier hands you the finished pizza.',
        prerequisites: [
          'Classes with public member functions.',
          'Returning *this by reference so calls can chain.',
          'Move semantics or a final build() that returns the finished object by value.',
        ],
        sample: { name: 'http_request_builder.cpp', code: builderSrc },
        correctStructure: {
          mustHave: [
            {
              label: 'Self-return chain',
              tokens: ['return', '*', 'this'],
              why: 'The setter returns the same object so calls chain. Without this, it is just a normal class.',
            },
          ],
          whyItWorks:
            'Builder and Method Chaining look the same at this token level. The analyzer flags a class with `return *this` as both candidates at once and marks the result ambiguous. The reader picks the right one based on whether the class also has a separate finishing method that returns a finished product (Builder) or just keeps mutating (Method Chaining).',
        },
      },
      {
        id: 'factory',
        name: 'Factory',
        oneLiner: 'Ask one helper to make the right kind of object for you.',
        whatItIs:
          'A helper class with one method that decides which kind of object to create. The caller does not need to know the exact subclass it is getting.',
        whenToUse:
          'When the calling code should not have to pick between several similar subclasses on its own. You ask for a Shape, and the factory hands back a Circle or a Square.',
        example:
          'A vending machine. You press the button for soda. The machine decides whether to give you a bottle or a can. You do not pick the brand of plastic.',
        prerequisites: [
          'Inheritance and virtual functions (a base class with derived subtypes).',
          'Smart pointers — std::unique_ptr<Base> as the factory return type.',
          'Polymorphism through a base-class pointer or reference.',
        ],
        sample: { name: 'shape_factory.cpp', code: factorySrc },
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
              why: 'Modern factories return smart pointers. The presence of `std::make_unique` (or `std::make_shared`) is enough on its own; no naming convention required.',
            },
          ],
          whyItWorks:
            'A factory is identified by the act of creating-and-returning, not by the method being named create() or make(). Token combos like `return new` or a bare `std::make_unique` are language-level evidence that does not depend on what the developer chose to call the method.',
        },
      },
      {
        id: 'method-chaining',
        name: 'Method Chaining',
        oneLiner: 'Set many options on the same object in one line.',
        whatItIs:
          'A style where each method returns the same object so you can call several methods in a row, all chained together.',
        whenToUse:
          'When you want a clean, readable way to set many options on one object without writing the variable name over and over.',
        example:
          'Picking filters in a settings screen. You tap dark mode, then large text, then no notifications. Each tap leaves you on the same screen so the next tap can follow right away.',
        prerequisites: [
          'Member functions and the implicit this pointer.',
          'Reference return types — return *this so the caller keeps the same object.',
          'Awareness of const-correctness so chains read predictably.',
        ],
        sample: { name: 'query_predicate.cpp', code: methodChainSrc },
        correctStructure: {
          mustHave: [
            {
              label: 'Self-return chain',
              tokens: ['return', '*', 'this'],
              why: 'Each call leaves the caller pointed at the same instance, so the next call can hang off the previous one without naming the variable again.',
            },
          ],
          whyItWorks:
            'Method Chaining is structurally identical to Builder at the token level: both rely on `return *this`. The analyzer surfaces both as candidates and marks the class ambiguous. The reader resolves it by asking: is there a finishing method that produces a different product (Builder) or do all calls just mutate the same object (Method Chaining)?',
        },
      },
      {
        id: 'singleton',
        name: 'Singleton',
        oneLiner: 'Allow only one instance of a class to exist at a time.',
        whatItIs:
          'A class that makes sure only one instance of itself exists in the whole program. Other code reaches that instance through a single shared accessor.',
        whenToUse:
          'When you have something that should be shared everywhere, like a settings registry, a logger, or a connection pool.',
        example:
          'The clock on a wall. Everyone in the room reads the same one. There is no second clock in the room with a different time.',
        prerequisites: [
          'Static class members and a static accessor function.',
          'Private constructors plus deleted copy and move (so no second instance can be made).',
          'Function-local statics (Meyers singleton) for thread-safe one-time initialisation.',
        ],
        sample: { name: 'config_registry.cpp', code: singletonSrc },
        correctStructure: {
          mustHave: [
            {
              label: 'Explicit deletion of copy/move',
              tokens: ['=', 'delete'],
              why: 'A Singleton actively prevents anyone from making a second instance. The `= delete` declaration on the copy constructor and copy assignment is the clearest language-level proof of that intent.',
            },
          ],
          whyItWorks:
            'Singletons are not identified by a method named getInstance() — that is a naming convention that varies across teams. The structural rule the analyzer enforces is "this class explicitly forbids being copied", which `= delete` says without ambiguity.',
        },
      },
    ],
  },
  {
    id: 'behavioural',
    name: 'Behavioural',
    gist:
      'Patterns that decide how objects work together. Use them when one piece of code needs to swap how it does its job.',
    overview:
      'Behavioural patterns are about choice at runtime. The shape of the code stays the same, but which step actually runs can change. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'strategy',
        name: 'Strategy',
        oneLiner: 'Swap out the algorithm a class uses without changing the class.',
        whatItIs:
          'A way to keep a single calling spot in your code while letting the actual work be done by one of several interchangeable helpers.',
        whenToUse:
          'When you have several different ways to do the same job and you want to choose between them at runtime.',
        example:
          'A navigation app. Walking, biking, and driving all give you a route from point A to point B. You pick the strategy and the app uses that one.',
        prerequisites: [
          'Abstract base classes with at least one pure virtual method.',
          'Composition — holding a pointer or reference to the strategy interface as a member.',
          'Dependency injection through the constructor or a setter.',
        ],
        sample: { name: 'strategy_basic.cpp', code: strategySrc },
        correctStructure: {
          mustHave: [
            {
              label: 'Virtual destructor declaration',
              tokens: ['virtual', '~'],
              why: 'A Strategy interface owns its derived classes through a base pointer; the virtual destructor is required so deletion runs the right destructor.',
            },
            {
              label: 'Or override on a concrete strategy',
              tokens: ['override', '{'],
              why: 'A concrete strategy declares the override of the interface method. The combo `override {` (or `override const`) is enough to identify the concrete role.',
            },
            {
              label: 'Or pure-virtual marker',
              tokens: ['=', '0'],
              why: 'On the interface itself, `= 0` after a method signature pins the class as abstract. No class with a pure-virtual method can be a value type.',
            },
          ],
          whyItWorks:
            'Strategy is identified by polymorphism, not by class names ending in "Strategy". The combos above (`virtual ~`, `override {`, `= 0`) are language-level signals that the class participates in a polymorphic family.',
        },
      },
    ],
  },
  {
    id: 'structural',
    name: 'Structural',
    gist:
      'Patterns that decide how objects fit together to form bigger things. Use them when you need to combine objects without making the code messy.',
    overview:
      'Structural patterns are about composition. They wrap, join, or stand in for other objects so that the calling code stays simple. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'adapter',
        name: 'Adapter',
        oneLiner: 'Let two parts that speak different languages work together.',
        whatItIs:
          'A wrapper class that translates one interface into another. The thing you have on the inside has a different shape from the thing the caller expects on the outside.',
        whenToUse:
          'When you have an old library that expects one shape and a new library that gives you a different shape, and you want them to work together.',
        example:
          'A travel plug adapter. The wall socket and your charger do not match, so you put an adapter between them. The wall does not change, the charger does not change.',
        prerequisites: [
          'Inheritance — the adapter implements the target interface.',
          'Composition — the adapter holds the adaptee as a member.',
          'Method forwarding and the difference between is-a and has-a relationships.',
        ],
        sample: { name: 'logging_proxy.cpp', code: wrappingSrc },
        correctStructure: {
          mustHave: [],
          mustNotHave: [
            {
              label: 'No smart pointer ownership of the wrappee',
              tokens: ['std::unique_ptr'],
              why: 'A class that owns its wrappee via std::unique_ptr is doing composition with a strategy or pimpl shape — not Adapter. Adapter holds the wrappee through a plain pointer or reference.',
            },
            {
              label: 'No virtual / override',
              tokens: ['override', '{'],
              why: 'A class that overrides a polymorphic interface is a Decorator candidate, not Adapter. Adapter does not extend behaviour through virtual dispatch — it translates between interfaces.',
            },
            {
              label: 'No stdlib synchronization',
              tokens: ['std::mutex'],
              why: 'A class that uses `std::mutex`, `std::lock_guard`, etc. is wrapping for access control — that is Proxy, not Adapter.',
            },
          ],
          whyItWorks:
            'Adapter is the residual structural wrapper: it forwards calls to a held member without virtual dispatch, without ownership of the wrappee, and without access control. The analyzer expresses this by REJECTING anything that looks like Decorator, Proxy, or Pimpl rather than positively asserting Adapter shape.',
        },
      },
      {
        id: 'decorator',
        name: 'Decorator',
        oneLiner: 'Wrap something to add extra behavior, without changing the original.',
        whatItIs:
          'A wrapper that has the same interface as the thing it wraps, but adds work before or after each call. Decorators stack, so you can add several layers.',
        whenToUse:
          'When you want to add features one layer at a time, like adding a timestamp to a logger or a border to a button, without rewriting the original.',
        example:
          'Putting a phone case on your phone. The phone still works the same. The case adds protection on top.',
        prerequisites: [
          'Inheritance from a common component interface.',
          'Composition where the decorator owns another component (often via std::unique_ptr).',
          'Recursive composition — a decorator can wrap another decorator.',
        ],
        sample: { name: 'logging_proxy.cpp', code: wrappingSrc },
        correctStructure: {
          mustHave: [
            {
              label: 'Override of the wrapped interface',
              tokens: ['override', '{'],
              why: 'A Decorator IS-A the wrapped component. It overrides the same methods and adds work before or after delegating.',
            },
          ],
          whyItWorks:
            'A Decorator is identified by polymorphic override of the component interface. Without an override the class is just composition; with the override, the wrapper presents the same shape to the caller while adding its own layer.',
        },
      },
      {
        id: 'proxy',
        name: 'Proxy',
        oneLiner: 'Stand in for another object and control how it gets used.',
        whatItIs:
          'A wrapper that has the same interface as the real object, but controls how and when the real one gets called. The proxy can check, delay, or even skip the real call.',
        whenToUse:
          'When you want to add access checks, lazy loading, or remote calls in front of an existing object without changing the object itself.',
        example:
          'A receptionist at an office. You do not walk straight to the CEO. You go through the receptionist, who decides if you may pass.',
        prerequisites: [
          'Inheritance from the same interface as the real subject.',
          'Holding the real subject as a member (often lazily, via a smart pointer).',
          'Method forwarding plus the discipline to add cross-cutting work before or after each call.',
        ],
        sample: { name: 'logging_proxy.cpp', code: wrappingSrc },
        correctStructure: {
          mustHave: [
            {
              label: 'Stdlib synchronization or access-control symbol',
              tokens: ['std::lock_guard'],
              why: 'A Proxy controls how and when the real subject is accessed. Stdlib symbols like `std::mutex`, `std::lock_guard`, `std::call_once`, `std::atomic`, or `std::condition_variable` are language-level proof of that control.',
            },
          ],
          whyItWorks:
            'Proxy is differentiated from plain wrapping by the presence of access control. The analyzer keys on stdlib symbols rather than method names like `cache` or `lock`, so a project that uses non-English variable names still gets the same answer.',
        },
      },
    ],
  },
  {
    id: 'idiom',
    name: 'Idiom',
    gist:
      'Patterns that are not from the classic Gang of Four book but show up so often in C++ that they deserve a name of their own.',
    overview:
      'Idioms live next to the classic patterns because they recur with the same regularity. They are language-specific tricks, not universal patterns. Pick a lesson on the left to see a plain example.',
    lessons: [
      {
        id: 'pimpl',
        name: 'Pimpl',
        oneLiner: 'Hide the inside of a class so the header file does not give it away.',
        whatItIs:
          'A trick that hides a class data members inside a private inner struct. The header file only mentions the inner struct by name, so the inside can change without anyone noticing.',
        whenToUse:
          'When you want the rest of the code to depend only on the public interface, not on the internal layout. Useful for keeping compile times down too.',
        example:
          'A sealed gift box. From the outside it looks the same to everyone. What is inside can change, and people who never open the box never need to know.',
        prerequisites: [
          'Forward declarations and the header / source split.',
          'std::unique_ptr to an incomplete type, with the destructor defined in the .cpp file.',
          'Awareness of how header changes trigger downstream recompilation.',
        ],
        correctStructure: {
          mustHave: [
            {
              label: 'Smart-pointer handle to the inner type',
              tokens: ['std::unique_ptr'],
              why: 'Pimpl owns its hidden Impl through a smart pointer. The presence of `std::unique_ptr` (or `std::shared_ptr`) plus a forward-declared inner struct is the structural signature.',
            },
          ],
          whyItWorks:
            'Pimpl is identified by ownership of an incomplete inner type via stdlib smart pointers. There is no naming convention involved — the analyzer reads the stdlib symbol directly.',
        },
      },
    ],
  },
];

export function familyById(id: string): Family | undefined {
  return FAMILIES.find((f) => f.id === id);
}

export function findLesson(lessonId: string): { family: Family; lesson: Lesson } | undefined {
  for (const family of FAMILIES) {
    const lesson = family.lessons.find((l) => l.id === lessonId);
    if (lesson) return { family, lesson };
  }
  return undefined;
}
