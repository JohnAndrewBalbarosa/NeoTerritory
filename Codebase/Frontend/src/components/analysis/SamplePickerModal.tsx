import { useEffect, useMemo, useState } from 'react';

// Bundle every C++ sample under Codebase/Microservice/samples/ as raw text.
// Vite glob with `?raw` returns a string per matching file. The path is
// relative to this file: ../../ -> src, then up four to Codebase/, then
// into Microservice/samples.
const RAW_SAMPLES = import.meta.glob(
  '../../../../Microservice/samples/**/*.cpp',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

interface Sample {
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  patternName: string;
  filename: string;
  code: string;
  intent: string; // one-line plain-English purpose
  citation: string;
}

// Maps the existing samples directory layout to user-facing pattern data.
// Families and intents are sourced from Nesteruk (2022) "Design Patterns
// in Modern C++20", the design-pattern reference used by the CodiNeo
// sample programs.
interface SampleMeta {
  family: Sample['family'];
  patternName: string;
  intent: string;
}

const META_BY_DIRECTORY: Record<string, SampleMeta> = {
  builder: {
    family: 'Creational',
    patternName: 'Builder',
    intent: 'Construct a complex object step by step using fluent setters that return *this.',
  },
  factory: {
    family: 'Creational',
    patternName: 'Factory Method',
    intent: 'Hide concrete construction behind a method that returns an abstract product.',
  },
  singleton: {
    family: 'Creational',
    patternName: 'Singleton',
    intent: 'Ensure a class has exactly one instance, accessed via a static accessor.',
  },
  method_chaining: {
    family: 'Behavioural',
    patternName: 'Method Chaining',
    intent: 'Configure an object across many setters in a single fluent expression.',
  },
  strategy: {
    family: 'Behavioural',
    patternName: 'Strategy',
    intent: 'Make an algorithm interchangeable at runtime through an abstract interface.',
  },
  wrapping: {
    family: 'Structural',
    patternName: 'Adapter / Proxy / Decorator (wrapping)',
    intent: 'Wrap an inner object and forward calls — adapt, proxy, or decorate them.',
  },
  pimpl: {
    family: 'Idioms',
    patternName: 'PIMPL (Pointer to Implementation)',
    intent: 'Hide implementation details behind a forward-declared inner type.',
  },
  integration: {
    family: 'Idioms',
    patternName: 'Integration sample',
    intent: 'Multi-pattern file used by the regression contract for the matcher.',
  },
  mixed: {
    family: 'Idioms',
    patternName: 'Mixed sample',
    intent: 'A file that exercises several patterns at once.',
  },
  negative: {
    family: 'Idioms',
    patternName: 'Negative control',
    intent: 'A file that should NOT match any pattern. Useful for sanity checks.',
  },
  usages: {
    family: 'Idioms',
    patternName: 'Cross-class usages',
    intent: 'A file with several classes that reference each other.',
  },
};

const NESTERUK_CITATION = 'Sample inspired by Nesteruk, D. (2022). Design Patterns in Modern C++20. Apress.';

function buildSamples(): Sample[] {
  const samples: Sample[] = [];
  for (const [absPath, code] of Object.entries(RAW_SAMPLES)) {
    // absPath looks like "../../../../Microservice/samples/<dir>/<file>.cpp".
    const match = absPath.match(/samples\/([^/]+)\/([^/]+\.cpp)$/);
    if (!match) continue;
    const dir = match[1];
    const filename = match[2];
    const meta = META_BY_DIRECTORY[dir];
    if (!meta) continue;
    samples.push({
      family: meta.family,
      patternName: meta.patternName,
      filename,
      code,
      intent: meta.intent,
      citation: NESTERUK_CITATION,
    });
  }
  // Stable order: Creational -> Structural -> Behavioural -> Idioms,
  // alphabetical within family by patternName then filename.
  const familyOrder: Record<Sample['family'], number> = {
    Creational: 0,
    Structural: 1,
    Behavioural: 2,
    Idioms: 3,
  };
  return samples.sort((a, b) => {
    if (familyOrder[a.family] !== familyOrder[b.family]) {
      return familyOrder[a.family] - familyOrder[b.family];
    }
    if (a.patternName !== b.patternName) return a.patternName.localeCompare(b.patternName);
    return a.filename.localeCompare(b.filename);
  });
}

interface SamplePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sample: { filename: string; code: string }) => void;
}

export default function SamplePickerModal({ open, onClose, onSelect }: SamplePickerModalProps) {
  const [familyFilter, setFamilyFilter] = useState<Sample['family'] | 'all'>('all');
  const samples = useMemo(buildSamples, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const visible =
    familyFilter === 'all' ? samples : samples.filter((s) => s.family === familyFilter);

  const grouped = (['Creational', 'Structural', 'Behavioural', 'Idioms'] as const)
    .map((family) => ({
      family,
      items: visible.filter((s) => s.family === family),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div
      className="nt-sample-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-picker-title"
    >
      <div
        className="nt-sample-picker__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="nt-sample-picker__panel" role="document">
        <header className="nt-sample-picker__head">
          <div>
            <p className="nt-sample-picker__eyebrow">Load a sample</p>
            <h2 id="sample-picker-title" className="nt-sample-picker__title">
              Pick a design-pattern example
            </h2>
            <p className="nt-sample-picker__lede">
              All samples are inspired by Nesteruk (2022) <em>Design Patterns in Modern C++20</em>{' '}
              and live under <code>Codebase/Microservice/samples/</code>.
            </p>
          </div>
          <button
            type="button"
            className="nt-sample-picker__close"
            onClick={onClose}
            aria-label="Close sample picker"
          >
            ×
          </button>
        </header>

        <nav className="nt-sample-picker__filters" aria-label="Family filter">
          {(['all', 'Creational', 'Structural', 'Behavioural', 'Idioms'] as const).map((f) => (
            <button
              key={f}
              type="button"
              data-active={familyFilter === f}
              onClick={() => setFamilyFilter(f)}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </nav>

        <div className="nt-sample-picker__body">
          {samples.length === 0 ? (
            <p className="nt-sample-picker__empty">
              No samples bundled at build time. Check that{' '}
              <code>Codebase/Microservice/samples/</code> contains <code>.cpp</code> files.
            </p>
          ) : (
            grouped.map((g) => (
              <section key={g.family} className="nt-sample-picker__group">
                <h3 className="nt-sample-picker__family">{g.family}</h3>
                <ul className="nt-sample-picker__list">
                  {g.items.map((s, i) => (
                    <li key={`${s.filename}-${i}`} className="nt-sample-picker__item">
                      <button
                        type="button"
                        className="nt-sample-picker__pick"
                        onClick={() => {
                          onSelect({ filename: s.filename, code: s.code });
                          onClose();
                        }}
                      >
                        <span className="nt-sample-picker__pattern">{s.patternName}</span>
                        <span className="nt-sample-picker__filename">{s.filename}</span>
                        <span className="nt-sample-picker__intent">{s.intent}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="nt-sample-picker__foot">
          <span className="nt-sample-picker__cite">{NESTERUK_CITATION}</span>
        </footer>
      </div>
    </div>
  );
}
