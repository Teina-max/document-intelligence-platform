-- Migration 021: Smart entreprise matching + merge 16 OCR duplicates
--
-- Problem: OCR extracts company names like "AgriForm SAS" but the official
-- Excel list has "AgriForm". The exact (nom, code_postal) matching creates duplicates.
--
-- Solution: Cascading match with aliases, normalization, and pg_trgm similarity.
-- The system learns automatically — each new OCR variant becomes a known alias.
--
-- Date: 2026-03-30

-- ============================================================
-- PART 1: Infrastructure
-- ============================================================

-- 1a. Enable pg_trgm for fuzzy similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1b. Add noms_alternatifs column (known name variants / aliases)
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS noms_alternatifs TEXT[] DEFAULT '{}';

-- 1c. GIN index for fast alias lookup
CREATE INDEX IF NOT EXISTS idx_entreprises_noms_alt
  ON entreprises USING GIN (noms_alternatifs);

-- 1d. Trigram index on nom for similarity searches
CREATE INDEX IF NOT EXISTS idx_entreprises_nom_trgm
  ON entreprises USING GIN (nom gin_trgm_ops);

-- ============================================================
-- PART 2: normalize_company_name()
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_company_name(name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(COALESCE(name, '')),
        -- Remove subtitle after dash: "Elvin Dairy SAS - Elle & Vire" → "Elvin Dairy SAS"
        '\s*[-–—]\s+.*$', '', 'i'
      ),
      -- Strip legal suffixes: SAS, S.A.S., SA, S.A., SARL, S.L., GmbH, Sigma Plastics, Ltd, Inc
      '\s*[,.]?\s*(S\.?A\.?S\.?|S\.?A\.?R\.?L\.?|S\.?A\.?|S\.?L\.?|GmbH|Sigma Plastics|Ltd\.?|Inc\.?)\s*\.?\s*$', '', 'i'
    ),
    -- Collapse multiple spaces
    '\s+', ' ', 'g'
  )));
$$;

-- ============================================================
-- PART 3: match_entreprise() — cascading smart match
-- ============================================================

