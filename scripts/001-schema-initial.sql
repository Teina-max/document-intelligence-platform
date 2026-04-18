-- ============================================================
-- ThermoPack Industries — Schema initial (US-001)
-- Migration 001 : Tables, enums, index, RLS, policies, functions
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE statut_offre AS ENUM (
  'en_attente',
  'transformee',
  'partiellement_transformee',
  'expiree'
);

CREATE TYPE type_commande AS ENUM (
  'partielle',
  'egale',
  'superieure',
  'directe'
);

CREATE TYPE pays_enum AS ENUM ('FR', 'ES');

CREATE TYPE statut_ocr AS ENUM (
  'success',
  'partial',
  'failed'
);

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Entreprises (clients ThermoPack)
CREATE TABLE entreprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code_postal TEXT,
  pays pays_enum NOT NULL DEFAULT 'FR',
  adresse TEXT,
  contact_nom TEXT,
  contact_email TEXT,
  contact_telephone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE entreprises IS 'Clients ThermoPack Industries et Espagne';

-- Offres (devis emis)
CREATE TABLE offres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_offre TEXT NOT NULL UNIQUE,
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE RESTRICT,
  montant_ht NUMERIC(12,2),
  montant_ttc NUMERIC(12,2),
  date_offre DATE NOT NULL,
  date_expiration DATE,
  statut statut_offre NOT NULL DEFAULT 'en_attente',
  correspondant TEXT,
  designations JSONB DEFAULT '[]'::jsonb,
  fichier_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE offres IS 'Offres/devis emis par le pole pieces';
COMMENT ON COLUMN offres.designations IS 'Array [{designation, quantite, prix_unitaire}]';
COMMENT ON COLUMN offres.fichier_source IS 'Chemin OneDrive du PDF source';

-- Commandes (recues)
CREATE TABLE commandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_commande TEXT NOT NULL UNIQUE,
  offre_id UUID REFERENCES offres(id) ON DELETE SET NULL,
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE RESTRICT,
  montant_ht NUMERIC(12,2),
  montant_ttc NUMERIC(12,2),
  date_commande DATE NOT NULL,
  date_expedition DATE,
  type type_commande NOT NULL DEFAULT 'directe',
  designations JSONB DEFAULT '[]'::jsonb,
  fichier_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE commandes IS 'Commandes recues par le pole pieces';
COMMENT ON COLUMN commandes.offre_id IS 'NULL = commande directe (sans offre prealable)';
COMMENT ON COLUMN commandes.type IS 'Calcule au rapprochement : partielle/egale/superieure/directe';

-- Logs OCR
CREATE TABLE ocr_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fichier_source TEXT NOT NULL,
  type_document TEXT NOT NULL CHECK (type_document IN ('offre', 'commande')),
  statut statut_ocr NOT NULL DEFAULT 'success',
  donnees_extraites JSONB,
  erreurs TEXT[],
  score_confiance NUMERIC(3,2) CHECK (score_confiance BETWEEN 0 AND 1),
  record_id UUID,
  duree_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ocr_logs IS 'Journal des extractions OCR Claude API';
COMMENT ON COLUMN ocr_logs.record_id IS 'ID de l offre ou commande creee (si success)';
COMMENT ON COLUMN ocr_logs.score_confiance IS 'Score de confiance OCR entre 0 et 1';

-- ============================================================
-- 3. INDEX
-- ============================================================

CREATE INDEX idx_offres_entreprise ON offres(entreprise_id);
CREATE INDEX idx_offres_reference ON offres(reference_offre);
CREATE INDEX idx_offres_date ON offres(date_offre DESC);
CREATE INDEX idx_offres_statut ON offres(statut);
CREATE INDEX idx_offres_expiration ON offres(date_expiration) WHERE statut = 'en_attente';

CREATE INDEX idx_commandes_entreprise ON commandes(entreprise_id);
CREATE INDEX idx_commandes_offre ON commandes(offre_id);
CREATE INDEX idx_commandes_date ON commandes(date_commande DESC);

