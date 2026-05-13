import { navigate } from '../../logic/router';

// Per D65 (this turn): standard multi-column site footer. Replaces the
// previous two-line "NeoTerritory Studio - For thesis evaluation..." footer
// that classmates flagged as too minimal. Four columns (Product, Learn,
// Company, Research) + a bottom row with copyright + DevCon acknowledgment.
//
// All internal links use navigate() so the SPA router handles them
// without a full page reload.

interface FooterLink {
  label: string;
  path: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: ReadonlyArray<FooterLink>;
}

const COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    title: 'Product',
    links: [
      { label: 'Home', path: '/' },
      { label: 'How it works', path: '/mechanics' },
      { label: 'Try it now', path: '/student-studio' },
      { label: 'Take the tour', path: '/tour' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Pattern catalog', path: '/patterns' },
      { label: 'Student learning hub', path: '/student-learning' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', path: '/about' },
      { label: 'DEVCON Philippines', path: 'https://devcon.ph/', external: true },
      { label: 'FEU Institute of Technology', path: 'https://feutech.edu.ph/', external: true },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Methods + references', path: '/docs' },
      { label: 'Design decisions log', path: 'https://github.com/JohnAndrewBalbarosa/NeoTerritory/blob/main/docs/Codebase/DESIGN_DECISIONS.md', external: true },
      { label: 'Source on GitHub', path: 'https://github.com/JohnAndrewBalbarosa/NeoTerritory', external: true },
    ],
  },
];

export default function MarketingFooter() {
  function onLinkClick(e: React.MouseEvent, link: FooterLink): void {
    if (link.external) return; // let the browser handle external links
    e.preventDefault();
    navigate(link.path);
  }

  return (
    <footer className="nt-mkt-footer" role="contentinfo">
      <div className="nt-mkt-footer__inner">
        <div className="nt-mkt-footer__brand">
          <span className="nt-mkt-footer__brand-mark" aria-hidden="true">
            NT
          </span>
          <div>
            <p className="nt-mkt-footer__brand-name">NeoTerritory</p>
            <p className="nt-mkt-footer__brand-tag">
              Design-pattern learning + auto-documentation for DEVCON Luzon.
            </p>
          </div>
        </div>

        <nav className="nt-mkt-footer__columns" aria-label="Footer navigation">
          {COLUMNS.map((col) => (
            <div key={col.title} className="nt-mkt-footer__col">
              <h2 className="nt-mkt-footer__col-title">{col.title}</h2>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.path}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noreferrer noopener' : undefined}
                      onClick={(e) => onLinkClick(e, link)}
                    >
                      {link.label}
                      {link.external ? (
                        <span className="nt-mkt-footer__ext" aria-hidden="true">
                          {' '}
                          &nearr;
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="nt-mkt-footer__bottom">
        <p className="nt-mkt-footer__copy">
          &copy; 2026 NeoTerritory. Thesis project by Balbarosa, De Leon, Santander - FEU
          Institute of Technology.
        </p>
        <p className="nt-mkt-footer__credit">
          In partnership with{' '}
          <a href="https://devcon.ph/" target="_blank" rel="noreferrer noopener">
            DEVCON Philippines
          </a>
          . Thanks to Sir Ghrassel Dungca (DEVCON co-lead).
        </p>
        <p className="nt-mkt-footer__admin">
          Admin access remains protected at <code>/app</code>.
        </p>
      </div>
    </footer>
  );
}
