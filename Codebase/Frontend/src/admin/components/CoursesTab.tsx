import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminLearningModules,
  patchLearningModule,
  deleteLearningModule,
  bulkUpdateLearningModules,
} from '../../api/client';
import type { AdminCoursePlan, AdminLearningModule } from '../../types/api';
import {
  BLOOM_TAXONOMIES,
  normalizeLearningModule,
  type LearningCategory,
} from '../../data/learningModules';
import CoursePlanPanel from './CoursePlanPanel';
import CourseEditor from './CourseEditor';
import { buildModuleSwitchboard } from '../../logic/moduleSwitchboard';

const CATEGORY_ORDER: ReadonlyArray<{ id: LearningCategory; label: string }> = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'creational', label: 'Creational' },
  { id: 'structural', label: 'Structural' },
  { id: 'behavioural', label: 'Behavioural' },
  { id: 'idioms', label: 'Idioms' },
];

type EditorState = { source: AdminLearningModule | null } | null;

function categoryRank(category: LearningCategory): number {
  const idx = CATEGORY_ORDER.findIndex((c) => c.id === category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

function normalizeAdminModule(module: AdminLearningModule): AdminLearningModule {
  return { ...module, ...normalizeLearningModule(module) };
}

export function hasIncompleteTheoreticalBank(module: AdminLearningModule): boolean {
  if (!module.theoreticalExam) return true;
  const normalized = normalizeLearningModule(module);
  const levels = new Set((normalized.theoreticalExam?.questions ?? []).map((q) => q.taxonomy));
  return BLOOM_TAXONOMIES.some((taxonomy) => !levels.has(taxonomy));
}

export default function CoursesTab() {
  const [modules, setModules] = useState<ReadonlyArray<AdminLearningModule>>([]);
  const [localPublished, setLocalPublished] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [previewPlan, setPreviewPlan] = useState<AdminCoursePlan | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const list = (await fetchAdminLearningModules()).map(normalizeAdminModule);
      setModules(list);
      // Initialize local toggles from the source of truth
      const toggles: Record<string, boolean> = {};
      for (const m of list) {
        toggles[m.id] = m.published;
      }
      setLocalPublished(toggles);
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

  const sorted = useMemo(() => {
    return [...modules].sort((a, b) => {
      const byCat = categoryRank(a.category) - categoryRank(b.category);
      if (byCat !== 0) return byCat;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id.localeCompare(b.id);
    });
  }, [modules]);

  const switchboard = useMemo(
    () => buildModuleSwitchboard(sorted, previewPlan ?? undefined),
    [previewPlan, sorted],
  );
  const switchboardById = useMemo(
    () => new Map(switchboard.map((row) => [row.moduleId, row])),
    [switchboard],
  );
  const requiredPreviewIds = useMemo(
    () => new Set((previewPlan?.requiredLearning ?? []).map((item) => item.moduleId)),
    [previewPlan],
  );

  function applyUpdate(id: string, next: Partial<AdminLearningModule>): void {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }

  const hasPendingChanges = useMemo(() => {
    return modules.some((m) => localPublished[m.id] !== m.published);
  }, [modules, localPublished]);

  function togglePublished(module: AdminLearningModule, nextValue: boolean): void {
    setLocalPublished((prev) => ({ ...prev, [module.id]: nextValue }));
  }

  async function saveBulk(): Promise<void> {
    if (isSavingBulk) return;
    setIsSavingBulk(true);
    setError(null);

    const updates = modules
      .filter((m) => localPublished[m.id] !== m.published)
      .map((m) => ({ id: m.id, published: localPublished[m.id] }));

    if (updates.length === 0) {
      setIsSavingBulk(false);
      return;
    }

    try {
      await bulkUpdateLearningModules(updates);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setIsSavingBulk(false);
    }
  }

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
            Author and manage learning modules using a simple On/Off switch.
            Questions are already stored in the module JSON, so visibility is
            controlled only by the module state. Seed courses are protected from
            deletion; turn them Off to hide them while keeping learner progress.
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

      <CoursePlanPanel
        modules={sorted}
        onApplied={reload}
        onPreviewChange={setPreviewPlan}
      />

      {!loaded && <p className="admin-section__hint">Loading courses...</p>}
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
                <th>On / Off</th>
                <th>Seed</th>
                <th>Content</th>
                <th>In-Module Questions</th>
                <th>Practical</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="runs-disabled">
              {sorted.map((m) => {
                const rowState = switchboardById.get(m.id);
                const effectiveOn = localPublished[m.id] ?? m.published;
                const currentOn = m.published;
                const rowChanged = effectiveOn !== currentOn;
                const rowLocked = Boolean(
                  rowState?.protectedBaseline || m.category === 'foundations' || requiredPreviewIds.has(m.id),
                );
                const rowBusy = busyId === m.id;

                const incompleteBank = hasIncompleteTheoreticalBank(m);

                return (
                  <tr key={m.id} data-testid={`courses-row-${m.id}`}>
                    <td>
                      <div className="courses-cell-title">
                        <strong>{m.title}</strong>
                        <code className="courses-cell-id">{m.id}</code>
                      </div>
                      {incompleteBank && (
                        <div className="courses-cell-health">
                          <span className="pill pill-amber" title="This module is missing Bloom levels. The pre-test will use randomized fallback questions for missing levels.">
                            ⚠️ Incomplete Bank
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="pill courses-cat-pill">{m.category}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`admin-feature-row__toggle courses-toggle${effectiveOn ? ' is-on' : ''}${rowChanged ? ' is-preview' : ''}`}
                        onClick={() => togglePublished(m, !effectiveOn)}
                        disabled={isSavingBulk || rowLocked}
                        aria-pressed={effectiveOn}
                        title={rowLocked
                          ? 'Required modules stay on for the learning path.'
                          : (rowChanged
                            ? `Current: ${currentOn ? 'On' : 'Off'} · Local: ${effectiveOn ? 'On' : 'Off'}`
                            : undefined)}
                        data-testid={`courses-publish-${m.id}`}
                      >
                        {effectiveOn ? 'On' : 'Off'}
                      </button>
                      {rowLocked && (
                        <span className="pill pill-amber courses-row-lock" data-testid="courses-row-required-badge">
                          required
                        </span>
                      )}
                    </td>
                    <td>
                      {m.isSeed ? (
                        <span className="pill pill-amber" title="Built-in seed course - protected from deletion">
                          seed
                        </span>
                      ) : (
                        <span className="courses-cell-dim">-</span>
                      )}
                    </td>
                    <td className="nt-muted">{m.theoreticalExam || m.practicalExam ? 'Authored' : '—'}</td>
                    <td>{m.theoreticalExam?.questions?.length ?? 0}</td>
                    <td className="nt-muted">{m.practicalExam?.patternName ?? '—'}</td>
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
                        {rowBusy ? '...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="courses-bulk-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={saveBulk}
              disabled={!hasPendingChanges || isSavingBulk}
              data-testid="courses-save-bulk"
            >
              {isSavingBulk ? 'Saving Changes...' : 'Save Visibility Changes'}
            </button>
            {hasPendingChanges && !isSavingBulk && (
              <p className="admin-section__hint">
                You have pending visibility changes. Click Save to apply them.
              </p>
            )}
          </div>
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