CREATE INDEX idx_ocr_logs_statut ON ocr_logs(statut) WHERE statut != 'success';
CREATE INDEX idx_ocr_logs_created ON ocr_logs(created_at DESC);

-- ============================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entreprises_updated_at
  BEFORE UPDATE ON entreprises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_offres_updated_at
  BEFORE UPDATE ON offres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_commandes_updated_at
  BEFORE UPDATE ON commandes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. RLS — Enable
-- ============================================================

ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
-- Roles via app_metadata:
--   { "role": "admin" }    → Éric Martin (DG) : full read, manage users
--   { "role": "commercial" } → Alice : full CRUD offres/commandes/entreprises
--   { "role": "comptable" }  → Gabrielle Petit : read-only
--   service_role (n8n, Edge Functions) : bypass RLS nativement
-- ============================================================

-- Helper function : extract role from app_metadata
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'none'
  );
$$ LANGUAGE sql STABLE;

-- ---- ENTREPRISES ----

-- Read : tous les roles authentifies
CREATE POLICY "entreprises_select"
  ON entreprises FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial', 'comptable'));

-- Insert/Update : admin + commercial
CREATE POLICY "entreprises_insert"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "entreprises_update"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'))
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

-- Delete : admin only
CREATE POLICY "entreprises_delete"
  ON entreprises FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');

-- ---- OFFRES ----

CREATE POLICY "offres_select"
  ON offres FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial', 'comptable'));

CREATE POLICY "offres_insert"
  ON offres FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "offres_update"
  ON offres FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'))
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "offres_delete"
  ON offres FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');

-- ---- COMMANDES ----

CREATE POLICY "commandes_select"
  ON commandes FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial', 'comptable'));

CREATE POLICY "commandes_insert"
  ON commandes FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "commandes_update"
  ON commandes FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'))
  WITH CHECK (public.user_role() IN ('admin', 'commercial'));

CREATE POLICY "commandes_delete"
  ON commandes FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');

-- ---- OCR_LOGS ----

-- Read : admin + commercial (pour review des erreurs)
CREATE POLICY "ocr_logs_select"
  ON ocr_logs FOR SELECT
  TO authenticated
  USING (public.user_role() IN ('admin', 'commercial'));

-- Insert : personne via authenticated (service_role only via Edge Functions)
-- Pas de policy INSERT pour authenticated = seul service_role peut inserer

-- ============================================================
-- 7. SQL FUNCTIONS (SECURITY DEFINER)
-- ============================================================

-- Rapprochement : calcule le type de commande et met a jour le statut offre
CREATE OR REPLACE FUNCTION rapprocher_commande(p_commande_id UUID)
RETURNS void AS $$
DECLARE
  v_offre_id UUID;
  v_montant_offre NUMERIC(12,2);
  v_total_commandes NUMERIC(12,2);
  v_type type_commande;
  v_statut statut_offre;
BEGIN
  -- Recuperer l'offre liee
  SELECT offre_id INTO v_offre_id
  FROM commandes WHERE id = p_commande_id;

  -- Si pas d'offre liee = commande directe
  IF v_offre_id IS NULL THEN
    UPDATE commandes SET type = 'directe' WHERE id = p_commande_id;
    RETURN;
  END IF;

  -- Montant de l'offre
  SELECT montant_ht INTO v_montant_offre
  FROM offres WHERE id = v_offre_id;

  -- Classifier la commande individuelle vs montant offre
  SELECT montant_ht INTO v_total_commandes FROM commandes WHERE id = p_commande_id;
  IF v_total_commandes < v_montant_offre THEN
    v_type := 'partielle';
  ELSIF v_total_commandes = v_montant_offre THEN
    v_type := 'egale';
  ELSE
    v_type := 'superieure';
  END IF;

  UPDATE commandes SET type = v_type WHERE id = p_commande_id;

  -- Recalculer le statut de l'offre (somme de TOUTES les commandes liees)
  SELECT coalesce(sum(montant_ht), 0) INTO v_total_commandes
  FROM commandes WHERE offre_id = v_offre_id;

  IF v_total_commandes >= v_montant_offre THEN
    v_statut := 'transformee';
  ELSIF v_total_commandes > 0 THEN
    v_statut := 'partiellement_transformee';
  ELSE
    v_statut := 'en_attente';
  END IF;

  UPDATE offres SET statut = v_statut WHERE id = v_offre_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rapprocher_commande IS 'Classe une commande et met a jour le statut de l offre liee';

