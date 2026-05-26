import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminLearningQuestions,
  fetchAdminLearningQuestionDetail,
} from '../../api/client';
import type {
  AdminLearningQuestionStat,
  AdminLearningQuestionLearner,
} from '../../types/api';
import {
  CATEGORY_META,
  findLearningModule,
  modulesInCategory,
  type LearningCategory,
} from '../../data/learningModules';
import { passRateBucket } from '../logic/passRateBucket';

// Map a moduleId+questionIndex to its question text from the catalog (the
// single source of truth — text is not stored server-side, D87).
function questionText(moduleId: string, qi: number): string {
  const mod = findLearningModule(moduleId);
  const q = mod?.theoreticalExam?.questions[qi];
  return q ? q.question : `Q${qi + 1}`;
}
function optionLabel(moduleId: string, qi: number, oi: number): string {
  const mod = findLearningModule(moduleId);
  const opt = mod?.theoreticalExam?.questions[qi]?.options[oi];
  return opt ?? `Option ${oi + 1}`;
}

export default function LearningAnalytics(): JSX.Element {
  const [stats, setStats] = useState<AdminLearningQuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<LearningCategory>('foundations');
  const [drill, setDrill] = useState<{ moduleId: string; qi: number } | null>(null);
  const [learners, setLearners] = useState<AdminLearningQuestionLearner[] | null>(null);

  useEffect(() => {
    fetchAdminLearningQuestions()
      .then((d) => setStats(d.questions ?? []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!drill) { setLearners(null); return; }
    let cancelled = false;
    fetchAdminLearningQuestionDetail(drill.moduleId, drill.qi)
      .then((d) => { if (!cancelled) setLearners(d.learners ?? []); })
      .catch(() => { if (!cancelled) setLearners([]); });
    return () => { cancelled = true; };
  }, [drill]);

  // Index stats by module+question for O(1) cell lookup.
  const statByKey = useMemo(() => {
    const m = new Map<string, AdminLearningQuestionStat>();
    for (const s of stats) m.set(`${s.moduleId}#${s.questionIndex}`, s);
    return m;
  }, [stats]);

  const modules = modulesInCategory(family).filter((mod) => Boolean(mod.theoreticalExam));
  const maxQ = modules.reduce((n, mod) => Math.max(n, mod.theoreticalExam?.questions.length ?? 0), 0);
  // Per-family check: the heatmap should show the empty state when THIS family
  // has no answered questions yet, not only when the whole path is empty.
  const hasDataForFamily = modules.some((mod) =>
    Array.from({ length: mod.theoreticalExam?.questions.length ?? 0 }).some((_, qi) =>
      statByKey.has(`${mod.id}#${qi}`),
    ),
  );

  if (loading) return <div className="empty-state">Loading learning analytics…</div>;

  return (
    <div className="admin-learn-analytics">
      <nav className="admin-learn-families" aria-label="Pattern family">
        {CATEGORY_META.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`admin-learn-family-btn${family === c.id ? ' is-active' : ''}`}
            onClick={() => { setFamily(c.id); setDrill(null); }}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {!hasDataForFamily ? (
        <div className="empty-state">
          No exam data for {CATEGORY_META.find((c) => c.id === family)?.name ?? family} yet.
          Per-question results are recorded as signed-in learners take the theoretical
          exams (analytics is forward-only).
        </div>
      ) : (
        <div className="admin-heatmap" role="table" aria-label={`${family} score heatmap`} style={{ ['--qcols' as never]: maxQ }}>
          <div className="admin-heatmap__row admin-heatmap__row--head" role="row">
            <span className="admin-heatmap__corner" role="columnheader">Module ↓ / Question →</span>
            {Array.from({ length: maxQ }, (_, qi) => (
              <span key={qi} className="admin-heatmap__col" role="columnheader">Q{qi + 1}</span>
            ))}
          </div>
          {modules.map((mod) => {
            const qCount = mod.theoreticalExam?.questions.length ?? 0;
            return (
              <div key={mod.id} className="admin-heatmap__row" role="row">
                <span className="admin-heatmap__rowhead" role="rowheader" title={mod.title}>{mod.title}</span>
                {Array.from({ length: maxQ }, (_, qi) => {
                  if (qi >= qCount) {
                    return <span key={qi} className="admin-heatmap__cell" data-bucket="none" aria-hidden="true" />;
                  }
                  const stat = statByKey.get(`${mod.id}#${qi}`);
                  const seen = stat?.seen ?? 0;
                  const rate = stat?.passRate ?? 0;
                  const bucket = passRateBucket(rate, seen);
                  const pct = seen > 0 ? Math.round(rate * 100) : null;
                  return (
                    <button
                      key={qi}
                      type="button"
                      className="admin-heatmap__cell"
                      data-bucket={bucket}
                      title={`${mod.title} · Q${qi + 1}\n${questionText(mod.id, qi)}\n${seen} learners · ${pct === null ? 'no data' : pct + '% first-try'}`}
                      onClick={() => seen > 0 && setDrill({ moduleId: mod.id, qi })}
                      disabled={seen === 0}
                    >
                      {pct === null ? '·' : `${pct}%`}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {drill && (
        <div className="admin-section admin-section--card" style={{ marginTop: 16 }}>
          <header className="admin-section__head">
            <h2>{findLearningModule(drill.moduleId)?.title} · Q{drill.qi + 1}</h2>
            <p className="admin-section__hint">{questionText(drill.moduleId, drill.qi)}</p>
          </header>
          {learners === null ? (
            <div className="empty-state">Loading learners…</div>
          ) : learners.length === 0 ? (
            <div className="empty-state">No learners have answered this question yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Learner</th><th>Selected</th><th>First try</th><th>Attempts</th></tr>
              </thead>
              <tbody className="runs-disabled">
                {learners.map((l) => (
                  <tr key={l.userId}>
                    <td><strong>{l.username}</strong>{l.email && <><br /><small>{l.email}</small></>}</td>
                    <td>{optionLabel(drill.moduleId, drill.qi, l.selectedIndex)}</td>
                    <td>{l.firstAttemptCorrect ? '✓' : '✗'}</td>
                    <td>{l.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" className="ghost-btn" style={{ marginTop: 12 }} onClick={() => setDrill(null)}>
            Close drilldown
          </button>
        </div>
      )}
    </div>
  );
}
