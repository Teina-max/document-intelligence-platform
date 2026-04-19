-- Migration 004: Enable upsert on entreprises table
-- Fix: duplicate key violation when same enterprise appears in multiple documents
-- Date: 2026-03-24

-- Step 1: Drop the existing unique INDEX (not a constraint, can't be used for ON CONFLICT)
DROP INDEX IF EXISTS idx_entreprises_nom_cp;

-- Step 2: Add a proper UNIQUE CONSTRAINT (required for ON CONFLICT upsert)
ALTER TABLE entreprises
  ADD CONSTRAINT uq_entreprises_nom_cp UNIQUE (nom, code_postal);

-- Step 3: Create an upsert function for n8n to call via RPC
-- This handles the "find or create" pattern cleanly
CREATE OR REPLACE FUNCTION upsert_entreprise(
  p_nom TEXT,
  p_code_postal TEXT DEFAULT NULL,
  p_pays TEXT DEFAULT 'FR',
  p_adresse TEXT DEFAULT NULL,
  p_contact_nom TEXT DEFAULT NULL,
  p_contact_telephone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_numero_client TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO entreprises (nom, code_postal, pays, adresse, contact_nom, contact_telephone, contact_email, numero_client)
  VALUES (p_nom, p_code_postal, p_pays::pays_enum, p_adresse, p_contact_nom, p_contact_telephone, p_contact_email, p_numero_client)
  ON CONFLICT (nom, code_postal)
  DO UPDATE SET
    adresse = COALESCE(EXCLUDED.adresse, entreprises.adresse),
    contact_nom = COALESCE(EXCLUDED.contact_nom, entreprises.contact_nom),
    contact_telephone = COALESCE(EXCLUDED.contact_telephone, entreprises.contact_telephone),
    contact_email = COALESCE(EXCLUDED.contact_email, entreprises.contact_email),
    numero_client = COALESCE(EXCLUDED.numero_client, entreprises.numero_client),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
