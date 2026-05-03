-- Run this once in the Supabase SQL editor (or via psql) to create the
-- mirror tables that backend writes to whenever SUPABASE_URL +
-- SUPABASE_SERVICE_KEY are set. Local SQLite remains the source of truth;
-- these tables are a survivable copy for AWS spot-instance deployments.
--
-- Override table names with SUPABASE_LOGS_TABLE / SUPABASE_AUDIT_TABLE.

create table if not exists public.admin_logs (
  id           bigserial primary key,
  user_id      bigint,
  event_type   text not null,
  message      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_admin_logs_created_at
  on public.admin_logs (created_at desc);
create index if not exists idx_admin_logs_event_type
  on public.admin_logs (event_type);

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

create index if not exists idx_admin_audit_created_at
  on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_action
  on public.admin_audit_log (action);

-- Lock these down: only the service-role key (used by the backend) may
-- write/read. Anon and authenticated client keys see nothing.
alter table public.admin_logs       enable row level security;
alter table public.admin_audit_log  enable row level security;
