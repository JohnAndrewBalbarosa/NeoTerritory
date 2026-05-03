-- ─────────────────────────────────────────────────────────────────────────────
-- NeoTerritory → Supabase mirror schema.
--
-- Run this ONCE in the Supabase SQL editor (or via psql). Idempotent — safe
-- to re-run after upstream additions.
--
-- Local SQLite (inside the container) remains the source of truth. These
-- tables are a survivable copy used by every admin-visible feature so that
-- a Lightsail spot termination never costs you research data:
--
--   • admin_logs              ← every logEvent() (login, register, upload,
--                                analysis, save, manual_review, survey_*,
--                                gdb.<phase>.<pass|fail>, …)
--   • admin_audit_log         ← every destructive admin action
--   • users                   ← new accounts (mirrors on register)
--   • jobs                    ← upload + transformation placeholders
--   • analysis_runs           ← FULL run snapshot incl. tagged design
--                                 patterns, findings, and stage metrics
--                                 (time/memory per pipeline stage) inside
--                                 the analysis jsonb column
--   • reviews                 ← per-pattern reviewer answers (jsonb)
--   • manual_pattern_decisions← user-confirmed pattern picks (jsonb candidates)
--   • survey_consent          ← consent acceptance (version, timestamp)
--   • survey_pretest          ← pretest answers (jsonb)
--   • run_feedback            ← per-run ratings + open-ended (jsonb each)
--   • session_feedback        ← end-of-session ratings + open-ended (jsonb)
--
-- Override any table name by setting SUPABASE_<NAME>_TABLE in the backend env.
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Logs and audit trail
-- ============================================================================
create table if not exists public.admin_logs (
  id           bigserial primary key,
  user_id      bigint,
  event_type   text not null,
  message      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_admin_logs_created_at on public.admin_logs (created_at desc);
create index if not exists idx_admin_logs_event_type on public.admin_logs (event_type);

create table if not exists public.admin_audit_log (
  id              bigserial primary key,
  actor_user_id   bigint,
  actor_username  text,
  action          text not null,
  target_kind     text not null,
  target_id       text,
  detail          text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_admin_audit_created_at on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_action     on public.admin_audit_log (action);

-- ============================================================================
-- 2. Identity / jobs
-- ============================================================================
create table if not exists public.users (
  id          bigint primary key,
  username    text not null,
  email       text,
  role        text not null default 'user',
  created_at  timestamptz not null default now()
);
create index if not exists idx_users_username on public.users (username);

create table if not exists public.jobs (
  id                 bigint primary key,
  user_id            bigint,
  input_file_path    text,
  output_file_path   text,
  job_status         text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_jobs_user_id    on public.jobs (user_id);
create index if not exists idx_jobs_created_at on public.jobs (created_at desc);

-- ============================================================================
-- 3. Analysis runs — the single most important admin table.
--    `analysis` jsonb contains:
--      - findings[]            ← detected patterns (tagged design pattern)
--      - stageMetrics[]        ← items_processed + milliseconds per stage
--                                 (the "time and memory per run" data)
--      - patterns / per-class breakdown / per-line decisions
-- ============================================================================
create table if not exists public.analysis_runs (
  id                   bigint primary key,
  user_id              bigint,
  source_name          text not null,
  source_text          text not null,
  analysis             jsonb not null,
  artifact_path        text not null,
  structure_score      integer not null default 0,
  modernization_score  integer not null default 0,
  findings_count       integer not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists idx_runs_user_id    on public.analysis_runs (user_id);
create index if not exists idx_runs_created_at on public.analysis_runs (created_at desc);
-- Fast lookup by tagged pattern id (exists inside analysis->findings[*].pattern_id).
create index if not exists idx_runs_findings_gin
  on public.analysis_runs using gin ((analysis -> 'findings') jsonb_path_ops);

-- ============================================================================
-- 4. Reviews + manual pattern decisions
-- ============================================================================
create table if not exists public.reviews (
  id                bigint primary key,
  user_id           bigint not null,
  scope             text not null,
  analysis_run_id   bigint,
  answers           jsonb not null,
  schema_version    text not null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_reviews_user  on public.reviews (user_id);
create index if not exists idx_reviews_scope on public.reviews (scope);

create table if not exists public.manual_pattern_decisions (
  id                bigint primary key,
  run_id            bigint not null,
  user_id           bigint not null,
  line              integer not null,
  candidates        jsonb not null,
  chosen_pattern    text,
  chosen_kind       text not null,
  other_text        text,
  decided_at        timestamptz not null default now()
);
create index if not exists idx_decisions_run  on public.manual_pattern_decisions (run_id);
create index if not exists idx_decisions_user on public.manual_pattern_decisions (user_id);

-- ============================================================================
-- 5. Surveys + feedback
-- ============================================================================
create table if not exists public.survey_consent (
  id           bigint primary key,
  user_id      bigint not null,
  accepted_at  timestamptz not null default now(),
  version      text not null
);
create index if not exists idx_consent_user on public.survey_consent (user_id);

create table if not exists public.survey_pretest (
  id            bigint primary key,
  user_id       bigint not null,
  answers       jsonb not null,
  submitted_at  timestamptz not null default now()
);
create index if not exists idx_pretest_user on public.survey_pretest (user_id);

create table if not exists public.run_feedback (
  id            bigint primary key,
  run_id        text not null,
  user_id       bigint not null,
  ratings       jsonb not null,
  "open"        jsonb not null,
  submitted_at  timestamptz not null default now()
);
create index if not exists idx_runfb_run  on public.run_feedback (run_id);
create index if not exists idx_runfb_user on public.run_feedback (user_id);

create table if not exists public.session_feedback (
  id            bigint primary key,
  user_id       bigint not null,
  session_uuid  text not null,
  ratings       jsonb not null,
  "open"        jsonb not null,
  submitted_at  timestamptz not null default now()
);
create index if not exists idx_sessfb_user on public.session_feedback (user_id);

-- ============================================================================
-- 6. Lock everything down — service-role key (used by the backend) is the
--    only role that may read or write. Anon and authenticated client keys
--    see nothing. RLS is on, no policies = deny by default.
-- ============================================================================
alter table public.admin_logs                  enable row level security;
alter table public.admin_audit_log             enable row level security;
alter table public.users                       enable row level security;
alter table public.jobs                        enable row level security;
alter table public.analysis_runs               enable row level security;
alter table public.reviews                     enable row level security;
alter table public.manual_pattern_decisions    enable row level security;
alter table public.survey_consent              enable row level security;
alter table public.survey_pretest              enable row level security;
alter table public.run_feedback                enable row level security;
alter table public.session_feedback            enable row level security;
