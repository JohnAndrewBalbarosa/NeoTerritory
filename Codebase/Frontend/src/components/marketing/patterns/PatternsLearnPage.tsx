import { useEffect, useMemo, useState } from 'react';
import { learnModuleSlugFromPath, navigate } from '../../../logic/router';
import {
  CATEGORY_META,
  LEARNING_MODULES,
  findLearningModule,
  modulesInCategory,
  type LearningModule,
} from '../../../data/learningModules';

// D77: /patterns/learn (category list) and /patterns/learn/<module-id>
// (single isolated module) both render this component. The surface
// signal in MarketingShell decides which route this is, but the page
// itself reads the slug from the URL to decide whether to show the
// category overview or one focused module.
//
// Strict-silo rule (user direction): only ONE module's content is in
// the DOM at a time. Sidebar is the picker. "See also" at the bottom of
// each module is a read-only pointer list — clicking switches to that
// module but never auto-folds content from one module into another.

interface CategoryGroup {
  meta: (typeof CATEGORY_META)[number];
  modules: ReadonlyArray<LearningModule>;
}

function useSelectedModule(): LearningModule | null {
  const initial =
    typeof window !== 'undefined' ? learnModuleSlugFromPath(window.location.pathname) : '';
  const [slug, setSlug] = useState<string>(initial);

  useEffect(() => {
    function recompute(): void {
      setSlug(learnModuleSlugFromPath(window.location.pathname));
    }
    window.addEventListener('popstate', recompute);
    window.addEventListener('nt:navigate', recompute);
    return () => {
      window.removeEventListener('popstate', recompute);
      window.removeEventListener('nt:navigate', recompute);
    };
  }, []);

  return slug ? findLearningModule(slug) ?? null : null;
}

function pickModule(moduleId: string): void {
  navigate(`/patterns/learn/${moduleId}`);
}

function goToCategoryList(): void {
  navigate('/patterns/learn');
}

