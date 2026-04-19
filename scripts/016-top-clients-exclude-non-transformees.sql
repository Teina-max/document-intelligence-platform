-- ============================================================
-- Migration 016 : top_clients exclut les offres non transformées
-- Ne garde que les offres transformee / partiellement_transformee
-- ============================================================

CREATE OR REPLACE FUNCTION top_clients(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_pays pays_enum DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  entreprise_id UUID,
  entreprise_nom TEXT,
  pays pays_enum,
  nb_offres BIGINT,
  nb_transformees BIGINT,
  taux_transformation NUMERIC(5,2),
  montant_total_offres NUMERIC(14,2)
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
    coalesce(sum(o.montant_ht), 0)::NUMERIC(14,2) AS montant_total_offres
  FROM entreprises e
  JOIN offres o ON o.entreprise_id = e.id
  WHERE o.statut IN ('transformee', 'partiellement_transformee')
    AND (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
    AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
    AND (p_pays IS NULL OR e.pays = p_pays)
  GROUP BY e.id, e.nom, e.pays
  ORDER BY montant_total_offres DESC, nb_offres DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_clients IS 'Top N clients par CA des offres transformées uniquement';
