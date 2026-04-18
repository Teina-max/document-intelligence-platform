-- ============================================================
-- ThermoPack Industries — Migration 007 : Direction + Analyse RPCs
-- US-007: Dashboard KPI Direction
-- US-008: Analyse comportement client/produit
-- ============================================================

-- ============================================================
-- 1. kpis_direction — KPIs globaux pour Éric Martin (DG)
-- ============================================================

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
  evolution_pct NUMERIC(5,2)
) AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  -- Calculate the period length for comparison
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
      count(c.id) AS nb_cmd
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
    pc.nb_cmd::BIGINT,
    op.mt_off::NUMERIC(14,2),
    pc.ca_tot::NUMERIC(14,2),
    CASE
      WHEN op.nb_off = 0 THEN 0
      ELSE round(pc.nb_cmd::NUMERIC / op.nb_off::NUMERIC * 100, 2)
    END::NUMERIC(5,2),
    pp.ca_prec::NUMERIC(14,2),
    CASE
      WHEN pp.ca_prec = 0 THEN 0
      ELSE round((pc.ca_tot - pp.ca_prec) / pp.ca_prec * 100, 2)
    END::NUMERIC(5,2)
  FROM periode_courante pc, offres_periode op, periode_precedente pp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION kpis_direction IS 'KPIs direction : CA par pays, taux conversion, evolution vs periode precedente';

-- ============================================================
-- 2. ca_mensuel — CA par mois pour une annee donnee
-- ============================================================

CREATE OR REPLACE FUNCTION ca_mensuel(
  p_annee INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  mois INTEGER,
  mois_label TEXT,
  ca_france NUMERIC(14,2),
  ca_espagne NUMERIC(14,2),
  ca_total NUMERIC(14,2),
  nb_commandes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH mois_serie AS (
    SELECT generate_series(1, 12) AS m
  ),
  data AS (
    SELECT
      EXTRACT(MONTH FROM c.date_commande)::INTEGER AS m,
      coalesce(sum(c.montant_ht) FILTER (WHERE e.pays = 'FR'), 0) AS ca_fr,
      coalesce(sum(c.montant_ht) FILTER (WHERE e.pays = 'ES'), 0) AS ca_es,
      coalesce(sum(c.montant_ht), 0) AS ca_tot,
      count(c.id) AS nb_cmd
    FROM commandes c
    JOIN entreprises e ON e.id = c.entreprise_id
    WHERE EXTRACT(YEAR FROM c.date_commande) = p_annee
    GROUP BY EXTRACT(MONTH FROM c.date_commande)
  )
  SELECT
    ms.m::INTEGER AS mois,
    to_char(make_date(p_annee, ms.m, 1), 'TMMonth')::TEXT AS mois_label,
    coalesce(d.ca_fr, 0)::NUMERIC(14,2),
    coalesce(d.ca_es, 0)::NUMERIC(14,2),
    coalesce(d.ca_tot, 0)::NUMERIC(14,2),
    coalesce(d.nb_cmd, 0)::BIGINT
  FROM mois_serie ms
  LEFT JOIN data d ON d.m = ms.m
  ORDER BY ms.m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION ca_mensuel IS 'CA mensuel par pays pour une annee donnee (12 lignes)';

-- ============================================================
-- 3. top_materiaux — Pieces les plus vendues
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
    jsonb_array_elements(
      CASE jsonb_typeof(c.designations::jsonb)
        WHEN 'array' THEN c.designations::jsonb
        WHEN 'string' THEN (c.designations::jsonb #>> '{}')::jsonb
        ELSE '[]'::jsonb
      END
    ) AS item
  WHERE (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
    AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
    AND item->>'reference_materiel' IS NOT NULL
  GROUP BY item->>'reference_materiel', item->>'designation'
  ORDER BY ca_total DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_materiaux IS 'Top N materiaux par CA, agregation depuis designations JSONB des commandes';

-- ============================================================
-- 4. recurrence_clients — Clients avec commandes recurrentes
-- ============================================================

CREATE OR REPLACE FUNCTION recurrence_clients(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  entreprise_id UUID,
  entreprise_nom TEXT,
  pays pays_enum,
  nb_commandes BIGINT,
  frequence_moyenne_jours INTEGER,
  derniere_commande DATE,
  ca_total NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH cmd_par_client AS (
    SELECT
      c.entreprise_id,
      c.date_commande,
      c.montant_ht,
      LAG(c.date_commande) OVER (PARTITION BY c.entreprise_id ORDER BY c.date_commande) AS prev_date
    FROM commandes c
    WHERE (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
      AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
  ),
  stats AS (
    SELECT
      cpc.entreprise_id,
      count(*)::BIGINT AS nb_cmd,
      coalesce(avg(cpc.date_commande - cpc.prev_date)::INTEGER, 0) AS freq_moy,
      max(cpc.date_commande) AS derniere,
      coalesce(sum(cpc.montant_ht), 0) AS ca
    FROM cmd_par_client cpc
    GROUP BY cpc.entreprise_id
    HAVING count(*) >= 2
  )
  SELECT
    s.entreprise_id,
    e.nom AS entreprise_nom,
    e.pays,
    s.nb_cmd,
    s.freq_moy,
    s.derniere,
    s.ca::NUMERIC(14,2)
  FROM stats s
  JOIN entreprises e ON e.id = s.entreprise_id
  ORDER BY s.nb_cmd DESC, s.ca DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION recurrence_clients IS 'Clients recurrents (>= 2 commandes) avec frequence moyenne et CA';
