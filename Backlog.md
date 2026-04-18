# USER STORIES & BACKLOG

## ThermoPack Industries - Automatisation Pole Pieces

Client ThermoPack Industries

Phase Phase 1 - Pole Pieces + Dashboard

Plateforme N8N (self-hosted)

Base de donnees Supabase (PostgreSQL)

IA Claude API (Anthropic)

Date Mars 2026

```
Document confidentiel
```

## 1. Matrice Effort / Impact

```
User Story Impact Effort Priorite Type
```
```
US-001 : Schema Supabase Eleve 1-2 jours Haute Quick Win
```
```
US-002 : Ingestion OCR offres Tres eleve 3-5 jours Haute Quick Win
```
```
US-003 : Ingestion OCR
commandes
```
```
Tres eleve 2-3 jours Haute Quick Win
```
```
US-004 : Rapprochement
offre/commande
```
```
Tres eleve 3-5 jours Haute Quick Win
```
```
US-005 : Dashboard taux
transformation
```
```
Eleve 5-7 jours Haute Quick Win
```
```
US-006 : Relance offres non
transformees
```
```
Tres eleve 3-5 jours Haute Conditionne*
```
```
US-007 : Dashboard KPI direction Eleve 5-7 jours Moyenne Projet structure
```
```
US-008 : Analyse comportement
client
```
```
Moyen 5-10 jours Basse Phase 2
```
```
* Conditionne a la validation du schema de relance avec Alice/Éric Martin
```

## 2. User Stories detaillees

#### US-001 : Creation schema base de donnees Supabase

```
En tant que equipe technique La Dinguerie
```
```
Je veux un schema de base de donnees structure sur Supabase avec les tables
Entreprises, Offres et Commandes
```
```
Afin de stocker de maniere fiable toutes les donnees extraites des PDF et permettre
les analyses futures
```
```
Criteres d'acceptation - Table Entreprises : id, nom, code_postal, pays, contact, telephone, email,
date_creation
```
- Table Offres : id, reference_offre, entreprise_id (FK), montant_ht,
montant_ttc, date_offre, date_expiration, statut, correspondant, fichier_source
- Table Commandes : id, reference_commande, offre_id (FK nullable),
entreprise_id (FK), montant_ht, montant_ttc, date_commande,
date_expedition, type (partielle/egale/superieure/directe), fichier_source
- Index sur reference_offre et entreprise_id
- Row Level Security configure

```
Apps impliquees Supabase
```
```
Complexite Simple
```
```
Plateforme N8N + Supabase
```
```
Priorite Haute - Prerequis pour toutes les autres US
```
#### US-002 : Ingestion automatique des offres (OCR)

```
En tant que Alice (assistante commerciale)
```
```
Je veux que chaque offre PDF deposee sur OneDrive soit automatiquement analysee
et stockee dans Supabase
```
```
Afin de eliminer la saisie manuelle sur cahier et avoir une base offres fiable et
exhaustive
```
```
Criteres d'acceptation - Trigger N8N sur nouveau fichier dans dossier OneDrive /Offres
```
- Extraction OCR via Claude API : reference offre, infos entreprise (nom,
adresse, code postal, pays), montant HT/TTC, date, correspondant,
designations + quantites
- Upsert entreprise dans Supabase (creation si nouvelle, mise a jour sinon)
- Creation enregistrement dans table Offres avec lien entreprise
- Gestion des erreurs OCR : log des extractions douteuses pour review
humain
- Notification en cas d'erreur

```
Apps impliquees N8N, Microsoft 365 (OneDrive), Claude API, Supabase
```
```
Complexite Moyenne
```
```
Plateforme N8N
```

```
Priorite Haute
```
#### US-003 : Ingestion automatique des commandes (OCR)

```
En tant que Alice (assistante commerciale)
```
```
Je veux que chaque commande PDF deposee sur OneDrive soit automatiquement
analysee et stockee dans Supabase
```
```
Afin de avoir un suivi complet des commandes et permettre le rapprochement
automatique avec les offres
```
```
Criteres d'acceptation - Trigger N8N sur nouveau fichier dans dossier OneDrive /Commandes
```
- Extraction OCR via Claude API : reference commande, reference offre (si
presente), infos entreprise, montant HT/TTC, date commande, date
expedition, designations + quantites
- Si reference offre presente : recherche dans table Offres pour liaison FK
- Si reference offre absente : commande directe (offre_id = NULL)
- Upsert entreprise + creation enregistrement Commandes
- Calcul automatique du type : partielle / egale / superieure / directe
- Log et notification en cas d'erreur

