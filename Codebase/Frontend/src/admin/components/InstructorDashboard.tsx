import { useEffect, useState } from 'react';
import { fetchAdminLearningRaw } from '../../api/client';
import type { AdminLearningRaw } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';
import InstructorStudents from './InstructorStudents';
import InstructorModules from './InstructorModules';
import LearningAnalytics from './LearningAnalytics';

// Instructor dashboard container (D91). Fetches the RAW learning payload once on
// mount and hosts three sub-views via a segmented control:
//   • Students  — per-student scores / attempts / pass-fail / improvement.
//   • Modules   — module difficulty ranking (hardest-first, grouped ties).
//   • Questions — the existing per-question heatmap (LearningAnalytics), reused
//                 unchanged; it fetches its own per-question stats.
// Students + Modules aggregate the single raw payload client-side, so they
// share one fetch and never re-hit the API on sub-view switches.

type SubView = 'students' | 'modules' | 'questions';

const SUBVIEWS: ReadonlyArray<{ id: SubView; label: string }> = [
  { id: 'students', label: 'Students' },
  { id: 'modules', label: 'Modules' },
  { id: 'questions', label: 'Questions' },
];

export default function InstructorDashboard(): JSX.Element {
  const [raw, setRaw] = useState<AdminLearningRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SubView>('students');

  useEffect(() => {
    let cancelled = false;
    fetchAdminLearningRaw()
      .then((d) => { if (!cancelled) setRaw(d); })
      .catch((e: unknown) => {
        if (cancelled) return;
        // A pre-auth 401 race resolves to an empty dataset rather than a red
        // banner (same pattern as the other admin panels).
        if (isAuthError(e)) { setRaw({ students: [], progress: [], questionResults: [], examAttempts: [] }); return; }
        setError(e instanceof Error ? e.message : 'Failed to load learning data');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="instructor-dashboard">
      <nav className="instructor-segmented" role="tablist" aria-label="Instructor sub-views">
        {SUBVIEWS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={view === s.id}
            className={`instructor-seg-btn${view === s.id ? ' is-active' : ''}`}
            onClick={() => setView(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Students + Modules need the raw payload; Questions is self-fetching. */}
      {view === 'questions' ? (
        <LearningAnalytics />
      ) : error ? (
        <div className="empty-state admin-error" role="alert">{error}</div>
      ) : raw === null ? (
        <div className="empty-state">Loading instructor analytics…</div>
      ) : view === 'students' ? (
        <InstructorStudents raw={raw} />
      ) : (
        <InstructorModules raw={raw} />
      )}
    </div>
  );
}