-- Taux de transformation global (par periode et pays optionnels)
CREATE OR REPLACE FUNCTION taux_transformation(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_pays pays_enum DEFAULT NULL
)
RETURNS TABLE (
  total_offres BIGINT,
  offres_transformees BIGINT,
  offres_partielles BIGINT,
  offres_en_attente BIGINT,
  montant_offres NUMERIC(14,2),
  montant_commandes NUMERIC(14,2),
  taux_transformation NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH offres_filtrees AS (
    SELECT o.id, o.montant_ht, o.statut
    FROM offres o
    JOIN entreprises e ON e.id = o.entreprise_id
    WHERE (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
      AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
      AND (p_pays IS NULL OR e.pays = p_pays)
  ),
  commandes_liees AS (
    SELECT coalesce(sum(c.montant_ht), 0) AS total
    FROM commandes c
    WHERE c.offre_id IN (SELECT of2.id FROM offres_filtrees of2)
  )
  SELECT
    count(*)::BIGINT AS total_offres,
    count(*) FILTER (WHERE of1.statut = 'transformee')::BIGINT,
    count(*) FILTER (WHERE of1.statut = 'partiellement_transformee')::BIGINT,
    count(*) FILTER (WHERE of1.statut = 'en_attente')::BIGINT,
    coalesce(sum(of1.montant_ht), 0)::NUMERIC(14,2),
    (SELECT cl.total FROM commandes_liees cl)::NUMERIC(14,2),
    CASE
      WHEN count(*) = 0 THEN 0
      ELSE round(
        count(*) FILTER (WHERE of1.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC
        / count(*)::NUMERIC * 100, 2
      )
    END::NUMERIC(5,2)
  FROM offres_filtrees of1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION taux_transformation IS 'Calcule le taux de transformation avec filtres optionnels (periode, pays)';

-- Offres a relancer (non transformees, triees par urgence)
CREATE OR REPLACE FUNCTION offres_a_relancer(p_jours_avant_expiration INTEGER DEFAULT 30)
RETURNS TABLE (
  offre_id UUID,
  reference_offre TEXT,
  entreprise_nom TEXT,
  contact_email TEXT,
  pays pays_enum,
  montant_ht NUMERIC(12,2),
  date_expiration DATE,
  jours_restants INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.reference_offre,
    e.nom,
    e.contact_email,
    e.pays,
    o.montant_ht,
    o.date_expiration,
    (o.date_expiration - current_date)::INTEGER AS jours_restants
  FROM offres o
  JOIN entreprises e ON e.id = o.entreprise_id
  WHERE o.statut = 'en_attente'
    AND o.date_expiration IS NOT NULL
    AND o.date_expiration >= current_date
    AND (o.date_expiration - current_date) <= p_jours_avant_expiration
  ORDER BY o.date_expiration ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION offres_a_relancer IS 'Liste les offres non transformees a relancer avant expiration';

-- Expirer les offres depassees (a appeler via cron n8n ou pg_cron)
CREATE OR REPLACE FUNCTION expirer_offres()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE offres
  SET statut = 'expiree'
  WHERE statut = 'en_attente'
    AND date_expiration < current_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expirer_offres IS 'Passe en expiree les offres depassees. Retourne le nombre de lignes affectees.';
