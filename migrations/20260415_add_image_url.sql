-- Deploy 1 of 3 for image_url feature. Data-layer only; no UI consumption yet.
--
-- recommendations.image_url: populated on new saves going forward (no backfill).
-- rec_files.work is JSONB — image_url is written as a new JSON field inside
-- the work object by lib/rec-files/build.js; no column change needed there.

ALTER TABLE recommendations
  ADD COLUMN image_url TEXT;

NOTIFY pgrst, 'reload schema';
