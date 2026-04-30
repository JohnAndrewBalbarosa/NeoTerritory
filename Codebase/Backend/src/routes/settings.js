const express = require('express');
const db = require('../db/database');
const { jwtAuth } = require('../middleware/jwtAuth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  next();
}

// Cache with 30s TTL to avoid per-request DB reads in the hot analysis path.
let settingsCache = null;
let cacheExpiresAt = 0;

function getSettingsFromDb() {
  const now = Date.now();
  if (settingsCache && now < cacheExpiresAt) return settingsCache;
  const rows = db.prepare('SELECT key, value FROM settings').all();
  settingsCache = Object.fromEntries(rows.map(r => [r.key, r.value]));
  cacheExpiresAt = now + 30_000;
  return settingsCache;
}

function invalidateCache() {
  settingsCache = null;
  cacheExpiresAt = 0;
}

function getSetting(key, defaultValue = null) {
  const settings = getSettingsFromDb();
  return key in settings ? settings[key] : defaultValue;
}

router.get('/', jwtAuth, requireAdmin, (req, res) => {
  const settings = getSettingsFromDb();
  res.json({
    aiEnabled: settings.ai_enabled !== '0'
  });
});

router.patch('/', jwtAuth, requireAdmin, (req, res) => {
  const { aiEnabled } = req.body || {};
  if (typeof aiEnabled !== 'boolean') {
    return res.status(400).json({ error: 'aiEnabled must be a boolean' });
  }
  db.prepare(`INSERT INTO settings (key, value, updated_at)
    VALUES ('ai_enabled', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(aiEnabled ? '1' : '0');
  invalidateCache();
  res.json({ aiEnabled });
});

module.exports = { router, getSetting, invalidateCache };
