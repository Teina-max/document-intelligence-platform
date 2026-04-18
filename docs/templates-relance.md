# Templates Relance — Offres non transformees

## Variables dynamiques (n8n)

| Variable | Source | Exemple |
|----------|--------|---------|
| `{{nom_contact}}` | entreprises.contact_nom | M. Dupont |
| `{{entreprise}}` | entreprises.nom | Plastiform SAS |
| `{{reference_offre}}` | offres.reference_offre | OFF-2026-0142 |
| `{{montant_ht}}` | offres.montant_ht | 12 450,00 EUR |
| `{{date_expiration}}` | offres.date_expiration | 15/04/2026 |
| `{{jours_restants}}` | calcule | 30 / 15 / 7 / 1 |
| `{{expediteur_nom}}` | config | Alice Durand |
| `{{expediteur_titre}}` | config | Assistante administration des ventes |
| `{{tel}}` | config | 01 60 86 10 25 |

> **Piece jointe** : PDF offre originale (`fichier_source`) attache automatiquement par n8n si disponible dans OneDrive.

---

## FRANCAIS

---

### Palier J-30 — Rappel courtois

**Objet** : Votre offre ThermoPack {{reference_offre}} — Suivi

Bonjour {{nom_contact}},

Nous nous permettons de revenir vers vous concernant notre offre **{{reference_offre}}** d'un montant de **{{montant_ht}} EUR HT**, dont vous trouverez le detail en piece jointe.

Cette offre reste valable jusqu'au **{{date_expiration}}**. Nous restons a votre disposition pour toute question technique ou commerciale.

N'hesitez pas a nous contacter si vous souhaitez des precisions ou des ajustements sur cette proposition.

Cordialement,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — France
Tel. : {{tel}}

---

### Palier J-15 — Demande de suivi

**Objet** : Offre {{reference_offre}} — Avez-vous pu etudier notre proposition ?

Bonjour {{nom_contact}},

Nous revenons vers vous au sujet de notre offre **{{reference_offre}}** (**{{montant_ht}} EUR HT**), valable jusqu'au **{{date_expiration}}**.

Avez-vous eu l'occasion d'etudier cette proposition ? Nous serions ravis d'echanger par telephone pour repondre a vos eventuelles questions ou adapter notre offre a vos besoins.

Vous pouvez nous joindre directement au **{{tel}}**.

Dans l'attente de votre retour, nous vous souhaitons une excellente journee.

Cordialement,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — France
Tel. : {{tel}}

---

### Palier J-7 — Echeance proche

**Objet** : Offre {{reference_offre}} — Echeance dans 7 jours

Bonjour {{nom_contact}},

Nous souhaitons vous informer que notre offre **{{reference_offre}}** d'un montant de **{{montant_ht}} EUR HT** arrive a echeance le **{{date_expiration}}**, soit dans **7 jours**.

Afin de vous garantir les conditions et delais indiques, nous vous invitons a nous confirmer votre commande avant cette date.

Si votre projet a evolue ou si vous avez besoin d'une mise a jour de l'offre, contactez-nous rapidement au **{{tel}}** — nous ferons le necessaire dans les meilleurs delais.

Cordialement,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — France
Tel. : {{tel}}

---

### Palier J-1 — Derniere relance

**Objet** : Offre {{reference_offre}} — Expire demain

Bonjour {{nom_contact}},

Dernier rappel : notre offre **{{reference_offre}}** (**{{montant_ht}} EUR HT**) expire **demain, le {{date_expiration}}**.

Passe cette date, nous ne serons malheureusement plus en mesure de garantir les conditions tarifaires et les delais de livraison indiques dans cette offre.

Si vous souhaitez maintenir cette proposition, merci de nous contacter aujourd'hui par retour de mail ou par telephone au **{{tel}}**.

Cordialement,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — France
Tel. : {{tel}}

---

## ESPAGNOL

---

### Palier J-30 — Recordatorio cordial

**Objet** : Su oferta ThermoPack {{reference_offre}} — Seguimiento

Estimado/a {{nom_contact}},

Nos permitimos ponernos en contacto con usted en relacion con nuestra oferta **{{reference_offre}}** por un importe de **{{montant_ht}} EUR sin IVA**, cuyo detalle encontrara en el documento adjunto.

Esta oferta es valida hasta el **{{date_expiration}}**. Quedamos a su disposicion para cualquier consulta tecnica o comercial.

No dude en contactarnos si desea aclaraciones o ajustes sobre esta propuesta.

Atentamente,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — Francia
Tel.: {{tel}}

---

### Palier J-15 — Solicitud de seguimiento

**Objet** : Oferta {{reference_offre}} — ¿Ha podido estudiar nuestra propuesta?

Estimado/a {{nom_contact}},

Nos ponemos en contacto con usted respecto a nuestra oferta **{{reference_offre}}** (**{{montant_ht}} EUR sin IVA**), valida hasta el **{{date_expiration}}**.

¿Ha tenido la oportunidad de estudiar esta propuesta? Estariamos encantados de conversar por telefono para responder a sus posibles preguntas o adaptar nuestra oferta a sus necesidades.

Puede contactarnos directamente al **{{tel}}**.

Quedando a la espera de su respuesta, le deseamos un excelente dia.

Atentamente,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — Francia
Tel.: {{tel}}

---

### Palier J-7 — Vencimiento proximo

**Objet** : Oferta {{reference_offre}} — Vence en 7 dias

Estimado/a {{nom_contact}},

Le informamos que nuestra oferta **{{reference_offre}}** por un importe de **{{montant_ht}} EUR sin IVA** vence el **{{date_expiration}}**, es decir, en **7 dias**.

Para garantizarle las condiciones y plazos indicados, le invitamos a confirmarnos su pedido antes de dicha fecha.

Si su proyecto ha evolucionado o necesita una actualizacion de la oferta, contactenos rapidamente al **{{tel}}** — haremos lo necesario en los mejores plazos.

Atentamente,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — Francia
Tel.: {{tel}}

---

### Palier J-1 — Ultimo recordatorio

**Objet** : Oferta {{reference_offre}} — Vence manana

Estimado/a {{nom_contact}},

Ultimo recordatorio: nuestra oferta **{{reference_offre}}** (**{{montant_ht}} EUR sin IVA**) vence **manana, {{date_expiration}}**.

Pasada esta fecha, lamentablemente no podremos garantizar las condiciones tarifarias ni los plazos de entrega indicados en esta oferta.

Si desea mantener esta propuesta, le rogamos que se ponga en contacto con nosotros hoy mismo por correo electronico o por telefono al **{{tel}}**.

Atentamente,

**{{expediteur_nom}}**
*{{expediteur_titre}}*

ThermoPack Industries
5, rue Leon Appert
91280 Saint-Pierre-du-Perray — Francia
Tel.: {{tel}}

---

## Regles d'envoi (a valider avec Alice/Éric Martin)

| Parametre | Valeur proposee | A confirmer |
|-----------|----------------|-------------|
| Paliers | J-30, J-15, J-7, J-1 | Oui |
| Horaire d'envoi | 9h00 (heure Paris) | Oui |
| Stop si commande recue | Automatique | Oui |
| Stop si offre expiree sans relance J-1 | Automatique | Oui |
| Expediteur | Alice Durand | Oui |
| Email expediteur | a.maraval@thermopack.fr ? | Oui |
| Piece jointe PDF | Offre originale | Oui |
| Max relances par jour (rate limit) | 20 emails/jour ? | Oui |
| Exclusion manuelle | Liste noire entreprises ? | Oui |
| CC interne | Copie Alice/Éric Martin ? | Oui |
