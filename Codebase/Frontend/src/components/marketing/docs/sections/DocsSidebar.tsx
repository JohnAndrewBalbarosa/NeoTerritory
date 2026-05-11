// Left sidebar on /docs. Per user direction this turn: replace the
// stacked-bento rail with a TOC of anchor links. Each link jumps to a
// <section id> rendered by DocsMain / DocsInlineSection. The sidebar
// is sticky on wide viewports and collapses inline on narrow ones via
// styles.css.

const TOC: ReadonlyArray<{ href: string; label: string }> = [
  { href: '#dp-scope', label: 'Scope and delimitations' },
  { href: '#dp-rationale', label: 'Design rationale' },
  { href: '#dp-method', label: 'Algorithmic analysis pipeline' },
  { href: '#dp-tradeoffs', label: 'Trade-offs and limitations' },
  { href: '#dp-contribution', label: 'Expected contribution' },
  { href: '#dp-trophy', label: 'Testing Trophy' },
  { href: '#dp-bibliography', label: 'Bibliography' },
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
