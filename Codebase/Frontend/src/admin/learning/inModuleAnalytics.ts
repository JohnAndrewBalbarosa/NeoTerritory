// Pure aggregation for In-Module LEARNING-PROCESS analytics. All inputs are
// in-module records only — conceptual attempts come from learning_question_results
// (GET /api/admin/stats/learning-raw) and practical submissions from stored
// practical answers (questionKind === 'practical' on GET /api/admin/learning/
// interns). FORMAL Form A/B (pre/post) attempts live in a different table and are
// NEVER mixed in here. Recommended modules + stage come from the shared learner
// derivation helper (cycle-frozen). No attempt-by-attempt history is fabricated:
// only stored aggregates (total attempts, first-attempt result, latest/eventual
// result, last activity) are used.

import type { LearningModule } from '../../data/learningModules';
import type { LearningRawQuestionResult } from '../../types/api';
import {
  deriveLearnerLearningRecord,
  type RawLearnerRecord,
  type LearnerStage,
} from './deriveLearnerLearningRecord';

// Centralized minimum-sample rule for module/question difficulty interpretation.
export const MIN_SAMPLE_LEARNERS = 2;

export type ModuleAnalyticsStatus = 'No Activity' | 'Limited Data' | 'Normal' | 'Repeated Attempts' | 'Needs Review';
export type QuestionAnalyticsStatus = 'No Activity' | 'Clear' | 'Moderate Retry Activity' | 'High Retry Activity' | 'Needs Content Review';

const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 100) : null);

function practicalModulesByLearner(rec: RawLearnerRecord): Set<string> {
  return new Set(rec.answers.filter((a) => a.questionKind === 'practical').map((a) => a.moduleId));
}

export interface LearnerAnalyticsRow {
  internId: number;
  displayName: string;
  email: string | null;
  stage: LearnerStage;
  cycleId: string | null;
  recommendedModuleIds: string[];
  recommendedModuleTitles: string[];
  modulesStarted: number;       // recommended modules with ≥1 stored question result
  modulesCompleted: number;     // recommended modules in completedModuleIds
  conceptualAttempts: number;   // Σ stored in-module question attempts
  retriedQuestions: number;     // stored question results with attempts > 1
  practicalSubmissions: number; // distinct modules with a stored practical submission
  avgAttemptsPerStartedModule: number | null; // null when no module started
  latestActivity: string | null;
}

export interface ModuleAnalyticsRow {
  moduleId: string;
  title: string;
  category: string;
  learnersRecommended: number;
  learnersStarted: number;
  learnersCompleted: number;
  conceptualAttempts: number;
  practicalSubmissions: number;
  avgAttemptsPerStartedLearner: number | null;
  questionsWithRetries: number;
  firstTryRate: number | null;   // null when no questions attempted → render "Not Attempted"
  eventualRate: number | null;
  learnerWithMostAttempts: string | null;
  maxAttemptCount: number;
  status: ModuleAnalyticsStatus;
}

export interface QuestionAnalyticsRow {
  moduleId: string;
  moduleTitle: string;
  questionId: string;
  questionIndex: number;
  prompt: string;
  bloom: string | null;
  learnersAttempted: number;
  totalAttempts: number;
  firstAttemptCorrectCount: number;
  firstAttemptRate: number | null;
  eventualCorrectCount: number;
  eventualRate: number | null;
  retriedLearners: number;
  status: QuestionAnalyticsStatus;
}

export interface InModuleSummary {
  internsWithActivity: number;
  recommendedModulesStarted: number;
  recommendedModulesCompleted: number;
  totalConceptualAttempts: number;
  totalPracticalSubmissions: number;
  learnersWithRetries: number;
  avgAttemptsPerStartedModule: number | null;
  questionsWithRetries: number;
  modulesWithRepeatedAttempts: number;
}

interface Ctx {
  interns: RawLearnerRecord[];
  qr: LearningRawQuestionResult[];
  modules: ReadonlyArray<LearningModule>;
}

// Recommended-to-study module ids per learner (cycle-frozen, threshold-driven).
function recommendedByLearner(ctx: Ctx): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const rec of ctx.interns) {
    const d = deriveLearnerLearningRecord(rec, ctx.modules);
    out.set(rec.internId, d.recommendedToStudy.map((m) => m.moduleId));
  }
  return out;
}

