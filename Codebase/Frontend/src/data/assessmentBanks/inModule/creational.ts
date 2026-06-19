// Authored in-module conceptual questions for the CREATIONAL pattern modules.
// One item per Bloom level (Remember→Evaluate) per module; Create (index 5) is
// the practical C++ task and is never authored here. Prompts/scenarios/code are
// deliberately distinct from the formal Form A/B bank (same concepts, new
// wording). Distractors reuse other creational pattern names. Correct-option
// positions are spread across 0/1/2/3 within and across modules.

import { imq, type InModuleBank } from './_shared';

const GOF = ['Gamma, Helm, Johnson, Vlissides (1994), Design Patterns'];
const NEST = ['Nesteruk (2022), Design Patterns in Modern C++'];
const MOD = ['CodiNeo Creational module content'];

export const IN_MODULE_CREATIONAL: InModuleBank = {
  // ============================ Singleton ============================
  // correctIndex spread: 2, 0, 3, 1, 2
  'creational-singleton': [
    imq('remembering', 'singleton-intent', 'easy',
      'In the kitchen-phone analogy from the module, what does Singleton ultimately provide?',
      ['A way to assemble one object part by part', 'A way to copy a configured object cheaply', 'Exactly one shared object reached through a single access point', 'A family of matching objects created together'], 2,
      'Like the one kitchen phone everyone shares, Singleton yields exactly one instance reached through a single access point. The distractors describe Builder, Prototype, and Abstract Factory.', [...MOD, ...GOF]),
    imq('understanding', 'singleton-enforce', 'moderate',
      'Why does hiding the constructor matter for a Singleton, and how is it different from simply storing an object in a global variable?',
      ['Because hiding the constructor stops outside code from constructing extra instances, whereas a plain global still lets anyone call the constructor again', 'Because a global variable cannot be accessed from other files', 'Because Singletons are forbidden from using static storage', 'Because hiding the constructor makes the object copyable by default'], 0,
      'A non-public constructor is what enforces uniqueness; a plain global object does not prevent additional construction, so the single-instance invariant is not guaranteed.', [...NEST, ...MOD]),
    imq('applying', 'singleton-select', 'moderate',
      'A game engine needs one audio mixer: created the first time sound plays, then reused by every system that emits a sound, with no second mixer ever existing. Which approach matches?',
      ['Prototype', 'Builder', 'Abstract Factory', 'Singleton'], 3,
      'One lazily-created object shared everywhere with no duplicates is the Singleton use case; the distractors solve copying, stepwise construction, and family creation.', [...MOD, ...GOF]),
    imq('analyzing', 'singleton-identify', 'difficult',
      'Examine:  class Clock { Clock(){} public: static Clock& get(){ static Clock c; return c; } long now(); };  Which pattern does this structure indicate?',
      ['Factory Method', 'Singleton (Meyers function-local static)', 'Prototype', 'Method Chaining'], 1,
      'A non-public constructor plus a static accessor returning a single function-local static is the Meyers Singleton idiom; nothing here copies, chains, or chooses a product.', [...NEST]),
    imq('evaluating', 'singleton-evaluate', 'difficult',
      'A class offers a static current() accessor but its copy constructor is still public, so callers can write Settings s2 = Settings::current();. Does this faithfully implement Singleton?',
      ['Yes — a static accessor is all that is required', 'Yes — copying is encouraged so each caller gets its own settings', 'No — a public copy constructor lets callers duplicate the instance, breaking the single-instance guarantee', 'No — Singletons must be allocated with new'], 2,
      'Uniqueness must be protected against copying too; a public copy constructor lets callers clone the instance, violating the invariant regardless of the accessor.', [...GOF, ...NEST]),
  ],

  // ============================ Factory Method ============================
  // correctIndex spread: 1, 3, 2, 0, 1
  'creational-factory-method': [
    imq('remembering', 'fm-intent', 'easy',
      'In Factory Method, which participant decides which concrete product is actually created?',
      ['The client code, by naming the concrete class directly', 'A subclass that overrides the creation method', 'A global registry shared by all callers', 'The destructor of the base product'], 1,
      'The base creator declares a creation method; a subclass overrides it to choose the concrete product. The other options bypass the subclass-driven choice that defines the pattern.', [...MOD, ...GOF]),
    imq('understanding', 'fm-understand', 'moderate',
      'How does Factory Method differ from a factory that produces a whole matching set of related objects?',
      ['It cannot use inheritance at all', 'It always returns a single shared instance', 'It is identical — both create families', 'It defers the choice of one product to a subclass override, rather than creating a coordinated family of products'], 3,
      'Factory Method picks one product through a subclass-overridden method; producing a coordinated family of related products is Abstract Factory.', [...MOD, ...GOF]),
    imq('applying', 'fm-select', 'moderate',
      'A report engine runs an identical generate-and-export sequence, but each report kind must construct its own exporter object. The base class wants to stay unaware of which concrete exporter is used. Which approach fits?',
      ['Singleton', 'Prototype', 'Factory Method', 'Method Chaining'], 2,
      'A fixed flow whose single sub-object is chosen by subclasses through an overridable creation method is Factory Method; the distractors solve single-instance, copying, and fluent configuration.', [...GOF]),
    imq('analyzing', 'fm-identify', 'difficult',
      'Examine:  struct Parser { virtual Token* lex() = 0; void run(){ Token* t = lex(); /* ... */ } };  struct JsonParser : Parser { Token* lex() override { return new JsonToken(); } };  Which pattern does this structure indicate?',
      ['Factory Method', 'Abstract Factory', 'Builder', 'Prototype'], 0,
      'A base class calls its own overridable creation method while a subclass implements it to return one concrete product — Factory Method. There is no family, copy, or stepwise build.', [...GOF, ...NEST]),
    imq('evaluating', 'fm-evaluate', 'difficult',
      'A reviewer finds a base Importer class with a virtual openSource() that two subclasses override to return different concrete sources, used by a shared import() routine. Is labeling this Factory Method defensible?',
      ['No — it must use a string switch to qualify', 'Yes — a creation method overridden by subclasses to choose the concrete product is exactly Factory Method', 'No — it is only Factory Method if the class is named Factory', 'Yes — but only if it is also a Singleton'], 1,
      'Subclasses overriding a creation method to select the concrete product is the defining structure of Factory Method; the class name and instance count are irrelevant.', [...GOF]),
  ],

  // ============================ Builder ============================
  // correctIndex spread: 3, 1, 0, 2, 3
  'creational-builder': [
    imq('remembering', 'builder-intent', 'easy',
      'In the custom-pizza analogy, what does the Builder ultimately do at the end of the steps?',
      ['Guarantees only one pizza ever exists', 'Copies an already-finished pizza', 'Produces a matching set of related pizzas', 'Returns the finished object after the parts have been set one at a time'], 3,
      'Builder assembles a complex object piece by piece and a terminal step returns the finished result, like saying "done" to get the completed pizza. The distractors are Singleton, Prototype, and Abstract Factory.', [...MOD, ...GOF]),
    imq('understanding', 'builder-understand', 'moderate',
      'Why is Builder preferred over a constructor that takes a long list of arguments for a complex object?',
      ['Because constructors cannot allocate memory', 'Because naming each part through separate steps makes the construction readable and lets optional parts be omitted', 'Because Builder guarantees the object is a Singleton', 'Because Builder removes the need for the object to have any fields'], 1,
      'Builder replaces a hard-to-read multi-argument constructor with named steps, so optional knobs stay optional and the intent of each part is clear.', [...MOD, ...GOF]),
    imq('applying', 'builder-select', 'moderate',
      'An HTTP request object has a required URL plus many optional pieces (headers, timeout, retries, body). The team wants required parts enforced and optionals set clearly, ending with one finished request. Which approach fits best?',
      ['Assemble it through ordered steps and a terminal finish call', 'Make the request a single shared global instance', 'Clone a pre-configured request each time', 'Provide one factory interface returning a family of related requests'], 0,
      'Stepwise assembly that enforces required parts and ends with a terminal build is Builder; the distractors describe Singleton, Prototype, and Abstract Factory.', [...MOD, ...GOF]),
    imq('analyzing', 'builder-identify', 'difficult',
      'Examine:  struct HouseBuilder { HouseBuilder& walls(int n); HouseBuilder& roof(std::string t); House build(); };  used as  House h = HouseBuilder{}.walls(4).roof("tile").build();  Which pattern does the presence of the terminal build() most strongly indicate?',
      ['Method Chaining only', 'Prototype', 'Builder (stepwise construction ending in a terminal build)', 'Singleton'], 2,
      'Chained setters that culminate in a terminal build() returning a separate finished product point to Builder; pure Method Chaining configures the same object and lacks the distinct terminal build step.', [...NEST, ...MOD]),
    imq('evaluating', 'builder-evaluate', 'difficult',
      'A "builder" exposes setters that return *this but has no terminal step and no separate product — callers just use the builder object itself as the final result. Does this honor Builder’s intent?',
      ['Yes — any class with chained setters is a complete Builder', 'Yes — a terminal step is forbidden in modern C++', 'No — Builder must be a Singleton to be valid', 'No — without a terminal step that yields a distinct finished product, this is fluent Method Chaining rather than Builder'], 3,
      'Builder’s intent is to assemble and then hand back a separate finished object via a terminal step; chained setters with no terminal product are Method Chaining, the closely related but distinct idiom.', [...NEST, ...MOD]),
  ],

  // ============================ Method Chaining ============================
  // correctIndex spread: 0, 2, 1, 3, 0
  'creational-method-chaining': [
    imq('remembering', 'mc-intent', 'easy',
      'What does the Method Chaining idiom let you do in a single expression?',
      ['Set several options on the same object one after another', 'Guarantee that only one instance of the object exists', 'Create a matching family of related objects', 'Clone a pre-configured object'], 0,
      'Method Chaining returns the same object from each call so options can be set in one fluent expression. The distractors are Singleton, Abstract Factory, and Prototype.', [...NEST, ...MOD]),
    imq('understanding', 'mc-understand', 'moderate',
      'Method Chaining and Builder both rely on returning *this. What distinguishes Method Chaining from Builder?',
      ['Method Chaining must be a Singleton', 'Method Chaining clones the object on each call', 'Method Chaining configures the same object fluently and has no separate terminal step that hands back a distinct finished product', 'Method Chaining can only set one option total'], 2,
      'Both share the return-*this shape, but Method Chaining simply configures one object fluently, whereas Builder adds a terminal step yielding a separate finished product.', [...NEST, ...MOD]),
    imq('applying', 'mc-select', 'moderate',
      'A developer wants to write log.level(Warn).tag("net").color(true); on one line, mutating the same logger and reading like a sentence, with no separate finished object produced. Which technique enables this?',
      ['Make the logger a Singleton', 'Have each setter return a reference to the same logger so calls chain', 'Return a fresh copy of the logger from each setter', 'Provide one interface that creates a family of loggers'], 1,
      'Each setter returning a reference to the same object enables the fluent chain on one logger; the distractors prevent chaining or solve unrelated problems.', [...NEST]),
    imq('analyzing', 'mc-identify', 'difficult',
      'Examine:  struct Style { Style& bold(bool b){ b_=b; return *this; } Style& size(int s){ s_=s; return *this; } };  with no terminal method returning a different type. Which idiom does this structure indicate?',
      ['Factory Method', 'Prototype', 'Abstract Factory', 'Method Chaining (a fluent interface)'], 3,
      'Mutating setters that return *this with no terminal step producing a distinct product form a fluent interface (Method Chaining). The absence of a build()-style terminal distinguishes it from Builder.', [...NEST]),
    imq('evaluating', 'mc-evaluate', 'difficult',
      'A "fluent" class declares its setters to return a brand-new copy of the object instead of *this. Does this implement method chaining correctly, and what is the effect?',
      ['No — each call mutates a different copy, so accumulated settings can be lost and the chain no longer configures one object', 'Yes — returning copies is required for chaining', 'Yes — it behaves identically to returning *this', 'No — chaining is impossible in C++ regardless'], 0,
      'Returning a fresh copy each call means each setter acts on a different object, so earlier settings may be discarded; correct chaining returns *this so the same object is configured.', [...NEST]),
  ],

  // ============================ Prototype ============================
  // correctIndex spread: 2, 0, 3, 1, 2
  'creational-prototype': [
    imq('remembering', 'pr-intent', 'easy',
      'What is the core idea of the Prototype pattern?',
      ['Build the object up one part at a time', 'Keep exactly one shared instance', 'Create a new object by copying an existing one instead of building it from nothing', 'Produce a coordinated family of related objects'], 2,
      'Prototype makes new objects by copying an existing instance rather than constructing from scratch. The distractors describe Builder, Singleton, and Abstract Factory.', [...MOD, ...GOF]),
    imq('understanding', 'pr-understand', 'moderate',
      'Why does cloning rely on a virtual clone() rather than letting the caller write new ConcreteType(original)?',
      ['So the caller can copy an object through a base pointer without knowing or naming its concrete type', 'Because virtual methods are faster than constructors', 'Because Prototype objects may not have constructors', 'Because clone() guarantees the object becomes a Singleton'], 0,
      'A polymorphic clone() lets callers copy through the base interface without knowing the concrete type, which is the whole point of Prototype; naming the concrete type would defeat it.', [...MOD, ...GOF]),
    imq('applying', 'pr-select', 'moderate',
      'A diagramming tool lets users press Ctrl+D to duplicate any selected element — a styled node, a connector, a group — at runtime, without the tool knowing each element’s concrete class. Which approach fits?',
      ['Singleton', 'Abstract Factory', 'Method Chaining', 'Prototype'], 3,
      'Duplicating a configured object polymorphically without naming its concrete type is Prototype via clone(); the distractors do not copy a configured instance.', [...GOF]),
    imq('analyzing', 'pr-identify', 'difficult',
      'Examine:  struct Node { virtual std::unique_ptr<Node> clone() const = 0; };  struct TextNode : Node { std::unique_ptr<Node> clone() const override { return std::make_unique<TextNode>(*this); } };  Which pattern does this structure indicate?',
      ['Factory Method', 'Prototype', 'Builder', 'Abstract Factory'], 1,
      'A virtual clone() that each concrete type implements to copy-construct itself is the Prototype structure; it copies an existing object rather than choosing or assembling one.', [...GOF, ...NEST]),
    imq('evaluating', 'pr-evaluate', 'difficult',
      'A Prototype subclass owns a pointer to a heap buffer, and its clone() performs only a member-wise (shallow) copy. Is this a sound clone, and why?',
      ['Sound — shallow copies are always correct for Prototype', 'Sound only if the class is marked final', 'Unsound — both objects end up sharing the same buffer, so a deep copy is needed for a truly independent clone', 'Unsound — Prototype classes may not own pointers'], 2,
      'A shallow copy makes the clone and original share the same owned buffer, risking aliasing and double-free; an independent clone usually requires a deep copy of owned resources.', [...NEST]),
  ],

  // ============================ Abstract Factory ============================
  // correctIndex spread: 1, 2, 0, 3, 1
  'creational-abstract-factory': [
    imq('remembering', 'af-intent', 'easy',
      'What does an Abstract Factory provide through its interface?',
      ['A single shared instance reached globally', 'A set of methods that create a whole matching family of related objects', 'A copy of an existing configured object', 'A terminal step that returns one finished object'], 1,
      'Abstract Factory exposes one interface whose methods create a coherent family of related products. The distractors describe Singleton, Prototype, and Builder.', [...MOD, ...GOF]),
    imq('understanding', 'af-understand', 'moderate',
      'How does Abstract Factory differ from a pattern where a subclass overrides one method to choose a single concrete product?',
      ['It is the same pattern under a different name', 'It only works when the products are Singletons', 'It defines an interface that creates a coordinated family of several related products, not just one product', 'It forbids the use of inheritance'], 2,
      'Abstract Factory creates a family of related products together; deferring one product’s creation to a subclass override is Factory Method. They are distinct.', [...MOD, ...GOF]),
    imq('applying', 'af-select', 'moderate',
      'A document editor must render either a "Light" or "Dark" theme, and within a chosen theme the toolbar, scrollbar, and tooltip must all match — never a light scrollbar with a dark toolbar. Which approach fits?',
      ['Provide one interface that creates a matching family of related controls per theme', 'Keep a single global instance of the toolbar', 'Clone a pre-configured tooltip for each control', 'Assemble each control through ordered steps'], 0,
      'Guaranteeing a coherent, non-mixed family of related products per theme is Abstract Factory; the distractors describe Singleton, Prototype, and Builder.', [...GOF, ...MOD]),
    imq('analyzing', 'af-identify', 'difficult',
      'Examine:  struct DbFactory { virtual Connection* connect() = 0; virtual Command* command() = 0; virtual Reader* reader() = 0; };  Which pattern is this interface part of?',
      ['Factory Method', 'Builder', 'Prototype', 'Abstract Factory'], 3,
      'One interface declaring several create methods for related products (Connection, Command, Reader) that a concrete factory implements as a coherent family is Abstract Factory; a single create method would be Factory Method.', [...GOF, ...NEST]),
    imq('evaluating', 'af-evaluate', 'difficult',
      'A concrete MySqlFactory implements connect() returning a MySqlConnection but command() returns a PostgresCommand. Does this honor Abstract Factory’s intent?',
      ['Yes — any concrete return types are acceptable', 'No — a concrete factory must return products from one consistent family; mixing MySQL and Postgres breaks the family guarantee', 'Yes — provided both types compile together', 'No — Abstract Factory is limited to a single product method'], 1,
      'The value of Abstract Factory is that one concrete factory yields a matching family; returning a Postgres command from a MySQL factory violates that coherence guarantee.', [...GOF]),
  ],
};
