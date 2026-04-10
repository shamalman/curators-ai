-- Dump public schema as markdown-ready rows.
-- Run in Supabase SQL Editor and paste output when updating CLAUDE.md.
-- Usage: every time CLAUDE.md schema section is updated, rerun this
-- and diff against the tables in the docs.
--
-- Note: Supabase SQL Editor may truncate large multi-table results.
-- If a specific table is missing columns in the output, re-run this
-- scoped to just that table:
--   WHERE table_name = 'taste_profiles'

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE '%_backup_%'
ORDER BY table_name, ordinal_position;
