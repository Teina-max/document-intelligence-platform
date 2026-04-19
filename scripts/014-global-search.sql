-- ============================================================
-- ThermoPack Industries — Migration 014
-- Global search RPC for header search bar
-- ============================================================

CREATE OR REPLACE FUNCTION recherche_globale(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  title TEXT,
  subtitle TEXT,
  href TEXT
) AS $$
DECLARE
  q TEXT := '%' || lower(p_query) || '%';
BEGIN
  RETURN QUERY

  -- Search offres by reference or entreprise
  (
    SELECT
      'offre'::TEXT AS result_type,
      o.id AS result_id,
      o.reference_offre AS title,
      e.nom AS subtitle,
      '/offres'::TEXT AS href
    FROM offres o
    JOIN entreprises e ON e.id = o.entreprise_id
    WHERE lower(o.reference_offre) LIKE q
      OR lower(e.nom) LIKE q
    ORDER BY o.date_offre DESC
    LIMIT p_limit
  )

  UNION ALL

  -- Search commandes by reference or entreprise
  (
    SELECT
      'commande'::TEXT,
      c.id,
      c.reference_commande,
      e.nom,
      '/commandes'::TEXT
    FROM commandes c
    JOIN entreprises e ON e.id = c.entreprise_id
    WHERE lower(c.reference_commande) LIKE q
      OR lower(e.nom) LIKE q
    ORDER BY c.date_commande DESC
    LIMIT p_limit
  )

  UNION ALL

  -- Search entreprises by name
  (
    SELECT
      'entreprise'::TEXT,
      e.id,
      e.nom,
      coalesce(e.pays::TEXT, '') || ' — ' || coalesce(e.code_postal, ''),
      '/dashboard?entreprise=' || e.id::TEXT
    FROM entreprises e
    WHERE lower(e.nom) LIKE q
    ORDER BY e.nom
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION recherche_globale IS 'Global search across offres, commandes, entreprises';
