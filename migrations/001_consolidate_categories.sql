-- Consolidate 8 categories → 6: watch, listen, read, visit, get, other
-- Run in Supabase SQL Editor

UPDATE recommendations SET category = 'watch' WHERE category IN ('tv', 'film');
UPDATE recommendations SET category = 'listen' WHERE category = 'music';
UPDATE recommendations SET category = 'read' WHERE category = 'book';
UPDATE recommendations SET category = 'visit' WHERE category IN ('restaurant', 'travel');
UPDATE recommendations SET category = 'get' WHERE category = 'product';
-- 'other' stays as-is
