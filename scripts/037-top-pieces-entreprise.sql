-- ============================================================
-- ThermoPack Industries — Migration 024
-- RPC top_pieces_par_entreprise
-- Top pieces commandees par un client, via commande_lignes JOIN pieces
-- ============================================================

CREATE OR REPLACE FUNCTION top_pieces_par_entreprise(
  p_entreprise_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  reference TEXT,
  nom_fr TEXT,
  nb_commandes BIGINT,
  quantite_totale NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.reference,
    p.nom_fr,
    count(DISTINCT cl.commande_id) AS nb_commandes,
    coalesce(sum(cl.quantite), 0) AS quantite_totale
  FROM commande_lignes cl
  JOIN pieces p ON p.id = cl.piece_id
  JOIN commandes c ON c.id = cl.commande_id
  WHERE c.entreprise_id = p_entreprise_id
    AND cl.piece_id IS NOT NULL
  GROUP BY p.reference, p.nom_fr
  ORDER BY nb_commandes DESC, quantite_totale DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_pieces_par_entreprise IS 'Top pieces commandees par un client, triees par nb commandes';