```
Apps impliquees N8N, Microsoft 365 (OneDrive), Claude API, Supabase
```
```
Complexite Moyenne
```
```
Plateforme N8N
```
```
Priorite Haute
```

#### US-004 : Rapprochement automatique offre / commande

```
En tant que Alice et Éric Martin (direction)
```
```
Je veux que chaque commande soit automatiquement rapprochee de son offre
d'origine avec comparaison des montants
```
```
Afin de connaitre en temps reel le taux de transformation et identifier les ecarts
(partiel, upsell)
```
```
Criteres d'acceptation - A chaque nouvelle commande avec reference offre : requete SQL pour
retrouver l'offre
```
- Comparaison montant commande vs montant offre
- Classification : partielle (< offre), egale (= offre), superieure (> offre)
- Gestion multi-commandes : somme des commandes liees a une meme offre
- Mise a jour du statut offre : transformee / partiellement transformee / en
attente
- Calcul taux de transformation global et par entreprise
- Distinction automatique France / Espagne (code postal donneur d'ordre)

```
Apps impliquees N8N, Supabase
```
```
Complexite Complexe
```
```
Plateforme N8N
```
```
Priorite Haute
```
#### US-005 : Dashboard taux de transformation

```
En tant que Éric Martin (DG) et Alice
```
```
Je veux un dashboard temps reel montrant le taux de transformation
offres/commandes avec filtres
```
```
Afin de piloter le business pieces avec des donnees fiables et identifier les
opportunites de relance
```
```
Criteres d'acceptation - Taux de transformation global (objectif : 43% -> 50%+)
```
- Montant total offres vs commandes (mois en cours, cumul annuel)
- Liste des offres non transformees avec delai restant avant expiration
- Repartition France / Espagne
- Top clients (volume offres, taux transformation)
- Filtres : periode, pays, entreprise
- Actualisation automatique (pas de saisie manuelle)

```
Apps impliquees Supabase, Zite ou interface custom
```
```
Complexite Moyenne
```
```
Plateforme N8N + Supabase
```
```
Priorite Haute
```

#### US-006 : Relance automatique des offres non transformees

```
En tant que Alice (assistante commerciale)
```
```
Je veux que les offres non transformees declenchent automatiquement des emails de
relance avant expiration
```
```
Afin de recuperer 240 000 EUR/an minimum en augmentant le taux de transformation
de 43% a 50%+
```
```
Criteres d'acceptation - Detection automatique des offres sans commande associee
```
- Sequence de relance : J-30, J-15, J-7, J-1 avant expiration
- Contenu personnalise (nom client, reference offre, montant, designations)
- Bilingue FR/ES selon le pays du donneur d'ordre
- Suivi des taux d'ouverture et de reponse
- Stop automatique si commande recue entre-temps
- Templates emails valides par Alice/Éric Martin avant mise en production

```
Apps impliquees N8N, Supabase, Microsoft 365 (Outlook)
```
```
Complexite Moyenne
```
```
Plateforme N8N
```
```
Priorite Haute
```
```
Potentiel business 800 000 EUR/mois x 57% non transformees = 456 000 EUR d'opportunites.
Objectif : +7 points de transformation = 240 000 EUR/an
```
#### US-007 : Dashboard KPI direction

```
En tant que Éric Martin (DG)
```
```
Je veux un dashboard centralise connecte aux sources de donnees (Excel Gabrielle Petit +
Supabase) remplacant la saisie manuelle sur Zite
```
```
Afin de avoir une vision temps reel du business sans ressaisie
```
```
Criteres d'acceptation - KPIs : CA France / Espagne / Total, resultat mensuel, order intake machines,
CA pieces / service / formation
```
- Connexion au tableau Excel de Gabrielle Petit (source KPIs comptables)
- Import automatique des donnees Supabase (offres, commandes)
- Offres emises, commandes recues, taux conversion
- Actualisation automatique (minimum quotidienne)
- Interface accessible et intuitive pour Éric Martin

```
Apps impliquees N8N, Supabase, Microsoft 365 (Excel), Zite ou interface custom
```
```
Complexite Moyenne a Complexe
```
```
Plateforme N8N
```
```
Priorite Moyenne
```

#### US-008 : Analyse comportement client/produit (Phase 2)

```
En tant que Alice et Éric Martin
```
```
Je veux identifier les consommables recurrents par client et analyser la saisonnalite
des commandes
```
```
Afin de passer d'un mode reactif a un marketing proactif (proposer avant que le client
ne demande)
```
```
Criteres d'acceptation - Extraction des designations et quantites depuis les commandes (deja fait en
US-003)
```
- Table materiaux avec reference, designation, famille
- Classement pieces les plus vendues (quantite vs valeur)
- Identification commandes recurrentes par client
- Analyse saisonnalite (periodes de maintenance, pics de commandes)
- Suggestions de promos ciblees par periode et par client

```
Apps impliquees N8N, Supabase, Claude API
```
```
Complexite Complexe
```
```
Plateforme N8N
```
```
Priorite Basse (Phase 2)
```

## 3. Backlog priorise

### 3.1 Quick Wins (deploiement immediat)

```
# User Story Effort Dependance Responsable
```
```
1 US-001 : Schema Supabase 1-2 jours Aucune Dev-agent
```
```
2 US-002 : Ingestion offres (OCR) 3-5 jours US-001 Dev-agent
```
```
3 US-003 : Ingestion commandes
(OCR)
```
```
2-3 jours US-001 Dev-agent
```
```
4 US-004 : Rapprochement
offre/commande
```
```
3-5 jours US-002 + US-003 Dev-agent
```
```
5 US-005 : Dashboard transformation 5-7 jours US-004 Dev-agent
```
```
6 US-006 : Relance auto offres 3-5 jours US-004 + validation
Alice
```
```
Dev-agent
```
##### Duree totale estimee Phase 1 : 17-27 jours ouvres

### 3.2 Projets structures (Phase 2+)

```
# User Story Effort Prerequis
```
```
7 US-007 : Dashboard KPI direction 5-7 jours Phase 1 terminee + Excel Gabrielle Petit
```
```
8 US-008 : Analyse comportement
client/produit
```
```
5-10 jours Phase 1 + base materiaux fournie
```
## 4. Roadmap de deploiement

```
Phase Contenu Duree Prerequis
```
```
Phase 1a US-001 a US-004 : Infrastructure +
Ingestion + Rapprochement
```
```
2-3 semaines Acces OneDrive +
exemples PDF
offres/commandes
```
```
Phase 1b US-005 + US-006 : Dashboard
transformation + Relances
```
```
2-3 semaines Phase 1a terminee +
validation templates
relance
```

```
Phase Contenu Duree Prerequis
```
```
Phase 2 US-007 + US-008 : Dashboard direction +
Analyse produits
```
```
3-5 semaines Phase 1 terminee +
Excel Gabrielle Petit + base
materiaux
```
## 5. Prerequis client (actions immediates)

```
# Action Responsable Delai
```
```
1 Donner acces au dossier OneDrive
offres/commandes
```
```
Alice Immediat
```
```
2 Fournir 10-15 exemples PDF (offres +
commandes associees) pour calibrage OCR
```
```
Alice 1 semaine
```
```
3 Valider le schema de base de donnees (tables,
champs)
```
```
Alice / Éric Martin 1 semaine
```
```
4 Definir les regles de relance (delais, contenu, ton) Alice / Éric Martin 2 semaines
```
```
5 Fournir templates emails relance FR + ES Alice 2 semaines
```
```
6 Envoyer tableau Excel KPIs (Gabrielle Petit) pour
dashboard direction
```
```
Gabrielle Petit 1 semaine
```
```
7 Envoyer lien dashboard Zite actuel Éric Martin Immediat
```
## Repo

- Chemin : `~/projects/thermopack-demo/`
- About.md, Roadmap.md, CLAUDE.md en place
- Kickoff : 2026-03-10

## 6. Prochaines etapes

- Validation backlog : Confirmer les priorites et le perimetre Phase 1 avec Alice/Éric Martin
- Acces : Recuperer les acces OneDrive et les exemples PDF
- Lancement dev : Demarrer US-001 (schema Supabase) des validation
- Proposition commerciale : Si besoin, generer la proposition via /prestation-ia
- Phase dev : Lancer le /dev-agent une fois le backlog valide pour construire les workflows N8N


