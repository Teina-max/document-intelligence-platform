-- ============================================================
-- Migration 017 : RPC reclassifier_document
-- Déplace un enregistrement entre offres et commandes
-- ============================================================

CREATE OR REPLACE FUNCTION reclassifier_document(
  p_id UUID,
  p_source TEXT,  -- 'offre' ou 'commande'
  p_target TEXT   -- 'offre' ou 'commande'
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_ref TEXT;
  v_entreprise_id UUID;
  v_montant_ht NUMERIC(12,2);
  v_montant_ttc NUMERIC(12,2);
  v_date DATE;
  v_designations JSONB;
  v_fichier_source TEXT;
  v_notes TEXT;
  v_new_id UUID;
BEGIN
  IF p_source = p_target THEN
    RETURN json_build_object('error', 'Source et cible identiques');
  END IF;

  IF p_source = 'offre' AND p_target = 'commande' THEN
    -- Get offre data
    SELECT reference_offre, entreprise_id, montant_ht, montant_ttc, date_offre,
           designations, fichier_source, notes
    INTO v_ref, v_entreprise_id, v_montant_ht, v_montant_ttc, v_date,
         v_designations, v_fichier_source, v_notes
    FROM offres WHERE id = p_id;

    IF NOT FOUND THEN
      RETURN json_build_object('error', 'Offre introuvable');
    END IF;

    -- Insert as commande
    INSERT INTO commandes (reference_commande, entreprise_id, montant_ht, montant_ttc,
                          date_commande, type, designations, fichier_source, notes)
    VALUES (v_ref, v_entreprise_id, v_montant_ht, v_montant_ttc,
            v_date, 'directe', v_designations, v_fichier_source, v_notes)
    RETURNING id INTO v_new_id;

    -- Delete offre
    DELETE FROM offres WHERE id = p_id;

    RETURN json_build_object('success', true, 'new_id', v_new_id, 'type', 'commande');

  ELSIF p_source = 'commande' AND p_target = 'offre' THEN
    -- Get commande data
    SELECT reference_commande, entreprise_id, montant_ht, montant_ttc, date_commande,
           designations, fichier_source, notes
    INTO v_ref, v_entreprise_id, v_montant_ht, v_montant_ttc, v_date,
         v_designations, v_fichier_source, v_notes
    FROM commandes WHERE id = p_id;

    IF NOT FOUND THEN
      RETURN json_build_object('error', 'Commande introuvable');
    END IF;

    -- Unlink from offre if linked
    -- (no need, we're deleting the commande)

    -- Insert as offre
    INSERT INTO offres (reference_offre, entreprise_id, montant_ht, montant_ttc,
                       date_offre, statut, designations, fichier_source, notes)
    VALUES (v_ref, v_entreprise_id, v_montant_ht, v_montant_ttc,
            v_date, 'en_attente', v_designations, v_fichier_source, v_notes)
    RETURNING id INTO v_new_id;

    -- Delete commande
    DELETE FROM commandes WHERE id = p_id;

    RETURN json_build_object('success', true, 'new_id', v_new_id, 'type', 'offre');
  ELSE
    RETURN json_build_object('error', 'Type source/cible invalide');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reclassifier_document IS 'Déplace un document entre offres et commandes (re-classification OCR)';
