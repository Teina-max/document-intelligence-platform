-- ============================================================
-- ThermoPack Industries — Migration 022
-- Table pieces : referentiel des pieces detachees ThermoPack
-- ============================================================

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  nom_fr TEXT NOT NULL,
  nom_original TEXT,
  variantes TEXT[] DEFAULT '{}',
  categorie TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pieces IS 'Referentiel des pieces detachees ThermoPack (article SAP)';
COMMENT ON COLUMN pieces.reference IS 'Numero article SAP unique (ex: 9034605)';
COMMENT ON COLUMN pieces.nom_fr IS 'Designation canonique en francais';
COMMENT ON COLUMN pieces.nom_original IS 'Designation brute d origine si differente du nom_fr';
COMMENT ON COLUMN pieces.variantes IS 'Alias connus (espagnol, allemand, variantes OCR)';

-- ============================================================
-- 2. INDEX
-- ============================================================

CREATE INDEX idx_pieces_reference ON pieces(reference);
CREATE INDEX idx_pieces_nom_fr ON pieces USING gin(to_tsvector('french', nom_fr));
CREATE INDEX idx_pieces_variantes ON pieces USING gin(variantes);

-- ============================================================
-- 3. TRIGGER updated_at
-- ============================================================

CREATE TRIGGER trg_pieces_updated_at
  BEFORE UPDATE ON pieces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;

-- Read : tous les roles authentifies
CREATE POLICY "pieces_select"
  ON pieces FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial', 'comptable'));

-- Insert/Update : admin + commercial
CREATE POLICY "pieces_insert"
  ON pieces FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "pieces_update"
  ON pieces FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'))
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

-- Delete : admin only
CREATE POLICY "pieces_delete"
  ON pieces FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');
