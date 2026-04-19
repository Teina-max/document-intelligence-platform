-- 003-add-columns-and-tables.sql
-- Sprint 3: Add missing columns + create log tables for workflows

-- ============================================================
-- 1. Add missing columns discovered from PDF analysis (19/03)
-- ============================================================

-- numero_client: ThermoPack internal client number (ex: 701441, 201912)
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS numero_client TEXT;

-- numero_commande_client: client's own order number (ex: 6DY164322, "BPA le 06/03/26")
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS numero_commande_client TEXT;

-- ============================================================
-- 2. Unique constraint for entreprise upsert (used by n8n WF-001)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_entreprises_nom_cp
  ON entreprises (nom, code_postal);

-- ============================================================
-- 3. Rapprochements log table (used by n8n WF-002)
-- ============================================================

CREATE TABLE IF NOT EXISTS rapprochements_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offre_id UUID REFERENCES offres(id),
  reference_offre TEXT,
  montant_offre NUMERIC(12,2),
  total_commandes NUMERIC(12,2),
  nb_commandes INTEGER DEFAULT 0,
  type_rapprochement TEXT CHECK (type_rapprochement IN ('egale', 'partielle', 'superieure', 'non_transformee')),
  ancien_statut TEXT,
  nouveau_statut TEXT,
  ecart NUMERIC(12,2),
  taux_transformation INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Relances log table (used by n8n WF-003)
-- ============================================================

CREATE TABLE IF NOT EXISTS relances_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offre_id UUID REFERENCES offres(id),
  reference_offre TEXT,
  entreprise_nom TEXT,
  palier TEXT CHECK (palier IN ('J-30', 'J-15', 'J-7', 'J-1')),
  email_destinataire TEXT,
  email_sujet TEXT,
  statut TEXT DEFAULT 'envoye' CHECK (statut IN ('envoye', 'erreur')),
  erreur TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. RLS policies for new tables
-- ============================================================

ALTER TABLE rapprochements_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances_log ENABLE ROW LEVEL SECURITY;

-- Service role (n8n) — full access
CREATE POLICY "service_role_all_rapprochements" ON rapprochements_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_relances" ON relances_log
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users — read only
CREATE POLICY "authenticated_read_rapprochements" ON rapprochements_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_relances" ON relances_log
  FOR SELECT TO authenticated USING (true);
