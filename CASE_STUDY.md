# Case study — Plateforme de suivi offres/commandes pour ETI plasturgie

> Mission freelance réelle, livrée début 2026 pour une ETI française de
> thermoformage. Version anonymisée pour portfolio — noms, chiffres et
> données remplacés par des fictions cohérentes.

---

## Contexte

Une ETI française fabrique des machines de thermoformage et vend en
parallèle les pièces détachées associées. Le pôle pièces gère environ
**1 M€ d'offres par mois**. Le taux de transformation offre → commande
stagnait autour de **45 %** : chaque point gagné représente un gain de
CA à six chiffres annuel.

Le suivi était entièrement manuel :

- L'assistante commerciale tenait un **cahier papier** avec les numéros
  d'offres et de commandes, et ressaisissait les montants sur un
  tableau Excel.
- Pas de visibilité temps réel sur le taux de transformation, ni sur
  les offres proches d'expirer.
- Les relances étaient ponctuelles, au feeling, souvent tardives.
- Un dashboard de direction était alimenté à la main, en fin de mois.
- Les PDF offres et commandes arrivaient par email, étaient triés
  manuellement dans un répertoire partagé.

## Problème

Même avec un gain modeste de **7 points** de taux de transformation,
l'entreprise pouvait récupérer **~200 k€ de CA par an**. Le frein
n'était pas le produit ni le commercial — c'était l'**absence de
tuyauterie** pour voir ce qui se passait et relancer au bon moment.

## Solution

Une plateforme custom qui automatise la boucle **ingestion → matching
→ visibilité → relance** :

1. **Ingestion OCR** (n8n + Claude Vision). L'assistante dépose un PDF
   dans une interface web. Un workflow n8n appelle Claude Vision avec
   un prompt calibré sur le layout client, extrait 20+ champs
   (références, dates, montants, lignes, correspondant, contact), et
   écrit dans Supabase.
2. **Rapprochement** (n8n + Postgres). Une commande est automatiquement
   liée à son offre via `N° de l'offre` quand il est présent. Le système
   classifie la commande (`partielle / égale / supérieure / directe`),
   agrège les multi‑commandes sur une offre, et met à jour le statut
   de l'offre.
3. **Dashboard** (Next.js + shadcn/ui). KPIs temps réel, offres
   urgentes (expiration ≤ 30 j), top clients par CA ou par taux de
   transformation, répartition FR/ES, analyse des pièces les plus
   vendues, fiche client avec historique.
4. **Relances** (n8n + Outlook). Séquence **J‑30 / J‑15 / J‑7 / J‑1**
   avant expiration, 8 templates HTML (4 paliers × FR/ES), bouton
   opt‑out qui pose un flag et notifie l'assistante.

## Résultats

Chiffres anonymisés / arrondis :

| Indicateur                              | Avant         | Après livraison |
|-----------------------------------------|---------------|-----------------|
| Taux de transformation offres          | ~45 %         | objectif 55 %+  |
| Temps de saisie par PDF                 | ~5 min        | < 20 s          |
| Latence visibilité offres émises        | J+15 à J+30   | temps réel      |
| Offres expirant sans relance            | ~30 %         | 0 % (auto)      |
| Dashboard direction                     | ressaisie manuelle | live Supabase |

Le périmètre initial (6 user stories) a été livré en **~6 semaines**,
suivi d'une Phase 2 (dashboard direction, analyse produits, import
historique SAP ~8 000 offres + ~6 500 commandes sur 2021‑2026).

## Choix techniques

### Pourquoi Supabase
Postgres managed + Auth + RLS + Storage dans une seule plateforme,
zéro infra à gérer, migrations SQL versionnées. Scale largement
au‑delà de ce dont cette ETI a besoin.

### Pourquoi n8n (vs. code Node pur)
Le client a une équipe IT non‑dev. n8n donne une UI visuelle pour les
workflows d'intégration, ce qui permet au prestataire MSP interne de
les maintenir après mon départ. Les workflows sont exportés en JSON et
versionnés dans le repo (source de vérité = code).

