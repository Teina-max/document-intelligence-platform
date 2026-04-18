-- ============================================================
-- Migration 028 : top_clients add sort mode + CA commandes
-- Adds p_sort_by parameter (ca | taux) and ca_commandes column
-- When sorting by 'taux': includes ALL offres to show real conversion rate
-- When sorting by 'ca': only includes transformed offres (existing behavior)
-- ============================================================

CREATE OR REPLACE FUNCTION top_clients(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_pays pays_enum DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_sort_by TEXT DEFAULT 'ca'
)
RETURNS TABLE (
  entreprise_id UUID,
  entreprise_nom TEXT,
  pays pays_enum,
  nb_offres BIGINT,
  nb_transformees BIGINT,
  taux_transformation NUMERIC(5,2),
  montant_total_offres NUMERIC(14,2),
  ca_commandes NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS entreprise_id,
    e.nom AS entreprise_nom,
    e.pays,
    count(o.id)::BIGINT AS nb_offres,
    count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::BIGINT AS nb_transformees,
    CASE
      WHEN count(o.id) = 0 THEN 0
      ELSE round(
        count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC
        / count(o.id)::NUMERIC * 100, 2
      )
    END::NUMERIC(5,2) AS taux_transformation,
    coalesce(sum(o.montant_ht) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee')), 0)::NUMERIC(14,2) AS montant_total_offres,
    coalesce((
      SELECT sum(c.montant_ht)::NUMERIC(14,2)
      FROM commandes c
      WHERE c.entreprise_id = e.id
        AND (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
        AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
    ), 0)::NUMERIC(14,2) AS ca_commandes
  FROM entreprises e
  JOIN offres o ON o.entreprise_id = e.id
  WHERE
    -- When sorting by taux: include ALL offres to compute real conversion rate
    -- When sorting by ca: only transformed offres (existing behavior)
    (p_sort_by = 'taux' OR o.statut IN ('transformee', 'partiellement_transformee'))
    AND (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
    AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
    AND (p_pays IS NULL OR e.pays = p_pays)
  GROUP BY e.id, e.nom, e.pays
  ORDER BY
    CASE
      WHEN p_sort_by = 'taux' THEN taux_transformation
      ELSE ca_commandes
    END DESC NULLS LAST,
    nb_offres DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_clients IS 'Top N clients by CA commandes or transformation rate with dynamic sorting';