export function deriveLearnerAnalytics(interns: RawLearnerRecord[], qr: LearningRawQuestionResult[], modules: ReadonlyArray<LearningModule>): LearnerAnalyticsRow[] {
  const ctx: Ctx = { interns, qr, modules };
  const recMap = recommendedByLearner(ctx);
  const moduleTitle = new Map(modules.map((m) => [m.id, m.title]));
  const qrByUser = new Map<number, LearningRawQuestionResult[]>();
  for (const r of qr) { const a = qrByUser.get(r.userId) ?? []; a.push(r); qrByUser.set(r.userId, a); }

  return interns.map((rec) => {
    const d = deriveLearnerLearningRecord(rec, modules);
    const recommended = recMap.get(rec.internId) ?? [];
    const recSet = new Set(recommended);
    const completed = new Set((d.recommendations.filter((m) => m.progressPercent >= 100).map((m) => m.moduleId)));
    const myQr = qrByUser.get(rec.internId) ?? [];
    const startedModules = new Set(myQr.map((q) => q.moduleId));
    const startedRecommended = recommended.filter((id) => startedModules.has(id));
    const conceptualAttempts = myQr.reduce((s, q) => s + q.attempts, 0);
    const retriedQuestions = myQr.filter((q) => q.attempts > 1).length;
    const practical = practicalModulesByLearner(rec);
    const latest = myQr.reduce<string | null>((acc, q) => (acc === null || q.updatedAt > acc ? q.updatedAt : acc), null);
    return {
      internId: rec.internId,
      displayName: rec.username,
      email: rec.email ?? null,
      stage: d.stage,
      cycleId: d.cycleId,
      recommendedModuleIds: recommended,
      recommendedModuleTitles: recommended.map((id) => moduleTitle.get(id) ?? id),
      modulesStarted: startedRecommended.length,
      modulesCompleted: recommended.filter((id) => recSet.has(id) && completed.has(id)).length,
      conceptualAttempts,
      retriedQuestions,
      practicalSubmissions: practical.size,
      avgAttemptsPerStartedModule: startedRecommended.length ? Math.round((conceptualAttempts / Math.max(startedModules.size, 1)) * 10) / 10 : null,
      latestActivity: latest,
    };
  });
}

export function deriveModuleAnalytics(interns: RawLearnerRecord[], qr: LearningRawQuestionResult[], modules: ReadonlyArray<LearningModule>): ModuleAnalyticsRow[] {
  const ctx: Ctx = { interns, qr, modules };
  const recMap = recommendedByLearner(ctx);
  const internById = new Map(interns.map((r) => [r.internId, r]));
  const byId = new Map(modules.map((m) => [m.id, m]));

  // moduleId → aggregation accumulators
  const acc = new Map<string, {
    learnersRecommended: Set<number>;
    learnersStarted: Set<number>;
    learnersCompleted: Set<number>;
    attempts: number;
    firstTry: number; firstAttemptable: number;
    eventual: number;
    questionsWithRetries: Set<string>; // `${user}:${qIdx}` with attempts>1 → distinct (module,q) with retries
    qRetried: Set<number>;            // questionIndexes that had a retry by any learner
    perLearnerAttempts: Map<number, number>;
    practical: number;
  }>();
  const ensure = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = { learnersRecommended: new Set(), learnersStarted: new Set(), learnersCompleted: new Set(), attempts: 0, firstTry: 0, firstAttemptable: 0, eventual: 0, questionsWithRetries: new Set(), qRetried: new Set(), perLearnerAttempts: new Map(), practical: 0 }; acc.set(id, a); }
    return a;
  };

  for (const [internId, recommended] of recMap) {
    const rec = internById.get(internId);
    const d = rec ? deriveLearnerLearningRecord(rec, modules) : null;
    const completed = new Set((d?.recommendations.filter((m) => m.progressPercent >= 100).map((m) => m.moduleId)) ?? []);
    const practicalMods = rec ? practicalModulesByLearner(rec) : new Set<string>();
    for (const id of recommended) {
      const a = ensure(id);
      a.learnersRecommended.add(internId);
      if (completed.has(id)) a.learnersCompleted.add(internId);
      if (practicalMods.has(id)) a.practical += 1;
    }
  }
  for (const q of qr) {
    const a = ensure(q.moduleId);
    a.learnersStarted.add(q.userId);
    a.attempts += q.attempts;
    a.firstAttemptable += 1;
    if (q.firstAttemptCorrect === 1) a.firstTry += 1;
    if (q.isCorrect === 1) a.eventual += 1;
    a.perLearnerAttempts.set(q.userId, (a.perLearnerAttempts.get(q.userId) ?? 0) + q.attempts);
    if (q.attempts > 1) { a.questionsWithRetries.add(`${q.questionIndex}`); a.qRetried.add(q.questionIndex); }
  }

  const rows: ModuleAnalyticsRow[] = [];
  for (const [id, a] of acc) {
    const started = a.learnersStarted.size;
    let learnerWithMost: string | null = null; let maxAttempts = 0;
    for (const [uid, n] of a.perLearnerAttempts) if (n > maxAttempts) { maxAttempts = n; learnerWithMost = internById.get(uid)?.username ?? String(uid); }
    let status: ModuleAnalyticsStatus;
    if (started === 0) status = 'No Activity';
    else if (started < MIN_SAMPLE_LEARNERS) status = 'Limited Data';
    else if (a.questionsWithRetries.size >= 2) status = 'Repeated Attempts';
    else if ((pct(a.eventual, a.firstAttemptable) ?? 100) < 60) status = 'Needs Review';
    else status = 'Normal';
    rows.push({
      moduleId: id,
      title: byId.get(id)?.title ?? id,
      category: byId.get(id)?.category ?? 'unknown',
      learnersRecommended: a.learnersRecommended.size,
      learnersStarted: started,
      learnersCompleted: a.learnersCompleted.size,
      conceptualAttempts: a.attempts,
      practicalSubmissions: a.practical,
      avgAttemptsPerStartedLearner: started ? Math.round((a.attempts / started) * 10) / 10 : null,
      questionsWithRetries: a.qRetried.size,
      firstTryRate: pct(a.firstTry, a.firstAttemptable),
      eventualRate: pct(a.eventual, a.firstAttemptable),
      learnerWithMostAttempts: learnerWithMost,
      maxAttemptCount: maxAttempts,
      status,
    });
  }
  return rows.sort((x, y) => y.conceptualAttempts - x.conceptualAttempts);
}

