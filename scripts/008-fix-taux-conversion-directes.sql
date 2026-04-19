-- ============================================================
-- ThermoPack Industries — Migration 008
-- Fix kpis_direction: exclude commandes directes from taux_conversion
-- Add nb_commandes_directes + montant_commandes_directes columns
-- ============================================================

DROP FUNCTION IF EXISTS kpis_direction(DATE, DATE);

CREATE OR REPLACE FUNCTION kpis_direction(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  ca_total NUMERIC(14,2),
  ca_france NUMERIC(14,2),
  ca_espagne NUMERIC(14,2),
  nb_offres_emises BIGINT,
  nb_commandes_recues BIGINT,
  montant_offres NUMERIC(14,2),
  montant_commandes NUMERIC(14,2),
  taux_conversion NUMERIC(5,2),
  ca_total_precedent NUMERIC(14,2),
  evolution_pct NUMERIC(5,2),
  nb_commandes_directes BIGINT,
  montant_commandes_directes NUMERIC(14,2)
) AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  IF p_date_debut IS NOT NULL AND p_date_fin IS NOT NULL THEN
    v_interval := p_date_fin - p_date_debut + 1;
  ELSE
    v_interval := INTERVAL '30 days';
  END IF;

  RETURN QUERY
  WITH periode_courante AS (
    SELECT
      coalesce(sum(c.montant_ht), 0) AS ca_tot,
      coalesce(sum(c.montant_ht) FILTER (WHERE e.pays = 'FR'), 0) AS ca_fr,
      coalesce(sum(c.montant_ht) FILTER (WHERE e.pays = 'ES'), 0) AS ca_es,
      -- All commandes
      count(c.id) AS nb_cmd_total,
      -- Only commandes linked to an offre (exclude directes)
      count(c.id) FILTER (WHERE c.type <> 'directe') AS nb_cmd_liees,
      -- Directes only
      count(c.id) FILTER (WHERE c.type = 'directe') AS nb_cmd_directes,
      coalesce(sum(c.montant_ht) FILTER (WHERE c.type = 'directe'), 0) AS mt_cmd_directes
    FROM commandes c
    JOIN entreprises e ON e.id = c.entreprise_id
    WHERE (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
      AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
  ),
  offres_periode AS (
    SELECT
      count(o.id) AS nb_off,
      coalesce(sum(o.montant_ht), 0) AS mt_off
    FROM offres o
    WHERE (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
      AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
  ),
  periode_precedente AS (
    SELECT coalesce(sum(c.montant_ht), 0) AS ca_prec
    FROM commandes c
    WHERE p_date_debut IS NOT NULL
      AND p_date_fin IS NOT NULL
      AND c.date_commande >= (p_date_debut - v_interval)::DATE
      AND c.date_commande < p_date_debut
  )
  SELECT
    pc.ca_tot::NUMERIC(14,2),
    pc.ca_fr::NUMERIC(14,2),
    pc.ca_es::NUMERIC(14,2),
    op.nb_off::BIGINT,
    pc.nb_cmd_total::BIGINT,
    op.mt_off::NUMERIC(14,2),
    pc.ca_tot::NUMERIC(14,2),
    -- Taux conversion = commandes liées à une offre / nb offres (hors directes)
    CASE
      WHEN op.nb_off = 0 THEN 0
      ELSE round(pc.nb_cmd_liees::NUMERIC / op.nb_off::NUMERIC * 100, 2)
    END::NUMERIC(5,2),
    pp.ca_prec::NUMERIC(14,2),
    CASE
      WHEN pp.ca_prec = 0 THEN 0
      ELSE round((pc.ca_tot - pp.ca_prec) / pp.ca_prec * 100, 2)
    END::NUMERIC(5,2),
    pc.nb_cmd_directes::BIGINT,
    pc.mt_cmd_directes::NUMERIC(14,2)
  FROM periode_courante pc, offres_periode op, periode_precedente pp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION kpis_direction IS 'KPIs direction : CA par pays, taux conversion (hors directes), evolution vs periode precedente, stats directes';
