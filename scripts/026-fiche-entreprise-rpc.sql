-- RPC to get company KPIs for the fiche entreprise page
CREATE OR REPLACE FUNCTION fiche_entreprise_kpis(p_entreprise_id UUID)
RETURNS TABLE (
  nb_offres BIGINT,
  nb_commandes BIGINT,
  nb_transformees BIGINT,
  taux_transformation NUMERIC(5,2),
  ca_offres NUMERIC(14,2),
  ca_commandes NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH offres_stats AS (
    SELECT
      count(*)::BIGINT AS nb_offres,
      count(*) FILTER (WHERE statut IN ('transformee', 'partiellement_transformee'))::BIGINT AS nb_transformees,
      coalesce(sum(montant_ht), 0)::NUMERIC(14,2) AS ca_offres
    FROM offres WHERE entreprise_id = p_entreprise_id
  ),
  commandes_stats AS (
    SELECT
      count(*)::BIGINT AS nb_commandes,
      coalesce(sum(montant_ht), 0)::NUMERIC(14,2) AS ca_commandes
    FROM commandes WHERE entreprise_id = p_entreprise_id
  )
  SELECT
    os.nb_offres, cs.nb_commandes, os.nb_transformees,
    CASE WHEN os.nb_offres = 0 THEN 0
      ELSE round(os.nb_transformees::NUMERIC / os.nb_offres * 100, 2)
    END,
    os.ca_offres, cs.ca_commandes
  FROM offres_stats os, commandes_stats cs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
