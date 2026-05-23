-- Drop the survey_consent table and its index. The /consent gate was
-- retired in favour of a streamlined Pretest-only flow for research
-- participants. Real-account OAuth users (Developer / Student / Admin)
-- never went through this gate, so the only impact is on the
-- dwindling Devcon tester cohort, whose consent acknowledgements are
-- no longer collected separately.
--
-- Run on the hosted Supabase project with:
--   npx supabase db push
-- CI does NOT auto-apply migrations.

DROP INDEX IF EXISTS idx_survey_consent_user;
DROP TABLE IF EXISTS survey_consent CASCADE;
