import { useMemo, useState } from 'react';
import type { AdminLearningRaw } from '../../types/api';
import { moduleDifficulty } from '../logic/learningAggregate';
import { groupByDifficulty } from '../logic/groupByDifficulty';
import { downloadCsv } from '../logic/toCsv';
import { passRateBucket } from '../logic/passRateBucket';
import { BarRow } from './StatsCharts';

// Modules sub-view of the Instructor tab (D91). Modules ranked hardest-first by
// difficulty D = 1 − firstTryPassRate. Near-equal difficulty modules share a
// display rank (groupByDifficulty) — rendered as one row ("Rank 6 · Module 4 &
// Module 19"). Top-3 hardest shown by default with a "Show all" toggle. Each
// module carries a horizontal difficulty bar (BarRow) on a DevCon warm ramp:
// hardest = warm lime, easiest = cool cyan.

const TOP_N = 3;

// DevCon difficulty ramp. Difficulty D ∈ [0,1]; harder = warmer. We interpolate
// between cyan (easy) → purple (mid) → lime (hard) so the bar colour itself
// reads the ranking even before the number. Pure presentation.
const RAMP_EASY = '#00d1d8';   // --devcon-cyan
const RAMP_MID = '#8a2be2';    // --devcon-purple
const RAMP_HARD = '#a6ff00';   // --devcon-lime

function lerpHex(a: string, b: string, t: number): string {
  const ah = a.slice(1), bh = b.slice(1);
  const ar = parseInt(ah.slice(0, 2), 16), ag = parseInt(ah.slice(2, 4), 16), ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16), bg = parseInt(bh.slice(2, 4), 16), bb = parseInt(bh.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

// Map difficulty 0..1 to a colour on the cyan→purple→lime ramp.
function difficultyColor(difficulty: number): string {
  const d = Math.max(0, Math.min(1, difficulty));
  return d < 0.5 ? lerpHex(RAMP_EASY, RAMP_MID, d / 0.5) : lerpHex(RAMP_MID, RAMP_HARD, (d - 0.5) / 0.5);
}

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
      <section className="instructor-card">
        <header className="instructor-card__head">
          <div className="instructor-card__title">
            <h3>Module Difficulty — First Attempt</h3>
            <span className="instructor-card__count">{difficulty.length} modules ranked · based on first-attempt performance</span>
          </div>
          <div className="instructor-card__tools">
            <span className="instructor-ramp-legend" aria-hidden="true">
              <span className="instructor-ramp-legend__label">Easier</span>
              <span className="instructor-ramp-legend__bar" />
              <span className="instructor-ramp-legend__label">Harder</span>
            </span>
            <div className="instructor-downloads">
              <button type="button" className="ghost-btn" onClick={onDownloadCsv}>
                Download CSV
              </button>
            </div>
          </div>
        </header>

        <p className="admin-section__hint instructor-card__hint">
          Hardest first by first-try difficulty (D = 1 − first-try pass rate).
          Modules of near-equal difficulty share a rank.
        </p>

        <ol className="instructor-rank-list">
          {visibleGroups.map((g) => (
            <li key={g.rank} className="instructor-rank-row">
              <span className="instructor-rank-badge">#{g.rank}</span>
              <div className="instructor-rank-modules">
                {g.modules.map((m) => (
                  <div key={m.moduleId} className="instructor-rank-module">
                    <div className="instructor-rank-module__top">
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
                    </div>
                    <BarRow
                      label={`D ${m.difficulty.toFixed(2)}`}
                      value={Math.round(m.difficulty * 100)}
                      max={100}
                      color={difficultyColor(m.difficulty)}
                    />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <div className="instructor-card__foot">
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
      </section>
    </div>
  );
}
