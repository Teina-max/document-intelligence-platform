-- ============================================================
-- ThermoPack Industries — Migration 013
-- Simplify top_materiaux: remove double-encoding workaround
-- Trigger 011 now auto-fixes JSONB on INSERT/UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION top_materiaux(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  reference_materiel TEXT,
  designation TEXT,
  nb_commandes BIGINT,
  quantite_totale NUMERIC(14,2),
  ca_total NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    item->>'reference_materiel' AS reference_materiel,
    item->>'designation' AS designation,
    count(DISTINCT c.id)::BIGINT AS nb_commandes,
    coalesce(sum((item->>'quantite')::NUMERIC), 0)::NUMERIC(14,2) AS quantite_totale,
    coalesce(sum(
      CASE
        WHEN item->>'montant_ligne' IS NOT NULL THEN (item->>'montant_ligne')::NUMERIC
        ELSE (item->>'quantite')::NUMERIC * (item->>'prix_unitaire')::NUMERIC
      END
    ), 0)::NUMERIC(14,2) AS ca_total
  FROM commandes c,
    jsonb_array_elements(c.designations::jsonb) AS item
  WHERE (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
    AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
    AND item->>'reference_materiel' IS NOT NULL
  GROUP BY item->>'reference_materiel', item->>'designation'
  ORDER BY ca_total DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_materiaux IS 'Top N materiaux par CA — simplified, trigger 011 handles JSONB de-encoding';
