import { useEffect, useState } from 'react';

// Per D31 (5 stages, locked order) + D46 (route /mechanics) + D61 (this turn):
// the previous ASCII pre-block diagrams are replaced with proper inline SVGs.
// SVG is the right format for these because each stage is a small graph
// that benefits from crisp rendering at any size and that does not need
// any external asset file.

interface Stage {
  num: number;
  id: string;
  title: string;
  paragraph: string;
  diagram: JSX.Element;
}

// Common SVG palette + helpers so all five diagrams share a visual language.
const COLOR_BG = 'rgba(13, 20, 34, 0.6)';
const COLOR_PANEL = 'rgba(15, 27, 46, 0.85)';
const COLOR_BORDER = 'rgba(0, 209, 216, 0.32)';
const COLOR_ACCENT = 'rgb(0, 209, 216)';
const COLOR_LIME = 'rgb(166, 255, 0)';
const COLOR_PURPLE = 'rgba(123, 94, 167, 0.55)';
const COLOR_TEXT = '#e2e4f0';
const COLOR_TEXT_SOFT = 'rgba(226, 228, 240, 0.7)';
const FONT_MONO = 'JetBrains Mono, monospace';
const FONT_UI = 'Inter, system-ui, sans-serif';

function StageSvg({
  children,
  width = 880,
  height = 280,
  label,
}: {
  children: React.ReactNode;
  width?: number;
  height?: number;
  label: string;
}) {
  return (
    <svg
      className="nt-mech__svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width={width} height={height} rx="14" fill={COLOR_BG} />
      {children}
    </svg>
  );
}

