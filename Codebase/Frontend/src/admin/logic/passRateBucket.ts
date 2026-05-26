export type PassBucket = 'high' | 'mid' | 'low' | 'none';

// Heatmap cell bucket from first-try pass rate. `seen` 0 means no learner has
// answered this question yet → 'none' (grey cell), distinct from a 0% pass.
export function passRateBucket(passRate: number, seen: number): PassBucket {
  if (seen <= 0) return 'none';
  if (passRate >= 0.8) return 'high';
  if (passRate >= 0.5) return 'mid';
  return 'low';
}
