import db from './database';

/**
 * Tiny admin-controlled key/value settings store.
 *
 * First user: the "show tester accounts in user-facing surfaces" flag.
 * Per project owner, the admin should be able to flip testers on or off
 * without redeploying. Anything else that needs a runtime toggle goes
 * here too (one row per key).
 *
 * Values are stored as text; callers convert. Unknown keys read default.
 */
db.prepare(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

export type SettingKey =
  | 'testers_visible_to_users'
  // Self-check / review-survey gating. ON during the thesis testing
  // window so per-run survey submission is the bagsakan that flushes
  // run details to the DB (project owner's hard rule). OFF after the
  // thesis is done so real-account Developer/Student users do not
  // hit a survey wall after every run — admin flips this when the
  // research period ends.
  | 'reviews_required'
  // Per-feature release flags. Stored as a JSON string mapping feature
  // key → boolean (true = released/visible). Unknown keys fall back to
  // the registry default on the frontend so unposted features stay
  // hidden until the developer admin flips them on. Owned by the
  // original-devs admin (e.g. jbalbarosa15@gmail.com).
  | 'feature_releases'
  // F1 expected-norm participant profile. JSON-encoded so the admin
  // can retune the assumptions without redeploying. Shape is enforced
  // by getF1NormProfile() (every numeric field clamped to [0, 1]).
  | 'f1_norm_profile';

const DEFAULT_F1_NORM_PROFILE = {
  label: 'Intermediate C++ · weak on design patterns',
  participantCount: 50,
  recallOnAnalyzerPositive: 0.55,
  specificityOnAnalyzerNegative: 0.78,
  hallucinatePatternRate: 0.18,
};

const DEFAULTS: Record<SettingKey, string> = {
  testers_visible_to_users: '1',
  reviews_required: '1',
  feature_releases: '{}',
  f1_norm_profile: JSON.stringify(DEFAULT_F1_NORM_PROFILE)
};

interface Row { value: string }

export function getSetting<T extends SettingKey>(key: T): string {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as Row | undefined;
  return row?.value ?? DEFAULTS[key];
}

export function setSetting<T extends SettingKey>(key: T, value: string): void {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value);
}

export function getBoolSetting<T extends SettingKey>(key: T): boolean {
  const v = getSetting(key);
  return v === '1' || v === 'true';
}

export interface F1NormProfile {
  label: string;
  participantCount: number;
  recallOnAnalyzerPositive: number;
  specificityOnAnalyzerNegative: number;
  hallucinatePatternRate: number;
}

function clamp01(n: unknown, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(1, Math.max(0, v));
}

// Parse the F1 expected-norm profile from app_settings. Each field is
// validated + clamped so a bad PUT cannot poison the dashboard math.
export function getF1NormProfile(): F1NormProfile {
  const raw = getSetting('f1_norm_profile');
  let parsed: Record<string, unknown> = {};
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && !Array.isArray(p)) parsed = p as Record<string, unknown>;
  } catch { /* fall through to defaults */ }
  const participantRaw = typeof parsed.participantCount === 'number' ? parsed.participantCount : DEFAULT_F1_NORM_PROFILE.participantCount;
  return {
    label: typeof parsed.label === 'string' && parsed.label.trim()
      ? parsed.label.trim()
      : DEFAULT_F1_NORM_PROFILE.label,
    participantCount: Math.max(0, Math.round(participantRaw)),
    recallOnAnalyzerPositive:      clamp01(parsed.recallOnAnalyzerPositive,      DEFAULT_F1_NORM_PROFILE.recallOnAnalyzerPositive),
    specificityOnAnalyzerNegative: clamp01(parsed.specificityOnAnalyzerNegative, DEFAULT_F1_NORM_PROFILE.specificityOnAnalyzerNegative),
    hallucinatePatternRate:        clamp01(parsed.hallucinatePatternRate,        DEFAULT_F1_NORM_PROFILE.hallucinatePatternRate),
  };
}

// Parse the feature_releases JSON setting into a typed map. Falls back to
// an empty object when the stored value is missing or malformed — keeps
// the frontend safe to merge with its defaultReleased registry.
export function getFeatureReleases(): Record<string, boolean> {
  const raw = getSetting('feature_releases');
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof k === 'string' && typeof v === 'boolean') out[k] = v;
      }
      return out;
    }
  } catch {
    // fall through to empty
  }
  return {};
}
