import { useMemo, useState } from 'react';
import type { AdminLearningRaw } from '../../types/api';
import {
  perStudentRows,
  studentDrilldown,
  type InstructorStudentRow,
} from '../logic/learningAggregate';
import { downloadCsv, downloadJson } from '../logic/toCsv';

// Students sub-view of the Instructor tab (D91). Per-student rollup table
// (scores, attempts, pass/fail, improvement) computed client-side from the raw
// payload. Clicking a row expands that student's per-question drilldown (their
// chosen vs the correct option, right/wrong, first-try, attempts). Sortable by
// improvement / wrong / pass-fail.

type SortKey = 'improvement' | 'wrong' | 'passfail';

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'improvement', label: 'Practice Improvement' },
  { key: 'wrong', label: 'Most wrong' },
  { key: 'passfail', label: 'Pass / fail' },
];

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function sortRows(rows: InstructorStudentRow[], key: SortKey): InstructorStudentRow[] {
  const copy = [...rows];
  if (key === 'improvement') copy.sort((a, b) => b.improvement - a.improvement);
  else if (key === 'wrong') copy.sort((a, b) => b.wrong - a.wrong);
  else copy.sort((a, b) => b.passCount - b.failCount - (a.passCount - a.failCount));
  return copy;
}

interface InstructorStudentsProps {
  raw: AdminLearningRaw;
}

export default function InstructorStudents({ raw }: InstructorStudentsProps): JSX.Element {
  const [sort, setSort] = useState<SortKey>('improvement');
  const [openUserId, setOpenUserId] = useState<number | null>(null);

  const rows = useMemo(() => sortRows(perStudentRows(raw), sort), [raw, sort]);
  const drill = useMemo(
    () => (openUserId === null ? [] : studentDrilldown(raw, openUserId)),
    [raw, openUserId],
  );

  function onDownloadCsv(): void {
    const headers = [
      'User ID', 'Username', 'Email', 'Modules completed', 'Theory passed',
      'Seen', 'First-try correct', 'Eventual correct', 'Wrong', 'Question attempts',
      'Exam attempts', 'Passes', 'Fails', 'First-try rate', 'Eventual rate', 'Practice Improvement (first-try to eventual mastery)',
    ];
    const body = rows.map((r) => [
      r.userId, r.username, r.email ?? '', r.modulesCompleted, r.theoryPassed,
      r.seen, r.firstTryCorrect, r.eventualCorrect, r.wrong, r.questionAttempts,
      r.examAttempts, r.passCount, r.failCount, pct(r.firstTryRate), pct(r.eventualRate),
      pct(r.improvement),
    ]);
    downloadCsv('instructor-students.csv', headers, body);
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        No students have learning activity yet. Per-student metrics appear as
        signed-in learners take the theoretical exams.
      </div>
    );
  }

  return (
    <div className="instructor-students">
      <section className="instructor-card">
        <header className="instructor-card__head">
          <div className="instructor-card__title">
            <h3>Intern Learning Progress</h3>
            <span className="instructor-card__count">{rows.length} interns with activity</span>
          </div>
          <div className="instructor-card__tools">
            <div className="instructor-sortgroup" role="group" aria-label="Sort students">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`user-ctrl-btn${sort === s.key ? ' is-active' : ''}`}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="instructor-downloads">
              <button type="button" className="ghost-btn" onClick={onDownloadCsv}>
                Download CSV
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => downloadJson('instructor-learning-raw.json', raw)}
                title="Raw dataset (all per-user rows)"
              >
                Download JSON
              </button>
            </div>
          </div>
        </header>

        <div className="instructor-table-wrap">
      <table className="admin-table instructor-students-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Modules</th>
            <th className="num">Seen</th>
            <th className="num">Wrong</th>
            <th className="num">First-try</th>
            <th className="num">Eventual</th>
            <th className="num" title="Practice Improvement: first-try vs eventual in-module mastery. This is a learning-process metric, NOT pre-test/post-test learning gain.">Practice Improvement</th>
            <th>Pass / fail</th>
            <th className="num">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = openUserId === r.userId;
            return (
              <tr
                key={r.userId}
                className={isOpen ? 'is-open' : undefined}
                onClick={() => setOpenUserId(isOpen ? null : r.userId)}
                aria-expanded={isOpen}
              >
                <td>
                  <strong>{r.username}</strong>
                  {r.email && <><br /><small>{r.email}</small></>}
                </td>
                <td>{r.modulesCompleted} done · {r.theoryPassed} theory</td>
                <td className="num">{r.seen}</td>
                <td className="num">{r.wrong}</td>
                <td className="num">{pct(r.firstTryRate)}</td>
                <td className="num">{pct(r.eventualRate)}</td>
                <td className="num">
                  <span
                    className="instructor-improvement"
                    data-sign={r.improvement > 0 ? 'pos' : r.improvement < 0 ? 'neg' : 'zero'}
                  >
                    <span className="instructor-improvement__arrow" aria-hidden="true">
                      {r.improvement > 0 ? '▲' : r.improvement < 0 ? '▼' : '–'}
                    </span>
                    {r.improvement > 0 ? '+' : ''}{pct(r.improvement)}
                  </span>
                </td>
                <td>
                  <span className="pill pill-green">{r.passCount}</span>{' '}
                  <span className="pill pill-red">{r.failCount}</span>
                </td>
                <td className="num">{r.questionAttempts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
        </div>
      </section>

      {openUserId !== null && (
        <section className="instructor-card instructor-drilldown">
          <header className="instructor-card__head">
            <div className="instructor-card__title">
              <h3>{rows.find((r) => r.userId === openUserId)?.username}</h3>
              <span className="instructor-card__count">answers by question</span>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setOpenUserId(null)}
            >
              Close
            </button>
          </header>
          {drill.length === 0 ? (
            <div className="empty-state">No answered questions for this student yet.</div>
          ) : (
            <div className="instructor-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Question</th>
                    <th>Their answer</th>
                    <th>Correct answer</th>
                    <th>Result</th>
                    <th>First try</th>
                    <th className="num">Attempts</th>
                  </tr>
                </thead>
                <tbody className="runs-disabled">
                  {drill.map((d) => (
                    <tr key={`${d.moduleId}#${d.questionIndex}`}>
                      <td><small>{d.moduleTitle}</small></td>
                      <td>{d.questionText}</td>
                      <td data-correct={d.isCorrect ? 'true' : 'false'}>{d.selectedText}</td>
                      <td>{d.correctText}</td>
                      <td>
                        <span className={`pill ${d.isCorrect ? 'pill-green' : 'pill-red'}`}>
                          {d.isCorrect ? 'Right' : 'Wrong'}
                        </span>
                      </td>
                      <td>{d.firstAttemptCorrect ? '✓' : '✗'}</td>
                      <td className="num">{d.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
