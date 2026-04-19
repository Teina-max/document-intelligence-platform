-- 024: Add contact_email + contact_nom to offres_non_transformees RPC
-- Needed for the "Relancer" mailto button on dashboard + offres page

DROP FUNCTION IF EXISTS offres_non_transformees(pays_enum, uuid);

CREATE OR REPLACE FUNCTION offres_non_transformees(
  p_pays pays_enum DEFAULT NULL,
  p_entreprise_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  reference_offre TEXT,
  entreprise_nom TEXT,
  entreprise_pays pays_enum,
  montant_ht NUMERIC(12,2),
  date_offre DATE,
  date_expiration DATE,
  jours_restants INTEGER,
  contact_email TEXT,
  contact_nom TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.reference_offre,
    e.nom AS entreprise_nom,
    e.pays AS entreprise_pays,
    o.montant_ht,
    o.date_offre,
    o.date_expiration,
    CASE
      WHEN o.date_expiration IS NULL THEN NULL
      ELSE (o.date_expiration - CURRENT_DATE)::INTEGER
    END AS jours_restants,
    e.contact_email,
    e.contact_nom
  FROM offres o
  JOIN entreprises e ON e.id = o.entreprise_id
  WHERE o.statut = 'en_attente'
    AND (p_pays IS NULL OR e.pays = p_pays)
    AND (p_entreprise_id IS NULL OR o.entreprise_id = p_entreprise_id)
  ORDER BY
    CASE WHEN o.date_expiration IS NULL THEN 1 ELSE 0 END,
    o.date_expiration ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
