import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db from './database';

/*
 * Admin-controlled AI provider configuration.
 *
 * One row, identified by the constant SETTINGS_ROW_ID. The API key is
 * encrypted at rest with AES-256-GCM using a key resolved in this order:
 *   1. process.env.AI_CONFIG_KEY  (32 bytes hex; recommended for prod)
 *   2. an auto-generated key persisted next to the DB file at
 *      <db-dir>/.ai-config-key, created with mode 0600 on first use.
 *
 * pickProvider() consults this table first; env-var-based provider
 * selection (ANTHROPIC_API_KEY / GEMINI_API_KEY) is the legacy fallback.
 */

const SETTINGS_ROW_ID = 1;

db.prepare(`
  CREATE TABLE IF NOT EXISTS ai_config (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    api_key_iv    TEXT,
    api_key_tag   TEXT,
    api_key_enc   TEXT,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by    TEXT
  )
`).run();

export type AiProvider = 'anthropic' | 'gemini' | 'none';

interface AiConfigRow {
  id: number;
  provider: AiProvider;
  model: string;
  api_key_iv: string | null;
  api_key_tag: string | null;
  api_key_enc: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AiConfigSnapshot {
  provider: AiProvider;
  model: string;
  hasKey: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AiConfigSecret extends AiConfigSnapshot {
  apiKey: string;
}

function resolveEncryptionKey(): Buffer {
  const envHex = (process.env.AI_CONFIG_KEY || '').trim();
  if (envHex) {
    try {
      const buf = Buffer.from(envHex, 'hex');
      if (buf.length === 32) return buf;
    } catch { /* fall through */ }
  }

  // Auto-generated key alongside the SQLite file. The file is created
  // with 0600 permissions so the encrypted column is meaningful even
  // when only the DB file leaks.
  const dbFile = (db as unknown as { name?: string }).name || 'database.sqlite';
  const keyFile = path.join(path.dirname(dbFile), '.ai-config-key');
  if (fs.existsSync(keyFile)) {
    const hex = fs.readFileSync(keyFile, 'utf8').trim();
    const buf = Buffer.from(hex, 'hex');
    if (buf.length === 32) return buf;
  }
  const fresh = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, fresh.toString('hex'), { mode: 0o600 });
  return fresh;
}

function encryptKey(plaintext: string): { iv: string; tag: string; enc: string } {
  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), enc: enc.toString('base64') };
}

function decryptKey(row: AiConfigRow): string | null {
  if (!row.api_key_iv || !row.api_key_tag || !row.api_key_enc) return null;
  try {
    const key = resolveEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(row.api_key_iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(row.api_key_tag, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(row.api_key_enc, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

function readRow(): AiConfigRow | null {
  const row = db
    .prepare('SELECT * FROM ai_config WHERE id = ?')
    .get(SETTINGS_ROW_ID) as AiConfigRow | undefined;
  return row || null;
}

export function getAiConfigSnapshot(): AiConfigSnapshot {
  const row = readRow();
  if (!row) {
    return { provider: 'none', model: '', hasKey: false, updatedAt: null, updatedBy: null };
  }
  return {
    provider: row.provider,
    model: row.model,
    hasKey: !!row.api_key_enc,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Returns the row with the decrypted key. Internal — only the AI service should call this. */
export function getAiConfigSecret(): AiConfigSecret | null {
  const row = readRow();
  if (!row) return null;
  const apiKey = decryptKey(row);
  if (!apiKey) return null;
  return {
    provider: row.provider,
    model: row.model,
    apiKey,
    hasKey: true,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

interface SaveInput {
  provider: AiProvider;
  model: string;
  apiKey?: string | null;
  updatedBy: string | null;
}

export function saveAiConfig(input: SaveInput): AiConfigSnapshot {
  const existing = readRow();
  // If the caller did not pass apiKey, keep the existing encrypted value.
  // If they passed an empty string, clear it. Non-empty → re-encrypt.
  let iv: string | null = existing?.api_key_iv ?? null;
  let tag: string | null = existing?.api_key_tag ?? null;
  let enc: string | null = existing?.api_key_enc ?? null;

  if (input.apiKey != null) {
    if (input.apiKey === '') {
      iv = null; tag = null; enc = null;
    } else {
      const e = encryptKey(input.apiKey);
      iv = e.iv; tag = e.tag; enc = e.enc;
    }
  }

  db.prepare(`
    INSERT INTO ai_config (id, provider, model, api_key_iv, api_key_tag, api_key_enc, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(id) DO UPDATE SET
      provider    = excluded.provider,
      model       = excluded.model,
      api_key_iv  = excluded.api_key_iv,
      api_key_tag = excluded.api_key_tag,
      api_key_enc = excluded.api_key_enc,
      updated_at  = excluded.updated_at,
      updated_by  = excluded.updated_by
  `).run(SETTINGS_ROW_ID, input.provider, input.model, iv, tag, enc, input.updatedBy);

  return getAiConfigSnapshot();
}

export function clearAiConfig(): void {
  db.prepare('DELETE FROM ai_config WHERE id = ?').run(SETTINGS_ROW_ID);
}
