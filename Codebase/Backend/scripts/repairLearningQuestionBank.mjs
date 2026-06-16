#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';

const BLOOM_TAXONOMIES = ['remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating'];
const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const dbArg = process.argv.find((arg) => arg.startsWith('--db='));
const dbPath = path.resolve(dbArg ? dbArg.slice('--db='.length) : 'src/db/database.sqlite');
const seedPath = path.resolve('src/db/seeds/learningModules.seed.json');

function usage() {
  console.log([
    'Usage: npm run repair:question-bank -- [--db=src/db/database.sqlite] [--write]',
    '',
    'Default mode is dry-run. Pass --write to update SQLite and mirror changed rows when Supabase env is configured.',
  ].join('\n'));
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function isMcq(question) {
  return question && typeof question === 'object' && Array.isArray(question.options);
}

function canonicalShape(question) {
  if (!question || typeof question !== 'object') return null;
  if (question.type === 'identification') {
    if (!question.question || !question.scenario || !Array.isArray(question.expectedTokens)) return null;
    return { ...question, type: 'identification' };
  }
  if (question.type === 'studio') {
    if (!question.prompt || !question.targetPatternSlug) return null;
    return { ...question, type: 'studio' };
  }
  if (isMcq(question)) {
    return { ...question, type: 'mcq' };
  }
  return null;
}

function repairTheory(existingTheory, canonicalTheory) {
  const canonicalQuestions = canonicalTheory?.questions || [];
  if (canonicalQuestions.length === 0) return { theory: existingTheory, changed: false, reasons: [] };

  const existingQuestions = Array.isArray(existingTheory?.questions) ? existingTheory.questions : [];
  const repaired = [];
  const reasons = [];

  for (const question of existingQuestions) {
    const shaped = canonicalShape(question);
    if (!shaped) {
      reasons.push('dropped invalid question');
      continue;
    }
    if (shaped !== question || shaped.type !== question.type) reasons.push('normalized legacy question type');
    repaired.push(shaped);
  }

  for (const taxonomy of BLOOM_TAXONOMIES) {
    const hasSlot = repaired.some((question) => question.taxonomy === taxonomy);
    if (hasSlot) continue;
    const fallback = canonicalQuestions.find((question) => question.taxonomy === taxonomy);
    if (fallback) {
      repaired.push(fallback);
      reasons.push(`added ${taxonomy}`);
    }
  }

  const nextTheory = { kind: 'theoretical', questions: repaired };
  const changed = JSON.stringify(existingTheory || null) !== JSON.stringify(nextTheory);
  return { theory: nextTheory, changed, reasons };
}

async function mirrorLearningModule(row, theoreticalJson) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  if (!supabaseUrl || !supabaseKey) return false;

  const payload = {
    module_id: row.module_id,
    category: row.category,
    title: row.title,
    eyebrow: row.eyebrow,
    intro: row.intro,
    sections_json: parseJson(row.sections_json, []),
    key_terms_json: parseJson(row.key_terms_json, []),
    summary: row.summary,
    see_also_json: parseJson(row.see_also_json, []),
    theoretical_json: theoreticalJson,
    practical_json: parseJson(row.practical_json, null),
    published: row.published,
    auto_tag: row.auto_tag,
    sort_order: row.sort_order,
    is_seed: row.is_seed,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/learning_modules?on_conflict=module_id`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase mirror failed for ${row.module_id}: ${res.status} ${text.slice(0, 200)}`);
  }
  return true;
}

if (!fs.existsSync(seedPath)) throw new Error(`Seed file not found: ${seedPath}`);
if (!fs.existsSync(dbPath)) throw new Error(`SQLite DB not found: ${dbPath}`);

const seedRows = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const canonicalById = new Map(seedRows.map((row) => [row.moduleId, row]));
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
const rows = db.prepare(`
  SELECT module_id, category, title, eyebrow, intro, sections_json, key_terms_json,
         summary, see_also_json, theoretical_json, practical_json,
         published, auto_tag, sort_order, is_seed
  FROM learning_modules
`).all();

const changes = [];
for (const row of rows) {
  const canonical = canonicalById.get(row.module_id);
  if (!canonical) continue;
  const existingTheory = parseJson(row.theoretical_json, null);
  const { theory, changed, reasons } = repairTheory(existingTheory, canonical.theoreticalExam);
  if (changed) changes.push({ row, theory, reasons });
}

console.log(`[repair-question-bank] ${changes.length} module(s) need repair out of ${rows.length}. mode=${write ? 'write' : 'dry-run'}`);
for (const change of changes) {
  console.log(`- ${change.row.module_id}: ${Array.from(new Set(change.reasons)).join(', ')}`);
}

if (!write || changes.length === 0) {
  if (!write) console.log('[repair-question-bank] dry-run only; rerun with --write to mutate SQLite.');
  db.close();
  process.exit(0);
}

const update = db.prepare(`
  UPDATE learning_modules
  SET theoretical_json = ?, updated_at = datetime('now')
  WHERE module_id = ?
`);
const setCourseUpdated = db.prepare(`
  INSERT INTO app_settings(key, value, updated_at)
  VALUES ('course_updated_at', ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
`);

const tx = db.transaction((items) => {
  for (const item of items) {
    update.run(JSON.stringify(item.theory), item.row.module_id);
  }
  setCourseUpdated.run(new Date().toISOString());
});
tx(changes);

let mirrored = 0;
for (const change of changes) {
  if (await mirrorLearningModule(change.row, change.theory)) mirrored += 1;
}
db.close();

console.log(`[repair-question-bank] updated ${changes.length} module(s); mirrored ${mirrored} to Supabase.`);
