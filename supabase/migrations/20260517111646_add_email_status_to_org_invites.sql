-- Track invite-email delivery status alongside the invite row so the
-- admin page can show a "sent / failed / queued" pill per row.

begin;

alter table public.org_invites
  add column if not exists email_status text not null default 'queued';

alter table public.org_invites
  add column if not exists email_sent_at timestamptz;

create index if not exists idx_org_invites_status
  on public.org_invites (org_id, email_status);

commit;
