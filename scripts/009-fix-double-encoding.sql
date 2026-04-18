-- ============================================================
-- ThermoPack Industries — Migration 009
-- Fix double-encoded JSONB columns + performance indexes
-- ============================================================

-- ============================================================
-- 1. Fix double-encoded donnees_extraites in ocr_logs
--    JSON.stringify(obj) stored as string in JSONB -> unwrap to native JSONB
-- ============================================================

UPDATE ocr_logs
SET donnees_extraites = (donnees_extraites #>> '{}')::jsonb
WHERE donnees_extraites IS NOT NULL
  AND jsonb_typeof(donnees_extraites) = 'string';

-- ============================================================
-- 2. Fix double-encoded designations in offres
--    JSON.stringify(array) stored as string in JSONB -> unwrap to native JSONB array
-- ============================================================

UPDATE offres
SET designations = (designations::jsonb #>> '{}')::jsonb
WHERE designations IS NOT NULL
  AND jsonb_typeof(designations::jsonb) = 'string';

-- ============================================================
-- 3. Fix double-encoded designations in commandes
-- ============================================================

UPDATE commandes
SET designations = (designations::jsonb #>> '{}')::jsonb
WHERE designations IS NOT NULL
  AND jsonb_typeof(designations::jsonb) = 'string';

-- ============================================================
-- 4. Performance indexes for dashboard RPCs
-- ============================================================

-- kpis_direction / ca_mensuel: filter by commandes.type (directe exclusion)
CREATE INDEX IF NOT EXISTS idx_commandes_type ON commandes(type);

-- kpis_direction: composite index for period queries on commandes
CREATE INDEX IF NOT EXISTS idx_commandes_date_entreprise ON commandes(date_commande, entreprise_id);

-- recurrence_clients: LAG window function needs ordered scan per entreprise
CREATE INDEX IF NOT EXISTS idx_commandes_entreprise_date ON commandes(entreprise_id, date_commande);

-- top_materiaux: needs to access designations JSONB, covering index for commande date range
-- (no GIN index on designations since jsonb_array_elements does full scan anyway)

-- offres_non_transformees: composite for statut + pays lookup via join
CREATE INDEX IF NOT EXISTS idx_offres_statut_entreprise ON offres(statut, entreprise_id)
  WHERE statut = 'en_attente';

-- ocr_logs: faster lookup by record_id (used in migration 005 backfill and potential future queries)
CREATE INDEX IF NOT EXISTS idx_ocr_logs_record_id ON ocr_logs(record_id)
  WHERE record_id IS NOT NULL;
