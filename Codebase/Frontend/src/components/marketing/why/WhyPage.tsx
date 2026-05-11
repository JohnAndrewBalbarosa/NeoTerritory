import { navigate } from '../../../logic/router';
import MagneticButton from '../effects/MagneticButton';

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

      <section className="nt-why__cta" aria-label="Try it">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
