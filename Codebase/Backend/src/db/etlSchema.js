function initEtlSchema(db) {
  db.prepare(`CREATE TABLE IF NOT EXISTS etl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    user_id INTEGER,
    source_file_path TEXT NOT NULL,
    target_file_path TEXT,
    pipeline_status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS etl_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etl_run_id INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    step_status TEXT NOT NULL DEFAULT 'pending',
    input_ref TEXT,
    output_ref TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(etl_run_id, step_order),
    UNIQUE(etl_run_id, step_name),
    FOREIGN KEY(etl_run_id) REFERENCES etl_runs(id) ON DELETE CASCADE
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS etl_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etl_run_id INTEGER NOT NULL,
    etl_step_id INTEGER,
    artifact_type TEXT NOT NULL,
    artifact_path TEXT,
    artifact_payload TEXT,
    content_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(etl_run_id) REFERENCES etl_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(etl_step_id) REFERENCES etl_steps(id) ON DELETE SET NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS etl_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etl_run_id INTEGER NOT NULL,
    etl_step_id INTEGER,
    error_code TEXT,
    error_message TEXT NOT NULL,
    error_payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(etl_run_id) REFERENCES etl_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(etl_step_id) REFERENCES etl_steps(id) ON DELETE SET NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS etl_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etl_run_id INTEGER NOT NULL,
    etl_step_id INTEGER,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(etl_run_id) REFERENCES etl_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(etl_step_id) REFERENCES etl_steps(id) ON DELETE SET NULL
  )`).run();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_runs_job_id ON etl_runs(job_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_runs_user_id ON etl_runs(user_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_runs_pipeline_status ON etl_runs(pipeline_status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_steps_etl_run_id ON etl_steps(etl_run_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_steps_step_status ON etl_steps(step_status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_artifacts_etl_run_id ON etl_artifacts(etl_run_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_artifacts_etl_step_id ON etl_artifacts(etl_step_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_errors_etl_run_id ON etl_errors(etl_run_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_etl_metrics_etl_run_id ON etl_metrics(etl_run_id)').run();
}

module.exports = { initEtlSchema };
