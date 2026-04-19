-- Migration 034: Add SAP export columns to offres + commandes
-- Source: 4 SAP Excel exports with montants (09/04/2026)
-- Enables: SAP-first data architecture, accurate montants, deterministic client matching

-- ============================================================
-- 1. OFFRES — SAP columns
-- ============================================================

ALTER TABLE offres ADD COLUMN IF NOT EXISTS montant_sap NUMERIC(12,2);
ALTER TABLE offres ADD COLUMN IF NOT EXISTS statut_sap TEXT;
ALTER TABLE offres ADD COLUMN IF NOT EXISTS cree_par TEXT;
ALTER TABLE offres ADD COLUMN IF NOT EXISTS donneur_ordre TEXT;
ALTER TABLE offres ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ocr';
ALTER TABLE offres ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

COMMENT ON COLUMN offres.montant_sap IS 'Montant from SAP export (source of truth)';
COMMENT ON COLUMN offres.statut_sap IS 'Raw SAP status: Non référé, Partiellemt terminé';
COMMENT ON COLUMN offres.donneur_ordre IS 'SAP client number (maps to entreprises.numero_client)';
COMMENT ON COLUMN offres.source IS 'ocr, sap, sap+ocr, excel';

-- ============================================================
-- 2. COMMANDES — SAP columns
-- ============================================================

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS montant_sap NUMERIC(12,2);
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS statut_sap TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS cree_par TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS donneur_ordre TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS type_document_vente TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ocr';
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

COMMENT ON COLUMN commandes.montant_sap IS 'Montant from SAP export (source of truth)';
COMMENT ON COLUMN commandes.statut_sap IS 'Raw SAP status: Liquidé, Non livré, etc.';
COMMENT ON COLUMN commandes.donneur_ordre IS 'SAP client number (maps to entreprises.numero_client)';
COMMENT ON COLUMN commandes.type_document_vente IS 'SAP doc type: YET, etc.';
COMMENT ON COLUMN commandes.source IS 'ocr, sap, sap+ocr, excel';

-- ============================================================
-- 3. INDEXES for matching
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_offres_donneur ON offres(donneur_ordre) WHERE donneur_ordre IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commandes_donneur ON commandes(donneur_ordre) WHERE donneur_ordre IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offres_source ON offres(source);
CREATE INDEX IF NOT EXISTS idx_commandes_source ON commandes(source);
