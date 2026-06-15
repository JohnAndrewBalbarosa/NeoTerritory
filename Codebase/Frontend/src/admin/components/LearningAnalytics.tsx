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
  isMcqQuestion,
  isIdentificationQuestion,
  isStudioQuestion,
} from '../../data/learningModules';
import { passRateBucket } from '../logic/passRateBucket';

// Map a moduleId+questionIndex to its question text from the catalog (the
// single source of truth — text is not stored server-side, D87).
function questionText(moduleId: string, qi: number): string {
  const mod = findLearningModule(moduleId);
  const q = mod?.theoreticalExam?.questions[qi];
  if (!q) return `Q${qi + 1}`;
  if (isMcqQuestion(q) || isIdentificationQuestion(q)) return q.question;
  if (isStudioQuestion(q)) return q.prompt;
  return `Q${qi + 1}`;
}
function optionLabel(moduleId: string, qi: number, oi: number): string {
  const mod = findLearningModule(moduleId);
  const q = mod?.theoreticalExam?.questions[qi];
  if (q && isMcqQuestion(q)) {
    return q.options[oi] ?? `Option ${oi + 1}`;
  }
  return `Option ${oi + 1}`;
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
      <section className="instructor-card">
        <header className="instructor-card__head">
          <div className="instructor-card__title">
            <h3>Question heatmap</h3>
            <span className="instructor-card__count">first-try pass rate by question</span>
          </div>
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
        </header>

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
      </section>

      {drill && (
        <div className="admin-section admin-section--card admin-heatmap-drilldown" style={{ marginTop: 24 }}>
          <header className="admin-section__head">
            <div className="admin-section__title-row">
              <h2>{findLearningModule(drill.moduleId)?.title} · Question {drill.qi + 1}</h2>
              <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => setDrill(null)}>
                Close Drilldown
              </button>
            </div>
            <p className="admin-section__hint">
              <strong>Question:</strong> {questionText(drill.moduleId, drill.qi)}
            </p>
          </header>
          {learners === null ? (
            <div className="empty-state">Loading learners…</div>
          ) : learners.length === 0 ? (
            <div className="empty-state">No learners have answered this question yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Selected Answer</th>
                    <th className="u-text-center">First Try</th>
                    <th className="u-text-center">Total Attempts</th>
                  </tr>
                </thead>
                <tbody className="runs-disabled">
                  {learners.map((l) => (
                    <tr key={l.userId}>
                      <td>
                        <div className="learner-meta">
                          <strong>{l.username}</strong>
                          {l.email && <span className="learner-meta__email">{l.email}</span>}
                        </div>
                      </td>
                      <td className="u-text-italic">
                        {optionLabel(drill.moduleId, drill.qi, l.selectedIndex)}
                      </td>
                      <td className="u-text-center">
                        <span className={`status-icon ${l.firstAttemptCorrect ? 'is-pass' : 'is-fail'}`}>
                          {l.firstAttemptCorrect ? '✓' : '✗'}
                        </span>
                      </td>
                      <td className="u-text-center">{l.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
