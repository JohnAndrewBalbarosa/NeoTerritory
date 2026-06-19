import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import type { Database } from 'better-sqlite3';
import db from './database';
import { initEtlSchema } from './etlSchema';
import { mirrorRow } from '../services/supabaseLogger';
// TEST SEED — REMOVE FOR PRODUCTION (delete _testSeed/ + this import + the calls below)
import { seedDevconUsers, ensureTestFolders } from './_testSeed/devconUsers';

const DEFAULT_ADMIN_USERNAME = 'Neoterritory';
const DEFAULT_ADMIN_PASSWORD = 'ragabag123';

interface PragmaColumnRow { name: string }
interface UserAdminRow { id: number; role: string }

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as PragmaColumnRow[];
  return rows.some((r) => r.name === column);
}

function seedAdminAccount(): void {
  const username = process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD
    || process.env.SEED_ADMIN_PASSWORD
    || DEFAULT_ADMIN_PASSWORD;
  const email = `${username.toLowerCase()}@neoterritory.local`;
  const hash = bcrypt.hashSync(password, 10);

  let existing = db
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(username) as UserAdminRow | undefined;

  if (!existing) {
    db.prepare(
      `INSERT OR IGNORE INTO users (username, email, password_hash, role, created_at)
       VALUES (?, ?, ?, 'admin', datetime('now'))`
    ).run(username, email, hash);
    existing = db
      .prepare('SELECT id, role FROM users WHERE username = ?')
      .get(username) as UserAdminRow | undefined;
  }

  if (existing) {
    // Idempotent upsert: ensure role is admin and password matches env.
    db.prepare(`UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?`)
      .run(hash, existing.id);
  }
}

// PILOT FIXTURE ONLY — explicitly not a production fallback. Seeds a DEDICATED
// pilot LEARNER (role 'user', NOT the admin) that owns one active plan with the
// two form-authored pilot modules approved. Production plans must be created
// through the plan API; the formal-assessment scope never falls back here.
const PILOT_PLAN_ID = 'pilot-plan-001';
const PILOT_LEARNER_USERNAME = 'pilot-learner';
const PILOT_LEARNER_EMAIL = 'pilot-learner@neoterritory.local';
const PILOT_PLAN_MODULES: ReadonlyArray<string> = ['foundations-what-is-pattern', 'creational-builder'];

function seedPilotLearnerAndPlan(): void {
  // Dedicated learner account. Its password is a random DISABLED hash so it can
  // never be used via normal /auth/login; the only entry point is the dev-gated
  // /auth/pilot-login endpoint. Idempotent → stable user id across boots.
  let learner = db
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(PILOT_LEARNER_USERNAME) as UserAdminRow | undefined;
  if (!learner) {
    const disabledHash = bcrypt.hashSync(`disabled_${Math.random().toString(36).slice(2)}`, 10);
    db.prepare(
      `INSERT OR IGNORE INTO users (username, email, password_hash, role, created_via, created_at)
       VALUES (?, ?, ?, 'user', 'pilot', datetime('now'))`,
    ).run(PILOT_LEARNER_USERNAME, PILOT_LEARNER_EMAIL, disabledHash);
    learner = db
      .prepare('SELECT id, role FROM users WHERE username = ?')
      .get(PILOT_LEARNER_USERNAME) as UserAdminRow;
  }
  if (!learner) return;

  // Plan owned by the pilot LEARNER (reassign from any prior owner, e.g. admin).
  let existing = db
    .prepare('SELECT id, learner_id FROM learning_plans WHERE id = ?')
    .get(PILOT_PLAN_ID) as { id: string; learner_id: number } | undefined;
  if (!existing) {
    db.prepare(
      `INSERT OR IGNORE INTO learning_plans (id, learner_id, status, created_at, updated_at, activated_at)
       VALUES (?, ?, 'active', datetime('now'), datetime('now'), datetime('now'))`,
    ).run(PILOT_PLAN_ID, learner.id);
    existing = db
      .prepare('SELECT id, learner_id FROM learning_plans WHERE id = ?')
      .get(PILOT_PLAN_ID) as { id: string; learner_id: number } | undefined;
  }
  if (existing && existing.learner_id !== learner.id) {
    db.prepare(
      `UPDATE learning_plans SET learner_id = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`,
    ).run(learner.id, PILOT_PLAN_ID);
  }
  const insMod = db.prepare(
    `INSERT OR IGNORE INTO learning_plan_modules (plan_id, module_id, selection_status, recommendation_source, display_order, created_at)
     VALUES (?, ?, 'approved', 'system', ?, datetime('now'))`,
  );
  PILOT_PLAN_MODULES.forEach((moduleId, i) => insMod.run(PILOT_PLAN_ID, moduleId, i));
}

