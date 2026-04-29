/*
 * Pattern Ranking Service (D29)
 * -----------------------------
 * Cross-reference rank pass that runs AFTER the microservice's structural
 * detection. Loads the pattern_catalog JSONs, evaluates each detected pattern's
 * `evidence_rules` against the source via the evidenceEvaluator, then assigns:
 *
 *   classFit          = 1.0 (microservice already matched the class shape)
 *   implementationFit = fraction of positive evidence rules that fired,
 *                       plus half-credit for satisfied negative rules
 *   finalRank         = weighted combination of the above
 *
 * Verdict logic:
 *   - top.finalRank >= CONFIDENT_THRESHOLD AND no near-tie -> 'confident'
 *   - top.finalRank >= NO_CLEAR_PATTERN     AND no near-tie -> 'weak'
 *   - near-tie (delta <= AMBIGUITY_DELTA)                  -> 'ambiguous'
 *   - else                                                  -> 'no_clear_pattern'
 *
 * Per-class disambiguation: when multiple patterns match the SAME class, only the
 * highest-implementationFit candidate per class survives the deduplication step.
 * That's the user's "highest score wins" rule for tie-breakers.
 */
const fs = require('fs');
const path = require('path');
const { evaluatePattern } = require('./evidenceEvaluator');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_CATALOG = path.join(PROJECT_ROOT, 'Codebase', 'Microservice', 'pattern_catalog');

const CONFIDENT_THRESHOLD = 0.75;
const AMBIGUITY_DELTA     = 0.10;
const NO_CLEAR_PATTERN    = 0.40;

let catalogCache = null;

function catalogPath() {
  return process.env.NEOTERRITORY_CATALOG || DEFAULT_CATALOG;
}

function loadCatalog() {
  if (catalogCache) return catalogCache;
  const root = catalogPath();
  const entries = {};
  if (!fs.existsSync(root)) {
    catalogCache = entries;
    return entries;
  }
  const families = fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  for (const family of families) {
    const familyDir = path.join(root, family);
    const files = fs.readdirSync(familyDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const json = JSON.parse(fs.readFileSync(path.join(familyDir, file), 'utf8'));
        if (json.pattern_id) entries[json.pattern_id] = json;
      } catch { /* skip malformed; microservice is source of truth */ }
    }
  }
  catalogCache = entries;
  return entries;
}

function clamp01(v) { return Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, v)); }

function rankPattern(detectedPattern, sourceText) {
  const catalog = loadCatalog();
  const entry = catalog[detectedPattern.patternId];
  const result = evaluatePattern(detectedPattern, entry, sourceText);

  // class_fit is binary 1.0 by definition (microservice matched the class shape).
  // We blend at 30/70 — the discretized evidence carries the verdict.
  const classFit = 1.0;
  const implementationFit = clamp01(result.implementationFit);
  const finalRank = clamp01(0.30 * classFit + 0.70 * implementationFit);

  return {
    patternId:           detectedPattern.patternId,
    className:           detectedPattern.className,
    classFit,
    implementationFit,
    finalRank,
    evidence: { fired: result.fired, missed: result.missed },
    hasEvidenceRules: result.hasEvidenceRules
  };
}

function compareRanks(a, b) {
  if (b.finalRank !== a.finalRank) return b.finalRank - a.finalRank;
  return b.implementationFit - a.implementationFit;
}

/**
 * Per-class winner: among ranks for the same className, keep only the highest finalRank.
 * Ties within a class are exposed via `perClassRivals` for the UI's disambiguator.
 */
function pickPerClassWinners(ranks) {
  const byClass = new Map();
  for (const r of ranks) {
    const key = r.className || '__nameless__';
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(r);
  }
  const winners = [];
  const perClassRivals = {};
  for (const [cls, list] of byClass) {
    list.sort(compareRanks);
    const top = list[0];
    winners.push(top);
    // Rivals = other candidates within AMBIGUITY_DELTA of the leader for THIS class.
    const rivals = list.slice(1).filter(r => top.finalRank - r.finalRank <= AMBIGUITY_DELTA);
    if (rivals.length) {
      perClassRivals[cls] = [top.patternId, ...rivals.map(r => r.patternId)];
    }
  }
  return { winners, perClassRivals };
}

function rankAll(detectedPatterns, sourceText) {
  const allRanks = (detectedPatterns || []).map(p => rankPattern(p, sourceText));
  const { winners, perClassRivals } = pickPerClassWinners(allRanks);

  const sortedWinners = [...winners].sort(compareRanks);
  const top = sortedWinners[0] || null;
  const second = sortedWinners[1] || null;

  let verdict = 'no_clear_pattern';
  let ambiguousCandidates = [];

  if (top) {
    const delta = second ? top.finalRank - second.finalRank : Infinity;
    if (top.finalRank >= CONFIDENT_THRESHOLD) {
      verdict = delta <= AMBIGUITY_DELTA ? 'ambiguous' : 'confident';
    } else if (top.finalRank >= NO_CLEAR_PATTERN) {
      verdict = delta <= AMBIGUITY_DELTA ? 'ambiguous' : 'weak';
    }
    if (verdict === 'ambiguous') {
      ambiguousCandidates = sortedWinners
        .filter(r => top.finalRank - r.finalRank <= AMBIGUITY_DELTA)
        .map(r => r.patternId);
    }
  }

  return {
    ranks: allRanks.sort(compareRanks),
    winners: sortedWinners,
    perClassRivals,
    verdict,
    leadingPatternId: top ? top.patternId : null,
    leadingClassName: top ? top.className : null,
    ambiguousCandidates,
    thresholds: {
      confident:      CONFIDENT_THRESHOLD,
      ambiguityDelta: AMBIGUITY_DELTA,
      noClearPattern: NO_CLEAR_PATTERN
    }
  };
}

function clearCatalogCache() { catalogCache = null; }

module.exports = { rankAll, rankPattern, loadCatalog, clearCatalogCache };
