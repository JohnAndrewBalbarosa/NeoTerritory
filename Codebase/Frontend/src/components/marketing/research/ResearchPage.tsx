// Per Sprint 0 doc blueprint: public bibliography. Reads markdown files
// under docs/Research/ via Vite glob import. Each card shows title, authors,
// year, summary, link. No detail routes — clicking a card opens the external
// URL in a new tab.

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

// Vite eager glob: pulls every .md file under docs/Research/ at build time
// as raw text. We parse the frontmatter and the first two prose sections
// (Summary and Why-it-matters). The glob path is relative to this file.
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
    // Take the first paragraph (sentence chunk) so cards stay short.
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
  // README.md is the index; not an entry.
  .filter(([p]) => !p.endsWith('/README.md'))
  .map(([p, raw]) => parseEntry(p, raw))
  .filter((e): e is ResearchEntry => e !== null)
  // Primary first, then secondary, then reference. Within priority, by year desc.
  .sort((a, b) => {
    const pri = { primary: 0, secondary: 1, reference: 2 } as const;
    const ap = pri[a.priority as keyof typeof pri] ?? 3;
    const bp = pri[b.priority as keyof typeof pri] ?? 3;
    if (ap !== bp) return ap - bp;
    return String(b.year).localeCompare(String(a.year));
  });

const KIND_ORDER: ReadonlyArray<string> = ['book', 'article', 'paper', 'tooling'];

export default function ResearchPage() {
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: ENTRIES.filter((e) => e.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="nt-research" id="main">
      <header className="nt-research__head">
        <p className="nt-section-eyebrow">Research</p>
        <h1 className="nt-research__title">What we read to build this.</h1>
        <p className="nt-research__lede">
          Books, papers, and prior art behind NeoTerritory. The directory under{' '}
          <code>docs/Research/</code> is the source of truth.
        </p>
      </header>

      {grouped.map((g) => (
        <section key={g.kind} className="nt-research__group" aria-label={g.kind}>
          <h2 className="nt-research__kind">{g.kind === 'article' ? 'Articles' : `${g.kind[0].toUpperCase()}${g.kind.slice(1)}s`}</h2>
          <div className="nt-research__grid">
            {g.items.map((e) => (
              <article key={e.slug} className="nt-research__card" data-priority={e.priority}>
                <header className="nt-research__card-head">
                  <h3 className="nt-research__card-title">{e.title}</h3>
                  <p className="nt-research__card-meta">
                    {e.authors}
                    {e.year ? ` · ${e.year}` : ''}
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
                    Open source ↗
                  </a>
                ) : (
                  <span className="nt-research__card-link nt-research__card-link--internal">
                    Internal compilation
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
