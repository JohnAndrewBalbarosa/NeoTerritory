// Pure helpers for per-question theoretical-exam analytics (D87). Kept out of
// the route handlers so they can be unit-tested without a DB or HTTP harness.

const MAX_ANSWERS = 50;
const MAX_INDEX = 10_000;

export interface CleanAnswer {
  questionIndex: number;
  selectedIndex: number;
  isCorrect: 0 | 1;
}

// Normalise the PUT /api/learning/answers body.answers array: objects only,
// non-negative bounded ints, correctness coerced to 0/1, capped at MAX_ANSWERS.
export function sanitizeAnswers(input: unknown): CleanAnswer[] {
  if (!Array.isArray(input)) return [];
  const out: CleanAnswer[] = [];
  for (const raw of input) {
    if (out.length >= MAX_ANSWERS) break;
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const qi = Number(r.questionIndex);
    const si = Number(r.selectedIndex);
    if (!Number.isInteger(qi) || qi < 0 || qi > MAX_INDEX) continue;
    if (!Number.isInteger(si) || si < 0 || si > MAX_INDEX) continue;
    out.push({ questionIndex: qi, selectedIndex: si, isCorrect: r.isCorrect ? 1 : 0 });
  }
  return out;
}

export interface RawResultRow {
  module_id: string;
  question_index: number;
  selected_index: number;
  first_attempt_correct: number;
}

export interface QuestionStat {
  family: string;
  moduleId: string;
  questionIndex: number;
  seen: number;
  firstTryCorrect: number;
  passRate: number; // firstTryCorrect / seen, 0 when seen === 0
  optionDistribution: number[]; // counts per selected_index (latest answers)
}

// Family is the module-id prefix before the first hyphen (matches the
// LearningCategory ids: foundations / creational / structural / behavioural /
// idioms). Mirrors how module ids are built in learningModules.ts.
function familyOf(moduleId: string): string {
  const dash = moduleId.indexOf('-');
  return dash > 0 ? moduleId.slice(0, dash) : moduleId;
}

export function aggregateQuestionResults(rows: ReadonlyArray<RawResultRow>): QuestionStat[] {
  const byKey = new Map<string, QuestionStat>();
  for (const row of rows) {
    const key = `${row.module_id}#${row.question_index}`;
    let stat = byKey.get(key);
    if (!stat) {
      stat = {
        family: familyOf(row.module_id),
        moduleId: row.module_id,
        questionIndex: row.question_index,
        seen: 0,
        firstTryCorrect: 0,
        passRate: 0,
        optionDistribution: [],
      };
      byKey.set(key, stat);
    }
    stat.seen += 1;
    if (row.first_attempt_correct) stat.firstTryCorrect += 1;
    const opt = row.selected_index;
    while (stat.optionDistribution.length <= opt) stat.optionDistribution.push(0);
    stat.optionDistribution[opt] += 1;
  }
  for (const stat of byKey.values()) {
    stat.passRate = stat.seen > 0 ? stat.firstTryCorrect / stat.seen : 0;
  }
  return Array.from(byKey.values());
}
