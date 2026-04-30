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
    const match = re.exec(sourceText);
    if (match) {
      const weight = typeof signal.weight === 'number' ? signal.weight : 0;
      total += weight;
      hits.push({
        id:       signal.id,
        weight,
        line:     lineOf(sourceText, match.index),
        snippet:  sourceText.slice(match.index, Math.min(sourceText.length, match.index + 80)),
        describe: signal.describe || ''
      });
    }
  }
  return { score: total, hits };
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

export function rankAll(detectedPatterns: DetectedPatternRef[] | undefined, sourceText: string): RankingOutcome {
  const ranks = (detectedPatterns || []).map((p) => rankPattern(p, sourceText));

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
