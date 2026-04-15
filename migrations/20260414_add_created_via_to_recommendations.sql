-- Add created_via column to recommendations for save-path analytics.
-- Analytics-only; not surfaced in UI.
--
-- Valid values (enforced in application code, not DB):
--   quick_capture_url, quick_capture_paste, quick_capture_upload,
--   chat_rec_block, chat_save_from_url, chat_save_from_image,
--   chat_save_from_taste_read, backfill, unknown

ALTER TABLE recommendations
  ADD COLUMN created_via TEXT;

CREATE INDEX IF NOT EXISTS idx_recommendations_created_via
  ON recommendations(created_via)
  WHERE created_via IS NOT NULL;

NOTIFY pgrst, 'reload schema';
