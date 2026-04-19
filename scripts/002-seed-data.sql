-- ============================================================
-- ThermoPack Industries — Seed data (dev/test only)
-- Donnees fictives realistes pour tester le schema et les fonctions
-- ============================================================

-- ============================================================
-- 1. ENTREPRISES
-- ============================================================

INSERT INTO entreprises (id, nom, code_postal, pays, adresse, contact_nom, contact_email, contact_telephone) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Plastiques Dupont SAS', '69001', 'FR', '12 rue de la République, Lyon', 'Jean Dupont', 'j.dupont@plastiques-dupont.fr', '+33 4 72 00 00 01'),
  ('a0000000-0000-0000-0000-000000000002', 'Emballages Martin SARL', '31000', 'FR', '45 avenue Jean Jaurès, Toulouse', 'Claire Martin', 'c.martin@emballages-martin.fr', '+33 5 61 00 00 02'),
  ('a0000000-0000-0000-0000-000000000003', 'Thermopack Ibérica SL', '08001', 'ES', 'Carrer de Balmes 55, Barcelona', 'Carlos García', 'c.garcia@thermopack-iberica.es', '+34 93 000 00 03'),
  ('a0000000-0000-0000-0000-000000000004', 'Conditionnement Leroy SA', '59000', 'FR', '8 boulevard de la Liberté, Lille', 'Sophie Leroy', 's.leroy@conditionnement-leroy.fr', '+33 3 20 00 00 04'),
  ('a0000000-0000-0000-0000-000000000005', 'Envases Rodríguez SL', '28001', 'ES', 'Calle Gran Vía 30, Madrid', 'María Rodríguez', 'm.rodriguez@envases-rodriguez.es', '+34 91 000 00 05'),
  ('a0000000-0000-0000-0000-000000000006', 'Agro-Plast SARL', '33000', 'FR', '22 cours de l''Intendance, Bordeaux', 'Pierre Moreau', 'p.moreau@agro-plast.fr', '+33 5 56 00 00 06');

-- ============================================================
-- 2. OFFRES
-- ============================================================

INSERT INTO offres (id, reference_offre, entreprise_id, montant_ht, montant_ttc, date_offre, date_expiration, statut, correspondant, designations, fichier_source) VALUES
  -- Offre transformee (commande egale)
  ('b0000000-0000-0000-0000-000000000001', 'OFF-2026-001', 'a0000000-0000-0000-0000-000000000001', 12500.00, 15000.00, '2026-01-15', '2026-03-15', 'transformee', 'Michel Blanc',
    '[{"designation": "Lame de coupe TC 450mm", "quantite": 10, "prix_unitaire": 850.00}, {"designation": "Joint silicone haute temp", "quantite": 20, "prix_unitaire": 200.00}]',
    '/Offres/OFF-2026-001.pdf'),

  -- Offre partiellement transformee
  ('b0000000-0000-0000-0000-000000000002', 'OFF-2026-002', 'a0000000-0000-0000-0000-000000000002', 8400.00, 10080.00, '2026-01-20', '2026-03-20', 'partiellement_transformee', 'Michel Blanc',
    '[{"designation": "Plateau de formage 600x400", "quantite": 5, "prix_unitaire": 1200.00}, {"designation": "Resistance chauffante 2kW", "quantite": 4, "prix_unitaire": 600.00}]',
    '/Offres/OFF-2026-002.pdf'),

  -- Offre en attente — expire dans 12 jours (relance urgente)
  ('b0000000-0000-0000-0000-000000000003', 'OFF-2026-003', 'a0000000-0000-0000-0000-000000000003', 22000.00, 26400.00, '2026-02-01', '2026-03-30', 'en_attente', 'Isabelle Faure',
    '[{"designation": "Moule thermoformage 800x600", "quantite": 2, "prix_unitaire": 8500.00}, {"designation": "Kit entretien annuel", "quantite": 1, "prix_unitaire": 5000.00}]',
    '/Offres/OFF-2026-003.pdf'),

  -- Offre en attente — expire dans 25 jours
  ('b0000000-0000-0000-0000-000000000004', 'OFF-2026-004', 'a0000000-0000-0000-0000-000000000004', 5600.00, 6720.00, '2026-02-15', '2026-04-12', 'en_attente', 'Michel Blanc',
    '[{"designation": "Filtre aspiration industriel", "quantite": 8, "prix_unitaire": 700.00}]',
    '/Offres/OFF-2026-004.pdf'),

  -- Offre en attente — Espagne, expire dans 5 jours (relance critique)
  ('b0000000-0000-0000-0000-000000000005', 'OFF-2026-005', 'a0000000-0000-0000-0000-000000000005', 15800.00, 19118.00, '2026-02-10', '2026-03-23', 'en_attente', 'Isabelle Faure',
    '[{"designation": "Plaque chauffante céramique", "quantite": 3, "prix_unitaire": 3200.00}, {"designation": "Capteur température PT100", "quantite": 10, "prix_unitaire": 620.00}]',
    '/Offres/OFF-2026-005.pdf'),

  -- Offre expiree
  ('b0000000-0000-0000-0000-000000000006', 'OFF-2025-048', 'a0000000-0000-0000-0000-000000000006', 3200.00, 3840.00, '2025-11-01', '2025-12-31', 'expiree', 'Michel Blanc',
    '[{"designation": "Courroie transmission 1500mm", "quantite": 4, "prix_unitaire": 800.00}]',
    '/Offres/OFF-2025-048.pdf'),

  -- Offre en attente — pas de date expiration
  ('b0000000-0000-0000-0000-000000000007', 'OFF-2026-006', 'a0000000-0000-0000-0000-000000000001', 4200.00, 5040.00, '2026-03-01', NULL, 'en_attente', 'Isabelle Faure',
    '[{"designation": "Vérin pneumatique DN80", "quantite": 6, "prix_unitaire": 700.00}]',
    '/Offres/OFF-2026-006.pdf');

