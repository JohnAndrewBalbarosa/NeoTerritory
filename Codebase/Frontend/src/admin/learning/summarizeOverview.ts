// Pure aggregation for the SOP-1 PM Overview. Derives stage distribution,
// completed-cycle count, recommendation averages, and Needs-Attention items from
// the already-derived learner records (one per intern, latest cycle) + all cycle
// records. Kept separate from the React component so the derivation is unit-
// testable. No formal/process mixing: conceptual/practical attempt TOTALS are
// supplied by the component from their own stored sources, not invented here.

import type { LearnerLearningRecord, LearnerStage } from './deriveLearnerLearningRecord';

export const ALL_STAGES: LearnerStage[] = [
  'Awaiting Pre-Test', 'Pre-Test Completed', 'Learning in Progress', 'Ready for Post-Test', 'Post-Test Completed', 'Needs Review',
];

export interface NeedsAttentionItem {
  internId: number;
  displayName: string;
  issue: string;
  moduleTitle?: string;
  stage: LearnerStage;
  cycleId: string | null;
}

export interface OverviewSummary {
  activeInterns: number;
  stageCounts: Record<LearnerStage, number>;
  awaitingPreTest: number;
  learningInProgress: number;
  readyForPostTest: number;
  needsReview: number;
  completedLearningCycles: number;
  avgRecommendedPerIntern: number;
  avgRecommendedCompletionPct: number | null; // null when no intern has recommended modules
  needsAttention: NeedsAttentionItem[];
}

export function summarizeOverview(
  records: LearnerLearningRecord[],
  cycleRecords: LearnerLearningRecord[],
  repeatedAttemptInternIds: ReadonlySet<number> = new Set(),
): OverviewSummary {
  const stageCounts = Object.fromEntries(ALL_STAGES.map((s) => [s, 0])) as Record<LearnerStage, number>;
  for (const r of records) stageCounts[r.stage] += 1;

  // A completed learning cycle = a cycle that has a paired post-test.
  const completedLearningCycles = cycleRecords.filter((c) => c.hasPostTest).length;

  const totalRecommended = records.reduce((s, r) => s + r.recommendedToStudy.length, 0);
  const avgRecommendedPerIntern = records.length ? totalRecommended / records.length : 0;

  const withRecommended = records.filter((r) => r.recommendedToStudy.length > 0);
  const avgRecommendedCompletionPct = withRecommended.length
    ? Math.round(
        (withRecommended.reduce((s, r) => s + r.completedRecommendedCount / r.recommendedToStudy.length, 0) /
          withRecommended.length) * 100,
      )
    : null;

  const needsAttention: NeedsAttentionItem[] = [];
  for (const r of records) {
    const base = { internId: r.internId, displayName: r.displayName, stage: r.stage, cycleId: r.cycleId };
    if (r.stage === 'Awaiting Pre-Test') {
      needsAttention.push({ ...base, issue: 'Has not started the targeted pre-test.' });
      continue;
    }
    if (r.recommendedToStudy.length > 0 && r.completedRecommendedCount === 0) {
      needsAttention.push({ ...base, issue: 'Recommended modules assigned but none started.' });
    } else if (r.recommendedToStudy.length > 0 && r.completedRecommendedCount < r.recommendedToStudy.length) {
      const next = r.recommendedToStudy.find((m) => m.progressPercent < 100);
      needsAttention.push({ ...base, issue: 'Incomplete recommended module(s).', moduleTitle: next?.moduleTitle });
    }
    if (repeatedAttemptInternIds.has(r.internId)) {
      needsAttention.push({ ...base, issue: 'Repeated in-module attempts recorded.' });
    }
    if (r.stage === 'Ready for Post-Test') {
      needsAttention.push({ ...base, issue: 'All recommended modules complete — ready for the post-test.' });
    }
    if (r.ppDiff !== null && r.ppDiff < 0) {
      needsAttention.push({ ...base, issue: `Paired post-test decreased by ${Math.abs(r.ppDiff)} percentage point(s).` });
    }
    if (r.stage === 'Needs Review') {
      needsAttention.push({ ...base, issue: 'Records require PM review.' });
    }
  }

  return {
    activeInterns: records.length,
    stageCounts,
    awaitingPreTest: stageCounts['Awaiting Pre-Test'],
    learningInProgress: stageCounts['Learning in Progress'],
    readyForPostTest: stageCounts['Ready for Post-Test'],
    needsReview: stageCounts['Needs Review'],
    completedLearningCycles,
    avgRecommendedPerIntern,
    avgRecommendedCompletionPct,
    needsAttention,
  };
}
