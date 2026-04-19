-- Migration 029: Enrich regions and departments from postal codes
-- For ~267 French enterprises with region IS NULL but code_postal IS NOT NULL
-- Maps LEFT(code_postal, 2) to region and département using French postal code prefixes

-- ============================================================
-- 1. Temporary function: enrich_regions_from_cp()
-- ============================================================

CREATE OR REPLACE FUNCTION enrich_regions_from_cp()
RETURNS TABLE (
  updated_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BIGINT := 0;
BEGIN
  WITH dept_mapping AS (
    SELECT *
    FROM (VALUES
      -- Auvergne-Rhône-Alpes
      ('01', 'Ain', 'Auvergne-Rhône-Alpes'),
      ('03', 'Allier', 'Auvergne-Rhône-Alpes'),
      ('07', 'Ardèche', 'Auvergne-Rhône-Alpes'),
      ('15', 'Cantal', 'Auvergne-Rhône-Alpes'),
      ('26', 'Drôme', 'Auvergne-Rhône-Alpes'),
      ('38', 'Isère', 'Auvergne-Rhône-Alpes'),
      ('42', 'Loire', 'Auvergne-Rhône-Alpes'),
      ('43', 'Haute-Loire', 'Auvergne-Rhône-Alpes'),
      ('63', 'Puy-de-Dôme', 'Auvergne-Rhône-Alpes'),
      ('69', 'Rhône', 'Auvergne-Rhône-Alpes'),
      ('73', 'Savoie', 'Auvergne-Rhône-Alpes'),
      ('74', 'Haute-Savoie', 'Auvergne-Rhône-Alpes'),

      -- Bourgogne-Franche-Comté
      ('21', 'Côte-d''Or', 'Bourgogne-Franche-Comté'),
      ('25', 'Doubs', 'Bourgogne-Franche-Comté'),
      ('39', 'Jura', 'Bourgogne-Franche-Comté'),
      ('58', 'Nièvre', 'Bourgogne-Franche-Comté'),
      ('70', 'Haute-Saône', 'Bourgogne-Franche-Comté'),
      ('71', 'Saône-et-Loire', 'Bourgogne-Franche-Comté'),
      ('89', 'Yonne', 'Bourgogne-Franche-Comté'),
      ('90', 'Territoire de Belfort', 'Bourgogne-Franche-Comté'),

      -- Bretagne
      ('22', 'Côtes-d''Armor', 'Bretagne'),
      ('29', 'Finistère', 'Bretagne'),
      ('35', 'Ille-et-Vilaine', 'Bretagne'),
      ('56', 'Morbihan', 'Bretagne'),

      -- Centre-Val de Loire
      ('18', 'Cher', 'Centre-Val de Loire'),
      ('28', 'Eure-et-Loir', 'Centre-Val de Loire'),
      ('36', 'Indre', 'Centre-Val de Loire'),
      ('37', 'Indre-et-Loire', 'Centre-Val de Loire'),
      ('41', 'Loir-et-Cher', 'Centre-Val de Loire'),
      ('45', 'Loiret', 'Centre-Val de Loire'),

      -- Corse
      ('20', 'Corse', 'Corse'),

      -- Grand Est
      ('08', 'Ardennes', 'Grand Est'),
      ('10', 'Aube', 'Grand Est'),
      ('51', 'Marne', 'Grand Est'),
      ('52', 'Haute-Marne', 'Grand Est'),
      ('54', 'Meurthe-et-Moselle', 'Grand Est'),
      ('55', 'Meuse', 'Grand Est'),
      ('57', 'Moselle', 'Grand Est'),
      ('67', 'Bas-Rhin', 'Grand Est'),
      ('68', 'Haut-Rhin', 'Grand Est'),
      ('88', 'Vosges', 'Grand Est'),

      -- Hauts-de-France
      ('02', 'Aisne', 'Hauts-de-France'),
      ('59', 'Nord', 'Hauts-de-France'),
      ('60', 'Oise', 'Hauts-de-France'),
      ('62', 'Pas-de-Calais', 'Hauts-de-France'),
      ('80', 'Somme', 'Hauts-de-France'),

      -- Île-de-France
      ('75', 'Paris', 'Île-de-France'),
      ('77', 'Seine-et-Marne', 'Île-de-France'),
      ('78', 'Yvelines', 'Île-de-France'),
      ('91', 'Essonne', 'Île-de-France'),
      ('92', 'Hauts-de-Seine', 'Île-de-France'),
      ('93', 'Seine-Saint-Denis', 'Île-de-France'),
      ('94', 'Val-de-Marne', 'Île-de-France'),
      ('95', 'Val-d''Oise', 'Île-de-France'),

      -- Normandie
      ('14', 'Calvados', 'Normandie'),
      ('27', 'Eure', 'Normandie'),
      ('50', 'Manche', 'Normandie'),
      ('61', 'Orne', 'Normandie'),
      ('76', 'Seine-Maritime', 'Normandie'),

      -- Nouvelle-Aquitaine
      ('16', 'Charente', 'Nouvelle-Aquitaine'),
      ('17', 'Charente-Maritime', 'Nouvelle-Aquitaine'),
      ('19', 'Corrèze', 'Nouvelle-Aquitaine'),
      ('23', 'Creuse', 'Nouvelle-Aquitaine'),
      ('24', 'Dordogne', 'Nouvelle-Aquitaine'),
      ('33', 'Gironde', 'Nouvelle-Aquitaine'),
      ('40', 'Landes', 'Nouvelle-Aquitaine'),
      ('47', 'Lot-et-Garonne', 'Nouvelle-Aquitaine'),
      ('64', 'Pyrénées-Atlantiques', 'Nouvelle-Aquitaine'),
      ('79', 'Deux-Sèvres', 'Nouvelle-Aquitaine'),
      ('86', 'Vienne', 'Nouvelle-Aquitaine'),
      ('87', 'Haute-Vienne', 'Nouvelle-Aquitaine'),

      -- Occitanie
      ('09', 'Ariège', 'Occitanie'),
      ('11', 'Aude', 'Occitanie'),
      ('12', 'Aveyron', 'Occitanie'),
      ('30', 'Gard', 'Occitanie'),
      ('31', 'Haute-Garonne', 'Occitanie'),
      ('32', 'Gers', 'Occitanie'),
      ('34', 'Hérault', 'Occitanie'),
      ('46', 'Lot', 'Occitanie'),
      ('48', 'Lozère', 'Occitanie'),
      ('65', 'Hautes-Pyrénées', 'Occitanie'),
      ('66', 'Pyrénées-Orientales', 'Occitanie'),
      ('81', 'Tarn', 'Occitanie'),
      ('82', 'Tarn-et-Garonne', 'Occitanie'),
      -- Pays de la Loire
      ('44', 'Loire-Atlantique', 'Pays de la Loire'),
      ('49', 'Maine-et-Loire', 'Pays de la Loire'),
      ('53', 'Mayenne', 'Pays de la Loire'),
      ('72', 'Sarthe', 'Pays de la Loire'),
      ('85', 'Vendée', 'Pays de la Loire'),

      -- Provence-Alpes-Côte d'Azur
      ('04', 'Alpes-de-Haute-Provence', 'Provence-Alpes-Côte d''Azur'),
      ('05', 'Hautes-Alpes', 'Provence-Alpes-Côte d''Azur'),
      ('06', 'Alpes-Maritimes', 'Provence-Alpes-Côte d''Azur'),
      ('13', 'Bouches-du-Rhône', 'Provence-Alpes-Côte d''Azur'),
      ('83', 'Var', 'Provence-Alpes-Côte d''Azur'),
      ('84', 'Vaucluse', 'Provence-Alpes-Côte d''Azur'),

      -- Outre-Mer
      ('97', 'Outre-Mer', 'Outre-Mer')
    ) AS t(dept_code, dept_name, region_name)
  )
  UPDATE entreprises e
  SET
    region = dm.region_name,
    departement = COALESCE(e.departement, dm.dept_name)
  FROM dept_mapping dm
  WHERE
    e.pays = 'FR'
    AND e.region IS NULL
    AND e.code_postal IS NOT NULL
    AND LENGTH(e.code_postal) >= 2
    AND LEFT(e.code_postal, 2) = dm.dept_code;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN QUERY SELECT v_updated;
END;
$$;

-- ============================================================
-- 2. Execute the function
-- ============================================================

SELECT * FROM enrich_regions_from_cp();

-- ============================================================
-- 3. Drop the temporary function
-- ============================================================

DROP FUNCTION enrich_regions_from_cp();
