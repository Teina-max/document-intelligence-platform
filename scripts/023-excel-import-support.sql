-- 023-excel-import-support.sql
-- Support for SAP Excel import + rapprochement algorithmique

-- ============================================================
-- 1. New columns
-- ============================================================

ALTER TABLE offres ADD COLUMN IF NOT EXISTS source_import TEXT NOT NULL DEFAULT 'ocr';
COMMENT ON COLUMN offres.source_import IS 'ocr | sap_export | manual';

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS source_import TEXT NOT NULL DEFAULT 'ocr';
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS statut_livraison TEXT;
COMMENT ON COLUMN commandes.source_import IS 'ocr | sap_export | manual';
COMMENT ON COLUMN commandes.statut_livraison IS 'liquide | non_livre | partiellement_livre (from SAP)';

ALTER TABLE offres ADD COLUMN IF NOT EXISTS sap_created_by TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS sap_created_by TEXT;

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_offres_source_import ON offres(source_import);
CREATE INDEX IF NOT EXISTS idx_commandes_source_import ON commandes(source_import);
CREATE INDEX IF NOT EXISTS idx_commandes_statut_livraison ON commandes(statut_livraison)
  WHERE statut_livraison IS NOT NULL;

-- ============================================================
-- 3. Rapprochement algorithmique — preview function (read-only)
-- ============================================================

CREATE OR REPLACE FUNCTION rapprochement_algorithmique(
  p_window_days INTEGER DEFAULT 180,
  p_min_score NUMERIC DEFAULT 0.3
)
RETURNS TABLE(
  commande_id     UUID,
  commande_ref    TEXT,
  matched_offre_id UUID,
  offre_ref       TEXT,
  entreprise_nom  TEXT,
  nb_articles_match INTEGER,
  nb_articles_cde   INTEGER,
  score           NUMERIC,
  jours_ecart     INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  cde_arts AS (
    SELECT DISTINCT c.id AS cde_id, c.reference_commande AS cde_ref,
           c.entreprise_id, c.date_commande,
           d->>'reference_materiel' AS art
    FROM commandes c
    CROSS JOIN LATERAL jsonb_array_elements(c.designations) d
    WHERE c.offre_id IS NULL
      AND c.source_import = 'sap_export'
      AND d->>'reference_materiel' IS NOT NULL
      AND d->>'reference_materiel' != ''
  ),
  cde_counts AS (
    SELECT cde_id, COUNT(*)::integer AS n FROM cde_arts GROUP BY cde_id
  ),
  off_arts AS (
    SELECT DISTINCT o.id AS off_id, o.reference_offre AS off_ref,
           o.entreprise_id, o.date_offre,
           d->>'reference_materiel' AS art
    FROM offres o
    CROSS JOIN LATERAL jsonb_array_elements(o.designations) d
    WHERE o.source_import = 'sap_export'
      AND d->>'reference_materiel' IS NOT NULL
      AND d->>'reference_materiel' != ''
  ),
  matches AS (
    SELECT ca.cde_id, ca.cde_ref, ca.date_commande,
           oa.off_id, oa.off_ref, oa.date_offre,
           COUNT(*)::integer AS nb_match
    FROM cde_arts ca
    JOIN off_arts oa
      ON ca.entreprise_id = oa.entreprise_id
      AND ca.art = oa.art
      AND oa.date_offre <= ca.date_commande
      AND oa.date_offre >= ca.date_commande - make_interval(days => p_window_days)
    GROUP BY ca.cde_id, ca.cde_ref, ca.date_commande,
             oa.off_id, oa.off_ref, oa.date_offre
  ),
  ranked AS (
    SELECT m.cde_id, m.cde_ref, m.off_id, m.off_ref,
           m.nb_match, cc.n AS nb_arts,
           ROUND(m.nb_match::numeric / GREATEST(cc.n, 1), 3) AS match_score,
           (m.date_commande - m.date_offre)::integer AS days_diff,
           ROW_NUMBER() OVER (
             PARTITION BY m.cde_id
             ORDER BY (m.nb_match::numeric / GREATEST(cc.n, 1)) DESC,
                      (m.date_commande - m.date_offre) ASC
           ) AS rn
    FROM matches m
    JOIN cde_counts cc ON cc.cde_id = m.cde_id
  )
  SELECT r.cde_id, r.cde_ref, r.off_id, r.off_ref,
         e.nom, r.nb_match, r.nb_arts, r.match_score, r.days_diff
  FROM ranked r
  JOIN commandes c ON c.id = r.cde_id
  JOIN entreprises e ON e.id = c.entreprise_id
  WHERE r.rn = 1 AND r.match_score >= p_min_score
  ORDER BY r.match_score DESC;
$$;

-- ============================================================
-- 4. Appliquer rapprochement — mutating function
-- ============================================================

CREATE OR REPLACE FUNCTION appliquer_rapprochement(
  p_window_days INTEGER DEFAULT 180,
  p_min_score NUMERIC DEFAULT 0.3
)
RETURNS TABLE(nb_matched INTEGER, nb_offres_transformees INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_matched INTEGER;
  v_transformed INTEGER;
BEGIN
  -- Link commandes to best matching offres
  UPDATE commandes c
  SET offre_id = r.matched_offre_id,
      type = 'egale'
  FROM rapprochement_algorithmique(p_window_days, p_min_score) r
  WHERE c.id = r.commande_id;
  GET DIAGNOSTICS v_matched = ROW_COUNT;

  -- Mark remaining unlinked SAP commandes as directe
  UPDATE commandes
  SET type = 'directe'
  WHERE offre_id IS NULL AND source_import = 'sap_export' AND type != 'directe';

  -- Update offre statuts: linked → transformee
  UPDATE offres o
  SET statut = 'transformee'
  WHERE o.source_import = 'sap_export'
    AND o.statut = 'en_attente'
    AND EXISTS (SELECT 1 FROM commandes c WHERE c.offre_id = o.id);
  GET DIAGNOSTICS v_transformed = ROW_COUNT;

  -- Expire old unmatched SAP offres (>6 months old) to avoid dashboard pollution
  UPDATE offres
  SET statut = 'expiree'
  WHERE source_import = 'sap_export'
    AND statut = 'en_attente'
    AND date_offre < NOW() - INTERVAL '6 months';

  RETURN QUERY SELECT v_matched, v_transformed;
END;
$$;

-- ============================================================
-- 5. Grant access
-- ============================================================

GRANT EXECUTE ON FUNCTION rapprochement_algorithmique TO authenticated;
GRANT EXECUTE ON FUNCTION appliquer_rapprochement TO authenticated;
