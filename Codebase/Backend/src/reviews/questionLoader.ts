import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

function resolveXmlPath(): string {
  const candidates = [
    path.join(__dirname, 'questions.xml'),
    path.resolve(__dirname, '../../../src/reviews/questions.xml'),
    path.resolve(__dirname, '../../src/reviews/questions.xml')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]!;
}

const XML_PATH = resolveXmlPath();
const SUPPORTED_TYPES = new Set(['rating', 'text', 'choice']);

interface ChoiceOption { value: string; label: string }

interface NormalizedQuestion {
  id: string;
  type: string;
  prompt: string;
  required: boolean;
  max?: number;
  maxLength?: number;
  options?: ChoiceOption[];
}

interface SchemaCache {
  version: string;
  scopes: Record<string, NormalizedQuestion[]>;
}

let cache: SchemaCache = { version: '0', scopes: {} };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true
});

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return false;
}

function normalizeQuestion(q: Record<string, unknown>): NormalizedQuestion {
  if (!q || !q.id || !q.type || !SUPPORTED_TYPES.has(String(q.type)) || !q.prompt) {
    throw new Error(`invalid question: ${JSON.stringify(q)}`);
  }
  const out: NormalizedQuestion = {
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
    out.options = asArray<Record<string, unknown>>(q.option as Record<string, unknown> | Record<string, unknown>[] | undefined).map((opt) => ({
      value: String(opt.value || opt['#text'] || ''),
      label: String(opt['#text'] || opt.value || '')
    })).filter((o) => o.value);
    if (!out.options.length) throw new Error(`choice ${out.id} needs <option>`);
  }
  return out;
}

function parseXmlText(xml: string): SchemaCache {
  const root = parser.parse(xml) as Record<string, unknown>;
  const doc = root.reviewQuestions as Record<string, unknown> | undefined;
  if (!doc) throw new Error('missing <reviewQuestions> root');
  const version = String(doc.version || '0');
  const scopes: Record<string, NormalizedQuestion[]> = {};
  for (const scope of asArray<Record<string, unknown>>(doc.scope as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
    if (!scope.id) throw new Error('scope missing id');
    const questions = asArray<Record<string, unknown>>(scope.question as Record<string, unknown> | Record<string, unknown>[] | undefined).map(normalizeQuestion);
    scopes[String(scope.id)] = questions;
  }
  return { version, scopes };
}

export function reload(): void {
  try {
    const xml = fs.readFileSync(XML_PATH, 'utf8');
    const parsed = parseXmlText(xml);
    cache = parsed;
    console.log(`[reviews] loaded questions schema v${parsed.version} (${Object.keys(parsed.scopes).length} scopes)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[reviews] failed to reload questions.xml — keeping last good schema:`, msg);
  }
}

export function startWatching(): void {
  reload();
  try {
    let timer: NodeJS.Timeout | null = null;
    fs.watch(XML_PATH, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reload, 250);
    });
  } catch {
    console.warn('[reviews] fs.watch unavailable; schema will not hot-reload');
  }
}

export function getQuestions(scope: string): NormalizedQuestion[] {
  return cache.scopes[scope] || [];
}

export function getSchemaVersion(): string {
  return cache.version;
}

export function listScopes(): string[] {
  return Object.keys(cache.scopes);
}

interface ValidationResult {
  ok: boolean;
  error?: string;
  cleaned?: Record<string, string | number>;
}

export function validateAnswers(scope: string, answers: Record<string, unknown> | undefined): ValidationResult {
  const questions = getQuestions(scope);
  if (!questions.length) return { ok: false, error: `unknown scope: ${scope}` };
  const errors: string[] = [];
  const cleaned: Record<string, string | number> = {};
  for (const q of questions) {
    const raw = answers ? answers[q.id] : undefined;
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (q.required) errors.push(`${q.id} is required`);
      continue;
    }
    if (q.type === 'rating') {
      const n = Number(raw);
      const max = q.max ?? 0;
      if (!Number.isInteger(n) || n < 1 || n > max) {
        errors.push(`${q.id} must be integer in [1,${max}]`);
        continue;
      }
      cleaned[q.id] = n;
    } else if (q.type === 'text') {
      const s = String(raw);
      const maxLength = q.maxLength ?? 1000;
      if (s.length > maxLength) {
        errors.push(`${q.id} exceeds maxLength ${maxLength}`);
        continue;
      }
      cleaned[q.id] = s;
    } else if (q.type === 'choice') {
      const opts = q.options ?? [];
      const valid = opts.some((o) => o.value === String(raw));
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
