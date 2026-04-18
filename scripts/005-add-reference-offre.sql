-- 005-add-reference-offre.sql
-- Add reference_offre column to commandes table + backfill from ocr_logs

-- ============================================================
-- 1. Add column
-- ============================================================

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS reference_offre TEXT;

-- ============================================================
-- 2. Backfill from ocr_logs (donnees_extraites is double-encoded JSON)
-- ============================================================

UPDATE commandes c
SET reference_offre = (o.donnees_extraites #>> '{}')::jsonb->>'reference_offre'
FROM ocr_logs o
WHERE o.record_id = c.id
  AND c.type = 'egale'
  AND c.reference_offre IS NULL;
