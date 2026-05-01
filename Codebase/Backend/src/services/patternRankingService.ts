/*
 * Pattern Ranking Service (D23)
 */
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_CATALOG = path.join(PROJECT_ROOT, 'Codebase', 'Microservice', 'pattern_catalog');

const CONFIDENT_THRESHOLD = 0.85;
const AMBIGUITY_DELTA = 0.10;
const NO_CLEAR_PATTERN = 0.50;

interface Signal {
  id?: string;
  shape_regex?: string;
  name_regex?: string;
  weight?: number;
  describe?: string;
}

interface ImplementationTemplate {
  callsites?: Signal[];
  expected_collaborators?: Signal[];
  global_functions?: Signal[];
  negative_signals?: Signal[];
}

interface RankingWeights {
  class_fit?: number;
  implementation_fit?: number;
}

interface CatalogEntry {
  pattern_id: string;
  ranking_weights?: RankingWeights;
  implementation_template?: ImplementationTemplate;
}

interface SignalHit {
  id?: string;
  weight: number;
  line: number;
  snippet: string;
  describe: string;
}

interface SignalScore {
  score: number;
  hits: SignalHit[];
}

interface DetectedPatternRef {
  patternId: string;
  className?: string;
  // Optional documentation anchors. Their min/max line span is what we use as
  // the class scope for line-coverage scoring. Falls back to whole-file when
  // missing (rankPattern handles it).
  documentationTargets?: Array<{ line?: number }>;
}

// Per-line Bernoulli-trial summary used to compute the Wilson score interval
// lower bound. Surfaced as `lineEvidence` on PatternRankEntry so the UI can
// audit the math against the named statistical sources.
//
// References (cited in the ScoringExplainer panel as well):
//  - Wilson, E. B. (1927). "Probable Inference, the Law of Succession, and
//    Statistical Inference." JASA 22(158): 209-212.
//  - Agresti & Coull (1998). "Approximate is better than 'exact' for interval
//    estimation of binomial proportions." Am. Statistician 52(2): 119-126.
//  - Evan Miller (2009). "How Not to Sort by Average Rating."
//    https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
//  - z = 1.96 is the 97.5th percentile of N(0,1) — the conventional 95% CI
//    z-score (NIST/SEMATECH e-Handbook §1.3.6.7.1).
interface LineEvidence {
  totalLines: number;          // non-blank lines in [scope.min, scope.max] = trial count n
  taggedLines: number;         // distinct lines with ≥1 hit from THIS pattern (informational)
  hitsTotal: number;           // sum of all signal hits for THIS pattern (informational)
  hitsMax: number;             // peak overlap on a single line (informational)
  rivalHits: number;           // hits on the same lines from OTHER patterns (informational)
  negativeHits: number;        // count of negative-signal hits (informational)
  coverage: number;            // taggedLines / totalLines (informational)
  // Wilson score interval inputs and output
  trials: number;              // = totalLines, exposed under stat-friendly name
  successes: number;           // = lines where this pattern wins the per-line trial
  pHat: number;                // successes / trials
  z: number;                   // 1.96 (95% CI two-sided z-score)
  wilsonLowerBound: number;    // the score, in [0, 1]
  probability: number;         // alias for wilsonLowerBound — UI compatibility
  byLine: Array<{ line: number; ownHits: number; rivalHits: number; opposingWeight: number; win: boolean }>;
}

interface PatternRankResult {
  patternId: string;
  classFit: number;
  implementationFit: number;
  finalRank: number;
  weights: RankingWeights;
  evidence: {
    callsites: SignalHit[];
    collaborators: SignalHit[];
    globalFunctions: SignalHit[];
    negativeSignals: SignalHit[];
  };
  hasImplementationTemplate: boolean;
  lineEvidence?: LineEvidence;
}

let catalogCache: Record<string, CatalogEntry> | null = null;

function catalogPath(): string {
  return process.env.NEOTERRITORY_CATALOG || DEFAULT_CATALOG;
}

