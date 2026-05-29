-- D91: Instructor learning-analytics tables, mirrored from SQLite (the source
-- of truth) via the backend's mirrorRow() PostgREST helper (services/
-- supabaseLogger.ts). Keyed by EMAIL — the durable cross-DB identity that
-- org_memberships already uses: the backend JWT carries only the local SQLite
-- int user id + email (no Supabase UUID), and a learner need not be an org
-- member. The app READS SQLite; these tables are the durable, console-queryable
-- copy. Apply with: npx supabase db push (CI does not auto-apply).

-- Per-learner path progress (upsert by email; mirror of learning_progress).
create table if not exists public.learning_progress (
  user_email text primary key,
  completed_module_ids jsonb not null default '[]'::jsonb,
  last_unlocked_module_id text,
  tries_by_module jsonb not null default '{}'::jsonb,
  theory_passed_module_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Latest per-question answer (upsert by email+module+question). first-try /
-- attempts gating mechanics stay SQLite-internal; the exam-attempts log below
-- carries the history the Instructor tab charts.
create table if not exists public.learning_question_results (
  user_email text not null,
  module_id text not null,
  question_index integer not null,
  selected_index integer not null,
  is_correct integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_email, module_id, question_index)
);

-- Append-only exam-submit log: one row per theoretical-exam submit, so the
-- Instructor tab can chart improvement over time + count pass/fail attempts.
create table if not exists public.learning_exam_attempts (
  id bigint generated always as identity primary key,
  user_email text not null,
  module_id text not null,
  attempt_no integer not null,
  correct_count integer not null,
  total_questions integer not null,
  passed integer not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lea_email_module
  on public.learning_exam_attempts (user_email, module_id);
