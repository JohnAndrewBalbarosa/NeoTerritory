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

// Line-coverage probability summary. Surfaced alongside the legacy
// finalRank/implementationFit so the UI can show *why* the score is what it
// is, on a per-line basis. See computeLineEvidence below for the formula.
interface LineEvidence {
  totalLines: number;          // non-blank lines in [scope.min, scope.max]
  taggedLines: number;         // distinct lines with ≥1 hit from THIS pattern
  hitsTotal: number;           // sum of all signal hits for THIS pattern
  hitsMax: number;             // peak overlap on a single line
  rivalHits: number;           // hits on the same lines from OTHER patterns
  negativeHits: number;        // negative-signal hits
  coverage: number;            // taggedLines / totalLines
  odds: number;                // (hitsTotal+1) / (rivalHits+1)
  probability: number;         // computed score, 0-1, dominates UI display
  byLine: Array<{ line: number; ownHits: number; rivalHits: number }>;
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

// Discrete-probability scoring per line.
//
// For each pattern P over a class scope [min, max]:
//   ownHits[ℓ]   = signals from P that matched on line ℓ
//   rivalHits[ℓ] = signals from any OTHER pattern Q that matched on line ℓ
//   tagged       = |{ℓ : ownHits[ℓ] > 0}|
//   total        = non-blank lines in [min, max]
//   coverage     = tagged / total
//   odds         = (Σ ownHits + 1) / (Σ rivalHits + 1)              ← Bayesian smoothing
//   prob_raw     = odds / (odds + 1)                                  ← logistic
//   penalty      = 0.2 × negativeHits / max(1, ownHits)
//   probability  = clamp01(prob_raw × (0.5 + 0.5 × coverage) − penalty)
//
// Why these terms:
//  - The +1 smoothing keeps the score finite when a rival has 0 hits.
//  - Coverage scales the raw odds so a single hot line (high overlap) doesn't
//    dominate over patterns that match more of the class evenly.
//  - Negative signals subtract proportionally — they cap influence near 20%.
function computeLineEvidence(
  ownHits: SignalHit[],
  rivalAllHits: Map<number, number>,
  negativeHits: SignalHit[],
  scopeMin: number,
  scopeMax: number,
  sourceText: string
): LineEvidence {
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
  let rivalHits = 0;
  for (const [line, c] of rivalAllHits.entries()) {
    if (line < scopeMin || line > scopeMax) continue;
    rivalHits += c;
  }
  const totalLines = countNonBlankLines(sourceText, scopeMin, scopeMax) || 1;
  const taggedLines = ownByLine.size;
  const coverage = taggedLines / totalLines;
  const odds = (hitsTotal + 1) / (rivalHits + 1);
  const probRaw = odds / (odds + 1);
  const negCount = negativeHits.length;
  const penalty = hitsTotal > 0 ? 0.2 * (negCount / hitsTotal) : 0;
  const probability = clamp01(probRaw * (0.5 + 0.5 * coverage) - penalty);

  const byLine: Array<{ line: number; ownHits: number; rivalHits: number }> = [];
  for (const [line, ownCount] of ownByLine.entries()) {
    byLine.push({ line, ownHits: ownCount, rivalHits: rivalAllHits.get(line) || 0 });
  }
  byLine.sort((a, b) => a.line - b.line);

  return {
    totalLines,
    taggedLines,
    hitsTotal,
    hitsMax,
    rivalHits,
    negativeHits: negCount,
    coverage,
    odds,
    probability,
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
