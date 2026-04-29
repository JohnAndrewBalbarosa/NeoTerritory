const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const XML_PATH = path.join(__dirname, 'questions.xml');
const SUPPORTED_TYPES = new Set(['rating', 'text', 'choice']);

let cache = { version: '0', scopes: {} };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true
});

function asArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return false;
}

function normalizeQuestion(q) {
  if (!q || !q.id || !q.type || !SUPPORTED_TYPES.has(q.type) || !q.prompt) {
    throw new Error(`invalid question: ${JSON.stringify(q)}`);
  }
  const out = {
    id: String(q.id),
    type: String(q.type),
    prompt: String(q.prompt).trim(),
    required: parseBool(q.required)
  };
  if (out.type === 'rating') {
    const max = Number(q.max);
    if (!Number.isInteger(max) || max < 2 || max > 10) {
      throw new Error(`rating ${out.id} needs integer max in [2,10]`);
    }
    out.max = max;
  } else if (out.type === 'text') {
    const maxLength = q.maxLength ? Number(q.maxLength) : 1000;
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 5000) {
      throw new Error(`text ${out.id} needs integer maxLength in [1,5000]`);
    }
    out.maxLength = maxLength;
  } else if (out.type === 'choice') {
    out.options = asArray(q.option).map(opt => ({
      value: String(opt.value || opt['#text'] || ''),
      label: String(opt['#text'] || opt.value || '')
    })).filter(o => o.value);
    if (!out.options.length) throw new Error(`choice ${out.id} needs <option>`);
  }
  return out;
}

function parseXmlText(xml) {
  const root = parser.parse(xml);
  const doc = root.reviewQuestions;
  if (!doc) throw new Error('missing <reviewQuestions> root');
  const version = String(doc.version || '0');
  const scopes = {};
  for (const scope of asArray(doc.scope)) {
    if (!scope.id) throw new Error('scope missing id');
    const questions = asArray(scope.question).map(normalizeQuestion);
    scopes[String(scope.id)] = questions;
  }
  return { version, scopes };
}

function reload() {
  try {
    const xml = fs.readFileSync(XML_PATH, 'utf8');
    const parsed = parseXmlText(xml);
    cache = parsed;
    // eslint-disable-next-line no-console
    console.log(`[reviews] loaded questions schema v${parsed.version} (${Object.keys(parsed.scopes).length} scopes)`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[reviews] failed to reload questions.xml — keeping last good schema:`, err.message);
  }
}

function startWatching() {
  reload();
  try {
    let timer = null;
    fs.watch(XML_PATH, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reload, 250);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[reviews] fs.watch unavailable; schema will not hot-reload');
  }
}

function getQuestions(scope) {
  return cache.scopes[scope] || [];
}

function getSchemaVersion() {
  return cache.version;
}

function listScopes() {
  return Object.keys(cache.scopes);
}

function validateAnswers(scope, answers) {
  const questions = getQuestions(scope);
  if (!questions.length) return { ok: false, error: `unknown scope: ${scope}` };
  const errors = [];
  const cleaned = {};
  for (const q of questions) {
    const raw = answers ? answers[q.id] : undefined;
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (q.required) errors.push(`${q.id} is required`);
      continue;
    }
    if (q.type === 'rating') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > q.max) {
        errors.push(`${q.id} must be integer in [1,${q.max}]`);
        continue;
      }
      cleaned[q.id] = n;
    } else if (q.type === 'text') {
      const s = String(raw);
      if (s.length > q.maxLength) {
        errors.push(`${q.id} exceeds maxLength ${q.maxLength}`);
        continue;
      }
      cleaned[q.id] = s;
    } else if (q.type === 'choice') {
      const valid = q.options.some(o => o.value === String(raw));
      if (!valid) {
        errors.push(`${q.id} must be one of declared options`);
        continue;
      }
      cleaned[q.id] = String(raw);
    }
  }
  if (errors.length) return { ok: false, error: errors.join('; ') };
  return { ok: true, cleaned };
}

module.exports = {
  startWatching,
  reload,
  getQuestions,
  getSchemaVersion,
  listScopes,
  validateAnswers
};
