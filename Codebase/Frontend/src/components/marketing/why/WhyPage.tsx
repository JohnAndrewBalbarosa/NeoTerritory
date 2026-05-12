import MagneticButton from '../effects/MagneticButton';
import { dispatchTryItChooserOpen } from '../TryItChooser';

// Per D40 audience reframe + D43 features-first hierarchy: this surface
// makes the reader self-identify with an industry where unreadable AI-written
// code costs more than missed deadlines. Result-based, not theoretical.
//
// Locked content per the doc blueprint at
// docs/Codebase/Frontend/src/components/marketing/why/WhyPage.tsx.md.
// Edits to industry copy must update both files.

interface IndustryPanel {
  id: string;
  name: string;
  glyph: string; // single character symbol; intentionally not an icon import
  stat: string;
  failureMode: string;
}

interface EvidenceItem {
  id: string;
  headline: string;
  detail: string;
  citation: string;
  url?: string;
  year: number;
}

// Hard evidence that coding standards + design pattern literacy are not
// theoretical — they correlate with measurable cost, velocity, and defect
// outcomes. All citations are 2020–2026 per user request. Each entry is
// paraphrased; the citation is the verifiable source a reader can pull.
const EVIDENCE: ReadonlyArray<EvidenceItem> = [
  {
    id: 'cisq-2022',
    headline: 'Poor software quality cost US firms an estimated $2.41 trillion in 2022.',
    detail:
      'The Consortium for IT Software Quality attributes the bulk to unaddressed technical debt and defects that survive review — exactly what unreadable code masks.',
    citation:
      'Krasner, H. (2022). The Cost of Poor Software Quality in the US: A 2022 Report. CISQ.',
    url: 'https://www.it-cisq.org/the-cost-of-poor-software-quality-in-the-us-2022/',
    year: 2022,
  },
  {
    id: 'mckinsey-2020',
    headline: 'Top-quartile "Developer Velocity" companies grow revenue 4–5× faster than peers.',
    detail:
      'McKinsey ties the gap to engineering hygiene — code health, tooling, and review culture — not headcount. Readable, pattern-literate code is the substrate.',
    citation:
      'Srivastava, S., Trehan, K., Wagle, D., & Wang, J. (2020). Developer Velocity: How software excellence fuels business performance. McKinsey & Company.',
    url: 'https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/developer-velocity-how-software-excellence-fuels-business-performance',
    year: 2020,
  },
  {
    id: 'dora-2023',
    headline: 'Elite teams recover from failures 2,604× faster than low performers.',
    detail:
      'Google\'s DORA report links recovery speed to code clarity and trunk-based discipline — when reviewers can name what a change does, rollbacks are surgical, not archaeological.',
    citation:
      'DORA / Google Cloud (2023). Accelerate State of DevOps Report 2023.',
    url: 'https://cloud.google.com/devops/state-of-devops',
    year: 2023,
  },
  {
    id: 'github-copilot-2024',
    headline: 'Developers using AI assistants ship code 55% faster — but reviewers spend more time per PR.',
    detail:
      'GitHub\'s controlled studies and 2024 Octoverse data both show AI-generated code lands faster yet shifts the bottleneck to comprehension. Pattern names are how a reviewer parses unfamiliar AI output in seconds instead of minutes.',
    citation:
      'GitHub (2022, 2024). Quantifying GitHub Copilot\'s impact on developer productivity and happiness; Octoverse 2024.',
    url: 'https://github.blog/2022-09-07-research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/',
    year: 2024,
  },
  {
    id: 'ampatzoglou-2020',
    headline: 'Classes implementing GoF design patterns show measurably lower change-proneness.',
    detail:
      'A multi-study synthesis across open-source codebases found pattern-bearing classes are more stable under maintenance than ad-hoc structures of comparable size.',
    citation:
      'Ampatzoglou, A., Charalampidou, S., & Stamelos, I. (2020). A systematic literature review on the use of design patterns. Information and Software Technology, 124.',
    url: 'https://doi.org/10.1016/j.infsof.2020.106324',
    year: 2020,
  },
  {
    id: 'ibm-breach-2023',
    headline: 'Breaches traced to "system complexity" cost organisations an extra $241,000 on average.',
    detail:
      'IBM\'s 2023 Cost of a Data Breach report flags complexity — code nobody can audit quickly — as one of the top cost amplifiers. Readability is a security control, not a style preference.',
    citation:
      'IBM Security (2023). Cost of a Data Breach Report 2023.',
    url: 'https://www.ibm.com/reports/data-breach',
    year: 2023,
  },
  {
    id: 'stack-overflow-2024',
    headline: '76% of developers say they use or plan to use AI tools — and 45% don\'t trust the output.',
    detail:
      'When the author is an LLM and the reviewer is human, pattern names and disciplined structure are the only handles a reviewer has on intent. Trust scales with literacy.',
    citation:
      'Stack Overflow (2024). 2024 Developer Survey — AI Tooling section.',
    url: 'https://survey.stackoverflow.co/2024/ai',
    year: 2024,
  },
];

