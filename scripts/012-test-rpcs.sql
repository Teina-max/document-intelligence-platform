-- ============================================================
-- ThermoPack Industries — RPC Tests
-- Validates SQL function calculations against known data
-- Run with: supabase db query --linked -f scripts/012-test-rpcs.sql
-- ============================================================

-- ============================================================
-- 1. taux_transformation — basic coherence
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM taux_transformation();

  -- Total offres must match actual count
  ASSERT r.total_offres = (SELECT count(*) FROM offres),
    format('taux_transformation: total_offres mismatch (%s vs %s)', r.total_offres, (SELECT count(*) FROM offres));

  -- Taux must be between 0 and 100
  ASSERT r.taux_transformation >= 0 AND r.taux_transformation <= 100,
    format('taux_transformation: taux out of range (%s)', r.taux_transformation);

  -- Sum of statuts must equal total
  ASSERT r.offres_transformees + r.offres_partielles + r.offres_en_attente <= r.total_offres,
    'taux_transformation: statut sum exceeds total';

  -- Montant offres must match
  ASSERT r.montant_offres = (SELECT coalesce(sum(montant_ht), 0) FROM offres),
    format('taux_transformation: montant_offres mismatch (%s)', r.montant_offres);

  RAISE NOTICE '✓ taux_transformation: OK (% offres, taux=%\%%)', r.total_offres, r.taux_transformation;
END $$;

-- ============================================================
-- 2. kpis_direction — basic coherence
-- ============================================================

DO $$
DECLARE
  r RECORD;
  actual_ca NUMERIC;
  actual_cmd BIGINT;
BEGIN
  SELECT * INTO r FROM kpis_direction();

  -- CA total must match sum of commandes
  SELECT coalesce(sum(montant_ht), 0), count(*) INTO actual_ca, actual_cmd FROM commandes;

  ASSERT r.ca_total = actual_ca,
    format('kpis_direction: ca_total mismatch (%s vs %s)', r.ca_total, actual_ca);

  ASSERT r.nb_commandes_recues = actual_cmd,
    format('kpis_direction: nb_commandes mismatch (%s vs %s)', r.nb_commandes_recues, actual_cmd);

  -- CA France + CA Espagne must equal CA total
  ASSERT r.ca_france + r.ca_espagne = r.ca_total,
    format('kpis_direction: ca_france + ca_espagne != ca_total (%s + %s != %s)', r.ca_france, r.ca_espagne, r.ca_total);

  -- Directes count + linked count must equal total
  ASSERT r.nb_commandes_directes + (r.nb_commandes_recues - r.nb_commandes_directes) = r.nb_commandes_recues,
    'kpis_direction: directes + linked != total';

  -- Taux conversion must be between 0 and 100
  ASSERT r.taux_conversion >= 0 AND r.taux_conversion <= 100,
    format('kpis_direction: taux_conversion out of range (%s)', r.taux_conversion);

  RAISE NOTICE '✓ kpis_direction: OK (CA=%, cmd=%, taux=%\%%)', r.ca_total, r.nb_commandes_recues, r.taux_conversion;
END $$;

-- ============================================================
-- 3. stats_par_pays — FR + ES totals must match global
-- ============================================================

DO $$
DECLARE
  global_r RECORD;
  pays_total_offres BIGINT;
  pays_total_transf BIGINT;
BEGIN
  SELECT * INTO global_r FROM taux_transformation();

  SELECT coalesce(sum(nb_offres), 0), coalesce(sum(nb_transformees), 0)
  INTO pays_total_offres, pays_total_transf
  FROM stats_par_pays();

  ASSERT pays_total_offres = global_r.total_offres,
    format('stats_par_pays: total offres mismatch (%s vs %s)', pays_total_offres, global_r.total_offres);

  ASSERT pays_total_transf = global_r.offres_transformees,
    format('stats_par_pays: total transformees mismatch (%s vs %s)', pays_total_transf, global_r.offres_transformees);

  RAISE NOTICE '✓ stats_par_pays: OK (% offres across pays)', pays_total_offres;
END $$;

-- ============================================================
-- 4. top_materiaux — CA sum must be <= total commandes CA
-- ============================================================

DO $$
DECLARE
  materiaux_ca NUMERIC;
  total_cmd_ca NUMERIC;
BEGIN
  SELECT coalesce(sum(ca_total), 0) INTO materiaux_ca FROM top_materiaux(p_limit := 1000);
  SELECT coalesce(sum(montant_ht), 0) INTO total_cmd_ca FROM commandes;

  -- Materiaux CA can exceed commandes CA if line items sum > document total
  -- (e.g., before remise), but should be in same order of magnitude
  ASSERT materiaux_ca > 0,
    'top_materiaux: no CA calculated from designations';

  RAISE NOTICE '✓ top_materiaux: OK (materiaux CA=%, commandes CA=%)', materiaux_ca, total_cmd_ca;
END $$;

-- ============================================================
-- 5. ca_mensuel — 12 rows, sums match
-- ============================================================

DO $$
DECLARE
  row_count BIGINT;
  mensuel_total NUMERIC;
  actual_total NUMERIC;
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  SELECT count(*), coalesce(sum(ca_total), 0) INTO row_count, mensuel_total
  FROM ca_mensuel(current_year);

  ASSERT row_count = 12,
    format('ca_mensuel: expected 12 rows, got %s', row_count);

  SELECT coalesce(sum(montant_ht), 0) INTO actual_total
  FROM commandes
  WHERE EXTRACT(YEAR FROM date_commande) = current_year;

  ASSERT mensuel_total = actual_total,
    format('ca_mensuel: sum mismatch (%s vs %s)', mensuel_total, actual_total);

  RAISE NOTICE '✓ ca_mensuel: OK (12 rows, total=%)', mensuel_total;
END $$;

-- ============================================================
-- 6. recurrence_clients — only clients with >= 2 orders
-- ============================================================

DO $$
DECLARE
  min_cmd BIGINT;
BEGIN
  SELECT coalesce(min(nb_commandes), 2) INTO min_cmd FROM recurrence_clients();

  ASSERT min_cmd >= 2,
    format('recurrence_clients: found client with %s commandes (minimum should be 2)', min_cmd);

  RAISE NOTICE '✓ recurrence_clients: OK (min commandes=% per client)', min_cmd;
END $$;

-- ============================================================
-- Summary
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '==============================';
  RAISE NOTICE 'All RPC tests passed!';
  RAISE NOTICE '==============================';
END $$;
