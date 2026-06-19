// Authored in-module conceptual questions for Foundation modules. Only the
// Bloom levels applicable to each module's learning outcomes are authored;
// non-applicable levels stay hidden generated fallbacks at preserved indexes.
// Prompts are distinct from the formal Form A/B bank (same content, new
// scenarios). foundations-postrequisite is intentionally omitted — it is
// open-ended/reflective (learning-only), not auto-graded MCQs.

import { imq, type InModuleBank } from './_shared';

const FND = ['CodiNeo Foundations module content'];
const GOF = ['Gamma, Helm, Johnson, Vlissides (1994), Design Patterns, ch. 1'];

export const IN_MODULE_FOUNDATIONS: InModuleBank = {
  // applicable: Remember, Understand, Apply
  'foundations-what-is-pattern': [
    imq('remembering', 'pattern-definition', 'easy',
      'In this module, a design pattern is described as ___.',
      ['a named, reusable solution to a recurring object-oriented design problem', 'a library you install to avoid writing code', 'a compiler setting that speeds up builds', 'a block of code you copy and paste unchanged'], 0,
      'A design pattern is a named, reusable solution to a recurring design problem — not a library, a compiler flag, or copy-paste code.', [...FND, ...GOF]),
    imq('understanding', 'pattern-not-code', 'moderate',
      'Why is a design pattern NOT the same as a framework or a code snippet?',
      ['Because it is always slower than handwritten code', 'Because it describes a proven way to organise classes and responsibilities, which you adapt to your own code', 'Because it can only be used once per program', 'Because it must be written in C++'], 1,
      'A pattern is a reusable design approach you adapt, not concrete shippable code or a framework you install.', FND),
    imq('applying', 'pattern-recognise-use', 'moderate',
      'A teammate says “let’s reuse the proven house-design idea for our recurring object-creation problem.” What are they proposing to apply?',
      ['A faster compiler', 'A copy of another company’s source code', 'A design pattern — a named, proven solution shape for that recurring problem', 'A new programming language'], 2,
      'Reusing a proven, named solution shape for a recurring design problem is exactly applying a design pattern.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-why-matters': [
    imq('remembering', 'why-benefits', 'easy',
      'According to the module, which is a benefit of using design patterns?',
      ['Code becomes harder to reuse', 'Teams gain a shared vocabulary and code is easier to maintain', 'Every class must inherit from one base', 'Builds always run faster'], 1,
      'Patterns make code easier to reuse/maintain and give teams a shared vocabulary; they are not about build speed or forced inheritance.', FND),
    imq('understanding', 'why-vocabulary', 'moderate',
      'Why does naming a recognisable pattern help during code review?',
      ['It removes the need to compile the code', 'It lets the reviewer grasp the design intent quickly without re-deriving it from scratch', 'It guarantees the code has no bugs', 'It hides the code from other developers'], 1,
      'A recognised pattern name communicates intent quickly so reviewers understand the design without re-deriving it; it does not prove correctness.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-categories': [
    imq('remembering', 'categories-three', 'easy',
      'What are the three main GoF pattern categories described in this module?',
      ['Public, private, protected', 'Creational, Structural, Behavioural', 'Compile, link, run', 'Easy, moderate, hard'], 1,
      'The three GoF categories are Creational, Structural, and Behavioural; the module adds a fourth bucket of C++ idioms.', [...FND, ...GOF]),
    imq('understanding', 'categories-basis', 'moderate',
      'On what basis are patterns grouped into those categories?',
      ['By how many lines of code they need', 'By what the pattern is responsible for — creating objects, organising them, or coordinating behaviour', 'By the year they were invented', 'By the author’s last name'], 1,
      'Categories reflect responsibility: object creation (Creational), structure/composition (Structural), and communication/behaviour (Behavioural).', [...FND, ...GOF]),
  ],
  // applicable: Remember, Understand
  'foundations-oop': [
    imq('remembering', 'oop-encapsulation', 'easy',
      'Which OOP concept means bundling data with the operations that act on it and restricting direct outside access?',
      ['Encapsulation', 'Recursion', 'Compilation', 'Concatenation'], 0,
      'Encapsulation bundles state with behaviour and limits outside access to internals; the others are unrelated.', FND),
    imq('understanding', 'oop-polymorphism-why', 'moderate',
      'Why is polymorphism foundational to most design patterns?',
      ['It makes programs single-threaded', 'It lets code call a shared interface while different concrete types supply the behaviour', 'It removes the need for classes', 'It forces every method to be static'], 1,
      'Polymorphism lets callers depend on an abstraction while concrete types vary the behaviour — the basis of Strategy, Factory, Bridge, and more.', FND),
  ],
  // applicable: Remember, Understand, Apply
  'foundations-interface-principle': [
    imq('remembering', 'interface-principle-statement', 'easy',
      'The principle taught in this module is “program to an ___.”',
      ['interface, not an implementation', 'integer, not a string', 'inline function, not a macro', 'index, not a pointer'], 0,
      'The principle is “program to an interface, not an implementation” — depend on abstractions, not concrete classes.', FND),
    imq('understanding', 'interface-principle-benefit', 'moderate',
      'Why does depending on an abstraction instead of a concrete class make a system easier to change?',
      ['It deletes all the concrete classes', 'New or swapped implementations can be used without modifying the callers that depend only on the abstraction', 'It makes the program compile without linking', 'It forces every class to be final'], 1,
      'Callers that depend on an abstraction are insulated from concrete changes, so implementations can be added or swapped without editing them.', FND),
    imq('applying', 'interface-principle-apply', 'moderate',
      'Several callers each hard-code PayPalProcessor. To follow this module’s principle, what should they depend on instead?',
      ['The exact PayPalProcessor class, but copied into each caller', 'A global PayPal instance', 'A shared PaymentProcessor abstraction that any concrete processor implements', 'A faster version of PayPalProcessor'], 2,
      'Depending on a shared PaymentProcessor abstraction lets any concrete processor be substituted without changing the callers.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-code-structure': [
    imq('remembering', 'code-structure-ast', 'easy',
      'What does AST stand for in this module?',
      ['Abstract Syntax Tree', 'Automated Software Test', 'Applied Statistical Table', 'Assembly Stack Trace'], 0,
      'AST = Abstract Syntax Tree, a tree representation of code structure that tools analyse.', FND),
    imq('understanding', 'code-structure-why', 'moderate',
      'Why can patterns be detected as “shapes” in code structure rather than by reading comments?',
      ['Because comments are always wrong', 'Because class relationships, inheritance, and call flow form recognisable structural arrangements a tool can analyse', 'Because the compiler renames every class', 'Because patterns only exist in documentation'], 1,
      'Patterns manifest as structural arrangements (relationships, inheritance, call flow) that a tool can analyse from a parse tree, independent of comments.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-real-software': [
    imq('remembering', 'real-software-where', 'easy',
      'According to the module, where do design patterns appear?',
      ['Only in textbooks and university exams', 'In production systems written by working engineers across many industries', 'Only in code older than 1994', 'Only in single-file programs'], 1,
      'Patterns appear in real production systems across industries, not only in academic material.', FND),
    imq('understanding', 'real-software-benefit', 'moderate',
      'Why does recognising patterns help a new contributor read an unfamiliar codebase?',
      ['It lets them skip compiling the project', 'A recognised pattern conveys a chunk of design intent at once, speeding up comprehension', 'It removes the need to talk to teammates ever', 'It guarantees the codebase has no bugs'], 1,
      'Spotting a pattern communicates its intent and structure at once, so a newcomer understands a region of code faster.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-beginner-mistakes': [
    imq('remembering', 'beginner-mistake-overuse', 'easy',
      'Which is a common beginner mistake this module warns against?',
      ['Reading the existing code before changing it', 'Forcing a pattern where a simple solution would do (over-engineering)', 'Naming variables clearly', 'Writing unit tests'], 1,
      'Over-applying patterns where a simple solution suffices is a classic beginner trap the module warns against.', FND),
    imq('understanding', 'beginner-mistake-name', 'moderate',
      'Why is naming a class “FactoryManager” NOT enough to claim it uses a pattern?',
      ['Because class names must be lowercase', 'Because a pattern is defined by its structure and intent, not by a label in the name', 'Because the compiler ignores names', 'Because patterns cannot be used in named classes'], 1,
      'A pattern is identified by structure and intent; a suggestive class name alone is not evidence the pattern is present.', FND),
  ],
  // applicable: Remember, Understand, Apply, Analyze, Evaluate
  'foundations-ambiguity': [
    imq('remembering', 'ambiguity-builtin', 'easy',
      'What does this module say about some patterns sharing the same code shape?',
      ['It is a bug in the catalog that must be fixed', 'It is a built-in property — different patterns can share a structural shape', 'It never happens in practice', 'It only happens in Java'], 1,
      'Shared structure across patterns is an inherent property, not a defect — e.g. Builder and Method Chaining both use return *this.', FND),
    imq('understanding', 'ambiguity-why', 'moderate',
      'Why can no automated tool always pick a single pattern from structure alone?',
      ['Because tools cannot read C++', 'Because several patterns can share an identical structural shape, so structure alone is insufficient to decide intent', 'Because the patterns are secret', 'Because compilers delete the structure'], 1,
      'When patterns share a shape, structure underdetermines intent, so a tool cannot always pick one winner from code alone.', FND),
    imq('applying', 'ambiguity-response', 'moderate',
      'Your analyser finds code matching both Adapter and Decorator equally. Following the module, what is the right response?',
      ['Randomly pick one and report it confidently', 'Report the genuine ambiguity rather than bluffing a single confident answer', 'Delete the code', 'Always choose the alphabetically first pattern'], 1,
      'The honest response to a true structural tie is to surface the ambiguity, not to fake a confident single pick.', FND),
    imq('analyzing', 'ambiguity-shared-shape', 'difficult',
      'Two classes each wrap a held member and forward calls to it. Why is this evidence insufficient to label one Adapter and the other Decorator?',
      ['Because forwarding is illegal in C++', 'Because Adapter, Decorator, and Proxy all share that wrap-and-forward shape; intent (convert vs add vs control) must distinguish them', 'Because wrapping always means Adapter', 'Because the classes must be merged'], 1,
      'Wrap-and-forward is common to Adapter, Decorator, and Proxy; only their differing intent separates them, so structure alone cannot decide.', [...FND, ...GOF]),
    imq('evaluating', 'ambiguity-judge', 'difficult',
      'A tool reports “100% Decorator” for code that is structurally identical to Adapter and Proxy, with no extra evidence. How should you judge this report?',
      ['Trustworthy — high confidence means it is correct', 'Unjustified — with a shared shape and no disambiguating evidence, a single high-confidence claim is not defensible', 'Correct because Decorator is most common', 'Correct because the number is high'], 1,
      'A confident single label on a genuinely ambiguous shape, lacking disambiguating evidence, is not defensible — the module’s core lesson.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-connotative-definition': [
    imq('remembering', 'connotative-rule', 'easy',
      'The connotative-definition rule reduces ambiguity by ___.',
      ['guessing the most likely pattern', 'adding descriptive context to the definition so the meaning narrows', 'removing all definitions', 'renaming the classes'], 1,
      'Adding descriptive context (more structural descriptions) narrows meaning — the connotation idea applied to pattern definitions.', FND),
    imq('understanding', 'connotative-set', 'moderate',
      'Why does CodiNeo define each pattern by a SET of structural descriptions rather than a single keyword?',
      ['Because one keyword is faster to type', 'Because a combination of descriptions narrows which pattern is meant, reducing ambiguity', 'Because keywords are banned in C++', 'Because patterns have no structure'], 1,
      'A set of token/structure descriptions, taken together, narrows the meaning far more than a single keyword could.', FND),
  ],
  // applicable: Remember, Understand, Analyze
  'foundations-same-structure': [
    imq('remembering', 'same-structure-intent', 'easy',
      'When two patterns share the same class diagram, this module says you tell them apart by ___.',
      ['intent', 'file size', 'compile time', 'the number of classes'], 0,
      'Identical structure is separated by intent, which shows up in lexemes, collaborators, and call-site shape — not the skeleton.', FND),
    imq('understanding', 'same-structure-where-intent', 'moderate',
      'Where does the module say intent leaves “fingerprints” that help break a near-tie?',
      ['In the compiler version', 'In the lexemes (tokens), the collaborators, and the call-site shape', 'In the file name only', 'In the number of comments'], 1,
      'Intent surfaces in token lexemes, collaborators, and call-site shape — the evidence an analyser uses to break a tie.', FND),
    imq('analyzing', 'same-structure-tiebreak', 'difficult',
      'Two candidates share one shape. Per the module, how should a careful analyser resolve the near-tie?',
      ['Pick the first candidate alphabetically', 'Score each candidate per line on intent evidence (lexemes/collaborators) and compare, rather than bluffing', 'Always report both as 100%', 'Ignore both candidates'], 1,
      'The module describes per-line scoring of intent evidence and comparison to resolve a tie honestly, not a bluffed pick.', FND),
  ],
  // applicable: Remember, Understand, Analyze
  'foundations-structural-rules': [
    imq('remembering', 'structural-rules-what', 'easy',
      'In this catalog, each pattern ships with a “correct structure” section that lists ___.',
      ['the exact token combos the analyser requires', 'the author’s favourite color', 'the price of the pattern', 'the year it was deprecated'], 0,
      'Each pattern’s correct-structure section enumerates the specific token combinations the analyser requires to detect it.', FND),
    imq('understanding', 'structural-rules-why', 'moderate',
      'Why does giving each pattern an explicit structural rule help detection stay consistent?',
      ['It makes the analyser ignore the code', 'It pins detection to concrete, checkable token combinations instead of vague impressions', 'It hides the pattern from learners', 'It forces all patterns to look identical'], 1,
      'Explicit token-combination rules make detection concrete and repeatable rather than subjective.', FND),
    imq('analyzing', 'structural-rules-apply', 'difficult',
      'Code is missing one of the required token combos in a pattern’s structural rule. What can the analyser correctly conclude?',
      ['The pattern is definitely present anyway', 'The required structural evidence is incomplete, so the pattern should not be confidently tagged', 'The code will not compile', 'A different pattern is guaranteed'], 1,
      'If the rule’s required token combo is absent, the structural evidence is incomplete and the pattern should not be confidently asserted.', FND),
  ],
  // applicable: Remember, Understand
  'foundations-context-variation': [
    imq('remembering', 'context-variation-fact', 'easy',
      'According to the module, two teams that both use Builder may ___.',
      ['write code that always looks byte-for-byte identical', 'write code that looks different while still being Builder', 'never use Builder correctly', 'be forced to use the same variable names'], 1,
      'Conventions vary by team, so two correct Builder implementations can look different — the module’s central point.', FND),
    imq('understanding', 'context-variation-standard', 'moderate',
      'How does CodiNeo keep detection consistent despite team-by-team variation?',
      ['By picking one team’s style as universal truth', 'By standardising on language-level structure, leaving team conventions to be layered on top', 'By refusing to analyse any code', 'By requiring all teams to rewrite their code'], 1,
      'CodiNeo answers the structural question at the language level; stricter team conventions are layered on top rather than baked into detection.', FND),
  ],
};