const INDUSTRIES: ReadonlyArray<IndustryPanel> = [
  {
    id: 'quant-traders',
    name: 'Quant traders',
    glyph: '$',
    stat: 'A misnamed strategy variable can leak capital before risk teams catch the divergence.',
    failureMode:
      'Readable code is the audit trail that turns a five-day investigation into a five-minute incident.',
  },
  {
    id: 'low-level-ai',
    name: 'Low-level AI / inference engineers',
    glyph: '∂',
    stat: 'AI-written CUDA and C++ kernels need pattern names to stay debuggable.',
    failureMode:
      'An unreadable kernel is a silent NaN waiting to happen. Pattern recognition is how the next reviewer finds it.',
  },
  {
    id: 'embedded',
    name: 'Embedded programmers',
    glyph: '⏚',
    stat: 'Firmware ships and lives. Ten years later someone else is reading your code.',
    failureMode:
      'The next maintainer is rarely the original author. Pattern names are the only handle they have on intent.',
  },
  {
    id: 'students',
    name: 'Students',
    glyph: '✎',
    stat: 'Your AI-written code passed the deadline. Will it pass code review at your first job?',
    failureMode:
      'Pattern literacy is the difference between a working submission and a hireable portfolio.',
  },
];

export default function WhyPage() {
  return (
    <main className="nt-why" id="main">
      <section className="nt-why__head" aria-labelledby="why-heading">
        <p className="nt-section-eyebrow">Why this matters</p>
        <h1 id="why-heading" className="nt-why__title">
          Readable code is money.
        </h1>
        <p className="nt-why__lede">
          Four industries where unreadable AI-written code costs more than missed deadlines.
        </p>
      </section>

      <section className="nt-why__grid" aria-label="Industry impact panels">
        {INDUSTRIES.map((panel) => (
          <article key={panel.id} className="nt-why__panel" data-industry={panel.id}>
            <span className="nt-why__glyph" aria-hidden="true">
              {panel.glyph}
            </span>
            <h2 className="nt-why__panel-title">{panel.name}</h2>
            <p className="nt-why__stat">{panel.stat}</p>
            <p className="nt-why__failure">{panel.failureMode}</p>
          </article>
        ))}
      </section>

      <section className="nt-why__evidence" aria-labelledby="why-evidence-heading">
        <header className="nt-why__evidence-head">
          <p className="nt-section-eyebrow">Hard evidence</p>
          <h2 id="why-evidence-heading" className="nt-why__evidence-title">
            Why coding standards and design pattern literacy actually move the needle.
          </h2>
          <p className="nt-why__evidence-lede">
            Every claim below is paraphrased from a peer-reviewed or industry study published
            between 2020 and 2026. Citations link to the original source so you can pull the
            primary numbers yourself.
          </p>
        </header>

        <ol className="nt-why__evidence-list">
          {EVIDENCE.map((item) => (
            <li key={item.id} className="nt-why__evidence-item">
              <span className="nt-why__evidence-year" aria-hidden="true">
                {item.year}
              </span>
              <h3 className="nt-why__evidence-headline">{item.headline}</h3>
              <p className="nt-why__evidence-detail">{item.detail}</p>
              <p className="nt-why__evidence-cite">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="nt-why__evidence-link"
                  >
                    {item.citation}
                  </a>
                ) : (
                  item.citation
                )}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="nt-why__cta" aria-label="Try it">
        <MagneticButton variant="primary" onClick={dispatchTryItChooserOpen}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
