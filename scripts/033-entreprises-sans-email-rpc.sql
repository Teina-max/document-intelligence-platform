-- ============================================================
-- Migration 033 : RPC entreprises_sans_email
-- Returns entreprises with offres en_attente but no contact_email
-- Used by the missing-emails dialog on the dashboard
-- ============================================================

CREATE OR REPLACE FUNCTION entreprises_sans_email()
RETURNS TABLE (
  entreprise_id UUID,
  entreprise_nom TEXT,
  pays pays_enum,
  nb_offres_en_attente BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS entreprise_id,
    e.nom AS entreprise_nom,
    e.pays,
    count(o.id)::BIGINT AS nb_offres_en_attente
  FROM entreprises e
  JOIN offres o ON o.entreprise_id = e.id
  WHERE o.statut = 'en_attente'
    AND e.contact_email IS NULL
  GROUP BY e.id, e.nom, e.pays
  ORDER BY count(o.id) DESC, e.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION entreprises_sans_email IS 'Entreprises with pending offres but no contact email — for missing-emails dashboard widget';
