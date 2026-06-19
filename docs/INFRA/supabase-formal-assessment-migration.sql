-- Supabase migration: formal-assessment cycle + stable question id + active plans
-- Mirrors the additive local-SQLite changes (Codebase/Backend/src/db/initDb.ts).
-- All columns are ADDITIVE and NULLABLE; existing rows remain valid.
--
-- NOTE: This file is the migration to APPLY on Supabase. It has NOT been run /
-- verified against a live Supabase instance in this change — apply it and
-- confirm the columns/tables exist before treating the mirror writes as durable.
-- The backend mirror is best-effort and will NOT fail learner requests if these
-- are missing, but question_id / cycle_id / plan_id will silently not persist
-- remotely until this is applied.

-- 1. Stable formal-assessment question id (was added locally already).
alter table if exists public.learning_assessment_answers
  add column if not exists question_id text;
create index if not exists idx_la_answers_attempt_qid
  on public.learning_assessment_answers (attempt_id, question_id);

-- 2. Pre/post pairing on attempts.
alter table if exists public.learning_assessment_attempts
  add column if not exists cycle_id text;
alter table if exists public.learning_assessment_attempts
  add column if not exists plan_id text;
create index if not exists idx_la_attempts_cycle
  on public.learning_assessment_attempts (user_email, cycle_id, assessment_type);

-- 3. Active learning plans (authoritative formal-assessment scope source).
create table if not exists public.learning_plans (
  id text primary key,
  learner_email text not null,
  project_manager_email text,
  project_specification text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);
create index if not exists idx_learning_plans_learner
  on public.learning_plans (learner_email, status);

create table if not exists public.learning_plan_modules (
  plan_id text not null references public.learning_plans (id) on delete cascade,
  module_id text not null,
  selection_status text not null,
  recommendation_source text not null,
  display_order integer,
  created_at timestamptz not null default now(),
  primary key (plan_id, module_id)
);
create index if not exists idx_learning_plan_modules_plan
  on public.learning_plan_modules (plan_id, selection_status);

-- Rollback (additive, low-risk): stop writing the columns/tables in code; the
-- columns may remain harmlessly. Hard rollback if required:
--   drop index if exists idx_la_answers_attempt_qid;
--   drop index if exists idx_la_attempts_cycle;
--   alter table public.learning_assessment_answers   drop column if exists question_id;
--   alter table public.learning_assessment_attempts  drop column if exists cycle_id;
--   alter table public.learning_assessment_attempts  drop column if exists plan_id;
--   drop table if exists public.learning_plan_modules;
--   drop table if exists public.learning_plans;
