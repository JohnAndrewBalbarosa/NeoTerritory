// Per D63 (this turn): /research is the literal academic surface. It
// carries the thesis content verbatim from FINAL THESIS 3 PAPER.pdf
// (research question, problem statement, objectives, scope, method,
// contribution, authors + adviser + panel) AND the bibliography of the
// books and papers the thesis cites (the docs/Research/ markdown
// directory). /about loses the methodology copy — it is about the
// developer team + the DevCon partnership now.
//
// This turn: per-domain "Patterns in industry — evidence 2020-2026"
// section (pros / cons / limits with primary-source citations). Lives
// here, not on /patterns, because the per-pattern detail page is
// reference-only by design.

import { PATTERN_EVIDENCE, EVIDENCE_DOMAIN_LABEL } from './patternEvidence';

interface ResearchEntry {
  slug: string;
  title: string;
  authors: string;
  year: number | string;
  url: string;
  kind: string;
  priority: string;
  summary: string;
  why: string;
  filePath: string;
}

const MD_FILES = import.meta.glob('../../../../../../docs/Research/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function parseEntry(filePath: string, raw: string): ResearchEntry | null {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return null;
  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  function field(name: string): string {
    const re = new RegExp(`^${name}:\\s*"?([^"\\n]*)"?\\s*$`, 'm');
    const m = frontmatter.match(re);
    return m ? m[1].trim() : '';
  }

  const title = field('title');
  if (!title) return null;

  function section(heading: string): string {
    const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'm');
    const m = body.match(re);
    if (!m) return '';
    const para = m[1].trim().split(/\n\s*\n/)[0] ?? '';
    return para.replace(/\s+/g, ' ').trim();
  }

  const slug = filePath
    .replace(/^.*docs\/Research\//, '')
    .replace(/\.md$/, '')
    .replace(/\//g, '__');

  return {
    slug,
    title,
    authors: field('authors') || '',
    year: field('year') || '',
    url: field('url') || '',
    kind: field('kind') || 'reference',
    priority: field('priority') || 'reference',
    summary: section('Summary'),
    why: section('Why it matters for this thesis'),
    filePath,
  };
}

const ENTRIES: ReadonlyArray<ResearchEntry> = Object.entries(MD_FILES)
  .filter(([p]) => !p.endsWith('/README.md'))
  .map(([p, raw]) => parseEntry(p, raw))
  .filter((e): e is ResearchEntry => e !== null)
  .sort((a, b) => {
    const pri = { primary: 0, secondary: 1, reference: 2 } as const;
    const ap = pri[a.priority as keyof typeof pri] ?? 3;
    const bp = pri[b.priority as keyof typeof pri] ?? 3;
    if (ap !== bp) return ap - bp;
    return String(b.year).localeCompare(String(a.year));
  });

const KIND_ORDER: ReadonlyArray<string> = ['book', 'article', 'paper', 'tooling'];

// Thesis content lifted verbatim (paraphrased only where necessary for
// flow) from FINAL THESIS 3 PAPER.pdf chapters 1.3, 1.4, 1.7.1, 3.4, 4 /
// expected contribution. Source: the PDF at the repository root.
const PROBLEM_QUESTIONS: ReadonlyArray<string> = [
  'How can the proposed system provide learning support for users in understanding software design-pattern concepts?',
  'How can the proposed system analyze C++ source code to identify supported design-pattern evidence?',
  'How can the proposed system present detected design-pattern evidence in a way that helps users understand the structure and important parts of the analyzed source code?',
  'How can documentation-oriented outputs help users connect design-pattern concepts with actual C++ source-code implementation?',
  'How useful is the proposed system in supporting design-pattern learning and code understanding in DEVCON Luzon?',
];

const OBJECTIVES: ReadonlyArray<string> = [
  'Develop learning modules that support users in understanding selected software design-pattern concepts.',
  'Develop a C++ source-code analysis feature that identifies supported design-pattern evidence from class-level source-code structure.',
  'Present detected design-pattern evidence through clear structural outputs that help users understand the important parts of the analyzed source code.',
  'Generate documentation-oriented outputs that help users connect design-pattern concepts with actual C++ source-code implementation.',
  'Evaluate the usefulness of the proposed system in supporting design-pattern learning and code understanding in DEVCON Luzon.',
];

const METHOD_STAGES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: '1. Source-code submission',
    body: 'The user submits C++ source code through pasted input, file upload, or supported multi-file input.',
  },
  {
    title: '2. Input validation',
    body: 'The backend checks the submitted file name, size, content, and supported input limits.',
  },
  {
    title: '3. Lexical scanning',
    body: 'The C++ microservice identifies source-code tokens and structural elements.',
  },
  {
    title: '4. Class-level structural representation',
    body: 'The system constructs a structural view of complete class or struct declarations.',
  },
  {
    title: '5. Pattern dispatch',
    body: 'The system checks the analyzed structure against supported design-pattern definitions.',
  },
  {
    title: '6. Evidence binding',
    body: 'Detected pattern evidence is connected to specific classes, methods, attributes, or source-code locations.',
  },
  {
    title: '7. Hash and link analysis',
    body: 'Stable references are created for analyzed files, code units, and evidence records.',
  },
  {
    title: '8. Documentation and test-target preparation',
    body: 'The system identifies code units that may be used for documentation-oriented explanations and supported validation checks.',
  },
  {
    title: '9. Structured report generation',
    body: 'The system returns detected pattern evidence, diagnostics, documentation targets, possible unit-test targets, and structured JSON results to the backend.',
  },
  {
    title: '10. Frontend presentation',
    body: 'The frontend displays the analysis results through pattern cards, highlighted code evidence, documentation outputs, diagnostics, and supported testing or review features.',
  },
];

