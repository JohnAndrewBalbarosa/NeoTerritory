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

export type SettingKey = 'testers_visible_to_users';

const DEFAULTS: Record<SettingKey, string> = {
  testers_visible_to_users: '1'
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
