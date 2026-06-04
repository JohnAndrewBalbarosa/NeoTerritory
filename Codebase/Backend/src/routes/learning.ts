// Per-account learning-path progress. The /patterns/learn surface runs a
// linear unlock gate: module N unlocks once module N-1 is completed. This
// router persists that progress per user so the path resumes where the
// account left off after a refresh or on another device.
//
// GET  /api/learning/progress  → { completedModuleIds, lastUnlockedModuleId,
//                                   theoryPassedModuleIds }
// PUT  /api/learning/progress  → upsert the same shape (called every time a
//                                module's theoretical or practical exam passes,
//                                which can unlock the next).
//
// theoryPassedModuleIds (D86): modules whose theoretical exam has passed. Kept
// separate from completedModuleIds so a learner who cleared a pattern module's
// theoretical exam but not its practical exam resumes mid-module after refresh.
import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { sanitizeAnswers } from '../services/learningQuestionStats';
import { mirrorRow } from '../services/supabaseLogger';

const router = express.Router();

interface ProgressRow {
  completed_module_ids: string;
  last_unlocked_module_id: string | null;
  theory_passed_module_ids: string | null;
}

// Parse a JSON-array-of-strings DB column defensively. A corrupt or non-array
// payload degrades to an empty list rather than throwing.
function parseStringArrayColumn(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Defensive parse for a learning_modules `_json` array column (sections /
// keyTerms / seeAlso). Corrupt JSON or a non-array degrades to [] — never a
// 500. Returns unknown[] so the DTO reconstruction stays loose (the wire shape
// is validated on write, not re-validated on every public read).
function parseJsonArrayColumn(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Defensive parse for a nullable JSON-object column (theoretical_json /
// practical_json). Corrupt JSON or a non-object degrades to null.
function parseJsonObjectColumn(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Raw learning_modules row (public-read subset). Drafts (published = 0) are
// filtered out in the query, so this route only ever reconstructs live modules.
interface LearningModuleRow {
  module_id: string;
  category: string;
  title: string;
  eyebrow: string;
  intro: string;
  sections_json: string;
  key_terms_json: string;
  summary: string | null;
  see_also_json: string;
  theoretical_json: string | null;
  practical_json: string | null;
  auto_tag: number;
}

// Reconstruct a LearningModuleDTO (the frozen wire contract = LearningModule)
// from a DB row: parse the _json columns defensively, rename module_id → id,
// coerce auto_tag → autoTag boolean. passMode rides inside practicalExam. Omits
// `summary` when null so the DTO matches the optional-field shape exactly.
function rowToDto(row: LearningModuleRow): Record<string, unknown> {
  const dto: Record<string, unknown> = {
    id: row.module_id,
    category: row.category,
    title: row.title,
    eyebrow: row.eyebrow,
    intro: row.intro,
    sections: parseJsonArrayColumn(row.sections_json),
    keyTerms: parseJsonArrayColumn(row.key_terms_json),
    seeAlso: parseJsonArrayColumn(row.see_also_json),
    autoTag: row.auto_tag !== 0,
  };
  if (row.summary != null) dto.summary = row.summary;
  const theoretical = parseJsonObjectColumn(row.theoretical_json);
  if (theoretical) dto.theoreticalExam = theoretical;
  const practical = parseJsonObjectColumn(row.practical_json);
  if (practical) dto.practicalExam = practical;
  return dto;
}

// Normalise a request-body module-id array: strings only, deduped, length- and
// count-capped to the same bounds as completedModuleIds.
function sanitizeModuleIdArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= MAX_ID_LEN),
    ),
  ).slice(0, MAX_MODULES);
}

// Module-id sanity bounds — defensive caps so a malformed client cannot store
// an unbounded blob. There are well under 100 learning modules.
const MAX_MODULES = 200;
const MAX_ID_LEN = 120;
const MAX_PAYLOAD_BYTES = 20_000;

// Sanitize the per-module tries map: keys bounded like module ids, values
// coerced to a non-negative integer count.
function sanitizeTries(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, number> = {};
  let n = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (n >= MAX_MODULES) break;
    if (typeof k !== 'string' || !k || k.length > MAX_ID_LEN) continue;
    const num = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    out[k] = Math.min(num, 100_000);
    n += 1;
  }
  return out;
}

