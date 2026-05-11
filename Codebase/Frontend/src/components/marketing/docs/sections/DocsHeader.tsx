// Header for /docs. Kept as its own component so DocsPage.tsx stays a
// thin composition file — per user direction this turn: "have a folder
// where all the UI / HTML lives, and then it's just called from one
// component."

export default function DocsHeader() {
  return (
    <header className="nt-docs__head">
      <p className="nt-section-eyebrow">Docs</p>
      <h1 className="nt-docs__title">CodiNeo design documentation</h1>
      <p className="nt-docs__meta">
        The in-depth surface: methods, design rationale, trade-offs, and references behind the
        Hash-Based Virtual Structural Copy algorithm.
      </p>
    </header>
  );
}
