import { useEffect, useMemo, useState } from 'react';
import { fetchLearningModules } from '../api/client';
import {
  LEARNING_MODULES,
  type LearningCategory,
  type LearningModule,
} from './learningModules';

// D92 (Track C): the learner page sources its content from the DB-backed CMS
// (GET /api/learning/modules, published-only, sort_order) WITH a static
// fallback. On ANY error, an unseeded DB, or an empty response we fall back to
// the bundled static LEARNING_MODULES — so the page (and the routes-manifest
// Playwright smoke) never break and the frontend can ship before the seed runs.
//
// The module ids returned by the API are identical to the static ids (seeded
// that way — see DESIGN_DECISIONS D92 "IDs are sacred"), so per-user progress
// + deep links are unaffected regardless of which source wins.

export type LearningModulesSource = 'api' | 'static';

export interface UseLearningModules {
  modules: ReadonlyArray<LearningModule>;
  loaded: boolean;
  source: LearningModulesSource;
  findModule: (id: string) => LearningModule | undefined;
  modulesInCategory: (category: LearningCategory) => ReadonlyArray<LearningModule>;
}

export function useLearningModules(): UseLearningModules {
  const [modules, setModules] = useState<ReadonlyArray<LearningModule>>(LEARNING_MODULES);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [source, setSource] = useState<LearningModulesSource>('static');

  useEffect(() => {
    let cancelled = false;

    function fallBackToStatic(): void {
      if (cancelled) return;
      setModules(LEARNING_MODULES);
      setSource('static');
      setLoaded(true);
    }

    fetchLearningModules()
      .then((apiModules) => {
        if (cancelled) return;
        // Treat an empty array as "unseeded / nothing published" → static.
        if (!apiModules || apiModules.length === 0) {
          fallBackToStatic();
          return;
        }
        setModules(apiModules);
        setSource('api');
        setLoaded(true);
      })
      .catch(() => {
        // Fetch failure (offline, 5xx, frontend deployed before the seed) —
        // render the full path from the bundled static catalog.
        fallBackToStatic();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Bound helpers over the loaded list, preserving its order. These mirror the
  // static findLearningModule/modulesInCategory signatures so the page can swap
  // the source without changing call-site shapes.
  const findModule = useMemo(
    () => (id: string): LearningModule | undefined => modules.find((m) => m.id === id),
    [modules],
  );

  const modulesInCategory = useMemo(
    () => (category: LearningCategory): ReadonlyArray<LearningModule> =>
      modules.filter((m) => m.category === category),
    [modules],
  );

  return { modules, loaded, source, findModule, modulesInCategory };
}
