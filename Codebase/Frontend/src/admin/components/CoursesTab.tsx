// Courses tab (D92 Track B-UI). The admin CMS for learning modules: lists ALL
// modules (incl. drafts) grouped by category then sortOrder, with Canvas-style
// publish/draft toggles (optimistic PATCH with rollback, mirroring
// CatalogsTab), an is_seed badge, and Edit / Delete actions. Create + Edit open
// the CourseEditor modal; Delete guards seed rows (409 ⇒ offer "unpublish
// instead", which preserves learner progress per D92).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminLearningModules,
  patchLearningModule,
  deleteLearningModule,
} from '../../api/client';
import type { AdminLearningModule } from '../../types/api';
import type { LearningCategory } from '../../data/learningModules';
import CoursePlanPanel from './CoursePlanPanel';
import CourseEditor from './CourseEditor';

const CATEGORY_ORDER: ReadonlyArray<{ id: LearningCategory; label: string }> = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'creational', label: 'Creational' },
  { id: 'structural', label: 'Structural' },
  { id: 'behavioural', label: 'Behavioural' },
  { id: 'idioms', label: 'Idioms' },
];

// Editor target: null when closed; { source: null } = create; otherwise edit.
type EditorState = { source: AdminLearningModule | null } | null;

function categoryRank(category: LearningCategory): number {
  const idx = CATEGORY_ORDER.findIndex((c) => c.id === category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

export default function CoursesTab() {
  const [modules, setModules] = useState<ReadonlyArray<AdminLearningModule>>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const list = await fetchAdminLearningModules();
      setModules(list);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Sorted view: category rank, then sortOrder, then id (stable tiebreak).
  const sorted = useMemo(() => {
    return [...modules].sort((a, b) => {
      const byCat = categoryRank(a.category) - categoryRank(b.category);
      if (byCat !== 0) return byCat;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id.localeCompare(b.id);
    });
  }, [modules]);

  function applyUpdate(id: string, next: Partial<AdminLearningModule>): void {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }

  // Optimistic control-field PATCH (publish only) with rollback.
  async function toggleField(
    module: AdminLearningModule,
    field: 'published',
    nextValue: boolean,
  ): Promise<void> {
    if (savingId) return;
    setSavingId(module.id);
    setError(null);
    const snapshot = modules;
    applyUpdate(module.id, { [field]: nextValue } as Partial<AdminLearningModule>);
    try {
      const res = await patchLearningModule(module.id, { [field]: nextValue });
      applyUpdate(module.id, {
        published: res.published,
        sortOrder: res.sortOrder,
      });
    } catch (err: unknown) {
      setModules(snapshot);
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setSavingId(null);
    }
  }

  // Unpublish in place — the steer-to path for a guarded seed delete. Preserves
  // learner progress (D92): progress rows persist and restore on re-publish.
  async function unpublish(module: AdminLearningModule): Promise<void> {
    if (busyId) return;
    setBusyId(module.id);
    setError(null);
    try {
      const res = await patchLearningModule(module.id, { published: false });
      applyUpdate(module.id, { published: res.published, sortOrder: res.sortOrder });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unpublish failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(module: AdminLearningModule): Promise<void> {
    if (busyId) return;
    const warn = module.isSeed
      ? `Delete seed course "${module.id}"? This discards all learner progress for it. Unpublishing is usually safer.`
      : `Delete course "${module.id}"? This discards all learner progress for it.`;
    if (!window.confirm(warn)) return;
    setBusyId(module.id);
    setError(null);
    try {
      await deleteLearningModule(module.id);
      await reload();
    } catch (err: unknown) {
      // Seed rows 409 without ?force=1. Steer to unpublish instead of forcing.
      const message = err instanceof Error ? err.message : 'Delete failed';
      const steer = window.confirm(
        `${message}\n\nThis looks like a protected (seed) course. Unpublish it instead? ` +
          `That hides it from learners while keeping their progress.`,
      );
      if (steer) {
        await unpublish(module);
      } else {
        setError(message);
      }
    } finally {
      setBusyId(null);
    }
  }

  function onEditorSaved(): void {
    setEditor(null);
    void reload();
  }

  return (
    <section className="admin-section admin-section--card courses-tab" data-testid="admin-courses">
      <header className="admin-section__head courses-head">
        <div>
          <p className="eyebrow">Learning CMS</p>
          <h2>Courses</h2>
          <p className="admin-section__hint">
            Author and manage learning modules — including drafts. Publish flips a
            module between draft and live (Canvas-style). Question tags are
            already stored in the module JSON, so visibility is controlled only
            by publish/unpublish. Seed courses are protected from deletion;
            unpublish to hide them while keeping learner progress.
          </p>
        </div>
        <button
          type="button"
          className="primary-btn"
          onClick={() => setEditor({ source: null })}
          data-testid="courses-new"
        >
          + New course
        </button>
      </header>

      {error && <p className="admin-login-error" role="alert">{error}</p>}

      <CoursePlanPanel modules={sorted} onApplied={reload} />

      {!loaded && <p className="admin-section__hint">Loading courses…</p>}
      {loaded && sorted.length === 0 && (
        <p className="admin-section__hint">No courses yet. Create one to get started.</p>
      )}

      {sorted.length > 0 && (
        <div className="courses-table-wrap">
          <table className="admin-table courses-table" data-testid="courses-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Category</th>
                <th>Published</th>
                <th>Seed</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="runs-disabled">
              {sorted.map((m) => {
                const rowBusy = busyId === m.id;
                const rowSaving = savingId === m.id;
                return (
                  <tr key={m.id} data-testid={`courses-row-${m.id}`}>
                    <td>
                      <div className="courses-cell-title">
                        <strong>{m.title}</strong>
                        <code className="courses-cell-id">{m.id}</code>
                      </div>
                    </td>
                    <td>
                      <span className="pill courses-cat-pill">{m.category}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`admin-feature-row__toggle courses-toggle${m.published ? ' is-on' : ''}`}
                        onClick={() => toggleField(m, 'published', !m.published)}
                        disabled={rowSaving}
                        aria-pressed={m.published}
                        data-testid={`courses-publish-${m.id}`}
                      >
                        {rowSaving ? 'Saving…' : m.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td>
                      {m.isSeed ? (
                        <span className="pill pill-amber" title="Built-in seed course — protected from deletion">
                          seed
                        </span>
                      ) : (
                        <span className="courses-cell-dim">—</span>
                      )}
                    </td>
                    <td className="courses-row-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setEditor({ source: m })}
                        disabled={rowBusy}
                        data-testid={`courses-edit-${m.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-btn courses-delete-btn"
                        onClick={() => onDelete(m)}
                        disabled={rowBusy}
                        data-testid={`courses-delete-${m.id}`}
                      >
                        {rowBusy ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <CourseEditor
          source={editor.source}
          onClose={() => setEditor(null)}
          onSaved={onEditorSaved}
        />
      )}
    </section>
  );
}
