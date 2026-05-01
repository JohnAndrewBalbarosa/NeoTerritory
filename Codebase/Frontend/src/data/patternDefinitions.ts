// Beginner-voice pattern descriptions. Used as the offline/fallback
// "What is this pattern?" copy on PatternCards. AI-generated patternEducation
// (when present on a DetectedPatternFull) takes precedence over this static
// table.
//
// Author guidance:
// - oneLiner: a single sentence a non-expert can grasp.
// - whenToUse: 1-2 sentences of practical intuition, no jargon.
// - realWorldAnalogy: an everyday analogy. Optional but encouraged.
// - watchOuts: a short note on what beginners commonly confuse this with.

export interface PatternDefinition {
  oneLiner: string;
  whenToUse: string;
  realWorldAnalogy?: string;
  watchOuts?: string;
}

export const PATTERN_DEFINITIONS: Record<string, PatternDefinition> = {
  Factory: {
    oneLiner: 'A function or class whose job is to build other objects for you.',
    whenToUse: 'Use it when picking which concrete class to create depends on input or config, and you do not want callers to know all the choices.',
    realWorldAnalogy: 'A coffee machine button: you press "Latte" and it returns a finished drink — you never touch the milk frother yourself.',
    watchOuts: 'If your "factory" only ever creates one thing with no branching, it is just a constructor in a fancy wrapper.'
  },
  Singleton: {
    oneLiner: 'Guarantees a class has only one instance, accessible from anywhere.',
    whenToUse: 'For shared resources that must not be duplicated — config, logger, connection pool. Reach for it sparingly; it is global state.',
    realWorldAnalogy: 'The President of a country: there is exactly one at any given time, and everyone calls the same one.',
    watchOuts: 'Often overused. If you can pass the object as a parameter instead, do that — it is easier to test.'
  },
  Builder: {
    oneLiner: 'A step-by-step way to construct a complex object, one setting at a time.',
    whenToUse: 'When an object has many optional parameters and a constructor with 8 arguments would be unreadable.',
    realWorldAnalogy: 'Ordering a custom burger: you add toppings one by one, then say "build it" at the end.',
    watchOuts: 'If you only have 2-3 fields, a plain constructor is simpler. Builder shines past ~5 fields.'
  },
  MethodChaining: {
    oneLiner: 'Each method returns the object itself so calls can be linked: a.x().y().z().',
    whenToUse: 'For fluent configuration APIs and query builders where chaining reads like a sentence.',
    realWorldAnalogy: 'Saying "make it large, add cheese, no onions, ready" without putting the order down between steps.',
    watchOuts: 'Easily confused with Builder. Method Chaining is just the syntax; Builder is chaining + a final build() that returns a different product.'
  },
  Adapter: {
    oneLiner: 'Wraps an object so it fits an interface that callers expect.',
    whenToUse: 'When you have an existing class with the right behavior but the wrong shape — different method names or argument types.',
    realWorldAnalogy: 'A travel power adapter: the appliance and the wall socket are both fine; the adapter just makes them mate.',
    watchOuts: 'If you are not adapting to a specific interface — just adding behavior — you probably want Decorator.'
  },
  Decorator: {
    oneLiner: 'Wraps an object to add behavior, while keeping the same interface.',
    whenToUse: 'For layering optional features onto an object at runtime — caching, logging, encryption — without subclassing for each combination.',
    realWorldAnalogy: 'Putting a phone in a case, then a screen protector, then a popsocket: each layer adds a feature; you still hold a phone.',
    watchOuts: 'If your wrapper changes the interface, that is Adapter. If it controls when the inner object is used (lazy, cached, guarded), that is Proxy.'
  },
  Proxy: {
    oneLiner: 'Stands in for another object and controls access to it.',
    whenToUse: 'When the real object is expensive to create, sensitive, or remote — and you want to lazy-load, cache, gate, or log access.',
    realWorldAnalogy: 'A receptionist: callers talk to the receptionist, who decides whether to put them through to the executive.',
    watchOuts: 'A Proxy without a "decision" — pure pass-through — is hard to distinguish from a Decorator that adds nothing.'
  },
  Strategy: {
    oneLiner: 'Lets you swap out an algorithm at runtime by holding it as an object.',
    whenToUse: 'When the same operation has multiple implementations (sort, compress, route) and you want to pick one based on context.',
    realWorldAnalogy: 'Choosing a route in a maps app: same goal (get there), different strategies (fastest, scenic, no tolls).',
    watchOuts: 'If the choice is fixed at compile time, a plain virtual method is enough. Strategy earns its keep when the choice changes at runtime.'
  },
  Observer: {
    oneLiner: 'Notifies a list of "subscribers" when something changes.',
    whenToUse: 'For decoupling: the subject does not need to know who cares; subscribers register and react.',
    realWorldAnalogy: 'A YouTube channel: the creator uploads once; every subscriber gets notified.',
    watchOuts: 'Memory leaks are common when you forget to unsubscribe. Watch the lifetime of subscribers.'
  },
  Composite: {
    oneLiner: 'Treats a tree of objects (parents and children) the same way as a single object.',
    whenToUse: 'For hierarchies — UI trees, file systems — where you want one operation (draw, render, count) to work on a leaf or a whole branch.',
    realWorldAnalogy: 'Folders containing files or other folders. "Show size" works on a single file or a whole folder.',
    watchOuts: 'Easy to over-apply. If your data is not actually tree-shaped, a list is simpler.'
  },
  Iterator: {
    oneLiner: 'Walks a collection one element at a time, hiding how the collection is stored.',
    whenToUse: 'When callers should not know whether they are iterating an array, linked list, or stream.',
    realWorldAnalogy: 'A TV remote\'s "next channel" button: you do not need to know how channels are stored to move to the next one.',
    watchOuts: 'In modern C++ this is mostly built into the language (range-for, iterators). Hand-rolling one is rarely needed.'
  },
  Visitor: {
    oneLiner: 'Lets you add new operations to a class hierarchy without modifying the classes.',
    whenToUse: 'When the data shape is stable but the operations on it keep growing — typed AST passes are a classic example.',
    realWorldAnalogy: 'A health inspector visiting different kinds of restaurants: the restaurant types do not change; the checks do.',
    watchOuts: 'Heavy machinery. If you only have one or two operations, a switch on type is simpler.'
  },
  Command: {
    oneLiner: 'Wraps an action and its arguments as an object you can store, queue, or undo.',
    whenToUse: 'For undo/redo, job queues, macros, and decoupling "what should happen" from "when it happens".',
    realWorldAnalogy: 'A restaurant order ticket: the kitchen does not care who placed it or when; they just execute the ticket.',
    watchOuts: 'If you never store, queue, or replay the action, you do not need Command — just call the function.'
  },
  Pimpl: {
    oneLiner: 'A C++ idiom that hides a class\'s implementation in a separate, opaque struct.',
    whenToUse: 'To reduce header dependencies, hide private members from clients, and improve compile times in large C++ codebases.',
    realWorldAnalogy: 'A car\'s dashboard: you see the steering wheel and pedals; the engine\'s wiring is hidden under the hood.',
    watchOuts: 'Adds a pointer indirection per method call. Use it when compile-time decoupling matters more than micro-perf.'
  },
  Review: {
    oneLiner: 'Could not classify this confidently — the matcher saw a structural clue but not enough evidence.',
    whenToUse: 'You decide. The Tag pattern… button on the card lets you pick the pattern that actually fits.',
    watchOuts: 'A grey "Review" badge is not an error — it is the tool asking for human judgment.'
  }
};

export function patternDefinitionFor(key: string): PatternDefinition | null {
  if (!key) return null;
  if (PATTERN_DEFINITIONS[key]) return PATTERN_DEFINITIONS[key];
  // Try case-insensitive and head-token resolution to match colorFor()'s
  // behavior, so synthetic keys like "factory_method" still find Factory copy.
  const lower = key.toLowerCase();
  for (const k of Object.keys(PATTERN_DEFINITIONS)) {
    if (k.toLowerCase() === lower) return PATTERN_DEFINITIONS[k];
  }
  const head = lower.split(/[^a-z0-9]+/).filter(Boolean)[0] || lower;
  for (const k of Object.keys(PATTERN_DEFINITIONS)) {
    if (k.toLowerCase() === head) return PATTERN_DEFINITIONS[k];
  }
  return null;
}
