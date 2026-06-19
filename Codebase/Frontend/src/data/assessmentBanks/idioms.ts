// Authored Idiom formal Form A/B objective items (Remember→Evaluate).
// PIMPL (pointer to implementation) is a C++ implementation idiom / compilation
// firewall — NOT a GoF structural pattern, and distinct from Bridge. Create
// stays in the module's practical C++ task. All items validationStatus 'draft'.

import type { ObjectiveAssessmentQuestion } from '../learningModules';

type Form = ReadonlyArray<ObjectiveAssessmentQuestion>;

const SUTTER = 'Sutter (1999), Exceptional C++ — Compilation Firewalls (PIMPL)';
const NESTERUK = 'Nesteruk (2022), Design Patterns in Modern C++';
const MODULE = 'CodiNeo Idioms module content';

const mk = (
  id: string, paired: string,
  taxonomy: 'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating',
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate',
  competencyId: string, difficulty: 'easy' | 'moderate' | 'difficult',
  question: string, options: [string, string, string, string], correctIndex: 0 | 1 | 2 | 3,
  rationale: string, sources: ReadonlyArray<string>,
): ObjectiveAssessmentQuestion => ({
  id, form: id.includes(':A') ? 'A' : 'B', pairedQuestionId: paired, type: 'mcq', taxonomy, bloomLevel, competencyId, difficulty,
  question, options, correctIndex, rationale, sourceReferences: sources, validationStatus: 'draft',
});

