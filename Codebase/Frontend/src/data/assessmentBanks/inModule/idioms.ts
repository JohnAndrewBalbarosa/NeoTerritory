// Authored in-module conceptual questions for the Idiom module (PIMPL). PIMPL is
// a C++ implementation idiom (compilation firewall) — NOT a GoF pattern and
// distinct from Bridge. Applicable Bloom levels: Remember→Evaluate. Create is the
// practical C++ task. Prompts are distinct from the formal Form A/B bank.

import { imq, type InModuleBank } from './_shared';

const SUTTER = ['Sutter (1999), Exceptional C++ — Compilation Firewalls (PIMPL)'];
const NEST = ['Nesteruk (2022), Design Patterns in Modern C++'];
const MOD = ['CodiNeo Idioms module content'];

export const IN_MODULE_IDIOMS: InModuleBank = {
  'idioms-pimpl': [
    imq('remembering', 'pimpl-purpose', 'easy',
      'What does the PIMPL idiom move out of a class’s public header?',
      ['Its private members, into a hidden implementation type reached through a pointer', 'Its public methods, into a base class', 'Its constructor, into a factory', 'Its return types, into templates'], 0,
      'PIMPL relocates private members into a hidden Impl type accessed via a pointer, keeping the header stable.', [...MOD, ...SUTTER]),
    imq('understanding', 'pimpl-why-recompile', 'moderate',
      'Why does PIMPL reduce client recompilation when private members change?',
      ['Because clients stop including any headers', 'Because PIMPL disables the preprocessor', 'Because the compiler caches everything forever', 'Because the private members live in the .cpp, so changing them does not change the header clients include'], 3,
      'With private state hidden in the implementation file, header-included clients are insulated from those changes and need not recompile.', [...MOD, ...SUTTER]),
    imq('applying', 'pimpl-select', 'moderate',
      'A heavily-included header keeps changing its private fields, forcing slow full rebuilds. Which technique stabilises the header so clients rarely recompile?',
      ['Make the class a Singleton', 'Add more public getters', 'Hide the private members behind a pointer to an implementation defined in the .cpp', 'Convert the class to a template'], 2,
      'Hiding private members behind an implementation pointer (PIMPL) stabilises the header and cuts client recompiles.', [...MOD, ...SUTTER]),
    imq('analyzing', 'pimpl-identify', 'difficult',
      'A header declares: class Widget { public: Widget(); ~Widget(); void draw(); private: struct Impl; std::unique_ptr<Impl> p; };  with Impl defined only in widget.cpp. Which technique is shown?',
      ['Bridge pattern', 'The PIMPL idiom (an opaque Impl owned via a pointer)', 'Flyweight pattern', 'Observer pattern'], 1,
      'A forward-declared Impl owned through a smart pointer, defined in the .cpp, is the PIMPL idiom.', [...MOD, ...NEST]),
    imq('evaluating', 'pimpl-vs-bridge', 'difficult',
      'A class holds one unique_ptr<Impl> whose sole job is hiding private members and stabilising the header — no abstraction varies. Is calling it “Bridge” accurate?',
      ['Yes — any pointer-to-implementation is Bridge', 'No — this is actually Adapter', 'Yes — Bridge and PIMPL are the same thing', 'No — a single fixed implementation used only to insulate the header is PIMPL; Bridge needs independently varying abstraction and implementation hierarchies'], 3,
      'One fixed Impl for header insulation is PIMPL, not Bridge; Bridge requires an abstraction and an independently varying implementation hierarchy.', [...MOD, ...NEST]),
  ],
};
