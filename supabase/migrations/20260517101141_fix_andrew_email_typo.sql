-- Correct Andrew's email in the NeoTerritory org_memberships seed.
--
-- The initial seed (20260517065014_seed_neoterritory_original_devs_org.sql)
-- inserted 'jbalabrosa15@gmail.com' — letters a/b transposed. Andrew's
-- real Google address is 'jbalbarosa15@gmail.com' (consistent with the
-- git config user 'JohnAndrewBalbarosa'). Because the seed used
-- ON CONFLICT DO NOTHING, the corrected row would not replace the bad
-- one. This migration deletes the typo'd row, inserts the correct
-- email, and migrates any membership rows that landed under the
-- typo'd email to the corrected one.

begin;

-- 1. Drop the typo'd seed row (idempotent — fine if it was already
--    cleaned by a hot-fix or never inserted).
delete from public.org_memberships
where email = 'jbalabrosa15@gmail.com'
  and org_id = '00000000-0000-0000-0000-000000000001';

-- 2. Insert the corrected row. ON CONFLICT covers re-runs.
insert into public.org_memberships (org_id, email, role)
values ('00000000-0000-0000-0000-000000000001', 'jbalbarosa15@gmail.com', 'admin')
on conflict (org_id, email) do nothing;

-- 3. If Andrew already signed in with the typo'd allowlist active, the
--    backend's resolveAdminOrg() would have spun up a self-serve org
--    for him under his real email. Re-bind those memberships back to
--    the original-devs org so he doesn't keep two parallel admin orgs.
update public.org_memberships
set org_id = '00000000-0000-0000-0000-000000000001'
where lower(email) = 'jbalbarosa15@gmail.com'
  and role = 'admin'
  and org_id != '00000000-0000-0000-0000-000000000001';

commit;
