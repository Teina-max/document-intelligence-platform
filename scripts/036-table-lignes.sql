-- ============================================================
-- ThermoPack Industries — Migration 023
-- Tables offre_lignes et commande_lignes
-- Lignes de detail avec FK vers pieces
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE offre_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id UUID NOT NULL REFERENCES offres(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES pieces(id) ON DELETE SET NULL,
  poste INTEGER,
  designation_brute TEXT,
  quantite NUMERIC(10,2) DEFAULT 0,
  prix_unitaire NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE offre_lignes IS 'Lignes de detail des offres avec lien vers pieces';
COMMENT ON COLUMN offre_lignes.poste IS 'Numero de ligne SAP (10, 20, 30...)';
COMMENT ON COLUMN offre_lignes.designation_brute IS 'Designation telle quelle avant normalisation';

CREATE TABLE commande_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES pieces(id) ON DELETE SET NULL,
  poste INTEGER,
  designation_brute TEXT,
  quantite NUMERIC(10,2) DEFAULT 0,
  prix_unitaire NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE commande_lignes IS 'Lignes de detail des commandes avec lien vers pieces';

-- ============================================================
-- 2. INDEX
-- ============================================================

CREATE INDEX idx_offre_lignes_offre ON offre_lignes(offre_id);
CREATE INDEX idx_offre_lignes_piece ON offre_lignes(piece_id);
CREATE INDEX idx_commande_lignes_commande ON commande_lignes(commande_id);
CREATE INDEX idx_commande_lignes_piece ON commande_lignes(piece_id);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE offre_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE commande_lignes ENABLE ROW LEVEL SECURITY;

-- offre_lignes : memes policies que offres
CREATE POLICY "offre_lignes_select"
  ON offre_lignes FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial', 'comptable'));

CREATE POLICY "offre_lignes_insert"
  ON offre_lignes FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "offre_lignes_update"
  ON offre_lignes FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'))
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "offre_lignes_delete"
  ON offre_lignes FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');

-- commande_lignes : memes policies que commandes
CREATE POLICY "commande_lignes_select"
  ON commande_lignes FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial', 'comptable'));

CREATE POLICY "commande_lignes_insert"
  ON commande_lignes FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "commande_lignes_update"
  ON commande_lignes FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'))
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "commande_lignes_delete"
  ON commande_lignes FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');