const pimplA: Form = [
  mk('idioms-pimpl:A1', 'idioms-pimpl:B1', 'remembering', 'remember', 'pimpl-intent', 'easy',
    'What does the PIMPL (pointer to implementation) idiom do?',
    ['Converts one interface into another', 'Shares intrinsic state across many objects', 'Hides a class’s private members behind a pointer to an implementation struct, keeping the header stable', 'Provides one-to-many notification'], 2,
    'PIMPL moves private members into a hidden implementation accessed through a pointer, so the header stays stable. The distractors are Adapter, Flyweight, and Observer.', [SUTTER, MODULE]),
  mk('idioms-pimpl:A2', 'idioms-pimpl:B2', 'understanding', 'understand', 'pimpl-classify', 'moderate',
    'How should PIMPL be classified relative to the GoF design patterns?',
    ['As the GoF Bridge pattern', 'As a GoF structural pattern', 'As a GoF creational pattern', 'As a C++ implementation idiom (a compilation firewall), distinct from Bridge'], 3,
    'PIMPL is a C++ implementation idiom for header insulation, not a GoF pattern, and is distinct from Bridge (which varies an abstraction/implementation hierarchy).', [SUTTER, NESTERUK]),
  mk('idioms-pimpl:A3', 'idioms-pimpl:B3', 'applying', 'apply', 'pimpl-select', 'moderate',
    'A widely-included library header keeps changing its private members, forcing slow recompiles of every client. You want the header to stop exposing those members so clients rarely recompile. Which technique fits?',
    ['The PIMPL idiom (pointer to a hidden implementation)', 'The Composite pattern', 'The Observer pattern', 'The Strategy pattern'], 0,
    'Insulating clients from private-member changes via a hidden implementation pointer is PIMPL. The distractors solve unrelated problems.', [SUTTER]),
  mk('idioms-pimpl:A4', 'idioms-pimpl:B4', 'analyzing', 'analyze', 'pimpl-identify', 'difficult',
    'Examine (widget.h):  class Widget { public: Widget(); ~Widget(); void draw(); private: struct Impl; std::unique_ptr<Impl> p; };  with all members defined in widget.cpp. Which C++ idiom does this header demonstrate?',
    ['Bridge pattern', 'PIMPL idiom', 'Flyweight pattern', 'Proxy pattern'], 1,
    'An opaque nested Impl held by a smart pointer, with definitions in the .cpp, is the PIMPL idiom (a compilation firewall).', [SUTTER, NESTERUK]),
  mk('idioms-pimpl:A5', 'idioms-pimpl:B5', 'evaluating', 'evaluate', 'pimpl-evaluate', 'difficult',
    'A developer says a class “uses Bridge” because it holds a unique_ptr<Impl>. But there is exactly one Impl type whose only purpose is to hide private members and reduce header dependencies — no abstraction/implementation hierarchy varies. Is “Bridge” accurate?',
    ['Yes — any pointer-to-impl is Bridge', 'Yes — Bridge and PIMPL are interchangeable terms', 'No — a single fixed implementation used only to hide members and stabilise the header is the PIMPL idiom, not Bridge', 'No — this is actually the Adapter pattern'], 2,
    'With one fixed implementation used solely for header insulation, this is PIMPL, not Bridge — Bridge requires independently varying abstraction and implementation hierarchies.', [SUTTER, NESTERUK]),
];
const pimplB: Form = [
  mk('idioms-pimpl:B1', 'idioms-pimpl:A1', 'remembering', 'remember', 'pimpl-intent', 'easy',
    'The PIMPL idiom primarily ___.',
    ['shares intrinsic state across objects', 'defines interchangeable algorithms', 'captures and restores object state', 'moves a class’s private implementation behind a pointer so the header stays stable and dependencies shrink'], 3,
    'PIMPL relocates the private implementation behind a pointer to insulate the header and cut dependencies. The distractors are Flyweight, Strategy, and Memento.', [SUTTER, MODULE]),
  mk('idioms-pimpl:B2', 'idioms-pimpl:A2', 'understanding', 'understand', 'pimpl-classify', 'moderate',
    'Which benefits does PIMPL provide?',
    ['Reduced header/compile-time dependencies, a more stable header/ABI, and hidden implementation details', 'Runtime algorithm swapping', 'Automatic object pooling', 'One-to-many event notification'], 0,
    'PIMPL’s benefits are fewer header dependencies, a more stable header/ABI, and hidden implementation details. The distractors describe Strategy, Flyweight, and Observer.', [SUTTER, NESTERUK]),
  mk('idioms-pimpl:B3', 'idioms-pimpl:A3', 'applying', 'apply', 'pimpl-select', 'moderate',
    'A team wants to change a class’s private data members in future releases without forcing every client translation unit that includes the header to recompile. Which technique achieves this insulation?',
    ['Template Method', 'The PIMPL idiom', 'Decorator', 'Mediator'], 1,
    'Hiding private members behind an implementation pointer so header changes (and recompiles) are avoided is PIMPL.', [SUTTER]),
  mk('idioms-pimpl:B4', 'idioms-pimpl:A4', 'analyzing', 'analyze', 'pimpl-identify', 'difficult',
    'Examine (engine.h):  class Engine { public: Engine(); ~Engine(); void run(); private: class Impl; Impl* impl_; };  with Impl defined only in engine.cpp. This header pattern is which idiom?',
    ['Bridge pattern', 'Adapter pattern', 'PIMPL idiom', 'Composite pattern'], 2,
    'An opaque nested Impl referenced by pointer and defined only in the .cpp is the PIMPL idiom.', [SUTTER, NESTERUK]),
  mk('idioms-pimpl:B5', 'idioms-pimpl:A5', 'evaluating', 'evaluate', 'pimpl-evaluate', 'difficult',
    'A class exposes only public methods in its header and forwards every call to a privately-pointed Impl defined in the source file, with one Impl type whose sole job is hiding members. Is calling this “PIMPL” (not Bridge) correct?',
    ['No — it must be called Bridge', 'No — PIMPL requires multiple implementations', 'Yes — but only if it is in the standard library', 'Yes — a single hidden implementation behind a pointer to insulate the header is PIMPL, distinct from Bridge’s varying abstraction/implementation hierarchies'], 3,
    'A single hidden implementation behind a pointer used to insulate the header is PIMPL; Bridge would require independently varying abstraction and implementation hierarchies.', [SUTTER, NESTERUK]),
];

export const IDIOM_ASSESSMENT_FORMS: Record<string, { A: Form; B: Form }> = {
  'idioms-pimpl': { A: pimplA, B: pimplB },
};
