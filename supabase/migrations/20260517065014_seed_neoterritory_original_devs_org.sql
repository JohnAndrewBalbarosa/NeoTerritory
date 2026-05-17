-- Seed the NeoTerritory org as the special-case "original devs" tenant.
-- Only the three thesis-team emails are pre-seeded as admins. Other Google
-- sign-ins fall through to the self-serve "create your own org" path
-- handled by the backend OAuth callback.

begin;

insert into public.organizations (id, name, slug, is_original_devs)
values (
  '00000000-0000-0000-0000-000000000001',
  'NeoTerritory',
  'neoterritory',
  true
)
on conflict (slug) do nothing;

insert into public.org_memberships (org_id, email, role)
values
  ('00000000-0000-0000-0000-000000000001', 'jbalabrosa15@gmail.com', 'admin'),
  ('00000000-0000-0000-0000-000000000001', 'miryl-email-tbd@placeholder.invalid', 'admin'),
  ('00000000-0000-0000-0000-000000000001', 'josephine-santander-email-tbd@placeholder.invalid', 'admin')
on conflict (org_id, email) do nothing;

commit;
