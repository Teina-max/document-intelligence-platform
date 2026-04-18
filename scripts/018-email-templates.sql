-- 018: Table email_templates for relance workflows
-- n8n fetches templates via: SELECT objet, corps_html FROM email_templates WHERE palier = 'J-30' AND langue = 'fr' AND actif = true

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palier TEXT NOT NULL CHECK (palier IN ('J-30', 'J-15', 'J-7', 'J-1')),
  langue TEXT NOT NULL CHECK (langue IN ('fr', 'es')),
  objet TEXT NOT NULL,
  corps_html TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one active template per palier+langue
CREATE UNIQUE INDEX idx_email_templates_palier_langue
  ON email_templates (palier, langue) WHERE actif = true;

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_email_templates
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_select" ON email_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "email_templates_admin" ON email_templates
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =============================================================================
-- SEED: 8 templates (4 paliers x 2 langues)
-- =============================================================================

-- J-30 FR
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-30', 'fr',
  'Votre offre ThermoPack {{reference_offre}} — Suivi',
  $TMPL$<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Suivi offre {{reference_offre}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#003B73;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <!-- Badge palier -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#E8F0FE;color:#003B73;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;letter-spacing:0.5px;">
                    SUIVI OFFRE
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Bonjour {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Nous nous permettons de revenir vers vous concernant notre offre ci-dessous, dont vous trouverez le d&eacute;tail en pi&egrave;ce jointe.
              </p>
            </td>
          </tr>
          <!-- Encart offre -->
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border-left:4px solid #003B73;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">R&eacute;f&eacute;rence offre</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Montant HT</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; HT</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Valable jusqu'au</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#1a1a1a;">{{date_expiration}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Suite texte -->
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Cette offre reste valable jusqu'au <strong>{{date_expiration}}</strong>. Nous restons &agrave; votre disposition pour toute question technique ou commerciale.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                N'h&eacute;sitez pas &agrave; nous contacter si vous souhaitez des pr&eacute;cisions ou des ajustements sur cette proposition.
              </p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="mailto:{{expediteur_email}}?subject=Re:%20Offre%20{{reference_offre}}" style="display:inline-block;background-color:#003B73;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
                Nous contacter
              </a>
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>
                5, rue L&eacute;on Appert<br>
                91280 Saint-Pierre-du-Perray &mdash; France<br>
                T&eacute;l. : {{tel}}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Ce message est envoy&eacute; automatiquement suite &agrave; votre demande de devis. Si vous ne souhaitez plus recevoir ces rappels, merci de nous le signaler par retour de mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-30 ES
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-30', 'es',
  'Su oferta ThermoPack {{reference_offre}} — Seguimiento',
  $TMPL$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Su oferta ThermoPack {{reference_offre}} — Seguimiento</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#003B73;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#E8F0FE;color:#003B73;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;letter-spacing:0.5px;">
                    SEGUIMIENTO DE OFERTA
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Estimado/a {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Nos permitimos ponernos en contacto con usted en relaci&oacute;n con nuestra oferta, cuyo detalle encontrar&aacute; en el documento adjunto.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border-left:4px solid #003B73;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Referencia oferta</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Importe sin IVA</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; sin IVA</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">V&aacute;lida hasta</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#1a1a1a;">{{date_expiration}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Esta oferta es v&aacute;lida hasta el <strong>{{date_expiration}}</strong>. Quedamos a su disposici&oacute;n para cualquier consulta t&eacute;cnica o comercial.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                No dude en contactarnos si desea aclaraciones o ajustes sobre esta propuesta.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="mailto:{{expediteur_email}}?subject=Re:%20Oferta%20{{reference_offre}}" style="display:inline-block;background-color:#003B73;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
                Contactarnos
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; Francia<br>Tel.: {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Este mensaje se env&iacute;a autom&aacute;ticamente tras su solicitud de presupuesto. Si no desea recibir estos recordatorios, por favor h&aacute;ganoslo saber respondiendo a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-15 FR
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-15', 'fr',
  'Offre {{reference_offre}} — Avez-vous pu etudier notre proposition ?',
  $TMPL$<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offre {{reference_offre}} — Suivi</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#003B73;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#FEF3C7;color:#92400E;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;letter-spacing:0.5px;">
                    OFFRE EN COURS &mdash; J-15
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Bonjour {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Nous revenons vers vous au sujet de notre offre ci-dessous, valable jusqu'au <strong>{{date_expiration}}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border-left:4px solid #D97706;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">R&eacute;f&eacute;rence offre</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Montant HT</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; HT</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Valable jusqu'au</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#D97706;">{{date_expiration}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                Avez-vous eu l'occasion d'&eacute;tudier cette proposition ? Nous serions ravis d'&eacute;changer par t&eacute;l&eacute;phone pour r&eacute;pondre &agrave; vos &eacute;ventuelles questions ou adapter notre offre &agrave; vos besoins.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="tel:+33160861025" style="display:inline-block;background-color:#003B73;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;margin-right:8px;">
                &#9742; Nous appeler
              </a>
              <a href="mailto:{{expediteur_email}}?subject=Re:%20Offre%20{{reference_offre}}" style="display:inline-block;background-color:#ffffff;color:#003B73;font-size:14px;font-weight:600;padding:11px 28px;border-radius:6px;text-decoration:none;border:1px solid #003B73;">
                R&eacute;pondre par email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; France<br>T&eacute;l. : {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Ce message est envoy&eacute; automatiquement suite &agrave; votre demande de devis. Si vous ne souhaitez plus recevoir ces rappels, merci de nous le signaler par retour de mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-15 ES
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-15', 'es',
  'Oferta {{reference_offre}} — ¿Ha podido estudiar nuestra propuesta?',
  $TMPL$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oferta {{reference_offre}} — Seguimiento</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#003B73;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#FEF3C7;color:#92400E;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;letter-spacing:0.5px;">
                    OFERTA EN CURSO &mdash; 15 D&Iacute;AS
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Estimado/a {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Nos ponemos en contacto con usted respecto a nuestra oferta, v&aacute;lida hasta el <strong>{{date_expiration}}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border-left:4px solid #D97706;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Referencia oferta</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Importe sin IVA</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; sin IVA</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">V&aacute;lida hasta</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#D97706;">{{date_expiration}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                &iquest;Ha tenido la oportunidad de estudiar esta propuesta? Estar&iacute;amos encantados de conversar por tel&eacute;fono para responder a sus posibles preguntas o adaptar nuestra oferta a sus necesidades.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="tel:+33160861025" style="display:inline-block;background-color:#003B73;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;margin-right:8px;">
                &#9742; Llamarnos
              </a>
              <a href="mailto:{{expediteur_email}}?subject=Re:%20Oferta%20{{reference_offre}}" style="display:inline-block;background-color:#ffffff;color:#003B73;font-size:14px;font-weight:600;padding:11px 28px;border-radius:6px;text-decoration:none;border:1px solid #003B73;">
                Responder por email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; Francia<br>Tel.: {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Este mensaje se env&iacute;a autom&aacute;ticamente tras su solicitud de presupuesto. Si no desea recibir estos recordatorios, por favor h&aacute;ganoslo saber respondiendo a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-7 FR
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-7', 'fr',
  'Offre {{reference_offre}} — Echeance dans 7 jours',
  $TMPL$<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offre {{reference_offre}} — Echeance dans 7 jours</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#003B73;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#FEE2E2;color:#991B1B;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;letter-spacing:0.5px;">
                    &#9888; &Eacute;CH&Eacute;ANCE DANS 7 JOURS
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Bonjour {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Nous souhaitons vous informer que notre offre arrive &agrave; &eacute;ch&eacute;ance le <strong>{{date_expiration}}</strong>, soit dans <strong>7 jours</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF2F2;border-left:4px solid #DC2626;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">R&eacute;f&eacute;rence offre</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Montant HT</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; HT</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Expire le</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#DC2626;">{{date_expiration}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Afin de vous garantir les conditions et d&eacute;lais indiqu&eacute;s, nous vous invitons &agrave; nous confirmer votre commande avant cette date.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                Si votre projet a &eacute;volu&eacute; ou si vous avez besoin d'une mise &agrave; jour de l'offre, contactez-nous rapidement &mdash; nous ferons le n&eacute;cessaire dans les meilleurs d&eacute;lais.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="tel:+33160861025" style="display:inline-block;background-color:#DC2626;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
                &#9742; Appeler maintenant
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; France<br>T&eacute;l. : {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Ce message est envoy&eacute; automatiquement suite &agrave; votre demande de devis. Si vous ne souhaitez plus recevoir ces rappels, merci de nous le signaler par retour de mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-7 ES
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-7', 'es',
  'Oferta {{reference_offre}} — Vence en 7 dias',
  $TMPL$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oferta {{reference_offre}} — Vence en 7 dias</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#003B73;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#FEE2E2;color:#991B1B;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;letter-spacing:0.5px;">
                    &#9888; VENCE EN 7 D&Iacute;AS
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Estimado/a {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Le informamos que nuestra oferta vence el <strong>{{date_expiration}}</strong>, es decir, en <strong>7 d&iacute;as</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF2F2;border-left:4px solid #DC2626;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Referencia oferta</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Importe sin IVA</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; sin IVA</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Vence el</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#DC2626;">{{date_expiration}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Para garantizarle las condiciones y plazos indicados, le invitamos a confirmarnos su pedido antes de dicha fecha.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                Si su proyecto ha evolucionado o necesita una actualizaci&oacute;n de la oferta, cont&aacute;ctenos r&aacute;pidamente &mdash; haremos lo necesario en los mejores plazos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="tel:+33160861025" style="display:inline-block;background-color:#DC2626;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
                &#9742; Llamar ahora
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; Francia<br>Tel.: {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Este mensaje se env&iacute;a autom&aacute;ticamente tras su solicitud de presupuesto. Si no desea recibir estos recordatorios, por favor h&aacute;ganoslo saber respondiendo a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-1 FR
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-1', 'fr',
  'Offre {{reference_offre}} — Expire demain',
  $TMPL$<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offre {{reference_offre}} — Expire demain</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#7F1D1D;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#7F1D1D;color:#ffffff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:12px;letter-spacing:0.5px;">
                    &#9888; EXPIRE DEMAIN
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Bonjour {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                <strong>Dernier rappel</strong> : notre offre ci-dessous expire <strong>demain, le {{date_expiration}}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF2F2;border-left:4px solid #7F1D1D;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">R&eacute;f&eacute;rence offre</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Montant HT</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; HT</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Expire le</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#7F1D1D;">&#9888; {{date_expiration}} &mdash; DEMAIN</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Pass&eacute; cette date, nous ne serons malheureusement plus en mesure de garantir les conditions tarifaires et les d&eacute;lais de livraison indiqu&eacute;s dans cette offre.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                Si vous souhaitez maintenir cette proposition, merci de nous contacter <strong>aujourd'hui</strong> par retour de mail ou par t&eacute;l&eacute;phone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;" align="center">
              <a href="mailto:{{expediteur_email}}?subject=Confirmation%20offre%20{{reference_offre}}" style="display:inline-block;background-color:#7F1D1D;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:6px;text-decoration:none;">
                Confirmer ma commande
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="tel:+33160861025" style="display:inline-block;color:#7F1D1D;font-size:13px;font-weight:600;padding:8px;text-decoration:underline;">
                ou appeler le {{tel}}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; France<br>T&eacute;l. : {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Ce message est envoy&eacute; automatiquement suite &agrave; votre demande de devis. Si vous ne souhaitez plus recevoir ces rappels, merci de nous le signaler par retour de mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);

-- J-1 ES
INSERT INTO email_templates (palier, langue, objet, corps_html) VALUES (
  'J-1', 'es',
  'Oferta {{reference_offre}} — Vence manana',
  $TMPL$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oferta {{reference_offre}} — Vence manana</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#7F1D1D;padding:24px 32px;text-align:center;">
              <img src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png" alt="ThermoPack" width="180" style="display:block;margin:0 auto;filter:brightness(0) invert(1);">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#7F1D1D;color:#ffffff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:12px;letter-spacing:0.5px;">
                    &#9888; VENCE MA&Ntilde;ANA
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">Estimado/a {{nom_contact}},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                <strong>&Uacute;ltimo recordatorio</strong>: nuestra oferta vence <strong>ma&ntilde;ana, {{date_expiration}}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF2F2;border-left:4px solid #7F1D1D;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Referencia oferta</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#003B73;">{{reference_offre}}</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Importe sin IVA</p>
                    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a1a;">{{montant_ht}} &euro; sin IVA</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#666;">Vence el</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#7F1D1D;">&#9888; {{date_expiration}} &mdash; MA&Ntilde;ANA</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">
                Pasada esta fecha, lamentablemente no podremos garantizar las condiciones tarifarias ni los plazos de entrega indicados en esta oferta.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">
                Si desea mantener esta propuesta, le rogamos que se ponga en contacto con nosotros <strong>hoy mismo</strong> por correo electr&oacute;nico o por tel&eacute;fono.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;" align="center">
              <a href="mailto:{{expediteur_email}}?subject=Confirmaci%C3%B3n%20oferta%20{{reference_offre}}" style="display:inline-block;background-color:#7F1D1D;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:6px;text-decoration:none;">
                Confirmar mi pedido
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;" align="center">
              <a href="tel:+33160861025" style="display:inline-block;color:#7F1D1D;font-size:13px;font-weight:600;padding:8px;text-decoration:underline;">
                o llamar al {{tel}}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:20px 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">{{expediteur_nom}}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;font-style:italic;">{{expediteur_titre}}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">
                ThermoPack Industries<br>5, rue L&eacute;on Appert<br>91280 Saint-Pierre-du-Perray &mdash; Francia<br>Tel.: {{tel}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                Este mensaje se env&iacute;a autom&aacute;ticamente tras su solicitud de presupuesto. Si no desea recibir estos recordatorios, por favor h&aacute;ganoslo saber respondiendo a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$TMPL$
);
