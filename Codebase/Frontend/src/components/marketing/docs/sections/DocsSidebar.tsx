// Slim TOC for /docs. Three anchors only: Overview, Pattern families,
// How it works. Deep teaching lives at /patterns/learn — the Docs page
// is not a second teacher.

const TOC: ReadonlyArray<{ href: string; label: string }> = [
  { href: '#dp-overview', label: 'Overview' },
  { href: '#dp-families', label: 'Pattern families' },
  { href: '#dp-how', label: 'How it works' },
];

export default function DocsSidebar() {
  return (
    <aside className="nt-docs__sidebar" aria-label="Docs section navigation">
      <p className="nt-docs__sidebar-eyebrow">On this page</p>
      <nav className="nt-docs__sidebar-nav" aria-label="Table of contents">
        <ol>
          {TOC.map((item) => (
            <li key={item.href}>
              <a className="nt-docs__sidebar-link" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
