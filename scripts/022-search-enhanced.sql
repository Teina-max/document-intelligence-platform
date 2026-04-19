-- Migration 022: Enhanced recherche_globale with statut and entreprise_id
-- Adds status badges to search results and enterprise-filtered navigation
-- Date: 2026-03-30

-- Must DROP first because return type changes (PostgreSQL limitation)
DROP FUNCTION IF EXISTS recherche_globale(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION recherche_globale(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  title TEXT,
  subtitle TEXT,
  href TEXT,
  statut TEXT,
  entreprise_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Offres: include statut and entreprise_id
  (SELECT
    'offre'::TEXT as result_type,
    o.id as result_id,
    o.reference_offre as title,
    e.nom as subtitle,
    '/offres' as href,
    o.statut::TEXT as statut,
    o.entreprise_id as entreprise_id
  FROM offres o
  LEFT JOIN entreprises e ON e.id = o.entreprise_id
  WHERE o.reference_offre ILIKE '%' || p_query || '%'
     OR e.nom ILIKE '%' || p_query || '%'
  ORDER BY o.date_offre DESC
  LIMIT p_limit)

  UNION ALL

  -- Commandes: statut=NULL, include entreprise_id
  (SELECT
    'commande'::TEXT,
    c.id,
    c.reference_commande,
    e.nom,
    '/commandes',
    NULL::TEXT,
    c.entreprise_id
  FROM commandes c
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE c.reference_commande ILIKE '%' || p_query || '%'
     OR e.nom ILIKE '%' || p_query || '%'
  ORDER BY c.date_commande DESC
  LIMIT p_limit)

  UNION ALL

  -- Entreprises: statut=NULL, entreprise_id=self, search aliases too
  (SELECT
    'entreprise'::TEXT,
    e.id,
    e.nom,
    e.code_postal,
    '/offres',
    NULL::TEXT,
    e.id
  FROM entreprises e
  WHERE e.nom ILIKE '%' || p_query || '%'
     OR e.numero_client ILIKE '%' || p_query || '%'
     OR EXISTS(SELECT 1 FROM unnest(e.noms_alternatifs) AS alias WHERE alias ILIKE '%' || p_query || '%')
  ORDER BY e.nom
  LIMIT p_limit)
$$;
