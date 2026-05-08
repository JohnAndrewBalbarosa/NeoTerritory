// Wilson 95%-confidence lower bound on a Bernoulli proportion.
// Mirrors the formula displayed in PatternCards' ScoringExplainerBanner so
// client-side recomputes (after a user picks a rival pattern) line up exactly
// with how the server-side ranking is presented.
export const WILSON_Z = 1.96;

export function wilsonLowerBound(k: number, n: number, z: number = WILSON_Z): number {
  if (!Number.isFinite(k) || !Number.isFinite(n) || n <= 0) return 0;
  const pHat = k / n;
  const z2 = z * z;
  const numerator = pHat + z2 / (2 * n) - z * Math.sqrt(pHat * (1 - pHat) / n + z2 / (4 * n * n));
  const denominator = 1 + z2 / n;
  const lb = numerator / denominator;
  if (!Number.isFinite(lb)) return 0;
  return Math.max(0, Math.min(1, lb));
}
