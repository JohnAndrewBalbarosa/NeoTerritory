import { useMemo, useState } from 'react';
import type { AdminLearningRaw } from '../../types/api';
import { moduleDifficulty } from '../logic/learningAggregate';
import { groupByDifficulty } from '../logic/groupByDifficulty';
import { downloadCsv } from '../logic/toCsv';
import { passRateBucket } from '../logic/passRateBucket';

// Modules sub-view of the Instructor tab (D91). Modules ranked hardest-first by
// difficulty D = 1 − firstTryPassRate. Near-equal difficulty modules share a
// display rank (groupByDifficulty) — rendered as one row ("Rank 6 · Module 4 &
// Module 19"). Top-3 hardest shown by default with a "Show all" toggle.

const TOP_N = 3;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

interface InstructorModulesProps {
  raw: AdminLearningRaw;
}

export default function InstructorModules({ raw }: InstructorModulesProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);

  const difficulty = useMemo(() => moduleDifficulty(raw), [raw]);
  const groups = useMemo(() => groupByDifficulty(difficulty), [difficulty]);

  // Default view: groups covering the top-3 hardest modules. Whole groups are
  // kept intact, so a tie that straddles the cutoff still shows in full.
  const visibleGroups = useMemo(() => {
    if (showAll) return groups;
    const out: typeof groups = [];
    let count = 0;
    for (const g of groups) {
      out.push(g);
      count += g.modules.length;
      if (count >= TOP_N) break;
    }
    return out;
  }, [groups, showAll]);

  function onDownloadCsv(): void {
    const headers = ['Rank', 'Module ID', 'Module', 'Category', 'Seen', 'First-try pass rate', 'Difficulty'];
    const body = groups.flatMap((g) =>
      g.modules.map((m) => [
        g.rank, m.moduleId, m.title, m.category, m.seen, pct(m.firstTryPassRate), m.difficulty.toFixed(3),
      ]),
    );
    downloadCsv('instructor-module-difficulty.csv', headers, body);
  }

  if (difficulty.length === 0) {
    return (
      <div className="empty-state">
        No module difficulty data yet. Rankings appear once signed-in learners
        answer theoretical-exam questions.
      </div>
    );
  }

  return (
    <div className="instructor-modules">
      <div className="instructor-toolbar">
        <p className="admin-section__hint" style={{ margin: 0 }}>
          Hardest first by first-try difficulty. Modules of near-equal difficulty
          share a rank.
        </p>
        <div className="instructor-downloads">
          <button type="button" className="ghost-btn" onClick={onDownloadCsv}>
            Download CSV
          </button>
        </div>
      </div>

      <ol className="instructor-rank-list">
        {visibleGroups.map((g) => (
          <li key={g.rank} className="instructor-rank-row">
            <span className="instructor-rank-badge">Rank {g.rank}</span>
            <div className="instructor-rank-modules">
              {g.modules.map((m, i) => (
                <span key={m.moduleId} className="instructor-rank-module">
                  {i > 0 && <span className="instructor-rank-amp"> &amp; </span>}
                  <span
                    className="instructor-rank-pill"
                    data-bucket={passRateBucket(m.firstTryPassRate, m.seen)}
                    title={`${m.category} · D=${m.difficulty.toFixed(2)}`}
                  >
                    {m.title}
                  </span>
                  <small className="instructor-rank-meta">
                    {pct(m.firstTryPassRate)} first-try · {m.seen} seen
                  </small>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {groups.length > visibleGroups.length && (
        <button type="button" className="ghost-btn" onClick={() => setShowAll(true)}>
          Show all {difficulty.length} modules
        </button>
      )}
      {showAll && groups.length > 1 && (
        <button type="button" className="ghost-btn" onClick={() => setShowAll(false)}>
          Show top {TOP_N} only
        </button>
      )}
    </div>
  );
}
