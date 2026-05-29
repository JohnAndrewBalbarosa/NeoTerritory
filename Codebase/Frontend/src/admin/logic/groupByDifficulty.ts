// Display-only difficulty grouping for the Instructor tab (D91).
//
// Module difficulty D = 1 − firstTryPassRate produces a hardest-first list
// (see learningAggregate.moduleDifficulty). For the Modules sub-view, modules
// of near-equal difficulty SHARE a display rank: D is rounded to the nearest
// 0.05 bucket, and modules in the same bucket render as one rank row
// ("Rank 6 · Module 4 & Module 19").
//
// This is REPRESENTATION ONLY — the underlying per-module rows (and the DB)
// stay separate. The grouping never merges or mutates module data.

import type { ModuleDifficulty } from './learningAggregate';

const BUCKET_SIZE = 0.05;

export interface RankedModuleGroup {
  rank: number; // 1-based display rank; shared by tied modules
  bucket: number; // the rounded-D bucket value this group sits in
  modules: ModuleDifficulty[]; // modules sharing this rank (≥1)
}

// Round a difficulty to the nearest BUCKET_SIZE so near-equal modules collapse
// to one bucket. Kept as an integer key internally to avoid float drift, then
// scaled back to a 0..1 value.
function bucketOf(difficulty: number): number {
  return Math.round(difficulty / BUCKET_SIZE) * BUCKET_SIZE;
}

// Group a hardest-first module-difficulty list into shared display ranks.
// Input is assumed sorted hardest-first (as moduleDifficulty returns); the
// output preserves that order, assigning the same `rank` to every module whose
// rounded D falls in the same bucket. Rank numbers are dense (1, 2, 3, …): each
// distinct bucket advances the rank by one, regardless of group size.
export function groupByDifficulty(modules: ModuleDifficulty[]): RankedModuleGroup[] {
  const groups: RankedModuleGroup[] = [];
  let lastBucket: number | null = null;

  for (const mod of modules) {
    const bucket = bucketOf(mod.difficulty);
    if (lastBucket !== null && Math.abs(bucket - lastBucket) < BUCKET_SIZE / 2) {
      // Same bucket as the previous module → share its rank.
      groups[groups.length - 1].modules.push(mod);
    } else {
      groups.push({ rank: groups.length + 1, bucket, modules: [mod] });
      lastBucket = bucket;
    }
  }

  return groups;
}