function ModuleView({ module }: { module: LearningModule }): JSX.Element {
  return (
    <article className="nt-learn__module" aria-labelledby={`mod-${module.id}-title`}>
      <header className="nt-learn__module-head">
        <p className="nt-section-eyebrow">{module.eyebrow}</p>
        <h1 id={`mod-${module.id}-title`} className="nt-learn__module-title">
          {module.title}
        </h1>
        <p className="nt-learn__module-intro">{module.intro}</p>
      </header>

      {module.sections.map((s, idx) => (
        <section className="nt-learn__module-section" key={`${module.id}-s-${idx}`}>
          <h2 className="nt-learn__module-section-head">{s.heading}</h2>
          {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
          {s.bullets && s.bullets.length > 0 ? (
            <ul className="nt-learn__module-bullets">
              {s.bullets.map((b, i) => (
                <li key={`${module.id}-s-${idx}-b-${i}`}>{b}</li>
              ))}
            </ul>
          ) : null}
          {s.code ? (
            <pre className="nt-learn__module-code" aria-label="Code example">
              {s.code}
            </pre>
          ) : null}
          {s.note ? <p className="nt-learn__module-note">{s.note}</p> : null}
        </section>
      ))}

      {module.keyTerms && module.keyTerms.length > 0 ? (
        <section className="nt-learn__module-section">
          <h2 className="nt-learn__module-section-head">Key terms</h2>
          <dl className="nt-learn__module-terms">
            {module.keyTerms.map((t) => (
              <div className="nt-learn__module-term" key={`${module.id}-t-${t.term}`}>
                <dt>{t.term}</dt>
                <dd>{t.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {module.summary ? (
        <section className="nt-learn__module-summary" aria-label="Module summary">
          <p className="nt-learn__module-summary-eyebrow">Summary</p>
          <p className="nt-learn__module-summary-body">{module.summary}</p>
        </section>
      ) : null}

      <section className="nt-learn__module-cites" aria-label="Citations">
        <h2 className="nt-learn__module-section-head">Sources</h2>
        <ol className="nt-learn__module-cite-list">
          {module.citations.map((c, i) => (
            <li key={`${module.id}-c-${i}`}>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noopener noreferrer">
                  {c.citation}
                </a>
              ) : (
                c.citation
              )}
            </li>
          ))}
        </ol>
      </section>

      {module.seeAlso && module.seeAlso.length > 0 ? (
        <footer className="nt-learn__module-see-also" aria-label="Related modules">
          <p className="nt-learn__module-see-also-eyebrow">See also</p>
          <ul className="nt-learn__module-see-also-list">
            {module.seeAlso.map((sa) => (
              <li key={`${module.id}-sa-${sa.moduleId}`}>
                <button
                  type="button"
                  className="nt-learn__module-see-also-link"
                  onClick={() => pickModule(sa.moduleId)}
                >
                  {sa.label} →
                </button>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}

function CategoryOverview({ groups }: { groups: ReadonlyArray<CategoryGroup> }): JSX.Element {
  return (
    <section className="nt-learn__overview" aria-labelledby="learn-overview-heading">
      <header className="nt-learn__overview-head">
        <p className="nt-section-eyebrow">Learning hub</p>
        <h1 id="learn-overview-heading" className="nt-learn__overview-title">
          Pick a module on the left to begin
        </h1>
        <p className="nt-learn__overview-lede">
          Each module is a standalone reference — read it end to end without needing the others.
          Use the sidebar to jump between categories; the &ldquo;See also&rdquo; footer at the bottom
          of each module points at related reading.
        </p>
      </header>
      <div className="nt-learn__overview-grid">
        {groups.map((g) => (
          <article key={g.meta.id} className="nt-learn__overview-card">
            <h2 className="nt-learn__overview-card-title">{g.meta.name}</h2>
            <p className="nt-learn__overview-card-gist">{g.meta.gist}</p>
            <p className="nt-learn__overview-card-count">{g.modules.length} modules</p>
            {g.modules.length > 0 ? (
              <button
                type="button"
                className="nt-learn__overview-card-cta"
                onClick={() => pickModule(g.modules[0].id)}
              >
                Start with {g.modules[0].title} →
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PatternsLearnPage(): JSX.Element {
  const selected = useSelectedModule();

  const groups: ReadonlyArray<CategoryGroup> = useMemo(
    () =>
      CATEGORY_META.map((meta) => ({
        meta,
        modules: modulesInCategory(meta.id),
      })).filter((g) => g.modules.length > 0),
    [],
  );

  const totalCount = LEARNING_MODULES.length;

  return (
    <main className="nt-learn" id="main" data-learn-mode="true">
      <header className="nt-learn__topbar">
        <div className="nt-learn__topbar-left">
          <p className="nt-section-eyebrow">Patterns · Learn</p>
          <h1 className="nt-learn__topbar-title">Learning modules</h1>
          <p className="nt-learn__topbar-lede">
            {totalCount} silo&rsquo;d reference modules. One module on screen at a time.
          </p>
        </div>
        <button
          type="button"
          className="nt-learn__topbar-back"
          onClick={() => navigate('/patterns')}
        >
          ← Back to catalog
        </button>
      </header>

      <div className="nt-learn__shell">
        <aside className="nt-learn__sidebar" aria-label="Learning module index">
          {groups.map((g) => (
            <section className="nt-learn__sidebar-cat" key={g.meta.id}>
              <header className="nt-learn__sidebar-cat-head">
                <h2 className="nt-learn__sidebar-cat-name">{g.meta.name}</h2>
                <p className="nt-learn__sidebar-cat-gist">{g.meta.gist}</p>
              </header>
              <ol className="nt-learn__sidebar-cat-list">
                {g.modules.map((m) => {
                  const isActive = selected?.id === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="nt-learn__sidebar-link"
                        data-active={isActive ? 'true' : undefined}
                        onClick={() => pickModule(m.id)}
                      >
                        {m.title}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </aside>

        <section className="nt-learn__main" aria-live="polite">
          {selected ? (
            <>
              <button
                type="button"
                className="nt-learn__main-back"
                onClick={goToCategoryList}
              >
                ← All modules
              </button>
              <ModuleView module={selected} />
            </>
          ) : (
            <CategoryOverview groups={groups} />
          )}
        </section>
      </div>
    </main>
  );
}