-- ============================================================
-- 3. COMMANDES
-- ============================================================

INSERT INTO commandes (id, reference_commande, offre_id, entreprise_id, montant_ht, montant_ttc, date_commande, date_expedition, type, designations, fichier_source) VALUES
  -- Commande egale a l'offre OFF-2026-001
  ('c0000000-0000-0000-0000-000000000001', 'CMD-2026-001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 12500.00, 15000.00, '2026-02-10', '2026-02-25', 'egale',
    '[{"designation": "Lame de coupe TC 450mm", "quantite": 10, "prix_unitaire": 850.00}, {"designation": "Joint silicone haute temp", "quantite": 20, "prix_unitaire": 200.00}]',
    '/Commandes/CMD-2026-001.pdf'),

  -- Commande partielle sur OFF-2026-002 (seulement les plateaux)
  ('c0000000-0000-0000-0000-000000000002', 'CMD-2026-002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 6000.00, 7200.00, '2026-02-15', '2026-03-01', 'partielle',
    '[{"designation": "Plateau de formage 600x400", "quantite": 5, "prix_unitaire": 1200.00}]',
    '/Commandes/CMD-2026-002.pdf'),

  -- Commande directe (sans offre) — Agro-Plast
  ('c0000000-0000-0000-0000-000000000003', 'CMD-2026-003', NULL, 'a0000000-0000-0000-0000-000000000006', 1800.00, 2160.00, '2026-03-05', NULL, 'directe',
    '[{"designation": "Courroie transmission 1500mm", "quantite": 2, "prix_unitaire": 900.00}]',
    '/Commandes/CMD-2026-003.pdf'),

  -- Commande directe — Thermopack Iberica (Espagne)
  ('c0000000-0000-0000-0000-000000000004', 'CMD-2026-004', NULL, 'a0000000-0000-0000-0000-000000000003', 4500.00, 5445.00, '2026-03-10', NULL, 'directe',
    '[{"designation": "Kit joints viton complet", "quantite": 3, "prix_unitaire": 1500.00}]',
    '/Commandes/CMD-2026-004.pdf');

-- ============================================================
-- 4. VERIFICATION
-- ============================================================

-- Verifier les donnees inserees
DO $$
DECLARE
  v_entreprises INTEGER;
  v_offres INTEGER;
  v_commandes INTEGER;
BEGIN
  SELECT count(*) INTO v_entreprises FROM entreprises;
  SELECT count(*) INTO v_offres FROM offres;
  SELECT count(*) INTO v_commandes FROM commandes;

  RAISE NOTICE '--- Seed complete ---';
  RAISE NOTICE 'Entreprises: % (2 ES, 4 FR)', v_entreprises;
  RAISE NOTICE 'Offres: % (1 transformee, 1 partielle, 3 en_attente, 1 expiree, 1 sans expiration)', v_offres;
  RAISE NOTICE 'Commandes: % (1 egale, 1 partielle, 2 directes)', v_commandes;
END $$;
