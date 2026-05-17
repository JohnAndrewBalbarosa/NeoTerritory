-- Track how a user was created so we can enforce a guest-seat cap on the
-- legacy username/password path while leaving Supabase OAuth users
-- unaffected.

begin;

alter table if exists public.users
  add column if not exists created_via text not null default 'legacy';

create index if not exists idx_users_created_via on public.users (created_via);

comment on column public.users.created_via is
  'How the user record was created: legacy (username/password JWT), guest (capped at 50 seats), or oauth (Supabase Google).';

commit;
