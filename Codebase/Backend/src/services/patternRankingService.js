/*
 * Pattern Ranking Service (D23)
 * ------------------------------
 * Cross-reference rank pass that runs AFTER the microservice's structural
 * detection. Loads the pattern_catalog JSONs ourselves, scores each detected
 * pattern using the optional `implementation_template` block, and decides
 * whether the verdict is confident, ambiguous, or weak.
 *
 * Microservice is untouched. Catalogs without the new fields fall back to
 * class_fit only — backwards compatible.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_CATALOG = path.join(PROJECT_ROOT, 'Codebase', 'Microservice', 'pattern_catalog');

const CONFIDENT_THRESHOLD = 0.85;
const AMBIGUITY_DELTA = 0.10;
const NO_CLEAR_PATTERN = 0.50;

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
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const family of families) {
    const familyDir = path.join(root, family);
    const files = fs.readdirSync(familyDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(familyDir, file), 'utf8');
        const json = JSON.parse(raw);
        if (json.pattern_id) entries[json.pattern_id] = json;
      } catch {
        // skip malformed catalog file silently — microservice is the source of truth
      }
    }
  }
  catalogCache = entries;
  return entries;
}

function escapeForRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileShape(shapeRegex, className) {
  const subbed = String(shapeRegex || '').replace(/\{class_name\}/g, escapeForRegex(className));
  try {
    return new RegExp(subbed);
  } catch {
    return null;
  }
}

function scoreSignals(signals, sourceText, className) {
  if (!Array.isArray(signals) || signals.length === 0) return { score: 0, hits: [] };
  let total = 0;
  const hits = [];
  for (const signal of signals) {
    const re = compileShape(signal.shape_regex || signal.name_regex, className);
    if (!re) continue;
    const match = re.exec(sourceText);
    if (match) {
      const weight = typeof signal.weight === 'number' ? signal.weight : 0;
      total += weight;
      hits.push({
        id:        signal.id,
        weight,
        line:      lineOf(sourceText, match.index),
        snippet:   sourceText.slice(match.index, Math.min(sourceText.length, match.index + 80)),
        describe:  signal.describe || ''
      });
    }
  }
  return { score: total, hits };
}

function lineOf(text, index) {
  if (index < 0) return 0;
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function rankPattern(detectedPattern, sourceText) {
  const catalog = loadCatalog();
  const entry = catalog[detectedPattern.patternId];

  // No catalog or no implementation_template → class_fit only (backwards compat).
  const weights = (entry && entry.ranking_weights) || { class_fit: 1.0, implementation_fit: 0.0 };
  const tmpl = entry && entry.implementation_template;
  const className = detectedPattern.className || '';

  const classFit = 1.0; // microservice already matched the class shape

  let implScoreRaw = 0;
  const evidence = { callsites: [], collaborators: [], globalFunctions: [], negativeSignals: [] };

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

// Sort: finalRank desc, then implementationFit desc as tiebreaker.
// Microservice gives binary class_fit=1.0 for all matched patterns, so without
// the impl tiebreaker every multi-pattern run looks "ambiguous" (everyone ties).
function compareRanks(a, b) {
  if (b.finalRank !== a.finalRank) return b.finalRank - a.finalRank;
  return b.implementationFit - a.implementationFit;
}

function effectiveScore(rank) {
  // Used only for ambiguity grouping: leans on implementationFit when finalRanks tie.
  return rank.finalRank + rank.implementationFit * 0.001;
}

function rankAll(detectedPatterns, sourceText) {
  const ranks = (detectedPatterns || []).map(p => rankPattern(p, sourceText));

  const sorted = [...ranks].sort(compareRanks);
  const top = sorted[0] || null;
  const second = sorted[1] || null;

  let verdict = 'no_clear_pattern';
  let ambiguousCandidates = [];

  if (top) {
    const topEff = effectiveScore(top);
    const secondEff = second ? effectiveScore(second) : 0;
    const delta = topEff - secondEff;

    if (top.finalRank >= CONFIDENT_THRESHOLD) {
      verdict = 'confident';
      if (second && delta <= AMBIGUITY_DELTA) {
        verdict = 'ambiguous';
        ambiguousCandidates = sorted
          .filter(r => topEff - effectiveScore(r) <= AMBIGUITY_DELTA)
          .map(r => r.patternId);
      }
    } else if (top.finalRank >= NO_CLEAR_PATTERN) {
      verdict = 'weak';
      if (second && delta <= AMBIGUITY_DELTA) {
        verdict = 'ambiguous';
        ambiguousCandidates = sorted
          .filter(r => topEff - effectiveScore(r) <= AMBIGUITY_DELTA)
          .map(r => r.patternId);
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

function clearCatalogCache() { catalogCache = null; }

module.exports = { rankAll, rankPattern, loadCatalog, clearCatalogCache };