// ── Public learning content (D92 DB-backed CMS) ────────────────────────────
// PUBLIC (no auth): the learner page reads its content here. Returns only
// published modules ordered by sort_order ASC, each reconstructed into the
// frozen LearningModuleDTO wire shape. Defensive parsing means a corrupt _json
// column degrades that field to []/null rather than 500-ing the whole page —
// the learner path (and the routes-manifest smoke) must never break. A short
// public cache header lets the CDN/browser hold the content briefly.
router.get('/modules', (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const rows = db
      .prepare(
        `SELECT module_id, category, title, eyebrow, intro,
                sections_json, key_terms_json, summary, see_also_json,
                theoretical_json, practical_json, auto_tag
         FROM learning_modules
         WHERE published = 1
         ORDER BY sort_order ASC`,
      )
      .all() as LearningModuleRow[];
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ modules: rows.map(rowToDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/progress', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const row = db
      .prepare(
        `SELECT completed_module_ids, last_unlocked_module_id, theory_passed_module_ids
         FROM learning_progress WHERE user_id = ?`,
      )
      .get(req.user.id) as ProgressRow | undefined;

    res.json({
      completedModuleIds: parseStringArrayColumn(row?.completed_module_ids),
      lastUnlockedModuleId: row?.last_unlocked_module_id ?? null,
      theoryPassedModuleIds: parseStringArrayColumn(row?.theory_passed_module_ids),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/progress', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as {
      completedModuleIds?: unknown;
      lastUnlockedModuleId?: unknown;
      triesByModule?: unknown;
      theoryPassedModuleIds?: unknown;
    };
    const completedModuleIds = sanitizeModuleIdArray(body.completedModuleIds);
    const theoryPassedModuleIds = sanitizeModuleIdArray(body.theoryPassedModuleIds);
    const lastUnlockedModuleId =
      typeof body.lastUnlockedModuleId === 'string' && body.lastUnlockedModuleId.length <= MAX_ID_LEN
        ? body.lastUnlockedModuleId
        : null;

    const serialized = JSON.stringify(completedModuleIds);
    const theorySerialized = JSON.stringify(theoryPassedModuleIds);
    if (serialized.length > MAX_PAYLOAD_BYTES || theorySerialized.length > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ error: 'progress payload too large' });
      return;
    }

    const triesByModule = sanitizeTries(body.triesByModule);
    const triesSerialized = JSON.stringify(triesByModule);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;

    db.prepare(
      `INSERT INTO learning_progress (user_id, session_id, completed_module_ids, last_unlocked_module_id, tries_by_module, theory_passed_module_ids, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, session_id) DO UPDATE SET
         completed_module_ids      = excluded.completed_module_ids,
         last_unlocked_module_id   = excluded.last_unlocked_module_id,
         tries_by_module           = excluded.tries_by_module,
         theory_passed_module_ids  = excluded.theory_passed_module_ids,
         updated_at                = datetime('now')`,
    ).run(req.user.id, sessionId, serialized, lastUnlockedModuleId, triesSerialized, theorySerialized);


    // Mirror to Supabase (best-effort, keyed by email — D91). SQLite above is
    // the source of truth; this never blocks the learner.
    if (req.user.email) {
      mirrorRow('learning_progress', {
        user_email: req.user.email.toLowerCase(),
        completed_module_ids: completedModuleIds,
        last_unlocked_module_id: lastUnlockedModuleId,
        tries_by_module: triesByModule,
        theory_passed_module_ids: theoryPassedModuleIds,
        updated_at: new Date().toISOString(),
      });
    }

    res.json({ ok: true, completedModuleIds, lastUnlockedModuleId, triesByModule, theoryPassedModuleIds });
  } catch (err) {
    next(err);
  }
});

// Per-question theoretical-exam results (D87). Called by the learner page on
// each exam submit for signed-in learners (the client guards guests). Upserts
// one row per (user, module, question); first_attempt_correct is locked on the
// first row and never overwritten. Best-effort from the client's view.
router.put('/answers', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as { moduleId?: unknown; attempt?: unknown; answers?: unknown; sessionId?: unknown };
    const moduleId =
      typeof body.moduleId === 'string' && body.moduleId.length > 0 && body.moduleId.length <= MAX_ID_LEN
        ? body.moduleId
        : null;
    if (!moduleId) {
      res.status(400).json({ error: 'moduleId required' });
      return;
    }
    const answers = sanitizeAnswers(body.answers);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;

    // attempts is DB-authoritative: 1 on first insert, +1 each subsequent
    // submit of this question.
    const upsert = db.prepare(
      `INSERT INTO learning_question_results
         (user_id, session_id, module_id, question_index, selected_index, is_correct, first_attempt_correct, attempts, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, session_id, module_id, question_index) DO UPDATE SET
         selected_index = excluded.selected_index,
         is_correct     = excluded.is_correct,
         attempts       = learning_question_results.attempts + 1,
         updated_at     = datetime('now')`,
    );
    const tx = db.transaction((rows: typeof answers) => {
      for (const a of rows) {
        upsert.run(req.user!.id, sessionId, moduleId, a.questionIndex, a.selectedIndex, a.isCorrect, a.isCorrect);
      }
    });
    tx(answers);

    // Append-only exam-attempt log (D91)
    const correctCount = answers.reduce((n, a) => n + (a.isCorrect ? 1 : 0), 0);
    const totalQuestions = answers.length;
    const passed = totalQuestions > 0 && correctCount === totalQuestions ? 1 : 0;
    const priorRow = db
      .prepare(`SELECT COUNT(*) AS n FROM learning_exam_attempts WHERE user_id = ? AND session_id IS ? AND module_id = ?`)
      .get(req.user.id, sessionId, moduleId) as { n: number } | undefined;
    const attemptNo = (priorRow?.n ?? 0) + 1;
    db.prepare(
      `INSERT INTO learning_exam_attempts
         (user_id, session_id, module_id, attempt_no, correct_count, total_questions, passed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(req.user.id, sessionId, moduleId, attemptNo, correctCount, totalQuestions, passed);

    // Mirror to Supabase (best-effort, keyed by email — D91).
    const email = req.user.email ? req.user.email.toLowerCase() : null;
    if (email) {
      const nowIso = new Date().toISOString();
      for (const a of answers) {
        mirrorRow('learning_question_results', {
          user_email: email,
          module_id: moduleId,
          question_index: a.questionIndex,
          selected_index: a.selectedIndex,
          is_correct: a.isCorrect,
          updated_at: nowIso,
        });
      }
      mirrorRow('learning_exam_attempts', {
        user_email: email,
        module_id: moduleId,
        attempt_no: attemptNo,
        correct_count: correctCount,
        total_questions: totalQuestions,
        passed,
        created_at: nowIso,
      });
    }

    res.json({ ok: true, recorded: answers.length });
  } catch (err) {
    next(err);
  }
});

export default router;
