const db = require('../db/database');

function logEvent(userId, eventType, message) {
  db.prepare('INSERT INTO logs (user_id, event_type, message, created_at) VALUES (?, ?, ?, datetime("now"))')
    .run(userId || null, eventType, message);
}

module.exports = { logEvent };
