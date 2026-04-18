-- Migration 020: Enrich entreprises table with client list data
-- Source: docs/Liste client.xlsx (231 clients, full contact/address/billing data)
-- Date: 2026-03-30

-- ============================================================
-- 1. Extend pays_enum (Excel has MAROC, TUNISIE, REUNION)
-- ============================================================

ALTER TYPE pays_enum ADD VALUE IF NOT EXISTS 'MA';  -- Maroc
ALTER TYPE pays_enum ADD VALUE IF NOT EXISTS 'TN';  -- Tunisie
ALTER TYPE pays_enum ADD VALUE IF NOT EXISTS 'RE';  -- Reunion

-- ============================================================
-- 2. Add new columns to entreprises
-- ============================================================

-- Identification
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS tva_intracommunautaire TEXT;

-- Billing info
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS conditions_paiement TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS email_facturation TEXT;

-- Secondary contact (livraison/intervention)
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS contact_livraison_nom TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS contact_livraison_email TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS contact_livraison_telephone TEXT;

-- Delivery address
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS adresse_livraison TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS code_postal_livraison TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS ville_livraison TEXT;

-- Geo (billing)
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS departement TEXT;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS region TEXT;

-- Secondary email
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS contact_email_secondaire TEXT;

-- Notes
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS notes TEXT;

-- Import tracking
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ocr';
-- 'ocr' = imported via PDF OCR, 'excel' = imported from client list, 'manual' = added manually

-- ============================================================
-- 3. Index on numero_client for fast lookup during import
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entreprises_numero_client
  ON entreprises (numero_client) WHERE numero_client IS NOT NULL;

-- ============================================================
-- 4. Index on region for geographic dashboard queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entreprises_region
  ON entreprises (region) WHERE region IS NOT NULL;

-- ============================================================
-- 5. Update upsert function to handle new columns
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_entreprise(
  p_nom TEXT,
  p_code_postal TEXT DEFAULT NULL,
  p_pays TEXT DEFAULT 'FR',
  p_adresse TEXT DEFAULT NULL,
  p_contact_nom TEXT DEFAULT NULL,
  p_contact_telephone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_numero_client TEXT DEFAULT NULL,
  p_siret TEXT DEFAULT NULL,
  p_tva_intracommunautaire TEXT DEFAULT NULL,
  p_conditions_paiement TEXT DEFAULT NULL,
  p_email_facturation TEXT DEFAULT NULL,
  p_contact_email_secondaire TEXT DEFAULT NULL,
  p_contact_livraison_nom TEXT DEFAULT NULL,
  p_contact_livraison_email TEXT DEFAULT NULL,
  p_contact_livraison_telephone TEXT DEFAULT NULL,
  p_adresse_livraison TEXT DEFAULT NULL,
  p_code_postal_livraison TEXT DEFAULT NULL,
  p_ville_livraison TEXT DEFAULT NULL,
  p_ville TEXT DEFAULT NULL,
  p_departement TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'ocr'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO entreprises (
    nom, code_postal, pays, adresse, contact_nom, contact_telephone, contact_email, numero_client,
    siret, tva_intracommunautaire, conditions_paiement, email_facturation,
    contact_email_secondaire, contact_livraison_nom, contact_livraison_email, contact_livraison_telephone,
    adresse_livraison, code_postal_livraison, ville_livraison,
    ville, departement, region, notes, source
  )
  VALUES (
    p_nom, p_code_postal, p_pays::pays_enum, p_adresse, p_contact_nom, p_contact_telephone, p_contact_email, p_numero_client,
    p_siret, p_tva_intracommunautaire, p_conditions_paiement, p_email_facturation,
    p_contact_email_secondaire, p_contact_livraison_nom, p_contact_livraison_email, p_contact_livraison_telephone,
    p_adresse_livraison, p_code_postal_livraison, p_ville_livraison,
    p_ville, p_departement, p_region, p_notes, p_source
  )
  ON CONFLICT (nom, code_postal)
  DO UPDATE SET
    adresse = COALESCE(EXCLUDED.adresse, entreprises.adresse),
    contact_nom = COALESCE(EXCLUDED.contact_nom, entreprises.contact_nom),
    contact_telephone = COALESCE(EXCLUDED.contact_telephone, entreprises.contact_telephone),
    contact_email = COALESCE(EXCLUDED.contact_email, entreprises.contact_email),
    numero_client = COALESCE(EXCLUDED.numero_client, entreprises.numero_client),
    siret = COALESCE(EXCLUDED.siret, entreprises.siret),
    tva_intracommunautaire = COALESCE(EXCLUDED.tva_intracommunautaire, entreprises.tva_intracommunautaire),
    conditions_paiement = COALESCE(EXCLUDED.conditions_paiement, entreprises.conditions_paiement),
    email_facturation = COALESCE(EXCLUDED.email_facturation, entreprises.email_facturation),
    contact_email_secondaire = COALESCE(EXCLUDED.contact_email_secondaire, entreprises.contact_email_secondaire),
    contact_livraison_nom = COALESCE(EXCLUDED.contact_livraison_nom, entreprises.contact_livraison_nom),
    contact_livraison_email = COALESCE(EXCLUDED.contact_livraison_email, entreprises.contact_livraison_email),
    contact_livraison_telephone = COALESCE(EXCLUDED.contact_livraison_telephone, entreprises.contact_livraison_telephone),
    adresse_livraison = COALESCE(EXCLUDED.adresse_livraison, entreprises.adresse_livraison),
    code_postal_livraison = COALESCE(EXCLUDED.code_postal_livraison, entreprises.code_postal_livraison),
    ville_livraison = COALESCE(EXCLUDED.ville_livraison, entreprises.ville_livraison),
    ville = COALESCE(EXCLUDED.ville, entreprises.ville),
    departement = COALESCE(EXCLUDED.departement, entreprises.departement),
    region = COALESCE(EXCLUDED.region, entreprises.region),
    notes = COALESCE(EXCLUDED.notes, entreprises.notes),
    source = CASE WHEN entreprises.source = 'ocr' AND EXCLUDED.source = 'excel' THEN 'ocr+excel' ELSE COALESCE(EXCLUDED.source, entreprises.source) END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 6. RPC for geographic stats (dashboard)
-- ============================================================

CREATE OR REPLACE FUNCTION stats_par_region()
RETURNS TABLE (
  region TEXT,
  nb_clients BIGINT,
  nb_offres BIGINT,
  nb_commandes BIGINT,
  ca_total NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(e.region, 'Non renseigné') AS region,
    COUNT(DISTINCT e.id) AS nb_clients,
    COUNT(DISTINCT o.id) AS nb_offres,
    COUNT(DISTINCT c.id) AS nb_commandes,
    COALESCE(SUM(c.montant_ht), 0) AS ca_total
  FROM entreprises e
  LEFT JOIN offres o ON o.entreprise_id = e.id
  LEFT JOIN commandes c ON c.entreprise_id = e.id
  GROUP BY COALESCE(e.region, 'Non renseigné')
  ORDER BY nb_clients DESC;
$$;