### Pourquoi Claude Vision (vs. Tesseract, Azure Document Intelligence)
Les PDF offres/commandes n'ont pas un layout standard, et contiennent
des éléments multilingues (FR/ES), des remises cascadées, des frais
hors lignes. Un LLM multimodal avec un prompt structuré (v2.1) donne
une précision d'extraction élevée dès la première extraction, sans
templates par client.

### Pourquoi Next.js 16 + shadcn/ui (vs. Retool / Lovable)
Retool coûte cher par utilisateur et lock‑in. Un petit app Next.js
sur Vercel, open pour quelques utilisateurs internes, héberge aussi
bien le dashboard, l'upload, l'admin users, l'i18n, et reste exportable
vers n'importe quel hébergeur. shadcn/ui livre un look pro sans passer
3 jours sur la UI.

## Timeline

| Sprint | Objectif                                  | Durée     |
|--------|-------------------------------------------|-----------|
| S1     | Schema Supabase + env n8n + calibrage OCR | 3 j       |
| S2     | Ingestion OCR offres + commandes (WF‑001) | 5 j       |
| S3     | Rapprochement (WF‑002)                    | 4 j       |
| S4     | Dashboard taux de transformation          | 5 j       |
| S5     | Relances auto (WF‑003) + hardening        | 5 j       |
| Phase 2| Import SAP + dashboards direction/analyse | ~3 semaines |

## Leçons apprises

1. **Le ROI venait du *timing* des relances, pas du volume**. L'ETI
   ne manquait pas d'offres à relancer — elle les relançait trop tard
   ou pas du tout. Le workflow `J‑30 / J‑15 / J‑7 / J‑1` a été le plus
   gros levier, pas le dashboard.
2. **L'OCR doit lire les totaux imprimés, jamais les recalculer**. Les
   PDF incluent des frais de transport / emballage en pied de page qui
   n'apparaissent pas dans les lignes. Faire confiance au total affiché
   évite des écarts silencieux. Rédigé dans le prompt v2.1.
3. **Le smart matching clients est un gros pain point OCR**. Une même
   entreprise apparaît sous 4‑5 orthographes selon les PDF (accent,
   casse, abréviation, trailing "SA / SARL"). Un matching en cascade
   (exact → normalisé → pg_trgm) avec auto‑apprentissage des variantes
   évite des centaines de doublons.
4. **Exporter les workflows n8n dans git** est la seule manière de
   garder un dev → prod sain. Un fichier JSON par workflow, une rule
   projet qui force dev → test → deploy checklist → prod.
5. **Des rules projet écrites à l'avance** (langue, credentials n8n,
   workflow lifecycle dev→test→prod, interdictions d'actions prod) ont
   été essentielles pour que Claude Code livre en autonomie sans casser
   de prod. Ces rules vivent hors du repo public.

## Ce que je referais différemment

- **Démarrer avec l'ingestion SAP** plutôt que l'OCR. Les 2 ans
  d'historique SAP auraient immédiatement alimenté le dashboard et
  donné de la matière au client sur l'analyse de saisonnalité, au
  lieu d'attendre que l'OCR ingère assez de volume. Délivré en Phase 2,
  aurait dû être Sprint 0.
- **Monter un Lovable / Retool en 48 h** au kickoff pour valider
  le layout du dashboard avec Alice et Éric (personae fictives) avant
  d'écrire le Next.js. On a économisé 0 temps à faire custom dès le
  début, parce que le dashboard a été réécrit 3 fois après leurs
  retours.
- **Prévoir le credential OAuth2 Outlook plus tôt**. Le blocker IT
  côté client a failli décaler la mise en prod des relances — à
  poser comme dépendance bloquante en semaine 1.

## Crédits

- **Dev + architecture** : Teina — freelance automatisation B2B pour
  PME et ETI.
- **Mission commerciale** : partenaire MSP (anonymisé).
- **Client** : ETI plasturgie française (anonymisée).

Contact pour mission freelance similaire : teinateinauri@gmail.com
