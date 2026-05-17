-- Add invite-code (admin-generated short codes for fast-path developer
-- joins) and join-request (developer → admin pending approval) tables.
-- Mirrors the SQLite tables created on-demand in googleAuth.ts.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.org_invite_codes (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid,
  uses_remaining integer not null default 1,
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_invite_codes_org on public.org_invite_codes (org_id);

create table if not exists public.org_join_requests (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requester_email text not null,
  requester_user_id uuid,
  requester_name text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, requester_email)
);

create index if not exists idx_join_requests_org_status
  on public.org_join_requests (org_id, status);

-- RLS — same pattern as org_memberships.
alter table public.org_invite_codes enable row level security;
alter table public.org_join_requests enable row level security;

create policy "invite_codes readable by org admin" on public.org_invite_codes
  for select to authenticated
  using (
    org_id in (
      select org_id from public.org_memberships
      where supabase_user_id = auth.uid() and role = 'admin'
    )
  );

create policy "join_requests readable by org admin or requester" on public.org_join_requests
  for select to authenticated
  using (
    org_id in (
      select org_id from public.org_memberships
      where supabase_user_id = auth.uid() and role = 'admin'
    )
    or lower(requester_email) = lower((auth.jwt() ->> 'email'))
  );

commit;
