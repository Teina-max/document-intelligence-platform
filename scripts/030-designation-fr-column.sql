-- Migration 030: Add designation_fr column for French translations of designations
-- Date: 2026-04-08

-- Add designation_fr to offre_lignes
ALTER TABLE offre_lignes ADD COLUMN IF NOT EXISTS designation_fr TEXT;

-- Add designation_fr to commande_lignes
ALTER TABLE commande_lignes ADD COLUMN IF NOT EXISTS designation_fr TEXT;

-- Comment
COMMENT ON COLUMN offre_lignes.designation_fr IS 'French translation of designation_brute (auto-translated if original is not French)';
COMMENT ON COLUMN commande_lignes.designation_fr IS 'French translation of designation_brute (auto-translated if original is not French)';
