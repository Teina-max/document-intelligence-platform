-- ============================================================
-- ThermoPack Industries — Migration 006 : Dashboard RPCs
-- Extends taux_transformation + 3 new RPCs for enriched dashboard
-- ============================================================

-- ============================================================
-- 1. EXTEND taux_transformation with p_entreprise_id filter
-- Drop old 3-param version first to avoid overload ambiguity
-- ============================================================

DROP FUNCTION IF EXISTS taux_transformation(DATE, DATE, pays_enum);

CREATE OR REPLACE FUNCTION taux_transformation(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_pays pays_enum DEFAULT NULL,
  p_entreprise_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_offres BIGINT,
  offres_transformees BIGINT,
  offres_partielles BIGINT,
  offres_en_attente BIGINT,
  montant_offres NUMERIC(14,2),
  montant_commandes NUMERIC(14,2),
  taux_transformation NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH offres_filtrees AS (
    SELECT o.id, o.montant_ht, o.statut
    FROM offres o
    JOIN entreprises e ON e.id = o.entreprise_id
    WHERE (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
      AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
      AND (p_pays IS NULL OR e.pays = p_pays)
      AND (p_entreprise_id IS NULL OR o.entreprise_id = p_entreprise_id)
  ),
  commandes_liees AS (
    SELECT coalesce(sum(c.montant_ht), 0) AS total
    FROM commandes c
    WHERE c.offre_id IN (SELECT of2.id FROM offres_filtrees of2)
  )
  SELECT
    count(*)::BIGINT AS total_offres,
    count(*) FILTER (WHERE of1.statut = 'transformee')::BIGINT,
    count(*) FILTER (WHERE of1.statut = 'partiellement_transformee')::BIGINT,
    count(*) FILTER (WHERE of1.statut = 'en_attente')::BIGINT,
    coalesce(sum(of1.montant_ht), 0)::NUMERIC(14,2),
    (SELECT cl.total FROM commandes_liees cl)::NUMERIC(14,2),
    CASE
      WHEN count(*) = 0 THEN 0
      ELSE round(
        count(*) FILTER (WHERE of1.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC
        / count(*)::NUMERIC * 100, 2
      )
    END::NUMERIC(5,2)
  FROM offres_filtrees of1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION taux_transformation IS 'Calcule le taux de transformation avec filtres optionnels (periode, pays, entreprise)';

-- ============================================================
-- 2. offres_non_transformees — liste offres en attente + urgence
-- ============================================================

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
  jours_restants INTEGER
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
    END AS jours_restants
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

COMMENT ON FUNCTION offres_non_transformees IS 'Liste des offres en attente triees par urgence (jours restants avant expiration)';

-- ============================================================
-- 3. top_clients — classement entreprises par volume et taux
-- ============================================================

CREATE OR REPLACE FUNCTION top_clients(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_pays pays_enum DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  entreprise_id UUID,
  entreprise_nom TEXT,
  pays pays_enum,
  nb_offres BIGINT,
  nb_transformees BIGINT,
  taux_transformation NUMERIC(5,2),
  montant_total_offres NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS entreprise_id,
    e.nom AS entreprise_nom,
    e.pays,
    count(o.id)::BIGINT AS nb_offres,
    count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::BIGINT AS nb_transformees,
    CASE
      WHEN count(o.id) = 0 THEN 0
      ELSE round(
        count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC
        / count(o.id)::NUMERIC * 100, 2
      )
    END::NUMERIC(5,2) AS taux_transformation,
    coalesce(sum(o.montant_ht), 0)::NUMERIC(14,2) AS montant_total_offres
  FROM entreprises e
  JOIN offres o ON o.entreprise_id = e.id
  WHERE (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
    AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
    AND (p_pays IS NULL OR e.pays = p_pays)
  GROUP BY e.id, e.nom, e.pays
  ORDER BY nb_offres DESC, montant_total_offres DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_clients IS 'Top N clients par volume d''offres avec taux de transformation';

-- ============================================================
-- 4. stats_par_pays — repartition FR/ES
-- ============================================================

CREATE OR REPLACE FUNCTION stats_par_pays(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  pays pays_enum,
  nb_offres BIGINT,
  nb_transformees BIGINT,
  taux_transformation NUMERIC(5,2),
  montant_offres NUMERIC(14,2),
  montant_commandes NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.pays,
    count(o.id)::BIGINT AS nb_offres,
    count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::BIGINT AS nb_transformees,
    CASE
      WHEN count(o.id) = 0 THEN 0
      ELSE round(
        count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC
        / count(o.id)::NUMERIC * 100, 2
      )
    END::NUMERIC(5,2) AS taux_transformation,
    coalesce(sum(o.montant_ht), 0)::NUMERIC(14,2) AS montant_offres,
    coalesce(sum(
      CASE WHEN o.statut IN ('transformee', 'partiellement_transformee')
      THEN (
        SELECT coalesce(sum(c.montant_ht), 0)
        FROM commandes c
        WHERE c.offre_id = o.id
      )
      ELSE 0 END
    ), 0)::NUMERIC(14,2) AS montant_commandes
  FROM entreprises e
  JOIN offres o ON o.entreprise_id = e.id
  WHERE (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
    AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
  GROUP BY e.pays
  ORDER BY e.pays;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION stats_par_pays IS 'Statistiques de transformation par pays (FR/ES)';
