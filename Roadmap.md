# Roadmap — ThermoPack Industries Phase 1

## Sprint 1 — Fondations (3 jours)

**Objectif** : Tout le socle technique en place, OCR calibre sur des vrais PDF.

### Livrables
- Schema Supabase deploye (tables Entreprises, Offres, Commandes + index + RLS)
- Connexion n8n <-> Supabase configuree
- Connexion n8n <-> OneDrive configuree
- Tests OCR Claude API sur 10-15 PDF reels (prompt calibre)
- Choix tech dashboard tranche

### Criteres d'acceptation
- Tables creees avec FK, index sur reference_offre et entreprise_id
- RLS active sur chaque table
- Trigger OneDrive fonctionnel dans n8n (detecte un nouveau fichier)
- Prompt OCR extrait correctement les champs cles sur 80%+ des PDF exemples

### Bloqueurs
- Acces OneDrive (Alice)
- PDF exemples (Alice)

---

## Sprint 2 — Ingestion OCR (5 jours)

**Objectif** : Chaque PDF depose sur OneDrive est automatiquement analyse et stocke.

### Livrables
- WF-001 : Ingestion offres (trigger OneDrive -> Claude OCR -> upsert Supabase)
- WF-002 : Ingestion commandes (idem + liaison FK offre si reference presente)
- Gestion erreurs : log des extractions douteuses, notification en cas d'echec
- Tests sur 20+ PDF (offres et commandes melangees)

### Criteres d'acceptation
- Offre deposee dans OneDrive /Offres -> enregistrement cree dans Supabase en <30s
- Commande avec ref offre -> liaison FK correcte
- Commande sans ref offre -> offre_id = NULL, type = "directe"
- Upsert entreprise fonctionnel (creation ou mise a jour)
- Erreurs OCR loguees et notifiees

### Dependances
- S1 termine (schema + connexions)

---

## Sprint 3 — Rapprochement (4 jours)

**Objectif** : Chaque commande est rapprochee de son offre avec classification automatique.

### Livrables
- WF-003 : Rapprochement offre/commande (post-ingestion ou cron)
- Logique multi-commandes (somme des commandes liees a une offre)
- Classification : partielle / egale / superieure / directe
- Mise a jour statut offre : transformee / partiellement transformee / en attente
- Distinction France / Espagne par code postal

### Criteres d'acceptation
- Commande de 5000 EUR sur offre de 10000 EUR -> "partielle", offre "partiellement transformee"
- 2 commandes de 5000 EUR sur meme offre -> somme 10000 EUR, offre "transformee"
- Commande sans ref offre -> "directe"
- Taux de transformation calculable par entreprise et global
- Repartition FR/ES correcte

### Dependances
- S2 termine (donnees offres + commandes en base)

---

## Sprint 4 — Dashboard (5 jours)

**Objectif** : Éric Martin et Alice voient le taux de transformation en temps reel.

### Livrables
- Dashboard avec : taux global, montants offres vs commandes, liste offres non transformees
- Filtres : periode, pays, entreprise
- Top clients (volume, taux transformation)
- Repartition France / Espagne
- Actualisation automatique

### Criteres d'acceptation
- Donnees coherentes avec Supabase (pas de decalage)
- Filtres fonctionnels
- Accessible et lisible pour Éric Martin (pas technique)
- Pas de saisie manuelle requise

### Dependances
- S3 termine (rapprochement fonctionnel)
- Tech dashboard tranchee en S1

---

## Sprint 5 — Relances + Handoff (5 jours)

**Objectif** : Relances automatiques + projet livre et documente.

### Livrables
- WF-004 : Relance offres non transformees (J-30, J-15, J-7, J-1)
- Templates email personnalises FR + ES
- Stop automatique si commande recue entre-temps
- Tests end-to-end sur tout le pipeline
- Documentation utilisateur
- Formation Alice/Éric Martin

### Criteres d'acceptation
- Offre sans commande a J-30 -> email relance envoye
- Commande recue apres relance J-30 -> plus de relance
- Contenu personnalise (nom client, ref offre, montant, designations)
- Langue correcte selon pays
- Suivi taux d'ouverture et reponse

### Dependances
- S3 termine (rapprochement)
- Templates valides par Alice/Éric Martin

---

## Resume

| Sprint | Jours | Cumul |
|--------|-------|-------|
| S1 Fondations | 3 | 3 |
| S2 Ingestion OCR | 5 | 8 |
| S3 Rapprochement | 4 | 12 |
| S4 Dashboard | 5 | 17 |
| S5 Relances + Handoff | 5 | 22 |

**Total Phase 1 : ~22 jours ouvres (4-5 semaines)**