CREATE OR REPLACE FUNCTION match_entreprise(
  p_nom TEXT,
  p_code_postal TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_normalized TEXT;
  v_count INT;
BEGIN
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN RETURN NULL; END IF;

  v_normalized := normalize_company_name(p_nom);

  -- Level 1: Exact name + exact CP
  SELECT id INTO v_id FROM entreprises
  WHERE UPPER(TRIM(nom)) = UPPER(TRIM(p_nom))
  AND code_postal IS NOT DISTINCT FROM p_code_postal
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Level 2: Known alias + exact CP
  SELECT id INTO v_id FROM entreprises
  WHERE UPPER(TRIM(p_nom)) = ANY(
    SELECT UPPER(TRIM(unnest(noms_alternatifs)))
  )
  AND code_postal IS NOT DISTINCT FROM p_code_postal
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Level 3: Normalized name + exact CP
  SELECT id INTO v_id FROM entreprises
  WHERE normalize_company_name(nom) = v_normalized
  AND code_postal IS NOT DISTINCT FROM p_code_postal
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Level 4: Known alias (normalized) + exact CP
  SELECT id INTO v_id FROM entreprises
  WHERE v_normalized = ANY(
    SELECT normalize_company_name(unnest(noms_alternatifs))
  )
  AND code_postal IS NOT DISTINCT FROM p_code_postal
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Level 5: Normalized name, ignore CP — only if unique match
  SELECT COUNT(*) INTO v_count FROM entreprises
  WHERE normalize_company_name(nom) = v_normalized;
  IF v_count = 1 THEN
    SELECT id INTO v_id FROM entreprises
    WHERE normalize_company_name(nom) = v_normalized;
    RETURN v_id;
  END IF;

  -- Level 6: Known alias (exact), ignore CP — only if unique match
  SELECT COUNT(*) INTO v_count FROM entreprises
  WHERE UPPER(TRIM(p_nom)) = ANY(SELECT UPPER(TRIM(unnest(noms_alternatifs))));
  IF v_count = 1 THEN
    SELECT id INTO v_id FROM entreprises
    WHERE UPPER(TRIM(p_nom)) = ANY(SELECT UPPER(TRIM(unnest(noms_alternatifs))));
    RETURN v_id;
  END IF;

  -- Level 7: Normalized alias, ignore CP — only if unique match
  SELECT COUNT(*) INTO v_count FROM entreprises
  WHERE v_normalized = ANY(SELECT normalize_company_name(unnest(noms_alternatifs)));
  IF v_count = 1 THEN
    SELECT id INTO v_id FROM entreprises
    WHERE v_normalized = ANY(SELECT normalize_company_name(unnest(noms_alternatifs)));
    RETURN v_id;
  END IF;

  -- Level 8: pg_trgm similarity > 0.5 + same CP (catches typos, word order)
  IF p_code_postal IS NOT NULL THEN
    SELECT id INTO v_id FROM entreprises
    WHERE code_postal = p_code_postal
    AND similarity(normalize_company_name(nom), v_normalized) > 0.5
    ORDER BY similarity(normalize_company_name(nom), v_normalized) DESC
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- Level 9: pg_trgm similarity > 0.7 without CP (high threshold = strong confidence)
  SELECT id INTO v_id FROM entreprises
  WHERE similarity(normalize_company_name(nom), v_normalized) > 0.7
  ORDER BY similarity(normalize_company_name(nom), v_normalized) DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- No match
  RETURN NULL;
END;
$$;

-- ============================================================
-- PART 4: Updated upsert_entreprise() — uses smart matching
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_entreprise(
  p_nom TEXT,
  p_code_postal TEXT DEFAULT NULL,
  p_pays TEXT DEFAULT 'FR',
  p_adresse TEXT DEFAULT NULL,
  p_contact_nom TEXT DEFAULT NULL,
  p_contact_telephone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_numero_client TEXT DEFAULT NULL,
  p_siret TEXT DEFAULT NULL,
  p_tva_intracommunautaire TEXT DEFAULT NULL,
  p_conditions_paiement TEXT DEFAULT NULL,
  p_email_facturation TEXT DEFAULT NULL,
  p_contact_email_secondaire TEXT DEFAULT NULL,
  p_contact_livraison_nom TEXT DEFAULT NULL,
  p_contact_livraison_email TEXT DEFAULT NULL,
  p_contact_livraison_telephone TEXT DEFAULT NULL,
  p_adresse_livraison TEXT DEFAULT NULL,
  p_code_postal_livraison TEXT DEFAULT NULL,
  p_ville_livraison TEXT DEFAULT NULL,
  p_ville TEXT DEFAULT NULL,
  p_departement TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'ocr'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_existing_nom TEXT;
BEGIN
  -- Step 1: Smart matching — find existing entreprise
  v_id := match_entreprise(p_nom, p_code_postal);

  IF v_id IS NOT NULL THEN
    -- Step 2: Match found → enrich existing entry (COALESCE = fill gaps, never overwrite)
    SELECT nom INTO v_existing_nom FROM entreprises WHERE id = v_id;

    UPDATE entreprises SET
      adresse = COALESCE(p_adresse, adresse),
      contact_nom = COALESCE(p_contact_nom, contact_nom),
      contact_telephone = COALESCE(p_contact_telephone, contact_telephone),
      contact_email = COALESCE(p_contact_email, contact_email),
      numero_client = COALESCE(p_numero_client, numero_client),
      siret = COALESCE(p_siret, siret),
      tva_intracommunautaire = COALESCE(p_tva_intracommunautaire, tva_intracommunautaire),
      conditions_paiement = COALESCE(p_conditions_paiement, conditions_paiement),
      email_facturation = COALESCE(p_email_facturation, email_facturation),
      contact_email_secondaire = COALESCE(p_contact_email_secondaire, contact_email_secondaire),
      contact_livraison_nom = COALESCE(p_contact_livraison_nom, contact_livraison_nom),
      contact_livraison_email = COALESCE(p_contact_livraison_email, contact_livraison_email),
      contact_livraison_telephone = COALESCE(p_contact_livraison_telephone, contact_livraison_telephone),
      adresse_livraison = COALESCE(p_adresse_livraison, adresse_livraison),
      code_postal_livraison = COALESCE(p_code_postal_livraison, code_postal_livraison),
      ville_livraison = COALESCE(p_ville_livraison, ville_livraison),
      ville = COALESCE(p_ville, ville),
      departement = COALESCE(p_departement, departement),
      region = COALESCE(p_region, region),
      notes = COALESCE(p_notes, notes),
      source = CASE
        WHEN source = 'ocr' AND p_source = 'excel' THEN 'ocr+excel'
        WHEN source = 'excel' AND p_source = 'ocr' THEN 'ocr+excel'
        ELSE COALESCE(source, p_source)
      END,
      updated_at = now()
    WHERE id = v_id;

    -- Step 3: Auto-learn — add OCR name as alias if different from canonical
    IF UPPER(TRIM(p_nom)) IS DISTINCT FROM UPPER(TRIM(v_existing_nom))
       AND NOT (UPPER(TRIM(p_nom)) = ANY(
         SELECT UPPER(TRIM(unnest(noms_alternatifs))) FROM entreprises WHERE id = v_id
       ))
    THEN
      UPDATE entreprises
      SET noms_alternatifs = array_append(COALESCE(noms_alternatifs, '{}'), p_nom)
      WHERE id = v_id;
    END IF;

    RETURN v_id;
  ELSE
    -- Step 4: No match → create new entry
    -- ON CONFLICT as safety net against race conditions
    INSERT INTO entreprises (
      nom, code_postal, pays, adresse, contact_nom, contact_telephone, contact_email, numero_client,
      siret, tva_intracommunautaire, conditions_paiement, email_facturation,
      contact_email_secondaire, contact_livraison_nom, contact_livraison_email, contact_livraison_telephone,
      adresse_livraison, code_postal_livraison, ville_livraison,
      ville, departement, region, notes, source
    )
    VALUES (
      p_nom, p_code_postal, p_pays::pays_enum, p_adresse, p_contact_nom, p_contact_telephone, p_contact_email, p_numero_client,
      p_siret, p_tva_intracommunautaire, p_conditions_paiement, p_email_facturation,
      p_contact_email_secondaire, p_contact_livraison_nom, p_contact_livraison_email, p_contact_livraison_telephone,
      p_adresse_livraison, p_code_postal_livraison, p_ville_livraison,
      p_ville, p_departement, p_region, p_notes, p_source
    )
    ON CONFLICT (nom, code_postal)
    DO UPDATE SET
      adresse = COALESCE(EXCLUDED.adresse, entreprises.adresse),
      contact_nom = COALESCE(EXCLUDED.contact_nom, entreprises.contact_nom),
      contact_telephone = COALESCE(EXCLUDED.contact_telephone, entreprises.contact_telephone),
      contact_email = COALESCE(EXCLUDED.contact_email, entreprises.contact_email),
      numero_client = COALESCE(EXCLUDED.numero_client, entreprises.numero_client),
      siret = COALESCE(EXCLUDED.siret, entreprises.siret),
      tva_intracommunautaire = COALESCE(EXCLUDED.tva_intracommunautaire, entreprises.tva_intracommunautaire),
      conditions_paiement = COALESCE(EXCLUDED.conditions_paiement, entreprises.conditions_paiement),
      email_facturation = COALESCE(EXCLUDED.email_facturation, entreprises.email_facturation),
      contact_email_secondaire = COALESCE(EXCLUDED.contact_email_secondaire, entreprises.contact_email_secondaire),
      contact_livraison_nom = COALESCE(EXCLUDED.contact_livraison_nom, entreprises.contact_livraison_nom),
      contact_livraison_email = COALESCE(EXCLUDED.contact_livraison_email, entreprises.contact_livraison_email),
      contact_livraison_telephone = COALESCE(EXCLUDED.contact_livraison_telephone, entreprises.contact_livraison_telephone),
      adresse_livraison = COALESCE(EXCLUDED.adresse_livraison, entreprises.adresse_livraison),
      code_postal_livraison = COALESCE(EXCLUDED.code_postal_livraison, entreprises.code_postal_livraison),
      ville_livraison = COALESCE(EXCLUDED.ville_livraison, entreprises.ville_livraison),
      ville = COALESCE(EXCLUDED.ville, entreprises.ville),
      departement = COALESCE(EXCLUDED.departement, entreprises.departement),
      region = COALESCE(EXCLUDED.region, entreprises.region),
      notes = COALESCE(EXCLUDED.notes, entreprises.notes),
      source = CASE
        WHEN entreprises.source = 'ocr' AND EXCLUDED.source = 'excel' THEN 'ocr+excel'
        WHEN entreprises.source = 'excel' AND EXCLUDED.source = 'ocr' THEN 'ocr+excel'
        ELSE COALESCE(EXCLUDED.source, entreprises.source)
      END,
      updated_at = now()
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;
END;
$$;

-- ============================================================
-- PART 5: Merge 16 OCR duplicates
-- ============================================================
-- Strategy: Keep OCR entry (has offres/commandes linked), rename to Excel name,
-- enrich with Excel data, store OCR name as alias, delete Excel duplicate.
-- Order: DELETE Excel first (avoid unique constraint conflict), then UPDATE OCR.

-- Step 5a: Delete the 16 Excel duplicate entries (all have 0 offres, 0 commandes)
DELETE FROM entreprises WHERE id IN (
  'edc9d046-2b96-401a-a7ec-9aaa19438b92',  -- AgriForm (Excel dupe of AgriForm SAS)
  'ff2dbdee-b51a-4946-85be-e8cd94842e0d',  -- AlphaMould SAS (Excel dupe of AlphaMould S.A.S.)
  'eb0e6419-2aee-4b74-b80f-49b7ebc8ff5a',  -- Apteca (Excel dupe of Apteca SA)
  'fad7a9a1-6626-4109-b26c-61c3ded99fd1',  -- Hexacore Packaging CASTELLVI (Excel dupe of BBC Packaging S.L.)
  '3564d555-7a19-425e-8cb7-e7aa69ff1a5f',  -- CONDITIONNEMENT 2000 (Excel dupe of CONDITIONNEMENT 2000 SA)
  '67c1bde2-5493-4511-970a-f9de0a634581',  -- Polymax SA S.A.S. (Excel dupe of Dynaplast S.A.S.)
  '15a24232-7075-4f1e-80b2-ba697fbd4659',  -- Elvin Dairy (Excel dupe of Elvin Dairy SAS - Elle & Vire)
  '97527adf-18bf-4da0-904a-94b123ac39e9',  -- FROMAGERIE BEL (Excel dupe of Fromageries Bel Production France)
  'c11fbd97-18de-4b52-956e-29e7315c7f07',  -- Uria Forming SARL (Excel dupe of Uria Forming Sarl)
  '930c4546-392e-41c0-9cc3-2883213f316e',  -- Galion Pack EMBALLAGES (Excel dupe of Guillin Emballages SAS)
  '5d36dd62-5e4b-4b5e-bea7-e3ed30bf8057',  -- MANUFACTURA Argus Plasturgie (Excel dupe of Manufacturas Arplast, S.L.)
  '4feed28a-561f-45a9-aadb-c0534a212a0f',  -- FrostForm (Excel dupe of FrostForm Thermoformage SAS)
  'e931e988-d66a-4b39-bb56-c74a992668da',  -- Société FORMAGE PLASTIQUE Sigma Plastics (Excel dupe)
  'da513e62-164c-43d9-9fa4-a713a3b7724e',  -- Solera Industries (Excel dupe, CP NULL)
  '30deceda-a72f-4b4f-8518-181410fef90b',  -- Cadence Tropical (Excel dupe)
  '355b3690-3d6d-43d4-8525-e79b91a84e68'   -- ThermalEdge (Excel dupe of Toutherm SAS)
);

-- Step 5b: Update each OCR entry — rename to Excel name, enrich, add alias

-- 1. AgriForm SAS → AgriForm
UPDATE entreprises SET
  nom = 'AgriForm', noms_alternatifs = ARRAY['AgriForm SAS'],
  contact_email = COALESCE(contact_email, 'maintenance@agrolis.com'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'jlemagnen@agrolis.com'),
  adresse = COALESCE(adresse, 'USINE DE LISON GARE — rue Octave Lemenuel'),
  ville = COALESCE(ville, 'SAINTE MAGUERITE D''ELLE'),
  departement = COALESCE(departement, '14'), region = COALESCE(region, 'NORMANDIE'),
  numero_client = COALESCE(numero_client, '715595'),
  adresse_livraison = COALESCE(adresse_livraison, 'USINE DE LISON GARE — rue Octave Lemenuel'),
  code_postal_livraison = COALESCE(code_postal_livraison, '14330'),
  ville_livraison = COALESCE(ville_livraison, 'SAINTE MAGUERITE D''ELLE'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'jlemagnen@agrolis.com'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '92438962-61ff-4a46-9a7e-b1e5b0346fa5';

-- 2. AlphaMould S.A.S. → AlphaMould SAS
UPDATE entreprises SET
  nom = 'AlphaMould SAS', noms_alternatifs = ARRAY['AlphaMould S.A.S.'],
  contact_email = COALESCE(contact_email, 'jlrigaud@alphaform.fr'),
  contact_telephone = COALESCE(contact_telephone, '475037935'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'compta.fournisseur@alphaform.fr'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  siret = COALESCE(siret, '30223882900014'),
  ville = COALESCE(ville, 'BEAUSEMBLANT'),
  departement = COALESCE(departement, '26'), region = COALESCE(region, 'AUVERGNE-RHÔNE-ALPES'),
  numero_client = COALESCE(numero_client, '250154'),
  adresse_livraison = COALESCE(adresse_livraison, '291 ROUTE PIERRELLES'),
  code_postal_livraison = COALESCE(code_postal_livraison, '26240'),
  ville_livraison = COALESCE(ville_livraison, 'BEAUSEMBLANT'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'pperrier@alphaform.fr'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '309442c1-5367-4f2c-92ab-201e6ddc6cf0';

-- 3. Apteca SA → Apteca
UPDATE entreprises SET
  nom = 'Apteca', noms_alternatifs = ARRAY['Apteca SA'],
  contact_email = COALESCE(contact_email, 'aldo.zedda@apte.fr'),
  contact_telephone = COALESCE(contact_telephone, '02 38 35 20 19'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'romuald.gaudry@apte.fr'),
  email_facturation = COALESCE(email_facturation, 'comptabilite2@apte.fr'),
  conditions_paiement = COALESCE(conditions_paiement, '60 jours net'),
  siret = COALESCE(siret, '34228145800048'),
  ville = COALESCE(ville, 'LA BUSSIERE'),
  departement = COALESCE(departement, '45'), region = COALESCE(region, 'CENTRE-VAL DE LOIRE'),
  numero_client = COALESCE(numero_client, '711561'),
  adresse_livraison = COALESCE(adresse_livraison, 'ROUTE DE CHATILLON'),
  code_postal_livraison = COALESCE(code_postal_livraison, '45230'),
  ville_livraison = COALESCE(ville_livraison, 'LA BUSSIERE'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'GAUDRY Romuald'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '4ec88fb4-b1d2-44f0-8121-5af0281fab32';

-- 4. BBC Packaging S.L. → Hexacore Packaging CASTELLVI
UPDATE entreprises SET
  nom = 'Hexacore Packaging CASTELLVI', noms_alternatifs = ARRAY['BBC Packaging S.L.'],
  tva_intracommunautaire = COALESCE(tva_intracommunautaire, 'ESB66158106'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'a.sanz@bbcpackaging.com'),
  numero_client = COALESCE(numero_client, '713641'),
  source = 'ocr+excel', updated_at = now()
WHERE id = 'd0bf0cfb-bd0f-411d-b2fc-4817822bbc5e';

-- 5. CONDITIONNEMENT 2000 SA → CONDITIONNEMENT 2000
UPDATE entreprises SET
  nom = 'CONDITIONNEMENT 2000', noms_alternatifs = ARRAY['CONDITIONNEMENT 2000 SA'],
  contact_email = COALESCE(contact_email, 'v.garnier@c2000.fr'),
  contact_telephone = COALESCE(contact_telephone, '243354051'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'w.garnier@c2000.fr'),
  email_facturation = COALESCE(email_facturation, 'v.garnier@c2000.fr'),
  conditions_paiement = COALESCE(conditions_paiement, '30 jours fin de mois le 10'),
  siret = COALESCE(siret, '32620520000016'),
  ville = COALESCE(ville, 'BOULOIRE'),
  departement = COALESCE(departement, '72'), region = COALESCE(region, 'PAYS DE LA LOIRE'),
  numero_client = COALESCE(numero_client, '252018'),
  adresse_livraison = COALESCE(adresse_livraison, 'RUE CLAUDE CHAPPE — Z.I. DU CHEVAL BLANC'),
  code_postal_livraison = COALESCE(code_postal_livraison, '72440'),
  ville_livraison = COALESCE(ville_livraison, 'BOULOIRE'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'v.garnier@c2000.fr'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '434b2bb1-8cc1-4c72-b8b0-9e87cfd1abb8';

-- 6. Dynaplast S.A.S. → Polymax SA S.A.S. (casse only)
UPDATE entreprises SET
  nom = 'Polymax SA S.A.S.', noms_alternatifs = ARRAY['Dynaplast S.A.S.'],
  contact_email = COALESCE(contact_email, 'comptabilite@dynaplast.fr'),
  contact_telephone = COALESCE(contact_telephone, '386438100'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  siret = COALESCE(siret, '30307453800024'),
  ville = COALESCE(ville, 'SAINT FLORENTIN'),
  departement = COALESCE(departement, '89'), region = COALESCE(region, 'BOURGOGNE-FRANCHE-COMTÉ'),
  numero_client = COALESCE(numero_client, '201912'),
  adresse_livraison = COALESCE(adresse_livraison, 'RUE JUST MEISONNASSE'),
  code_postal_livraison = COALESCE(code_postal_livraison, '89600'),
  ville_livraison = COALESCE(ville_livraison, 'SAINT FLORENTIN'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'MR SAR'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '386438100'),
  source = 'ocr+excel', updated_at = now()
WHERE id = 'a5cb2d93-518d-448e-b886-3c819764c261';

-- 7. Elvin Dairy SAS - Elle & Vire → Elvin Dairy (CP: keep billing 50951 from Excel)
UPDATE entreprises SET
  nom = 'Elvin Dairy', noms_alternatifs = ARRAY['Elvin Dairy SAS - Elle & Vire'],
  code_postal = '50951',
  contact_email = COALESCE(contact_email, 'regine.campain@savencia.com'),
  contact_telephone = COALESCE(contact_telephone, '233066858'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'thibaut.yanowsky@savencia.com;mathilde.garnier.ext@saventia.com'),
  email_facturation = COALESCE(email_facturation, 'facture.fournisseur@elvir.fr'),
  adresse = COALESCE(adresse, 'COMPTABILITE FOURNISSEUR TSA 60004 CONDE SUR VIRE — 2 ROUTE NEUVE'),
  siret = COALESCE(siret, '38929766400010'),
  ville = COALESCE(ville, 'SAINT LO CEDEX 9'),
  departement = COALESCE(departement, '50'), region = COALESCE(region, 'NORMANDIE'),
  numero_client = COALESCE(numero_client, '715337'),
  adresse_livraison = COALESCE(adresse_livraison, '2 ROUTE NEUVE'),
  code_postal_livraison = COALESCE(code_postal_livraison, '50890'),
  ville_livraison = COALESCE(ville_livraison, 'CONDE SUR VIRE'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '77efe9bf-e54e-47ee-8e10-2a155053d967';

-- 8. Fromageries Bel Production France → FROMAGERIE BEL (CP: keep billing 39100)
UPDATE entreprises SET
  nom = 'FROMAGERIE BEL', noms_alternatifs = ARRAY['Fromageries Bel Production France'],
  code_postal = '39100',
  contact_email = COALESCE(contact_email, 'csp_fournisseurs@groupe-bel.com'),
  contact_nom = COALESCE(contact_nom, 'MME HUGON'),
  contact_telephone = COALESCE(contact_telephone, '765157168'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'christelle.moreau@formes-sculptures.com'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  adresse = COALESCE(adresse, 'PRODUCTION France SERVICE COMPTABILITE FOURNISSEURS — 74 RUE DU MONT ROLAND'),
  siret = COALESCE(siret, '49337159500023'),
  ville = COALESCE(ville, 'DOLE CEDEX'),
  departement = COALESCE(departement, '39'), region = COALESCE(region, 'BOURGOGNE-FRANCHE-COMTÉ'),
  numero_client = COALESCE(numero_client, '700789'),
  adresse_livraison = COALESCE(adresse_livraison, 'PRODUCTION France — 120 BOULEVARD JULES FERRY'),
  code_postal_livraison = COALESCE(code_postal_livraison, '39021'),
  ville_livraison = COALESCE(ville_livraison, 'LONS LE SAUNIER'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '03 84 70 84 00'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '76470c36-7177-4d69-8be6-af05abce3e18';

-- 9. Uria Forming Sarl → Uria Forming SARL (CP: keep 01150 from OCR, properly formatted)
UPDATE entreprises SET
  nom = 'Uria Forming SARL', noms_alternatifs = ARRAY['Uria Forming Sarl'],
  contact_email = COALESCE(contact_email, 'georgutz@fr-georgutz.com'),
  contact_telephone = COALESCE(contact_telephone, '487653424'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'aereno@walterpack.com'),
  email_facturation = COALESCE(email_facturation, 'mcp@plasal.es'),
  adresse = COALESCE(adresse, 'PARC INDUSTRIEL DE LA PLAINE DE L''AIN — 100 ALLEES DES CYPRES'),
  ville = COALESCE(ville, 'SAINT VULBAS'),
  departement = COALESCE(departement, '01'),
  numero_client = COALESCE(numero_client, '706097'),
  adresse_livraison = COALESCE(adresse_livraison, 'PARC INDUSTRIEL DE LA PLAINE DE L''AIN — 100 ALLEES DES CYPRES'),
  code_postal_livraison = COALESCE(code_postal_livraison, '01150'),
  ville_livraison = COALESCE(ville_livraison, 'SAINT VULBAS'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'georgutz@fr-georgutz.com'),
  source = 'ocr+excel', updated_at = now()
WHERE id = 'f74d247b-d4d0-4509-8514-101d3812f9db';

-- 10. Guillin Emballages SAS → Galion Pack EMBALLAGES
UPDATE entreprises SET
  nom = 'Galion Pack EMBALLAGES', noms_alternatifs = ARRAY['Guillin Emballages SAS'],
  contact_email = COALESCE(contact_email, 'compta.fournisseurs@guillin-emballages.fr'),
  contact_telephone = COALESCE(contact_telephone, '381402392'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'wmyat@guillin-emballages.fr'),
  email_facturation = COALESCE(email_facturation, 'compta.fournisseurs@guillin-emballages.fr'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  siret = COALESCE(siret, '32240991300041'),
  ville = COALESCE(ville, 'ORNANS'),
  departement = COALESCE(departement, '25'), region = COALESCE(region, 'BOURGOGNE-FRANCHE-COMTÉ'),
  numero_client = COALESCE(numero_client, '254907'),
  adresse_livraison = COALESCE(adresse_livraison, 'ZONE INDUSTRIELLE'),
  code_postal_livraison = COALESCE(code_postal_livraison, '25290'),
  ville_livraison = COALESCE(ville_livraison, 'ORNANS'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'Christophe ETIENNE'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'cetienne@guillin-emballages.fr'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '381402372'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '8c8cbe0e-bff6-4e2c-b177-da79c0a64119';

-- 11. Manufacturas Arplast, S.L. �� MANUFACTURA Argus Plasturgie
UPDATE entreprises SET
  nom = 'MANUFACTURA Argus Plasturgie', noms_alternatifs = ARRAY['Manufacturas Arplast, S.L.'],
  tva_intracommunautaire = COALESCE(tva_intracommunautaire, 'ESB46221966'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'produccion@arplastsl.com'),
  numero_client = COALESCE(numero_client, '202040'),
  source = 'ocr+excel', updated_at = now()
WHERE id = 'eba77c70-f92e-4d80-946f-07f8fc17e453';

-- 12. FrostForm Thermoformage SAS → FrostForm
UPDATE entreprises SET
  nom = 'FrostForm', noms_alternatifs = ARRAY['FrostForm Thermoformage SAS'],
  contact_email = COALESCE(contact_email, 'facture@societe-picard.fr'),
  contact_telephone = COALESCE(contact_telephone, '545905128'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'stephane.pradelle@societe-picard.fr'),
  email_facturation = COALESCE(email_facturation, 'facture@societe-picard.fr'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  adresse = COALESCE(adresse, '2 RUE AMPERE — Z.I. DE NERSAC'),
  siret = COALESCE(siret, '73182025400027'),
  ville = COALESCE(ville, 'NERSAC'),
  departement = COALESCE(departement, '16'), region = COALESCE(region, 'NOUVELLE-AQUITAINE'),
  numero_client = COALESCE(numero_client, '259600'),
  adresse_livraison = COALESCE(adresse_livraison, '2 RUE AMPERE — Z.I. DE NERSAC'),
  code_postal_livraison = COALESCE(code_postal_livraison, '16440'),
  ville_livraison = COALESCE(ville_livraison, 'NERSAC'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'MR BROSSARD'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'nicolas.brossard@societe-picard.fr'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '545905128'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '8ad03d2e-57a8-4dcd-8a91-aaedf3ff46b0';

-- 13. Société FORMAGE PLASTIQUE → Société FORMAGE PLASTIQUE Sigma Plastics
UPDATE entreprises SET
  nom = 'Société FORMAGE PLASTIQUE Sigma Plastics', noms_alternatifs = ARRAY['Société FORMAGE PLASTIQUE'],
  contact_email = COALESCE(contact_email, 'compta@formage-plastique.com'),
  contact_nom = COALESCE(contact_nom, 'Bernadette DERRE'),
  contact_telephone = COALESCE(contact_telephone, '549954525'),
  contact_email_secondaire = COALESCE(contact_email_secondaire, 'bernadette.derre@groupe-lafourcade.com'),
  email_facturation = COALESCE(email_facturation, 'fournisseurs@formage-plastique.com'),
  conditions_paiement = COALESCE(conditions_paiement, '30 jours fin de mois le 15'),
  adresse = COALESCE(adresse, 'ZONE D''ACTIVITES — 2 AVENUE SUZANNE LENGLEN'),
  ville = COALESCE(ville, 'CHATILLON SUR THOUET'),
  departement = COALESCE(departement, '79'), region = COALESCE(region, 'NOUVELLE-AQUITAINE'),
  numero_client = COALESCE(numero_client, '260418'),
  adresse_livraison = COALESCE(adresse_livraison, '2 AVENUE SUZANNE LENGLEN — ESPACE ECONOMIQUE SAINTE ANNE'),
  code_postal_livraison = COALESCE(code_postal_livraison, '79200'),
  ville_livraison = COALESCE(ville_livraison, 'CHATILLON SUR THOUET'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'TONY VERGNAULT'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'maintenance@formage-plastique.com'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '549954742'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '0650be13-0e54-4071-b424-21a45b7d1930';

-- 14. Solera Industries → Solera Industries (same name, enrich with Excel data)
UPDATE entreprises SET
  noms_alternatifs = '{}',
  contact_email = COALESCE(contact_email, 'd.cailleau@somater.fr'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  contact_livraison_email = COALESCE(contact_livraison_email, 's.boutoulle@somater.fr'),
  numero_client = COALESCE(numero_client, '704110'),
  source = 'ocr+excel', updated_at = now()
WHERE id = '4b1fa637-7ecf-45ff-b595-d87fef52d33d';

-- 15. SVS La Martiniquaise S.A. → Cadence Tropical
UPDATE entreprises SET
  nom = 'Cadence Tropical', noms_alternatifs = ARRAY['SVS La Martiniquaise S.A.'],
  contact_telephone = COALESCE(contact_telephone, '143538181'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  adresse = COALESCE(adresse, '18 RUE DE L''ENTREPOT'),
  siret = COALESCE(siret, '63200387700032'),
  ville = COALESCE(ville, 'CHARENTON LE PONT CEDEX'),
  departement = COALESCE(departement, '94'), region = COALESCE(region, 'ÎLE-DE-FRANCE'),
  numero_client = COALESCE(numero_client, '201560'),
  adresse_livraison = COALESCE(adresse_livraison, '18 RUE DE L''ENTREPOT'),
  code_postal_livraison = COALESCE(code_postal_livraison, '94227'),
  ville_livraison = COALESCE(ville_livraison, 'CHARENTON LE PONT CEDEX'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'MR BRANDEHO'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'guillaume.gohourou@la-martiniquaise.fr'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '143538181'),
  source = 'ocr+excel', updated_at = now()
WHERE id = 'd860a06a-fdd3-431c-bcbd-26654b830cc0';

-- 16. Toutherm SAS → ThermalEdge
UPDATE entreprises SET
  nom = 'ThermalEdge', noms_alternatifs = ARRAY['Toutherm SAS'],
  contact_email = COALESCE(contact_email, 'denis.rolland@toutherm.fr'),
  contact_nom = COALESCE(contact_nom, 'Denis ROLLAND'),
  contact_telephone = COALESCE(contact_telephone, '386193240'),
  conditions_paiement = COALESCE(conditions_paiement, '45 jours fin de mois'),
  adresse = COALESCE(adresse, '57 ROUTE DE MONTARGIS'),
  siret = COALESCE(siret, '43240122200026'),
  ville = COALESCE(ville, 'JOIGNY'),
  departement = COALESCE(departement, '89'), region = COALESCE(region, 'BOURGOGNE-FRANCHE-COMTÉ'),
  numero_client = COALESCE(numero_client, '701441'),
  adresse_livraison = COALESCE(adresse_livraison, '57 ROUTE DE MONTARGIS'),
  code_postal_livraison = COALESCE(code_postal_livraison, '89300'),
  ville_livraison = COALESCE(ville_livraison, 'JOIGNY'),
  contact_livraison_nom = COALESCE(contact_livraison_nom, 'Ludovic GAUTARD'),
  contact_livraison_email = COALESCE(contact_livraison_email, 'ludovic.gautard@toutherm.fr'),
  contact_livraison_telephone = COALESCE(contact_livraison_telephone, '386193240'),
  source = 'ocr+excel', updated_at = now()
WHERE id = 'c5c60d34-302d-4bd8-9dea-c1700344f310';

-- ============================================================
-- PART 6: Verification queries (run after migration)
-- ============================================================

-- Check: should be 0 entries with source='ocr'
-- SELECT source, COUNT(*) FROM entreprises GROUP BY source ORDER BY source;

-- Check: all 16 should have noms_alternatifs populated
-- SELECT nom, noms_alternatifs, source FROM entreprises WHERE source = 'ocr+excel' ORDER BY nom;

-- Check: match_entreprise finds known variants
-- SELECT match_entreprise('AgriForm SAS', '14330');  -- should return AgriForm id
-- SELECT match_entreprise('Toutherm SAS', '89300'); -- should return ThermalEdge id
-- SELECT match_entreprise('FrostForm Thermoformage SAS', '16440'); -- should return FrostForm id