export function loadCatalog(): Record<string, CatalogEntry> {
  if (catalogCache) return catalogCache;
  const root = catalogPath();
  const entries: Record<string, CatalogEntry> = {};
  if (!fs.existsSync(root)) {
    catalogCache = entries;
    return entries;
  }
  const families = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const family of families) {
    const familyDir = path.join(root, family);
    const files = fs.readdirSync(familyDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(familyDir, file), 'utf8');
        const json = JSON.parse(raw) as CatalogEntry;
        if (json.pattern_id) entries[json.pattern_id] = json;
      } catch {
        // skip malformed catalog file silently
      }
    }
  }
  catalogCache = entries;
  return entries;
}

function escapeForRegex(value: unknown): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileShape(shapeRegex: string | undefined, className: string): RegExp | null {
  const subbed = String(shapeRegex || '').replace(/\{class_name\}/g, escapeForRegex(className));
  try {
    return new RegExp(subbed);
  } catch {
    return null;
  }
}

function lineOf(text: string, index: number): number {
  if (index < 0) return 0;
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function scoreSignals(signals: Signal[] | undefined, sourceText: string, className: string): SignalScore {
  if (!Array.isArray(signals) || signals.length === 0) return { score: 0, hits: [] };
  let total = 0;
  const hits: SignalHit[] = [];
  for (const signal of signals) {
    const re = compileShape(signal.shape_regex || signal.name_regex, className);
    if (!re) continue;
    // Walk every match, not just the first, so per-line overlap counts are
    // accurate. Cap iterations defensively in case a signal regex is greedy.
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const gre = new RegExp(re.source, flags);
    let match: RegExpExecArray | null;
    let safety = 0;
    while ((match = gre.exec(sourceText)) !== null && safety < 500) {
      safety += 1;
      const weight = typeof signal.weight === 'number' ? signal.weight : 0;
      total += weight;
      hits.push({
        id:       signal.id,
        weight,
        line:     lineOf(sourceText, match.index),
        snippet:  sourceText.slice(match.index, Math.min(sourceText.length, match.index + 80)),
        describe: signal.describe || ''
      });
      if (match.index === gre.lastIndex) gre.lastIndex += 1;
    }
  }
  return { score: total, hits };
}

// Count non-blank, non-pure-comment lines as the denominator. Pure-whitespace
// and pure-`//` lines don't tell us anything about pattern coverage.
function countNonBlankLines(sourceText: string, fromLine: number, toLine: number): number {
  if (!Number.isFinite(fromLine) || !Number.isFinite(toLine) || toLine < fromLine) return 0;
  const lines = sourceText.split('\n');
  let count = 0;
  for (let i = fromLine - 1; i <= toLine - 1 && i < lines.length; i += 1) {
    const t = (lines[i] || '').trim();
    if (!t) continue;
    if (t.startsWith('//')) continue;
    count += 1;
  }
  return count;
}

// Wilson score interval — 95% CI lower bound. The only "magic" constant is
// z = 1.96 (the 97.5th percentile of N(0,1)), which is the standard two-sided
// 95%-confidence z-score.
//
//                  pHat + z^2/(2n)  -  z * sqrt( pHat*(1-pHat)/n + z^2/(4n^2) )
//   wilsonLower = ----------------------------------------------------------
//                                       1 + z^2/n
//
// References: Wilson (1927) JASA 22(158); Agresti & Coull (1998) Am. Stat 52(2);
// Evan Miller (2009) "How Not to Sort by Average Rating".
const Z_95 = 1.96;
function wilsonLowerBound(successes: number, trials: number, z: number = Z_95): number {
  if (trials <= 0) return 0;
  const pHat = successes / trials;
  const z2   = z * z;
  const num  = pHat + z2 / (2 * trials)
             - z * Math.sqrt((pHat * (1 - pHat) + z2 / (4 * trials)) / trials);
  const den  = 1 + z2 / trials;
  return clamp01(num / den);
}

function computeLineEvidence(
  ownHits: SignalHit[],
  rivalAllHits: Map<number, number>,
  negativeHits: SignalHit[],
  scopeMin: number,
  scopeMax: number,
  sourceText: string
): LineEvidence {
  // Aggregate own-pattern hits per line for the informational fields.
  const ownByLine = new Map<number, number>();
  for (const h of ownHits) {
    if (h.line < scopeMin || h.line > scopeMax) continue;
    ownByLine.set(h.line, (ownByLine.get(h.line) || 0) + 1);
  }
  let hitsMax = 0;
  let hitsTotal = 0;
  for (const c of ownByLine.values()) {
    hitsTotal += c;
    if (c > hitsMax) hitsMax = c;
  }
  // Catalog-authored absolute weight of negative-signal hits per line. A
  // negative signal with weight -0.4 contributes 0.4 of opposing evidence on
  // its hit line. Nothing is invented at scoring time.
  const negWeightByLine = new Map<number, number>();
  for (const h of negativeHits) {
    if (h.line < scopeMin || h.line > scopeMax) continue;
    const w = Math.abs(typeof h.weight === 'number' ? h.weight : 0);
    negWeightByLine.set(h.line, (negWeightByLine.get(h.line) || 0) + w);
  }
  let rivalHits = 0;
  for (const [line, c] of rivalAllHits.entries()) {
    if (line < scopeMin || line > scopeMax) continue;
    rivalHits += c;
  }

  // Trial set: every non-blank, non-comment line in scope is one Bernoulli
  // trial. Walk the range, classify each line as a win/loss for this pattern.
  const lines = sourceText.split('\n');
  const byLine: Array<{ line: number; ownHits: number; rivalHits: number; opposingWeight: number; win: boolean }> = [];
  let trials = 0;
  let successes = 0;
  for (let l = scopeMin; l <= scopeMax && l - 1 < lines.length; l += 1) {
    const text = (lines[l - 1] || '').trim();
    if (!text || text.startsWith('//')) continue;
    trials += 1;
    const own  = ownByLine.get(l) || 0;
    const riv  = rivalAllHits.get(l) || 0;
    const negW = negWeightByLine.get(l) || 0;
    const opposing = riv + negW;
    const win = own > opposing;
    if (win) successes += 1;
    if (own > 0 || riv > 0 || negW > 0) {
      byLine.push({ line: l, ownHits: own, rivalHits: riv, opposingWeight: negW, win });
    }
  }
  if (trials === 0) trials = 1;  // avoid divide-by-zero on degenerate scopes

  const z = Z_95;
  const wilson = wilsonLowerBound(successes, trials, z);
  const taggedLines = ownByLine.size;

  return {
    totalLines: trials,
    taggedLines,
    hitsTotal,
    hitsMax,
    rivalHits,
    negativeHits: negativeHits.length,
    coverage: taggedLines / trials,
    trials,
    successes,
    pHat: successes / trials,
    z,
    wilsonLowerBound: wilson,
    probability: wilson,
    byLine
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function rankPattern(detectedPattern: DetectedPatternRef, sourceText: string): PatternRankResult {
  const catalog = loadCatalog();
  const entry = catalog[detectedPattern.patternId];

  const weights: RankingWeights = (entry && entry.ranking_weights) || { class_fit: 1.0, implementation_fit: 0.0 };
  const tmpl = entry && entry.implementation_template;
  const className = detectedPattern.className || '';

  const classFit = 1.0;

  let implScoreRaw = 0;
  const evidence = {
    callsites: [] as SignalHit[],
    collaborators: [] as SignalHit[],
    globalFunctions: [] as SignalHit[],
    negativeSignals: [] as SignalHit[]
  };

  if (tmpl) {
    const cs = scoreSignals(tmpl.callsites,              sourceText, className);
    const co = scoreSignals(tmpl.expected_collaborators, sourceText, className);
    const gf = scoreSignals(tmpl.global_functions,       sourceText, className);
    const ns = scoreSignals(tmpl.negative_signals,       sourceText, className);
    implScoreRaw = cs.score + co.score + gf.score + ns.score;
    evidence.callsites      = cs.hits;
    evidence.collaborators  = co.hits;
    evidence.globalFunctions = gf.hits;
    evidence.negativeSignals = ns.hits;
  }

  const implementationFit = clamp01(implScoreRaw);
  const finalRank = clamp01(
    (weights.class_fit || 0) * classFit +
    (weights.implementation_fit || 0) * implementationFit
  );

  return {
    patternId: detectedPattern.patternId,
    classFit,
    implementationFit,
    finalRank,
    weights,
    evidence,
    hasImplementationTemplate: Boolean(tmpl)
  };
}

function compareRanks(a: PatternRankResult, b: PatternRankResult): number {
  if (b.finalRank !== a.finalRank) return b.finalRank - a.finalRank;
  return b.implementationFit - a.implementationFit;
}

function effectiveScore(rank: PatternRankResult): number {
  return rank.finalRank + rank.implementationFit * 0.001;
}

interface RankingOutcome {
  ranks: PatternRankResult[];
  verdict: string;
  leadingPatternId: string | null;
  ambiguousCandidates: string[];
  thresholds: {
    confident: number;
    ambiguityDelta: number;
    noClearPattern: number;
  };
}

function deriveScope(ref: DetectedPatternRef, sourceText: string): { min: number; max: number } {
  const ts = ref.documentationTargets || [];
  let min = Infinity;
  let max = -Infinity;
  for (const t of ts) {
    if (typeof t.line !== 'number') continue;
    if (t.line < min) min = t.line;
    if (t.line > max) max = t.line;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const totalLines = sourceText.split('\n').length;
    return { min: 1, max: Math.max(1, totalLines) };
  }
  return { min, max };
}

export function rankAll(detectedPatterns: DetectedPatternRef[] | undefined, sourceText: string): RankingOutcome {
  const refs = detectedPatterns || [];
  const ranks = refs.map((p) => rankPattern(p, sourceText));

  // Stitch line-coverage probability onto each rank. We need every other
  // pattern's hits to compute the rival count for the focus pattern, hence
  // this second pass after rankPattern has populated each evidence bag.
  refs.forEach((ref, idx) => {
    const own = ranks[idx];
    const ownLines: SignalHit[] = [
      ...own.evidence.callsites,
      ...own.evidence.collaborators,
      ...own.evidence.globalFunctions
    ];
    const rivalByLine = new Map<number, number>();
    ranks.forEach((other, j) => {
      if (j === idx) return;
      const hits = [
        ...other.evidence.callsites,
        ...other.evidence.collaborators,
        ...other.evidence.globalFunctions
      ];
      for (const h of hits) {
        rivalByLine.set(h.line, (rivalByLine.get(h.line) || 0) + 1);
      }
    });
    const scope = deriveScope(ref, sourceText);
    own.lineEvidence = computeLineEvidence(
      ownLines,
      rivalByLine,
      own.evidence.negativeSignals,
      scope.min,
      scope.max,
      sourceText
    );
    // Promote the line-evidence probability into implementationFit so the
    // UI shows the new score by default. finalRank still combines weights.
    own.implementationFit = own.lineEvidence.probability;
    own.finalRank = clamp01(
      (own.weights.class_fit || 0) * own.classFit +
      (own.weights.implementation_fit || 0) * own.lineEvidence.probability
    );
  });

  const sorted = [...ranks].sort(compareRanks);
  const top = sorted[0] || null;
  const second = sorted[1] || null;

  let verdict = 'no_clear_pattern';
  let ambiguousCandidates: string[] = [];

  if (top) {
    const topEff = effectiveScore(top);
    const secondEff = second ? effectiveScore(second) : 0;
    const delta = topEff - secondEff;

    if (top.finalRank >= CONFIDENT_THRESHOLD) {
      verdict = 'confident';
      if (second && delta <= AMBIGUITY_DELTA) {
        verdict = 'ambiguous';
        ambiguousCandidates = sorted
          .filter((r) => topEff - effectiveScore(r) <= AMBIGUITY_DELTA)
          .map((r) => r.patternId);
      }
    } else if (top.finalRank >= NO_CLEAR_PATTERN) {
      verdict = 'weak';
      if (second && delta <= AMBIGUITY_DELTA) {
        verdict = 'ambiguous';
        ambiguousCandidates = sorted
          .filter((r) => topEff - effectiveScore(r) <= AMBIGUITY_DELTA)
          .map((r) => r.patternId);
      }
    }
  }

  return {
    ranks: sorted,
    verdict,
    leadingPatternId: top ? top.patternId : null,
    ambiguousCandidates,
    thresholds: {
      confident: CONFIDENT_THRESHOLD,
      ambiguityDelta: AMBIGUITY_DELTA,
      noClearPattern: NO_CLEAR_PATTERN
    }
  };
}

export function clearCatalogCache(): void {
  catalogCache = null;
}
