-- ============================================================
-- ThermoPack Industries — Migration 011
-- Auto-fix double-encoded JSONB on INSERT/UPDATE
-- n8n Supabase node v1 requires JSON.stringify, so data arrives
-- as a JSON string inside JSONB. These triggers unwrap it.
-- ============================================================

-- ============================================================
-- 1. Trigger function for ocr_logs.donnees_extraites
-- ============================================================

CREATE OR REPLACE FUNCTION fix_ocr_logs_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.donnees_extraites IS NOT NULL
    AND jsonb_typeof(NEW.donnees_extraites) = 'string' THEN
    NEW.donnees_extraites := (NEW.donnees_extraites #>> '{}')::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fix_ocr_logs_jsonb ON ocr_logs;
CREATE TRIGGER trg_fix_ocr_logs_jsonb
  BEFORE INSERT OR UPDATE ON ocr_logs
  FOR EACH ROW EXECUTE FUNCTION fix_ocr_logs_jsonb();

-- ============================================================
-- 2. Trigger function for offres.designations
-- ============================================================

CREATE OR REPLACE FUNCTION fix_offres_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.designations IS NOT NULL
    AND jsonb_typeof(NEW.designations::jsonb) = 'string' THEN
    NEW.designations := (NEW.designations::jsonb #>> '{}')::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fix_offres_jsonb ON offres;
CREATE TRIGGER trg_fix_offres_jsonb
  BEFORE INSERT OR UPDATE ON offres
  FOR EACH ROW EXECUTE FUNCTION fix_offres_jsonb();

-- ============================================================
-- 3. Trigger function for commandes.designations
-- ============================================================

CREATE OR REPLACE FUNCTION fix_commandes_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.designations IS NOT NULL
    AND jsonb_typeof(NEW.designations::jsonb) = 'string' THEN
    NEW.designations := (NEW.designations::jsonb #>> '{}')::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fix_commandes_jsonb ON commandes;
CREATE TRIGGER trg_fix_commandes_jsonb
  BEFORE INSERT OR UPDATE ON commandes
  FOR EACH ROW EXECUTE FUNCTION fix_commandes_jsonb();
