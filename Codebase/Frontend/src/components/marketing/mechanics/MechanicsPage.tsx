import { useEffect, useState } from 'react';

// Per D31 (5 stages, locked order) + D46 (route /mechanics) + Sprint 0 doc
// blueprint at docs/Codebase/Frontend/src/components/marketing/mechanics/MechanicsPage.tsx.md.
//
// Five sequential stages of the algorithm. Each stage anchored. A sticky
// "Stage N of 5" indicator updates on scroll via IntersectionObserver — pure
// CSS sticky + IO, no animation library, satisfies the effects-budget rule
// per D41.

interface Stage {
  num: number;
  id: string;
  title: string;
  paragraph: string;
  diagram: JSX.Element;
}

const STAGES: ReadonlyArray<Stage> = [
  {
    num: 1,
    id: 'stage-1',
    title: 'Lexical tagging',
    paragraph:
      'Every token in your C++ source is assigned a category before any structural analysis. The categories live in lexeme_categories.json and are language facts (keywords, operators, stdlib symbols), never project-specific names. Categorising once means the matcher can operate on token-category windows instead of raw text.',
    diagram: (
      <pre className="nt-mech__code" aria-label="Token categories example">
        {`std::unique_ptr<Foo> p = std::make_unique<Foo>();
└──┬──┘ └──┬─────┘ ├─┘  ├   ├──┬──┘   ├──┬─────┘ ├─┘
 stdlib   handle  type  =     stdlib   inst   type
 (ownership_handle)          (object_instantiation)`}
      </pre>
    ),
  },
  {
    num: 2,
    id: 'stage-2',
    title: 'Virtual + actual parse tree',
    paragraph:
      'We build two trees side by side. The actual tree mirrors the original source and stays immutable — that is the audit trail. The virtual tree is a working copy attached to the main tree. Tagging, cross-referencing, and pattern checks all happen on the virtual tree so we can never accidentally rewrite your real source.',
    diagram: (
      <div className="nt-mech__split" aria-label="Actual versus virtual parse tree">
        <div>
          <p className="nt-mech__split-label">Actual tree (immutable)</p>
          <pre className="nt-mech__code">{`File
├── class Foo
│   └── method Foo()
└── function main`}</pre>
        </div>
        <div>
          <p className="nt-mech__split-label">Virtual tree (tagged)</p>
          <pre className="nt-mech__code">{`File*
├── class Foo*  [Singleton?]
│   └── method Foo()*  [private ctor]
└── function main*  [usage of Foo]`}</pre>
        </div>
      </div>
    ),
  },
  {
    num: 3,
    id: 'stage-3',
    title: 'Per-class cross-referencing',
    paragraph:
      'For each class, the binder walks the function bodies in the program and records who uses what. The result is a reverse index: given a class, list every function that touches it. This is the foundation for "did anyone actually call build()?" and "is this class instantiated anywhere outside the file it lives in?"',
    diagram: (
      <pre className="nt-mech__code" aria-label="Class usage table example">
        {`class_usage_table:
  Foo  → [main()  line 42 (constructor),
          run()   line 81 (method call)]
  Bar  → [main()  line 43 (member access)]`}
      </pre>
    ),
  },
  {
    num: 4,
    id: 'stage-4',
    title: 'Virtual-only inspection',
    paragraph:
      'Once the virtual tree is built and tagged, every subsequent pass reads only the virtual copy. The actual class is already affected — its tags are computed and attached — so there is nothing more to add by re-walking the original source. This is what keeps the algorithm linear in source size and reproducible.',
    diagram: (
      <pre className="nt-mech__code" aria-label="Virtual-only access example">
        {`pass.detectSingleton(virtual_tree)  // OK
pass.detectBuilder  (virtual_tree)  // OK
pass.detectAdapter  (virtual_tree)  // OK
//                  ^^^^^^^^^^^^^^
// No pass touches the actual tree after stage 2.`}
      </pre>
    ),
  },
  {
    num: 5,
    id: 'stage-5',
    title: 'Pre-templated pattern matching',
    paragraph:
      'Each design pattern is a JSON file describing the structural shape NeoTerritory expects to see. Adding a new pattern is dropping a JSON file in pattern_catalog/<family>/ and rerunning. No C++ recompile. Because templates are pre-known, generating tests is cheap: every detected pattern carries a list of unit-test targets the test scaffold consumes.',
    diagram: (
      <pre className="nt-mech__code" aria-label="Catalog entry example">
        {`// pattern_catalog/creational/builder.json
{
  "id": "creational.builder",
  "signature_categories": ["self_return"],
  "ordered_checks": [
    { "kind": "method_chain_returns_this" },
    { "kind": "build_method_present"      }
  ]
}`}
      </pre>
    ),
  },
];

export default function MechanicsPage() {
  const [activeStage, setActiveStage] = useState<number>(1);

  useEffect(() => {
    const targets = STAGES.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the most-visible stage. When several are intersecting, the
        // largest intersectionRatio wins. Falls back to whichever is in view.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const stage = STAGES.find((s) => s.id === id);
          if (stage) setActiveStage(stage.num);
        }
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0.1, 0.4, 0.8] },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="nt-mech" id="main">
      <header className="nt-mech__head">
        <p className="nt-section-eyebrow">Mechanics</p>
        <h1 className="nt-mech__title">How NeoTerritory reads your code.</h1>
        <p className="nt-mech__lede">
          Five stages, in order. Each one runs once. The output is structural facts plus an
          evidence file the AI can cite back to.
        </p>
      </header>

      <div className="nt-mech__indicator" aria-label="Stage progress" role="status">
        Stage {activeStage} of {STAGES.length}
      </div>

      <ol className="nt-mech__stages">
        {STAGES.map((s) => (
          <li key={s.id} id={s.id} className="nt-mech__stage" data-active={activeStage === s.num}>
            <span className="nt-mech__num">{s.num.toString().padStart(2, '0')}</span>
            <h2 className="nt-mech__stage-title">{s.title}</h2>
            <p className="nt-mech__stage-text">{s.paragraph}</p>
            <div className="nt-mech__diagram">{s.diagram}</div>
          </li>
        ))}
      </ol>
    </main>
  );
}