export function deriveQuestionAnalytics(qr: LearningRawQuestionResult[], modules: ReadonlyArray<LearningModule>): QuestionAnalyticsRow[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const acc = new Map<string, { moduleId: string; qi: number; learners: Set<number>; attempts: number; firstTry: number; eventual: number; retried: number }>();
  for (const q of qr) {
    const key = `${q.moduleId}:${q.questionIndex}`;
    let a = acc.get(key);
    if (!a) { a = { moduleId: q.moduleId, qi: q.questionIndex, learners: new Set(), attempts: 0, firstTry: 0, eventual: 0, retried: 0 }; acc.set(key, a); }
    a.learners.add(q.userId);
    a.attempts += q.attempts;
    if (q.firstAttemptCorrect === 1) a.firstTry += 1;
    if (q.isCorrect === 1) a.eventual += 1;
    if (q.attempts > 1) a.retried += 1;
  }
  const rows: QuestionAnalyticsRow[] = [];
  for (const a of acc.values()) {
    const mod = byId.get(a.moduleId);
    const q = mod?.theoreticalExam?.questions[a.qi];
    const learners = a.learners.size;
    const retryRate = learners > 0 ? a.retried / learners : 0;
    let status: QuestionAnalyticsStatus;
    if (learners === 0) status = 'No Activity';
    else if (learners < MIN_SAMPLE_LEARNERS) status = 'Clear'; // do NOT call difficult on a single learner
    else if (retryRate >= 0.5) status = 'High Retry Activity';
    else if (retryRate >= 0.25) status = 'Moderate Retry Activity';
    else if ((pct(a.eventual, learners) ?? 100) < 50) status = 'Needs Content Review';
    else status = 'Clear';
    rows.push({
      moduleId: a.moduleId,
      moduleTitle: mod?.title ?? a.moduleId,
      questionId: q?.id ?? `${a.moduleId}:IM-${a.qi}`,
      questionIndex: a.qi,
      prompt: q && q.type !== 'studio' ? q.question : (q && q.type === 'studio' ? q.prompt : `Question ${a.qi + 1}`),
      bloom: q?.taxonomy ?? null,
      learnersAttempted: learners,
      totalAttempts: a.attempts,
      firstAttemptCorrectCount: a.firstTry,
      firstAttemptRate: pct(a.firstTry, learners),
      eventualCorrectCount: a.eventual,
      eventualRate: pct(a.eventual, learners),
      retriedLearners: a.retried,
      status,
    });
  }
  return rows.sort((x, y) => y.retriedLearners - x.retriedLearners);
}

export function summarizeInModuleAnalytics(interns: RawLearnerRecord[], qr: LearningRawQuestionResult[], modules: ReadonlyArray<LearningModule>): InModuleSummary {
  const learners = deriveLearnerAnalytics(interns, qr, modules);
  const moduleRows = deriveModuleAnalytics(interns, qr, modules);
  const questionRows = deriveQuestionAnalytics(qr, modules);
  const startedModuleTotal = learners.reduce((s, l) => s + l.modulesStarted, 0);
  return {
    internsWithActivity: learners.filter((l) => l.conceptualAttempts > 0 || l.practicalSubmissions > 0).length,
    recommendedModulesStarted: startedModuleTotal,
    recommendedModulesCompleted: learners.reduce((s, l) => s + l.modulesCompleted, 0),
    totalConceptualAttempts: qr.reduce((s, q) => s + q.attempts, 0),
    totalPracticalSubmissions: learners.reduce((s, l) => s + l.practicalSubmissions, 0),
    learnersWithRetries: learners.filter((l) => l.retriedQuestions > 0).length,
    avgAttemptsPerStartedModule: startedModuleTotal > 0 ? Math.round((qr.reduce((s, q) => s + q.attempts, 0) / startedModuleTotal) * 10) / 10 : null,
    questionsWithRetries: questionRows.filter((q) => q.retriedLearners > 0).length,
    modulesWithRepeatedAttempts: moduleRows.filter((m) => m.questionsWithRetries > 0).length,
  };
}
