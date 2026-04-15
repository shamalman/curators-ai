-- Drop deprecated style_summary column from profiles.
--
-- Visitor AI personality is now driven by taste_profiles.content (Voice &
-- Style section). All readers and writers of style_summary have been removed
-- from the codebase as of 2026-04-15.
--
-- Ship order: deploy code that stops reading/writing first, verify clean prod
-- logs for ~24h, THEN run this migration.

ALTER TABLE profiles DROP COLUMN IF EXISTS style_summary;
NOTIFY pgrst, 'reload schema';