// One module row in the checked-in seed JSON (produced by
// scripts/dump-learning-seed.mjs from the frontend LEARNING_MODULES). moduleId
// + sortOrder are load-bearing (see D92). Sub-objects are passed through and
// re-serialized verbatim, so practicalExam.passMode rides along unchanged.
interface LearningModuleSeedRow {
  moduleId: string;
  category: string;
  title: string;
  eyebrow?: string;
  intro?: string;
  sections?: unknown;
  keyTerms?: unknown;
  summary?: string | null;
  seeAlso?: unknown;
  theoreticalExam?: unknown;
  practicalExam?: unknown;
  sortOrder?: number;
}

// Resolve the seed JSON across dev (tsx/ts-node from src/) and prod (compiled
// dist/). tsc does NOT copy non-.ts assets, so the file lives only under
// src/db/seeds; from a dist/ build we hop back to src/. Returns the first
// existing candidate, else null.
function resolveLearningSeedPath(): string | null {
  const candidates = [
    path.join(__dirname, 'seeds', 'learningModules.seed.json'),
    // From compiled dist/db → repo src/db/seeds.
    path.join(__dirname, '..', '..', 'src', 'db', 'seeds', 'learningModules.seed.json'),
    path.join(__dirname, '..', '..', '..', 'src', 'db', 'seeds', 'learningModules.seed.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Read + parse the checked-in learning seed JSON into rows. Returns null when
// the file is missing or unreadable (callers log + skip gracefully) and []
// when it parses to a non-array. Shared by seedLearningModulesIfEmpty (empty-
// table full seed) and ensureSeedLearningModules (additive insert-missing).
function readLearningSeedRows(): LearningModuleSeedRow[] | null {
  const seedPath = resolveLearningSeedPath();
  if (!seedPath) {
    // eslint-disable-next-line no-console
    console.warn('[initDb] learning seed JSON not found — skipping learning_modules seed');
    return null;
  }
  try {
    const raw = fs.readFileSync(seedPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LearningModuleSeedRow[]) : [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[initDb] failed to read/parse learning seed JSON — skipping:', err);
    return null;
  }
}

// Seed learning_modules from the checked-in JSON, but ONLY when the table is
// empty. Once seeded, content is admin-owned (the CMS) — we never overwrite
// instructor edits on a later boot. If the seed file is missing we log and skip
// gracefully (the public GET falls back to the bundled static modules client-
// side). Each inserted row is also mirrored to Supabase (best-effort).
export function seedLearningModulesIfEmpty(database: Database): void {
  try {
    const existing = database
      .prepare(`SELECT COUNT(*) AS n FROM learning_modules`)
      .get() as { n: number } | undefined;
    if ((existing?.n ?? 0) > 0) return; // already seeded — never overwrite

    const rows = readLearningSeedRows();
    if (!rows || rows.length === 0) return;

    const insert = database.prepare(`
      INSERT OR IGNORE INTO learning_modules (
        module_id, category, title, eyebrow, intro,
        sections_json, key_terms_json, summary, see_also_json,
        theoretical_json, practical_json,
        published, auto_tag, sort_order, is_seed, created_at, updated_at
      ) VALUES (
        @module_id, @category, @title, @eyebrow, @intro,
        @sections_json, @key_terms_json, @summary, @see_also_json,
        @theoretical_json, @practical_json,
        @published, 1, @sort_order, 1, datetime('now'), datetime('now')
      )
    `);

    const insertAll = database.transaction((seedRows: LearningModuleSeedRow[]) => {
      for (const r of seedRows) {
        if (!r || typeof r.moduleId !== 'string' || !r.moduleId) continue;
        insert.run({
          module_id: r.moduleId,
          category: r.category,
          title: r.title,
          eyebrow: r.eyebrow ?? '',
          intro: r.intro ?? '',
          sections_json: JSON.stringify(r.sections ?? []),
          key_terms_json: JSON.stringify(r.keyTerms ?? []),
          summary: r.summary ?? null,
          see_also_json: JSON.stringify(r.seeAlso ?? []),
          theoretical_json: r.theoreticalExam ? JSON.stringify(r.theoreticalExam) : null,
          practical_json: r.practicalExam ? JSON.stringify(r.practicalExam) : null,
          published: r.category === 'foundations' ? 1 : 0,
          sort_order: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
        });
      }
    });
    insertAll(rows);

    // Mirror each seeded row to Supabase (best-effort; JSON fields as JS objects
    // so PostgREST stores jsonb). Keyed by module_id (UPSERT_BY_PK).
    const nowIso = new Date().toISOString();
    for (const r of rows) {
      if (!r || typeof r.moduleId !== 'string' || !r.moduleId) continue;
      mirrorRow('learning_modules', {
        module_id: r.moduleId,
        category: r.category,
        title: r.title,
        eyebrow: r.eyebrow ?? '',
        intro: r.intro ?? '',
        sections_json: r.sections ?? [],
        key_terms_json: r.keyTerms ?? [],
        summary: r.summary ?? null,
        see_also_json: r.seeAlso ?? [],
        theoretical_json: r.theoreticalExam ?? null,
        practical_json: r.practicalExam ?? null,
        published: r.category === 'foundations' ? 1 : 0,
        auto_tag: 1,
        sort_order: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
        is_seed: 1,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    // eslint-disable-next-line no-console
    console.log(`[initDb] seeded ${rows.length} learning modules from learningModules.seed.json`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[initDb] seedLearningModulesIfEmpty skipped:', err);
  }
}

// Additively insert any seed module whose module_id is NOT already present.
//
// seedLearningModulesIfEmpty only runs on a virgin table, so a NEW seed module
// (e.g. D92 Track E's `foundations-same-structure`) would never reach a DB that
// was seeded under an older build. This pass closes that gap WITHOUT an empty-
// table reset: it diffs the checked-in seed against the existing module_ids and
// INSERT OR IGNOREs only the genuinely-missing ones.
//
// It NEVER overwrites an existing row — instructor edits and previously-seeded
// modules are untouched (INSERT OR IGNORE no-ops on a PK collision; we also pre-
// filter to ids not in the table). New rows land published + auto_tag + is_seed
// with their seed sort_order, and are mirrored to Supabase best-effort.
//
// Accepted edge (documented): if an admin FORCE-deletes a seed module
// (the `?force=1` hard delete guarded for is_seed rows), this pass re-inserts it
// on the next boot. That is acceptable for "core" seed content — it is treated
// as canonical and self-heals; an instructor who wants it gone should UNPUBLISH
// it (published=0 survives reboots) rather than force-delete.
export function ensureSeedLearningModules(database: Database): void {
  try {
    const rows = readLearningSeedRows();
    if (!rows || rows.length === 0) return;

    const existingRows = database
      .prepare(`SELECT module_id FROM learning_modules`)
      .all() as Array<{ module_id: string }>;
    const present = new Set(existingRows.map((r) => r.module_id));

    const missing = rows.filter(
      (r) => r && typeof r.moduleId === 'string' && r.moduleId && !present.has(r.moduleId),
    );

    // Sync exams for EXISTING seed modules in case the source code updated them
    // (e.g., removing vague fallbacks or improving hints). We don't overwrite
    // title/content here to respect admin edits, but we force-sync the exams.
    const existingSeedRows = rows.filter(
      (r) => r && typeof r.moduleId === 'string' && r.moduleId && present.has(r.moduleId),
    );

    if (existingSeedRows.length > 0) {
      const updateExams = database.prepare(`
        UPDATE learning_modules
        SET theoretical_json = @theoretical_json,
            practical_json = @practical_json,
            updated_at = datetime('now')
        WHERE module_id = @module_id AND is_seed = 1
      `);
      
      database.transaction((seedRows: LearningModuleSeedRow[]) => {
        for (const r of seedRows) {
          updateExams.run({
            module_id: r.moduleId,
            theoretical_json: r.theoreticalExam ? JSON.stringify(r.theoreticalExam) : null,
            practical_json: r.practicalExam ? JSON.stringify(r.practicalExam) : null,
          });
        }
      })(existingSeedRows);
    }

    if (missing.length === 0) return; // every seed id already present — nothing to insert

    // INSERT OR IGNORE is belt-and-suspenders: the pre-filter already excludes
    // present ids, and OR IGNORE guarantees we never clobber a row on a PK race.
    const insert = database.prepare(`
      INSERT OR IGNORE INTO learning_modules (
        module_id, category, title, eyebrow, intro,
        sections_json, key_terms_json, summary, see_also_json,
        theoretical_json, practical_json,
        published, auto_tag, sort_order, is_seed, created_at, updated_at
      ) VALUES (
        @module_id, @category, @title, @eyebrow, @intro,
        @sections_json, @key_terms_json, @summary, @see_also_json,
        @theoretical_json, @practical_json,
        @published, 1, @sort_order, 1, datetime('now'), datetime('now')
      )
    `);

    const insertMissing = database.transaction((seedRows: LearningModuleSeedRow[]) => {
      for (const r of seedRows) {
        insert.run({
          module_id: r.moduleId,
          category: r.category,
          title: r.title,
          eyebrow: r.eyebrow ?? '',
          intro: r.intro ?? '',
          sections_json: JSON.stringify(r.sections ?? []),
          key_terms_json: JSON.stringify(r.keyTerms ?? []),
          summary: r.summary ?? null,
          see_also_json: JSON.stringify(r.seeAlso ?? []),
          theoretical_json: r.theoreticalExam ? JSON.stringify(r.theoreticalExam) : null,
          practical_json: r.practicalExam ? JSON.stringify(r.practicalExam) : null,
          published: r.category === 'foundations' ? 1 : 0,
          sort_order: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
        });
      }
    });
    insertMissing(missing);

    // Mirror the freshly-inserted rows to Supabase (best-effort; JSON fields as
    // JS objects so PostgREST stores jsonb). Keyed by module_id (UPSERT_BY_PK).
    const nowIso = new Date().toISOString();
    for (const r of missing) {
      mirrorRow('learning_modules', {
        module_id: r.moduleId,
        category: r.category,
        title: r.title,
        eyebrow: r.eyebrow ?? '',
        intro: r.intro ?? '',
        sections_json: r.sections ?? [],
        key_terms_json: r.keyTerms ?? [],
        summary: r.summary ?? null,
        see_also_json: r.seeAlso ?? [],
        theoretical_json: r.theoreticalExam ?? null,
        practical_json: r.practicalExam ?? null,
        published: r.category === 'foundations' ? 1 : 0,
        auto_tag: 1,
        sort_order: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
        is_seed: 1,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[initDb] inserted ${missing.length} missing seed learning module(s): ${missing
        .map((r) => r.moduleId)
        .join(', ')}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[initDb] ensureSeedLearningModules skipped:', err);
  }
}

export function initDb(): void {
  db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  )`).run();
  db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`).run();

  if (!columnExists('users', 'role')) {
    db.prepare(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`).run();
  }
  if (!columnExists('users', 'claimed_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN claimed_at TEXT`).run();
  }
  if (!columnExists('users', 'last_active')) {
    db.prepare(`ALTER TABLE users ADD COLUMN last_active TEXT`).run();
  }

  // created_via: how the account was created — 'oauth' (Google), 'guest'
  // (Devcon seat), or 'legacy' (username/password incl. seeded admin).
  // SQLite-only (the Supabase migration for this column does not reach the
  // admin's SQLite data). Idempotent via the duplicate-column catch (D87).
  try {
    db.prepare(`ALTER TABLE users ADD COLUMN created_via TEXT NOT NULL DEFAULT 'legacy'`).run();
    // One-time backfill: existing Devcon* seats are guests. Safe to run every
    // boot — only flips rows still on the 'legacy' default.
    db.prepare(`UPDATE users SET created_via = 'guest'
                WHERE username LIKE 'Devcon%' AND created_via = 'legacy'`).run();
  } catch {
    /* column already exists — nothing to do */
  }

  db.prepare(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    input_file_path TEXT NOT NULL,
    output_file_path TEXT NOT NULL,
    job_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  // Audit log — append-only record of destructive admin actions (deletions
  // of runs and bulk log purges). Intentionally separate from `logs` because
  // the admin UI exposes a "Delete all logs" control; this table is never
  // exposed to that delete and has no DELETE route. Source of accountability.
  db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    actor_username TEXT,
    action TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_id TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS analysis_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_text TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    artifact_path TEXT NOT NULL,
    structure_score INTEGER NOT NULL,
    modernization_score INTEGER NOT NULL,
    findings_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`).run();

  // Migration: add user_id column to analysis_runs if missing
  if (!columnExists('analysis_runs', 'user_id')) {
    db.prepare(`ALTER TABLE analysis_runs ADD COLUMN user_id INTEGER`).run();
  }

  db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scope TEXT NOT NULL,
    analysis_run_id INTEGER,
    answers_json TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(analysis_run_id) REFERENCES analysis_runs(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_reviews_scope ON reviews(scope)`).run();

  initEtlSchema(db);

  // --- Survey + manual-review tables (idempotent) ---
  // Fresh-DB shape: run_id is INTEGER + FK CASCADE so a run delete also
  // wipes its per-run survey rows. Older DBs created before this change
  // still have run_id TEXT and no FK; they get migrated by the
  // ensureCascade('run_feedback', …) call below. session_feedback is
  // intentionally NOT linked to runs.
  db.prepare(`CREATE TABLE IF NOT EXISTS run_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    ratings_json TEXT NOT NULL,
    open_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_feedback_user ON run_feedback(user_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_feedback_run ON run_feedback(run_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS session_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_uuid TEXT NOT NULL,
    ratings_json TEXT NOT NULL,
    open_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_session_feedback_user ON session_feedback(user_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS manual_pattern_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    line INTEGER NOT NULL,
    candidates_json TEXT NOT NULL,
    chosen_pattern TEXT,
    chosen_kind TEXT NOT NULL,
    other_text TEXT,
    decided_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(run_id) REFERENCES analysis_runs(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_manual_decisions_run ON manual_pattern_decisions(run_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_manual_decisions_user ON manual_pattern_decisions(user_id)`).run();

  // ── org_pattern_catalogs (dud-state local mirror of the Supabase table) ─
  // Local SQLite mirror that backs the admin Catalogs tab before the full
  // Supabase OAuth + org model goes live. org_id is stored as TEXT so the
  // same row maps cleanly to the Supabase UUID once Phase 3's OAuth path
  // is wired. is_active_in_parser stays 0 until the microservice learns
  // to consume admin-uploaded catalogs.
  db.prepare(`CREATE TABLE IF NOT EXISTS org_pattern_catalogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    json_payload TEXT NOT NULL,
    is_active_in_parser INTEGER NOT NULL DEFAULT 0,
    uploaded_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    kind TEXT NOT NULL DEFAULT 'custom',
    pattern_enabled_map TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_org_catalogs_org ON org_pattern_catalogs(org_id)`).run();

  // ── Pattern-groups migration ───────────────────────────────────────────
  // Existing DBs predate the kind / pattern_enabled_map columns introduced
  // for the Pattern Groups feature. ensureColumn adds a column only when it
  // is missing (PRAGMA table_info lookup), wrapped in try/catch so a stray
  // race or unexpected schema never aborts boot.
  function ensureColumn(table: string, column: string, ddl: string): void {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      if (cols.some((c) => c.name === column)) return;
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[initDb] ensureColumn ${table}.${column} skipped:`, err);
    }
  }
  ensureColumn('org_pattern_catalogs', 'kind', `kind TEXT NOT NULL DEFAULT 'custom'`);
  ensureColumn('org_pattern_catalogs', 'pattern_enabled_map', `pattern_enabled_map TEXT NOT NULL DEFAULT '{}'`);

  // ── learning_progress (per-account learning-path progress) ──────────────
  // One row per user. completed_module_ids is a JSON array of the learning
  // module ids the account has passed; last_unlocked_module_id is the highest
  // module the linear gate has opened for that account. Updated every time a
  // module is completed (which unlocks the next), so the path resumes where
  // the user left off after a refresh or on another device.
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_progress (
    user_id INTEGER NOT NULL,
    session_id TEXT,
    completed_module_ids TEXT NOT NULL DEFAULT '[]',
    last_unlocked_module_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, session_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  ensureColumn('learning_progress', 'session_id', 'session_id TEXT');

  // Per-module practical attempt counts (JSON map module_id → tries). Added
  // after learning_progress shipped, so older DBs need the column backfilled.
  // ALTER ... ADD COLUMN is idempotent here via the duplicate-column catch.
  try {
    db.prepare(`ALTER TABLE learning_progress ADD COLUMN tries_by_module TEXT NOT NULL DEFAULT '{}'`).run();
  } catch {
    /* column already exists — nothing to do */
  }

  // Per-module theoretical-exam pass state (JSON array of module ids). Separate
  // from completed_module_ids so a learner who passed a pattern module's
  // theoretical exam but not yet its practical exam resumes mid-module after a
  // refresh (the practical block stays unlocked). Added after tries_by_module,
  // so older DBs need the column backfilled. Idempotent via the duplicate-column
  // catch (D86).
  try {
    db.prepare(`ALTER TABLE learning_progress ADD COLUMN theory_passed_module_ids TEXT NOT NULL DEFAULT '[]'`).run();
  } catch {
    /* column already exists — nothing to do */
  }

  // Per-module Bloom mastery state (JSON map module_id -> score 0..6). Stored
  // with the rest of the learner progress so the snapshot survives refreshes
  // and device changes.
  try {
    db.prepare(`ALTER TABLE learning_progress ADD COLUMN bloom_mastery_by_module TEXT NOT NULL DEFAULT '{}'`).run();
  } catch {
    /* column already exists — nothing to do */
  }

  // Per-module learner "skip" decisions for optional (already-proficient) modules
  // (JSON array of module ids). Only optional modules can be skipped — required
  // review modules never enter this set — so it never blocks required progression.
  // Added after bloom_mastery_by_module; idempotent via the duplicate-column catch.
  try {
    db.prepare(`ALTER TABLE learning_progress ADD COLUMN skipped_module_ids TEXT NOT NULL DEFAULT '[]'`).run();
  } catch {
    /* column already exists — nothing to do */
  }

  // ── learning_question_results (per-question theoretical-exam results) ────
  // One row per (user, session, module, question).
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_question_results (
    user_id INTEGER NOT NULL,
    session_id TEXT,
    module_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    selected_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    first_attempt_correct INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, session_id, module_id, question_index),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`).run();

  ensureColumn('learning_question_results', 'session_id', 'session_id TEXT');

  // ── learning_exam_attempts (append-only theoretical-exam submit log, D91) ─
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT,
    module_id TEXT NOT NULL,
    attempt_no INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  ensureColumn('learning_exam_attempts', 'session_id', 'session_id TEXT');
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_lea_user_module
    ON learning_exam_attempts(user_id, session_id, module_id)`).run();


  // ── learning_modules (DB-backed Learning CMS, D92) ──────────────────────
  // One row per learning module, keyed by module_id (PK = the sacred id the
  // learner-progress tables reference). Stored as one nested inline-JSON
  // document (NOT normalized) — the learner needs the whole active module at
  // once and a module is read/written whole (matches the
  // org_pattern_catalogs.json_payload precedent). The _json columns hold the
  // sections / key-terms / see-also arrays + the theoretical/practical exam
  // objects; practical_json carries the practical INCLUDING its optional
  // passMode. published / auto_tag / sort_order / is_seed drive the public
  // GET ordering + the publish gate. SQLite is the source of truth; rows are
  // mirrored to Supabase (jsonb cols) via mirrorRow() keyed by module_id.
  // â”€â”€ learning_assessment_attempts (raw pre/post-test submissions) â”€â”€
  // Raw-only store: the backend keeps the assessment type, session, and
  // question count, but never the derived score/pass state. Interpretation
  // stays in the client so the same raw submission can be re-scored later if
  // the module bank changes.
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_assessment_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT,
    assessment_type TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    -- Formal pre/post pairing (additive, nullable for legacy attempts):
    -- a pre-test and its paired post-test share one cycle_id; plan_id records
    -- the active learning plan the cycle was scoped from.
    cycle_id TEXT,
    plan_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_assessment_attempts_user
    ON learning_assessment_attempts(user_id, assessment_type, created_at DESC)`).run();
  // Additive nullable columns for existing DBs created before pairing landed.
  try { db.prepare(`ALTER TABLE learning_assessment_attempts ADD COLUMN cycle_id TEXT`).run(); } catch { /* exists */ }
  try { db.prepare(`ALTER TABLE learning_assessment_attempts ADD COLUMN plan_id TEXT`).run(); } catch { /* exists */ }
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_assessment_attempts_cycle
    ON learning_assessment_attempts(user_id, cycle_id, assessment_type)`).run();

  // ---- Active learning plans (authoritative formal-assessment scope) ----
  // The formal pre/post scope comes ONLY from a learner's active plan modules
  // whose selection_status is 'approved' or 'added'. Not derived from progress,
  // proficiency, all-published, or all-with-forms.
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_plans (
    id TEXT PRIMARY KEY,
    learner_id INTEGER NOT NULL,
    project_manager_id INTEGER,
    project_specification TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    activated_at TEXT,
    FOREIGN KEY(learner_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_plans_learner
    ON learning_plans(learner_id, status)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_plan_modules (
    plan_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    selection_status TEXT NOT NULL,
    recommendation_source TEXT NOT NULL,
    display_order INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (plan_id, module_id),
    FOREIGN KEY(plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_plan_modules_plan
    ON learning_plan_modules(plan_id, selection_status)`).run();

  // One raw answer row per question in an assessment attempt.
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_assessment_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    session_id TEXT,
    assessment_type TEXT NOT NULL,
    assessment_index INTEGER NOT NULL,
    module_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    selected_index INTEGER NOT NULL,
    response_text TEXT,
    question_taxonomy TEXT,
    question_kind TEXT NOT NULL DEFAULT 'theoretical',
    -- Stable formal-assessment question id (additive; nullable for legacy rows).
    -- question_index is retained for backward compatibility / legacy fallback.
    question_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(attempt_id) REFERENCES learning_assessment_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_assessment_answers_attempt
    ON learning_assessment_answers(attempt_id, assessment_index)`).run();
  try {
    db.prepare(`ALTER TABLE learning_assessment_answers ADD COLUMN response_text TEXT`).run();
  } catch {
    /* column already exists */
  }
  try {
    db.prepare(`ALTER TABLE learning_assessment_answers ADD COLUMN question_taxonomy TEXT`).run();
  } catch {
    /* column already exists */
  }
  try {
    db.prepare(`ALTER TABLE learning_assessment_answers ADD COLUMN question_kind TEXT NOT NULL DEFAULT 'theoretical'`).run();
  } catch {
    /* column already exists */
  }
  // Additive, nullable stable question id for formal pre/post-test answers.
  // Existing rows stay NULL (legacy fallback to question_index); never backfilled
  // from an ambiguous index. Affects ONLY this formal-assessment table —
  // learning_question_results (in-module analytics) is untouched.
  try {
    db.prepare(`ALTER TABLE learning_assessment_answers ADD COLUMN question_id TEXT`).run();
  } catch {
    /* column already exists */
  }
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_assessment_answers_attempt_qid
    ON learning_assessment_answers(attempt_id, question_id)`).run();
  // Bloom-level progression (additive, nullable). NULL = correctness unknown
  // (legacy rows never had server-side grading). 1 = correct, 0 = incorrect.
  try {
    db.prepare(`ALTER TABLE learning_assessment_answers ADD COLUMN is_correct INTEGER`).run();
  } catch {
    /* column already exists */
  }

  db.prepare(`CREATE TABLE IF NOT EXISTS learning_modules (
    module_id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    eyebrow TEXT NOT NULL DEFAULT '',
    intro TEXT NOT NULL DEFAULT '',
    sections_json TEXT NOT NULL DEFAULT '[]',
    key_terms_json TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    see_also_json TEXT NOT NULL DEFAULT '[]',
    theoretical_json TEXT,
    practical_json TEXT,
    published INTEGER NOT NULL DEFAULT 1,
    auto_tag INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_seed INTEGER NOT NULL DEFAULT 0,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_modules_cat_order
    ON learning_modules(category, sort_order)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_learning_modules_published
    ON learning_modules(published)`).run();

  // Seed once when the table is empty (never overwrites instructor edits).
  seedLearningModulesIfEmpty(db);
  // Additively insert any NEW seed module missing from an already-seeded DB
  // (e.g. D92 Track E). Never overwrites existing rows — insert-missing only.
  ensureSeedLearningModules(db);

  // ── Original-devs email reconciliation ─────────────────────────────────
  // If Andrew (or any future original-dev) signed in BEFORE their email
  // entered the ORIGINAL_DEV_EMAILS allowlist, resolveAdminOrg would
  // have spun up a self-serve org for them. Re-bind those memberships
  // back to the NeoTerritory org so they don't keep two parallel admin
  // orgs. Idempotent: targets only admin rows whose org_id is NOT the
  // NeoTerritory id. Wrapped in try/catch because dev envs may not
  // have the table yet (it's lazily created in googleAuth.ts).
  try {
    db.prepare(`UPDATE org_memberships
      SET org_id = '00000000-0000-0000-0000-000000000001'
      WHERE lower(email) = lower(?)
        AND role = 'admin'
        AND org_id != '00000000-0000-0000-0000-000000000001'`)
      .run('jbalbarosa15@gmail.com');
  } catch {
    // org_memberships table not yet present — first Google sign-in
    // will create it; nothing to reconcile.
  }

  // ── ON DELETE CASCADE migration ────────────────────────────────────────
  // SQLite can't ALTER an existing foreign key to add CASCADE — we have
  // to recreate the table. We do this once, idempotently, by checking
  // whether the existing FK definition mentions "CASCADE". If it
  // doesn't, we copy the data into a new table that does, then swap.
  // Wrapped in a transaction so a partial failure rolls back.
  function ensureCascade(table: string, recreateSql: string): void {
    try {
      const sqlRow = db.prepare(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
      ).get(table) as { sql?: string } | undefined;
      const sql = sqlRow?.sql || '';
      if (sql.toUpperCase().includes('ON DELETE CASCADE')) return;
      db.exec('PRAGMA foreign_keys = OFF;');
      db.transaction(() => {
        db.exec(`ALTER TABLE ${table} RENAME TO ${table}__old;`);
        db.exec(recreateSql);
        const colsRow = db.prepare(
          `SELECT group_concat(name) AS cols FROM pragma_table_info(?)`
        ).get(`${table}__old`) as { cols?: string } | undefined;
        const cols = colsRow?.cols || '*';
        db.exec(`INSERT INTO ${table} (${cols}) SELECT ${cols} FROM ${table}__old;`);
        db.exec(`DROP TABLE ${table}__old;`);
      })();
      db.exec('PRAGMA foreign_keys = ON;');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[initDb] cascade migration for ${table} skipped:`, err);
    }
  }

  ensureCascade('reviews', `
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      analysis_run_id INTEGER,
      answers_json TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    )
  `);
  ensureCascade('manual_pattern_decisions', `
    CREATE TABLE manual_pattern_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      line INTEGER NOT NULL,
      candidates_json TEXT NOT NULL,
      chosen_pattern TEXT,
      chosen_kind TEXT NOT NULL,
      other_text TEXT,
      decided_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    )
  `);
  // run_feedback (per-run survey) — linked to the analysis_run record so a
  // run delete cascades the feedback. Original schema stored run_id as
  // TEXT (no FK); this migration converts to INTEGER + FK CASCADE. Existing
  // numeric-string values coerce cleanly via INSERT…SELECT. session_feedback
  // (signout survey) intentionally STAYS standalone — it is not run-bound
  // and must survive run deletion.
  ensureCascade('run_feedback', `
    CREATE TABLE run_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      ratings_json TEXT NOT NULL,
      open_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    )
  `);

  // TEST SEED — REMOVE FOR PRODUCTION
  seedDevconUsers(db);
  ensureTestFolders();

  seedAdminAccount();
  seedPilotLearnerAndPlan();
}
