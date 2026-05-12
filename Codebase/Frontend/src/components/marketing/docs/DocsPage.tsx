// /docs page — thin composition shell. All real JSX lives under
// ./sections/ per user direction this turn: "have a folder where all
// the UI / HTML lives, called from one component."
//
// Surface map:
//   <DocsHeader />     — title, eyebrow, meta paragraph
//   <DocsSidebar />    — Scope + Design rationale (stacked bento tiles)
//   <DocsMain />       — Method, Trade-offs and limitations, Contribution,
//                         Testing Trophy, Bibliography
//
// Problem statement + objectives moved to the landing page; Authors /
// adviser / panel moved to /about.

import DocsHeader from './sections/DocsHeader';
import DocsSidebar from './sections/DocsSidebar';
import DocsMain from './sections/DocsMain';

export default function DocsPage() {
  return (
    <main className="nt-docs" id="main">
      <DocsHeader />
      <div className="nt-docs__layout">
        <DocsSidebar />
        <DocsMain />
      </div>
    </main>
  );
}
