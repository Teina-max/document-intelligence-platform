-- F5: Alertes résumé du matin
-- RPC pour récupérer les alertes du dashboard: offres expirant cette semaine, jamais relancées, sans email

ALTER TABLE offres ADD COLUMN IF NOT EXISTS derniere_relance TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION alertes_dashboard()
RETURNS TABLE (
  expirent_7j BIGINT,
  jamais_relancees BIGINT,
  sans_email BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE o.date_expiration IS NOT NULL AND o.date_expiration - CURRENT_DATE BETWEEN 0 AND 7)::BIGINT AS expirent_7j,
    count(*) FILTER (WHERE o.derniere_relance IS NULL)::BIGINT AS jamais_relancees,
    count(*) FILTER (WHERE e.contact_email IS NULL)::BIGINT AS sans_email
  FROM offres o
  JOIN entreprises e ON e.id = o.entreprise_id
  WHERE o.statut = 'en_attente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
