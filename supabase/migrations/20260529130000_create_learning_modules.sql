-- D92: DB-backed Learning CMS content table, mirrored from SQLite (the source
-- of truth) via the backend's mirrorRow() PostgREST helper (services/
-- supabaseLogger.ts, UPSERT_BY_PK['learning_modules'] = 'module_id'). One row
-- per learning module, stored as one nested inline-JSON document (NOT
-- normalized) — matches the org_pattern_catalogs.json_payload precedent. The
-- app READS SQLite; this table is the durable, console-queryable copy that
-- survives an AWS spot-instance termination.
--
-- IDs are sacred: module_id is the stable PK the learner-progress tables key
-- on (learning_progress / learning_question_results / learning_exam_attempts).
--
-- The _json columns are jsonb (sections / key_terms / see_also arrays +
-- theoretical/practical exam objects). practical jsonb carries the optional
-- passMode. published / auto_tag / sort_order / is_seed are integers to match
-- the SQLite 0/1 mirror exactly (no boolean coercion across the wire).
--
-- Apply with: npx supabase db push (CI does NOT auto-apply).

create table if not exists public.learning_modules (
  module_id text primary key,
  category text not null,
  title text not null,
  eyebrow text not null default '',
  intro text not null default '',
  sections_json jsonb not null default '[]'::jsonb,
  key_terms_json jsonb not null default '[]'::jsonb,
  summary text,
  see_also_json jsonb not null default '[]'::jsonb,
  theoretical_json jsonb,
  practical_json jsonb,
  published integer not null default 1,
  auto_tag integer not null default 1,
  sort_order integer not null default 0,
  is_seed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public read ordering (published only, by sort_order) mirrors the SQLite
-- GET /api/learning/modules query shape.
create index if not exists idx_learning_modules_cat_order
  on public.learning_modules (category, sort_order);
create index if not exists idx_learning_modules_published
  on public.learning_modules (published);
