-- Create the multi-tenant organization model: organizations, memberships,
-- invites, per-org pattern catalogs.
--
-- Why: the existing single-admin model cannot represent "each admin owns
-- their own org and their developers see only that org's pattern catalogs."
-- This migration introduces the org tier; the original-devs org is seeded
-- in a follow-up migration with the special-case is_original_devs flag.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  is_original_devs boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  supabase_user_id uuid,
  email text not null,
  role text not null check (role in ('admin', 'developer')),
  joined_at timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists idx_org_memberships_user
  on public.org_memberships (supabase_user_id);
create index if not exists idx_org_memberships_email
  on public.org_memberships (email);

create table if not exists public.org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  role text not null default 'developer' check (role in ('admin', 'developer')),
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_invites_token
  on public.org_invites (token);

create table if not exists public.org_pattern_catalogs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  json_payload jsonb not null,
  is_active_in_parser boolean not null default false,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_pattern_catalogs_org
  on public.org_pattern_catalogs (org_id);

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.org_invites enable row level security;
alter table public.org_pattern_catalogs enable row level security;

create policy "org readable by member" on public.organizations
  for select to authenticated
  using (
    id in (
      select org_id from public.org_memberships
      where supabase_user_id = auth.uid()
    )
    or is_original_devs = true
  );

create policy "membership readable by org member" on public.org_memberships
  for select to authenticated
  using (
    org_id in (
      select org_id from public.org_memberships
      where supabase_user_id = auth.uid()
    )
  );

create policy "invites readable by org admin" on public.org_invites
  for select to authenticated
  using (
    org_id in (
      select org_id from public.org_memberships
      where supabase_user_id = auth.uid() and role = 'admin'
    )
  );

create policy "catalog readable by org member or public for originals"
  on public.org_pattern_catalogs
  for select to authenticated
  using (
    org_id in (
      select org_id from public.org_memberships
      where supabase_user_id = auth.uid()
    )
    or org_id in (
      select id from public.organizations where is_original_devs = true
    )
  );

commit;
