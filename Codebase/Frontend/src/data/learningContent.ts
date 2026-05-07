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