const AUTHORS: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'John Andrew Balbarosa', role: 'Researcher' },
  { name: 'Miryl Z. De Leon', role: 'Researcher' },
  { name: 'Josephine J. Santander', role: 'Researcher' },
];

const PANEL: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'Dr. Hadji Tejuco', role: 'Head Panelist' },
  { name: 'Ms. May Florence San Pablo', role: 'Panelist' },
  { name: 'Dr. Dennis B. Gonzales', role: 'Panelist' },
];

export default function ResearchPage() {
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: ENTRIES.filter((e) => e.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="nt-research" id="main">
      <header className="nt-research__head">
        <p className="nt-section-eyebrow">The thesis</p>
        <h1 className="nt-research__title">
          CodiNeo: A Documentation Generation System Using Hash-Based Virtual Structural Copy
          Algorithm for Design Pattern Learning in DEVCON Luzon
        </h1>
        <p className="nt-research__meta">
          Balbarosa, J. A., De Leon, M. Z., Santander, J. J. (2026). FEU Institute of Technology
          - BS Computer Science (Software Engineering). Thesis adviser: Ms. Kim Giselle Bautista.
        </p>
      </header>

      <section className="nt-research__section" aria-labelledby="rp-problem">
        <h2 id="rp-problem" className="nt-research__section-title">
          Statement of the problem
        </h2>
        <p className="nt-research__section-lede">
          This study aims to determine how a design-pattern learning support system can analyze
          C++ source-code structure, detect design-pattern evidence, and generate
          documentation-oriented outputs to support code understanding, and design-pattern learning
          in DEVCON Luzon. Specifically, the study seeks to address the following questions:
        </p>
        <ol className="nt-research__numbered">
          {PROBLEM_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-objectives">
        <h2 id="rp-objectives" className="nt-research__section-title">
          Objectives of the study
        </h2>
        <p className="nt-research__section-lede">
          The general objective of this study is to develop a design-pattern learning system that
          combines learning modules, C++ source-code analysis, design-pattern evidence detection,
          and documentation-oriented outputs to support code understanding and design-pattern
          learning in DEVCON Luzon. Specifically, this study seeks to:
        </p>
        <ol className="nt-research__numbered">
          {OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-scope">
        <h2 id="rp-scope" className="nt-research__section-title">
          Scope and delimitations
        </h2>
        <p>
          The system includes a learner pathway with learning modules for selected software
          design-pattern concepts, and a developer or studio pathway where users analyze C++
          source code, detect supported design-pattern evidence, and generate
          documentation-oriented outputs.
        </p>
        <p>
          The C++ analysis feature focuses on complete class or struct declarations because
          analysis is class-level and design-pattern-oriented. The system examines declarations,
          methods, attributes, relationships, and implementation-use evidence that may help
          explain how the code is organized and how supported design patterns may appear in the
          submitted source code.
        </p>
        <p>
          The design-pattern detection feature is limited to the supported pattern definitions
          included in the implemented prototype. The system does not claim to detect all existing
          design patterns; it focuses on the design-pattern cases covered by its implemented
          detection logic.
        </p>
        <p>
          The study is contextualized within DEVCON Luzon as a collaborative and
          learning-oriented development environment. Evaluation focuses on the system&rsquo;s
          usefulness in supporting design-pattern learning and code understanding, alongside
          usability, clarity of outputs, and functional suitability on selected C++ samples.
        </p>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-method">
        <h2 id="rp-method" className="nt-research__section-title">
          Method: the algorithmic analysis pipeline
        </h2>
        <p className="nt-research__section-lede">
          The deterministic C++ microservice performs the following sequence on every submission:
        </p>
        <ol className="nt-research__numbered nt-research__method">
          {METHOD_STAGES.map((s) => (
            <li key={s.title}>
              <strong>{s.title}.</strong> {s.body}
            </li>
          ))}
        </ol>
        <div className="nt-research__method-note">
          <h3>Why pre-templated tests work here</h3>
          <p>
            Structural analysis on arbitrary source code does not produce semantic meaning by
            itself - a tree of class declarations is just shape. Design patterns are what bridge
            that gap. Because every supported pattern is a named, idiomatic arrangement of
            classes, methods, and ownership, recognising the structure recognises the meaning at
            the same time. A class that matches the Builder shape <em>is</em> a Builder; a class
            that matches the wrapping signature is some flavour of Adapter/Proxy/Decorator.
          </p>
          <p>
            That semantic-from-structure equivalence is what lets the system ship{' '}
            <strong>pre-templated unit tests</strong>. Each pattern in{' '}
            <code>pattern_catalog/&lt;family&gt;/&lt;pattern&gt;.test.template.cpp</code> is a
            GoogleTest scaffold targeting the contract the pattern implies (e.g. Singleton:
            &ldquo;the second call returns the same address as the first&rdquo;). The detector
            tags the class, the scaffold fills in the class name and load-bearing methods, and
            the resulting test exercises behaviour the structure alone tells us must hold. No
            data-flow analysis required - the pattern <em>is</em> the meaning.
          </p>
        </div>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-contribution">
        <h2 id="rp-contribution" className="nt-research__section-title">
          Expected contribution
        </h2>
        <p>
          A reproducible, JSON-extensible C++ pattern detector with an integrated documentation
          and unit-test-scaffold pipeline; a public dataset of structural-fact runs paired with
          human accuracy ratings collected from DEVCON Luzon intern volunteers; and a study-grade
          comparison of AI-only versus structural-plus-AI documentation against reading-speed and
          design-pattern-recognition outcomes for novice C++ developers.
        </p>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-people">
        <h2 id="rp-people" className="nt-research__section-title">
          Authors, advising, and panel
        </h2>
        <div className="nt-research__people">
          <div className="nt-research__people-group">
            <h3>Authors</h3>
            <ul>
              {AUTHORS.map((a) => (
                <li key={a.name}>
                  <strong>{a.name}</strong> - <span>{a.role}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="nt-research__people-group">
            <h3>Advising</h3>
            <ul>
              <li>
                <strong>Ms. Kim Giselle Bautista</strong> - <span>Thesis Adviser</span>
              </li>
              <li>
                <strong>Ms. Elisa Malasaga</strong> - <span>Course Adviser</span>
              </li>
              <li>
                <strong>Dr. Shaneth C. Ambat</strong> - <span>Department Head</span>
              </li>
            </ul>
          </div>
          <div className="nt-research__people-group">
            <h3>Panel</h3>
            <ul>
              {PANEL.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong> - <span>{p.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-trophy">
        <h2 id="rp-trophy" className="nt-research__section-title">
          Testing strategy: the Testing Trophy
        </h2>
        <p className="nt-research__section-lede">
          NeoTerritory follows the <strong>Testing Trophy</strong> (Kent C. Dodds, popularised by{' '}
          <a href="https://symflower.com/en/company/blog/2023/what-is-the-testing-trophy/" target="_blank" rel="noreferrer noopener">
            Symflower
          </a>
          ) instead of the traditional unit-test pyramid. The system is a multi-process pipeline
          (frontend &harr; backend &harr; C++ microservice &harr; AI provider), so the bugs that
          hurt users live at the seams between processes - exactly where integration tests catch
          and unit tests do not.
        </p>
        <div className="nt-research__trophy">
          <h3>Layered budget (each layer required to be non-empty before any release)</h3>
          <ul>
            <li>
              <strong>Static analysis (broad base):</strong> TypeScript strict mode, ESLint,
              <code> clang-tidy</code>, <code>clang-format</code>, <code>cppcheck</code> where available.
            </li>
            <li>
              <strong>Integration tests (the meat):</strong> backend-route tests spawning the real
              microservice binary on curated C++ samples; pattern-catalog tests loading each JSON
              and asserting matcher emission; AI-pipeline tests stubbing the Claude HTTP client
              while exercising the real chunking + timeout + fallback paths.
            </li>
            <li>
              <strong>E2E tests (critical-flow):</strong> Playwright runs covering &ldquo;open
              studio &rarr; load sample &rarr; analyze &rarr; see pattern card &rarr; request docs
              &rarr; see fallback or AI doc.&rdquo; One spec per critical flow.
            </li>
            <li>
              <strong>Unit tests (small, surgical):</strong> only where the function has
              nontrivial branching that integration tests cannot cheaply cover (candidate-filter
              ambiguity logic, heuristic class-usage binder).
            </li>
          </ul>
          <p>
            Sprint R adds an AI-generated random-C++ stress harness for fuzz coverage; failing
            seeds promote to the regression integration suite. See{' '}
            <code>docs/Research/testing-trophy.md</code> for the full doc.
          </p>
        </div>
      </section>

      <section className="nt-research__section" aria-labelledby="rp-evidence">
        <h2 id="rp-evidence" className="nt-research__section-title">
          Patterns in industry &mdash; evidence 2020&ndash;2026
        </h2>
        <p className="nt-research__section-lede">
          The catalog at <code>/patterns</code> covers what each pattern is and how to recognise it.
          This section covers <strong>why</strong> the pattern still matters in production - the
          trade-offs (pros, cons, limits) with industry citations from 2020 onward, scoped per
          domain (HFT/quant, low-latency AI, systems, maintainability). Every claim carries a
          numbered footnote tying it to a primary source.
        </p>
        {PATTERN_EVIDENCE.length === 0 ? (
          <p className="nt-research__section-lede">
            <em>Evidence entries are being authored from primary 2020-2026 sources. Check back.</em>
          </p>
        ) : (
          <ul className="nt-research__evidence-list">
            {PATTERN_EVIDENCE.map((ev, idx) => (
              <li key={`${ev.domain}-${idx}`} className="nt-research__evidence">
                <p className="nt-research__evidence-domain">
                  {EVIDENCE_DOMAIN_LABEL[ev.domain]}
                  {ev.relatedPatternSlug ? (
                    <>
                      {' '}&middot;{' '}
                      <a href={`/patterns/${ev.relatedPatternSlug}`}>
                        {ev.relatedPatternSlug}
                      </a>
                    </>
                  ) : null}
                </p>
                <p className="nt-research__evidence-claim">{ev.claim}</p>
                <div className="nt-research__evidence-grid">
                  <div>
                    <p className="nt-research__evidence-label">Pros</p>
                    <ul className="nt-research__evidence-pros">
                      {ev.pros.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="nt-research__evidence-label">Cons</p>
                    <ul className="nt-research__evidence-cons">
                      {ev.cons.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="nt-research__evidence-label">Limits</p>
                    <ul className="nt-research__evidence-limits">
                      {ev.limits.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <ol className="nt-research__evidence-sources">
                  {ev.sources.map((s, i) => (
                    <li key={`${s.citation}-${i}`}>
                      <span className="nt-research__evidence-source-kind">[{s.kind}]</span>{' '}
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.citation}
                          {s.chapter ? ` — ${s.chapter}` : ''}
                        </a>
                      ) : (
                        <>
                          {s.citation}
                          {s.chapter ? ` — ${s.chapter}` : ''}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="nt-research__section" aria-labelledby="rp-bibliography">
        <h2 id="rp-bibliography" className="nt-research__section-title">
          Bibliography &amp; design-pattern references
        </h2>
        <p className="nt-research__section-lede">
          Books, papers, and prior art the thesis cites or relies on. The directory under{' '}
          <code>docs/Research/</code> is the source of truth - each card here renders from a
          markdown file there.
        </p>
        {grouped.map((g) => (
          <div key={g.kind} className="nt-research__group" aria-label={g.kind}>
            <h3 className="nt-research__kind">
              {g.kind === 'article' ? 'Articles' : `${g.kind[0].toUpperCase()}${g.kind.slice(1)}s`}
            </h3>
            <div className="nt-research__grid">
              {g.items.map((e) => (
                <article key={e.slug} className="nt-research__card" data-priority={e.priority}>
                  <header className="nt-research__card-head">
                    <h4 className="nt-research__card-title">{e.title}</h4>
                    <p className="nt-research__card-meta">
                      {e.authors}
                      {e.year ? ` - ${e.year}` : ''}
                    </p>
                  </header>
                  {e.summary ? <p className="nt-research__card-summary">{e.summary}</p> : null}
                  {e.why ? <p className="nt-research__card-why">{e.why}</p> : null}
                  {e.url ? (
                    <a
                      className="nt-research__card-link"
                      href={e.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Open source &nearr;
                    </a>
                  ) : (
                    <span className="nt-research__card-link nt-research__card-link--internal">
                      Internal compilation
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