const STAGES: ReadonlyArray<Stage> = [
  {
    num: 1,
    id: 'stage-1',
    title: 'Lexical tagging',
    paragraph:
      'Every token in your C++ source is assigned a category before any structural analysis. The categories live in lexeme_categories.json and are language facts (keywords, operators, stdlib symbols), never project-specific names. Categorising once means the matcher can operate on token-category windows instead of raw text.',
    diagram: (
      <StageSvg label="Token chips categorised by lexeme category">
        {/* Source code rendered as a sequence of chips, with the category
            label sitting beneath each chip. */}
        <g fontFamily={FONT_MONO} fontSize="14">
          <text x="40" y="40" fill={COLOR_TEXT_SOFT} fontSize="11" letterSpacing="0.12em">
            SOURCE
          </text>
          <text x="40" y="68" fill={COLOR_TEXT}>
            std::unique_ptr&lt;Foo&gt; p = std::make_unique&lt;Foo&gt;();
          </text>
        </g>
        {/* Token chips, paired below */}
        {[
          { x: 40, w: 140, label: 'std::unique_ptr', cat: 'ownership_handle' },
          { x: 190, w: 50, label: '<Foo>', cat: 'type' },
          { x: 250, w: 30, label: 'p', cat: 'ident' },
          { x: 290, w: 20, label: '=', cat: 'op' },
          { x: 320, w: 170, label: 'std::make_unique', cat: 'object_instantiation' },
          { x: 500, w: 50, label: '<Foo>', cat: 'type' },
          { x: 560, w: 30, label: '()', cat: 'call' },
        ].map((t) => {
          const accent = t.cat === 'ownership_handle' || t.cat === 'object_instantiation';
          return (
            <g key={`${t.x}-${t.label}`}>
              <rect
                x={t.x}
                y="100"
                width={t.w}
                height="32"
                rx="8"
                fill={accent ? 'rgba(0,209,216,0.14)' : COLOR_PANEL}
                stroke={accent ? COLOR_ACCENT : COLOR_BORDER}
              />
              <text
                x={t.x + t.w / 2}
                y="121"
                fill={COLOR_TEXT}
                fontFamily={FONT_MONO}
                fontSize="11"
                textAnchor="middle"
              >
                {t.label}
              </text>
              <text
                x={t.x + t.w / 2}
                y="160"
                fill={accent ? COLOR_LIME : COLOR_TEXT_SOFT}
                fontFamily={FONT_MONO}
                fontSize="10"
                textAnchor="middle"
                letterSpacing="0.06em"
              >
                {t.cat}
              </text>
            </g>
          );
        })}
        <text
          x="40"
          y="210"
          fill={COLOR_TEXT_SOFT}
          fontFamily={FONT_UI}
          fontSize="12"
        >
          Categories from <tspan fontFamily={FONT_MONO}>lexeme_categories.json</tspan>. Only stdlib symbols
          and grammar combos qualify — bare keywords do not.
        </text>
      </StageSvg>
    ),
  },
  {
    num: 2,
    id: 'stage-2',
    title: 'Virtual + actual parse tree',
    paragraph:
      'We build two trees side by side. The actual tree mirrors the original source and stays immutable — that is the audit trail. The virtual tree is a working copy attached to the main tree. Tagging, cross-referencing, and pattern checks all happen on the virtual tree so we can never accidentally rewrite your real source.',
    diagram: (
      <StageSvg label="Actual and virtual parse trees side by side">
        {/* Left: Actual tree (immutable) */}
        <g fontFamily={FONT_UI} fontSize="13">
          <text x="40" y="32" fill={COLOR_TEXT_SOFT} fontSize="11" letterSpacing="0.12em" fontFamily={FONT_MONO}>
            ACTUAL TREE (immutable)
          </text>
          {/* Nodes */}
          <g>
            <rect x="40" y="50" width="120" height="32" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
            <text x="100" y="71" fill={COLOR_TEXT} textAnchor="middle">File</text>
            <line x1="100" y1="82" x2="80" y2="110" stroke={COLOR_BORDER} />
            <line x1="100" y1="82" x2="220" y2="110" stroke={COLOR_BORDER} />
            <rect x="20" y="110" width="120" height="32" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
            <text x="80" y="131" fill={COLOR_TEXT} textAnchor="middle">class Foo</text>
            <rect x="160" y="110" width="120" height="32" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
            <text x="220" y="131" fill={COLOR_TEXT} textAnchor="middle">fn main</text>
            <line x1="80" y1="142" x2="80" y2="170" stroke={COLOR_BORDER} />
            <rect x="20" y="170" width="120" height="32" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
            <text x="80" y="191" fill={COLOR_TEXT} textAnchor="middle">Foo()</text>
          </g>
        </g>

        {/* Right: Virtual tree (tagged) */}
        <g fontFamily={FONT_UI} fontSize="13">
          <text x="500" y="32" fill={COLOR_ACCENT} fontSize="11" letterSpacing="0.12em" fontFamily={FONT_MONO}>
            VIRTUAL TREE (tagged)
          </text>
          <g>
            <rect x="500" y="50" width="120" height="32" rx="8" fill="rgba(0,209,216,0.14)" stroke={COLOR_ACCENT} />
            <text x="560" y="71" fill={COLOR_TEXT} textAnchor="middle">File*</text>
            <line x1="560" y1="82" x2="540" y2="110" stroke={COLOR_ACCENT} />
            <line x1="560" y1="82" x2="680" y2="110" stroke={COLOR_ACCENT} />
            <rect x="480" y="110" width="140" height="32" rx="8" fill="rgba(0,209,216,0.14)" stroke={COLOR_ACCENT} />
            <text x="550" y="131" fill={COLOR_TEXT} textAnchor="middle">class Foo* [tag]</text>
            <rect x="640" y="110" width="120" height="32" rx="8" fill="rgba(0,209,216,0.14)" stroke={COLOR_ACCENT} />
            <text x="700" y="131" fill={COLOR_TEXT} textAnchor="middle">fn main*</text>
            <line x1="550" y1="142" x2="550" y2="170" stroke={COLOR_ACCENT} />
            <rect x="480" y="170" width="140" height="32" rx="8" fill="rgba(0,209,216,0.14)" stroke={COLOR_ACCENT} />
            <text x="550" y="191" fill={COLOR_TEXT} textAnchor="middle">Foo()* [private]</text>
          </g>
        </g>

        {/* Arrow between */}
        <g>
          <line x1="290" y1="125" x2="480" y2="125" stroke={COLOR_PURPLE} strokeWidth="2" strokeDasharray="6 4" />
          <text x="385" y="118" fill={COLOR_PURPLE} fontFamily={FONT_MONO} fontSize="11" textAnchor="middle">
            mirrored
          </text>
        </g>
      </StageSvg>
    ),
  },
  {
    num: 3,
    id: 'stage-3',
    title: 'Per-class cross-referencing',
    paragraph:
      'For each class, the binder walks the function bodies in the program and records who uses what. The result is a reverse index: given a class, list every function that touches it. This is the foundation for "did anyone actually call build()?" and "is this class instantiated anywhere outside the file it lives in?"',
    diagram: (
      <StageSvg label="Class usage table mapping classes to function bodies">
        <g fontFamily={FONT_UI}>
          {/* Class nodes (left) */}
          <text x="40" y="32" fill={COLOR_TEXT_SOFT} fontSize="11" letterSpacing="0.12em" fontFamily={FONT_MONO}>
            CLASSES
          </text>
          <rect x="40" y="60" width="120" height="36" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
          <text x="100" y="84" fill={COLOR_TEXT} textAnchor="middle">Foo</text>
          <rect x="40" y="120" width="120" height="36" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
          <text x="100" y="144" fill={COLOR_TEXT} textAnchor="middle">Bar</text>

          {/* Function nodes (right) */}
          <text x="600" y="32" fill={COLOR_TEXT_SOFT} fontSize="11" letterSpacing="0.12em" fontFamily={FONT_MONO}>
            FUNCTIONS
          </text>
          <rect x="600" y="50" width="200" height="36" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
          <text x="700" y="68" fill={COLOR_TEXT} textAnchor="middle" fontSize="12">main()</text>
          <text x="700" y="82" fill={COLOR_TEXT_SOFT} textAnchor="middle" fontFamily={FONT_MONO} fontSize="10">line 42 — constructs Foo</text>
          <rect x="600" y="100" width="200" height="36" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
          <text x="700" y="118" fill={COLOR_TEXT} textAnchor="middle" fontSize="12">run()</text>
          <text x="700" y="132" fill={COLOR_TEXT_SOFT} textAnchor="middle" fontFamily={FONT_MONO} fontSize="10">line 81 — Foo::method</text>
          <rect x="600" y="150" width="200" height="36" rx="8" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
          <text x="700" y="168" fill={COLOR_TEXT} textAnchor="middle" fontSize="12">main()</text>
          <text x="700" y="182" fill={COLOR_TEXT_SOFT} textAnchor="middle" fontFamily={FONT_MONO} fontSize="10">line 43 — Bar member access</text>

          {/* Edges */}
          <line x1="160" y1="78" x2="600" y2="68" stroke={COLOR_ACCENT} strokeWidth="2" />
          <line x1="160" y1="78" x2="600" y2="118" stroke={COLOR_ACCENT} strokeWidth="2" />
          <line x1="160" y1="138" x2="600" y2="168" stroke={COLOR_LIME} strokeWidth="2" />

          <text x="440" y="240" fill={COLOR_TEXT_SOFT} fontFamily={FONT_UI} fontSize="12" textAnchor="middle">
            Given any class, the table lists every function body that touches it.
          </text>
        </g>
      </StageSvg>
    ),
  },
  {
    num: 4,
    id: 'stage-4',
    title: 'Virtual-only inspection',
    paragraph:
      'There is one detector. Patterns are not hardcoded as separate passes - the detector loads pattern definitions from JSON files in the catalog (one JSON per pattern) and runs the same structural checks against the virtual tree. Adding a new pattern means dropping a JSON file; the engine never recompiles. This keeps the algorithm extensible and the inspection deterministic.',
    diagram: (
      <StageSvg label="One detector loads JSON pattern files and inspects the virtual tree" height={300}>
        {/* JSON catalog column (left) */}
        <g fontFamily={FONT_UI}>
          <text x="40" y="32" fill={COLOR_TEXT_SOFT} fontSize="11" letterSpacing="0.12em" fontFamily={FONT_MONO}>
            pattern_catalog/ (JSON files)
          </text>
          {[
            { y: 56, label: 'creational/singleton.json' },
            { y: 92, label: 'creational/builder.json' },
            { y: 128, label: 'structural/adapter.json' },
            { y: 164, label: 'behavioural/strategy.json' },
            { y: 200, label: 'idiom/pimpl.json' },
          ].map((p) => (
            <g key={p.label}>
              <rect x="40" y={p.y} width="230" height="28" rx="6" fill={COLOR_PANEL} stroke={COLOR_LIME} />
              <text x="56" y={p.y + 19} fill={COLOR_TEXT} fontFamily={FONT_MONO} fontSize="11">
                {p.label}
              </text>
            </g>
          ))}
          <text x="155" y="248" fill={COLOR_TEXT_SOFT} fontFamily={FONT_UI} fontSize="11" textAnchor="middle">
            Drop a JSON; no recompile.
          </text>
        </g>

        {/* JSON parser in the middle */}
        <g>
          <line x1="270" y1="135" x2="340" y2="135" stroke={COLOR_LIME} strokeWidth="2" />
          <polygon points="340,135 332,131 332,139" fill={COLOR_LIME} />
          <rect x="340" y="105" width="160" height="64" rx="12" fill={COLOR_PANEL} stroke={COLOR_LIME} />
          <text x="420" y="128" fill={COLOR_LIME} fontFamily={FONT_MONO} fontSize="11" textAnchor="middle" letterSpacing="0.06em">
            JSON PARSER
          </text>
          <text x="420" y="148" fill={COLOR_TEXT} fontFamily={FONT_UI} fontSize="12" textAnchor="middle">
            structure rules
          </text>
          <text x="420" y="164" fill={COLOR_TEXT_SOFT} fontFamily={FONT_MONO} fontSize="10" textAnchor="middle">
            tokens · ordered_checks
          </text>
        </g>

        {/* Single detector */}
        <g>
          <line x1="500" y1="135" x2="560" y2="135" stroke={COLOR_ACCENT} strokeWidth="2" />
          <polygon points="560,135 552,131 552,139" fill={COLOR_ACCENT} />
          <rect x="560" y="100" width="160" height="72" rx="12" fill="rgba(0,209,216,0.12)" stroke={COLOR_ACCENT} />
          <text x="640" y="124" fill={COLOR_ACCENT} fontFamily={FONT_MONO} fontSize="11" textAnchor="middle" letterSpacing="0.08em">
            ONE DETECTOR
          </text>
          <text x="640" y="146" fill={COLOR_TEXT} fontFamily={FONT_UI} fontSize="13" textAnchor="middle">
            inspect(virtual)
          </text>
          <text x="640" y="164" fill={COLOR_TEXT_SOFT} fontFamily={FONT_MONO} fontSize="10" textAnchor="middle">
            same code, every pattern
          </text>
        </g>

        {/* Virtual tree at the far right */}
        <g>
          <line x1="720" y1="135" x2="780" y2="135" stroke={COLOR_ACCENT} strokeWidth="2" />
          <polygon points="780,135 772,131 772,139" fill={COLOR_ACCENT} />
          <rect x="780" y="80" width="60" height="112" rx="10" fill="rgba(0,209,216,0.10)" stroke={COLOR_ACCENT} />
          <text x="810" y="142" fill={COLOR_TEXT} fontFamily={FONT_UI} fontSize="11" textAnchor="middle" transform="rotate(-90 810 142)">
            virtual_tree
          </text>
        </g>

        {/* actual_tree greyed-out below */}
        <g opacity="0.42">
          <rect x="560" y="252" width="160" height="28" rx="6" fill={COLOR_PANEL} stroke={COLOR_BORDER} />
          <text x="640" y="271" fill={COLOR_TEXT_SOFT} fontFamily={FONT_MONO} fontSize="11" textAnchor="middle">
            actual_tree (untouched)
          </text>
        </g>
      </StageSvg>
    ),
  },
  {
    num: 5,
    id: 'stage-5',
    title: 'Pre-templated pattern matching',
    paragraph:
      'Each design pattern is a JSON file describing the structural shape CodiNeo expects to see. Adding a new pattern is dropping a JSON file in pattern_catalog/<family>/ and rerunning. No C++ recompile. Because templates are pre-known, generating tests is cheap: every detected pattern carries a list of unit-test targets the test scaffold consumes.',
    diagram: (
      <StageSvg label="A pattern catalog JSON drives the matcher" height={280}>
        {/* Folder column */}
        <g fontFamily={FONT_UI}>
          <text x="40" y="32" fill={COLOR_TEXT_SOFT} fontSize="11" letterSpacing="0.12em" fontFamily={FONT_MONO}>
            pattern_catalog/
          </text>
          {[
            { y: 60, label: 'creational/builder.json', accent: true },
            { y: 95, label: 'creational/singleton.json' },
            { y: 130, label: 'structural/adapter.json' },
            { y: 165, label: 'structural/proxy.json' },
            { y: 200, label: 'behavioural/strategy.json' },
          ].map((p) => (
            <g key={p.label}>
              <rect
                x="40"
                y={p.y}
                width="280"
                height="26"
                rx="6"
                fill={p.accent ? 'rgba(166,255,0,0.10)' : COLOR_PANEL}
                stroke={p.accent ? COLOR_LIME : COLOR_BORDER}
              />
              <text x="56" y={p.y + 18} fill={COLOR_TEXT} fontFamily={FONT_MONO} fontSize="11">
                {p.label}
              </text>
            </g>
          ))}
        </g>

        {/* Selected JSON detail */}
        <g>
          <rect x="380" y="50" width="450" height="200" rx="12" fill={COLOR_PANEL} stroke={COLOR_LIME} />
          <text x="400" y="76" fill={COLOR_LIME} fontFamily={FONT_MONO} fontSize="11" letterSpacing="0.06em">
            creational/builder.json
          </text>
          {[
            '{',
            '  "id": "creational.builder",',
            '  "signature_categories": ["self_return"],',
            '  "ordered_checks": [',
            '    { "kind": "method_chain_returns_this" },',
            '    { "kind": "build_method_present" }',
            '  ]',
            '}',
          ].map((line, i) => (
            <text
              key={i}
              x="400"
              y={102 + i * 17}
              fill={COLOR_TEXT}
              fontFamily={FONT_MONO}
              fontSize="12"
            >
              {line}
            </text>
          ))}
        </g>

        {/* Arrow */}
        <g>
          <line x1="320" y1="73" x2="380" y2="73" stroke={COLOR_LIME} strokeWidth="2" />
          <polygon points="380,73 372,69 372,77" fill={COLOR_LIME} />
        </g>
      </StageSvg>
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
        <h1 className="nt-mech__title">How CodiNeo reads your code.</h1>
        <p className="nt-mech__lede">
          Five stages, in order. Each one runs once. The output is structural facts plus an
          evidence file the AI can cite back to.
        </p>
      </header>

      {/* Trophy-vs-data-structure section was removed per user direction
          this turn — it now lives at /docs ("Testing strategy → The
          Testing Trophy") with the alpha-testing-only framing for the
          integration and E2E tiers. /mechanics stays focused on the
          algorithm; /docs owns the testing-strategy narrative. */}

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
