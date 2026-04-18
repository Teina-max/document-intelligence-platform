# ThermoPack Industries — Automatisation Pole Pieces

## Vue d'ensemble

ThermoPack Industries fabrique des machines de thermoformage. Leur pole pieces detachees gere ~800k EUR/mois d'offres avec un taux de transformation de 43%. L'objectif est d'automatiser le suivi offres/commandes pour atteindre 50%+ de transformation, soit ~240k EUR/an de CA supplementaire.

## Equipe client

- **Éric Martin** — DG, sponsor projet, veut un dashboard de pilotage
- **Alice** — Assistante commerciale (alice.durand@thermopack.example), utilisatrice principale, gere les offres/commandes manuellement sur cahier
- **Gabrielle Petit** — Comptable, fournit les KPIs comptables (Excel)
- **Interlocuteurs ** : l'équipe commerciale, 

## Probleme actuel

- Suivi offres/commandes sur cahier papier (Alice)
- Pas de visibilite temps reel sur le taux de transformation
- Relances manuelles, pas systematiques
- Pas de rapprochement automatique offre/commande
- Dashboard Zite alimente manuellement

## Solution

App web custom + pipeline OCR -> rapprochement -> dashboard -> relances auto

```
App Next.js (drag & drop PDF) -> n8n OCR (Claude Vision) -> Supabase DB -> Dashboard + Relances email
```

**URL prod** : https://thermopack-demo.vercel.app

## Statut

- **Phase** : Phase 1 terminee, US-006 en cours d'activation
- **Sprint actuel** : S5 (relances + security)
- **Bloqueur** : Credential Outlook OAuth2 (IT ThermoPack) pour activer les relances

## User Stories (Phase 1)

| US | Description | Effort | Statut |
|----|-------------|--------|--------|
| US-001 | Schema Supabase (Entreprises, Offres, Commandes) | 1-2j | **FAIT** (14/03) |
| US-002 | App Next.js (interface upload, dashboard) | 3-5j | **FAIT** (19/03) |
| US-003 | Ingestion OCR offres + commandes (n8n + Claude Vision) | 3-5j | **FAIT** (24/03) — 39/39 PDF, WF-001 operationnel |
| US-004 | Rapprochement offre/commande + classification | 3-5j | **FAIT** (24/03) — 10 rapprochements, 9 transformees, 1 partielle |
| US-005 | Dashboard taux de transformation | 5-7j | **FAIT** (25/03) — Filtres, KPIs, offres urgentes, top clients, FR/ES |
| US-006 | Relance auto offres non transformees | 3-5j | **PRET** (26/03) — Templates + workflows prets, en attente credential Outlook |

## User Stories (Phase 2)

| US | Description | Effort | Statut |
|----|-------------|--------|--------|
| US-007 | Dashboard KPI direction | 5-7j | **PARTIEL** (25/03) — Page /direction OK. Manque : Excel Gabrielle Petit |
| US-008 | Analyse comportement client/produit | 5-10j | **PARTIEL** (25/03) — Page /analyse OK. Manque : historique pour saisonnalite |

## App — Pages (8)

| Route | Description |
|-------|-------------|
| `/login` | Split screen branding ThermoPack Blue + form auth |
| `/dashboard` | 5 KPI cards, filtres (periode/pays/entreprise), offres urgentes, top 10 clients, FR/ES |
| `/direction` | KPIs mois/annuel, commandes directes, CA mensuel |
| `/analyse` | Top materiaux, clients recurrents, filtres |
| `/offres` | Table inline edit, delete, reclassify, PDF, expand designations |
| `/commandes` | Idem offres, avec offre liee et type |
| `/upload` | Dropzone PDF, upload parallele x2, resultats detailles OCR |
| `/admin/users` | Inviter, supprimer utilisateurs |

## App — Securite

- Admin role check sur toutes les API routes
- Proxy webhooks n8n (URLs cachees cote serveur)
- Rate limiting in-memory sur toutes les routes API
- Security headers (CSP, HSTS, X-Frame-Options, nosniff)
- Password policy (8 chars + majuscule + chiffre)
- Filename sanitization (anti path-traversal)
- Error hiding (messages generiques client, logs detailles serveur)
- 40 tests E2E Playwright

## App — Features

- Inline edit offres/commandes (EditableCell)
- Delete (admin only) + confirmation
- Reclassifier offre <-> commande (RPC SQL)
- CSV export sur toutes les pages data
- Toast notifications (sonner) sur toutes les actions
- Upload indicator flottant + upload parallele x2
- ISR 5 min sur toutes les pages data
- next/image Cloudinary + next/font Geist

## Relances — Templates email (US-006)

| Palier | Ton | CTA | Couleur |
|--------|-----|-----|---------|
| J-30 | Rappel courtois | Nous contacter (email) | Bleu |
| J-15 | Demande de suivi | Appeler / Repondre | Orange |
| J-7 | Echeance proche | Appeler maintenant | Rouge |
| J-1 | Derniere relance | Confirmer ma commande | Rouge fonce |

- 8 templates HTML (4 paliers x FR/ES) stockes dans table `email_templates` Supabase
- Variables dynamiques : {{reference_offre}}, {{montant_ht}}, {{date_expiration}}, etc.
- Logo Cloudinary dans header
- Bouton opt-out "Cette offre ne m'interesse plus" → webhook WF-003b
- Preview live : `workflows/templates/preview.html`

## Workflows n8n

| Fichier | Trigger | Description | Statut |
|---------|---------|-------------|--------|
| WF-001 Ingestion PDF (OCR) | Webhook POST /thermopack/ingest-pdf | OCR unifie offres+commandes via Claude Vision | **Actif** |
| WF-002 Rapprochement | CRON 7h + Webhook POST /thermopack/rapprochement | Lie commandes aux offres, classifie, MAJ statut | **Actif** |
| WF-003 Relance Offres | CRON L-V 9h | Fetch templates HTML depuis DB, injection variables, envoi Outlook, log | **Importe** — en attente credential |
| WF-003b Opt-out Relance | Webhook GET /thermopack/stop-relance | Marque offre opt-out, notifie Alice, page confirmation | **Importe** — en attente credential |
| WF-005 Health Check | CRON | Monitoring erreurs, notification Gmail | **Actif** |

### Credentials n8n

| Nom | Type | Usage | Statut |
|-----|------|-------|--------|
| Supabase ThermoPack | supabaseApi | Toutes les operations DB | **Configure** |
| Claude-API | httpHeaderAuth (x-api-key) | OCR Claude Vision (WF-001) | **Configure** |
| Outlook ThermoPack | microsoftOutlookOAuth2Api | Envoi emails relance (WF-003) | **En attente IT ThermoPack** |

## Migrations SQL

| # | Fichier | Description |
|---|---------|-------------|
| 001 | schema-initial.sql | Tables, enums, RLS, fonctions de base |
| 002 | seed-data.sql | Donnees de test |
| 003 | add-columns-and-tables.sql | Colonnes + tables complementaires |
| 004 | upsert-entreprises.sql | RPC upsert_entreprise |
| 005 | add-reference-offre.sql | Colonne reference_offre + backfill |
| 006 | dashboard-rpcs.sql | 4 RPCs dashboard (taux_transformation, offres_non_transformees, top_clients, stats_par_pays) |
| 007 | direction-analyse-rpcs.sql | RPCs kpis_direction, ca_mensuel, top_materiaux, recurrence_clients |
| 008 | fix-taux-conversion-directes.sql | Exclure directes du taux |
| 009 | fix-double-encoding.sql | Fix JSONB double-encoding |
| 010 | find-missing-pdfs.sql | Script diagnostic |
| 011 | trigger-fix-double-encoding.sql | Trigger auto-fix encoding |
| 012 | test-rpcs.sql | Tests RPCs |
| 013 | simplify-top-materiaux.sql | Simplification RPC |
| 014 | global-search.sql | Recherche globale |
| 015 | error-logs-webhook.sql | Logs erreurs |
| 016 | top-clients-exclude-non-transformees.sql | Top clients filtre |
| 017 | reclassifier-document.sql | RPC reclassifier offre <-> commande |
| 018 | email-templates.sql | Table email_templates + 8 rows HTML |
| 019 | relance-optout.sql | Colonnes relance_stoppee sur offres |
| 020 | enrich-entreprises.sql | 14 colonnes, pays_enum MA/TN/RE, upsert v2, RPC stats_par_region |
| 021 | smart-matching.sql | pg_trgm, noms_alternatifs, normalize/match RPCs, merge 16 doublons OCR |
| 022 | search-enhanced.sql | Recherche avancee full-text |
| 023 | excel-import-support.sql | Support import Excel |
| 024 | relance-mailto.sql | Deep-link mailto relance |
| 025 | ~~022-~~table-pieces.sql | Table pieces (referentiel 6984 articles SAP, noms FR normalises, variantes ES/DE) |
| 026 | ~~023-~~table-lignes.sql | Tables offre_lignes + commande_lignes (63322 lignes, FK pieces) |
| 027 | ~~024-~~top-pieces-entreprise.sql | RPC top_pieces_par_entreprise (top pieces commandees par client) |
| 031 | exclude-frais-top-materiaux.sql | Exclure FRAIS_PORT/EMBALLAGE du top pieces |
| 032 | fix-top-clients-sort.sql | Fix tri top_clients (CTE pour alias ORDER BY) |
| 033 | entreprises-sans-email-rpc.sql | RPC entreprises_sans_email |
| 034 | sap-columns.sql | Colonnes SAP (montant_sap, statut_sap, donneur_ordre, cree_par, source) |

## Prerequisites client

| # | Action | Responsable | Statut |
|---|--------|-------------|--------|
| ~~1~~ | ~~Acces OneDrive offres/commandes~~ | ~~Alice~~ | **Supprime** (upload direct dans l'app) |
| 2 | 10-15 PDF exemples (offres + commandes) | Alice | **RECU** (19/03) — 39 PDF |
| 3 | Valider schema BDD | Alice/Éric Martin | **FAIT** (19/03) |
| 4 | Regles de relance (delais, contenu, ton) | Alice/Éric Martin | **PROPOSE** (26/03) — J-30/J-15/J-7/J-1, a valider en visio |
| 5 | Templates emails relance FR + ES | Alice | **FAIT** (26/03) — 8 templates HTML prets |
| 6 | Tableau Excel KPIs (Gabrielle Petit) | Gabrielle Petit | En attente |
| 7 | Lien dashboard Zite actuel | Éric Martin | En attente |
| 8 | Credential Outlook OAuth2 | IT ThermoPack | En attente |

## Decisions

| Date | Decision |
|------|----------|
| 2026-03-10 | Kickoff valide. Phase 1 = US-001 a US-006 (~22 jours). |
| 2026-03-14 | Schema Supabase deploye (4 tables, 4 enums, RLS + policies, 4 SQL functions). |
| 2026-03-14 | Strategie OCR : Claude Vision en baseline. |
| 2026-03-19 | Visio client : interface Next.js validee, schema BDD valide, upload drag & drop. |
| 2026-03-19 | Stack dashboard : Next.js + React + Tailwind + shadcn/ui. |
| 2026-03-24 | WF-001 deploye et valide. 39/39 PDF ingeres (24 entreprises, 13 offres, 26 commandes). |
| 2026-03-24 | WF-002 deploye et valide. 10 rapprochements (9 transformees, 1 partielle a 72%). |
| 2026-03-25 | Dashboard US-005 enrichi : filtres, KPIs, offres urgentes, top clients, FR/ES. |
| 2026-03-25 | US-007/008 scaffoldes : pages /direction et /analyse avec RPCs. |
| 2026-03-26 | S5 security hardening : admin checks, proxy webhooks, rate limiting, CSP, headers, 40 E2E tests. |
| 2026-03-26 | CRUD inline edit + delete + reclassifier sur offres/commandes. |
| 2026-03-26 | Templates relance HTML crees (8 templates, table email_templates, bouton opt-out). WF-003 v2 + WF-003b importes dans n8n. En attente credential Outlook. |
| 2026-03-30 | Reception Liste client.xlsx (231 clients). Migration 020 + script import prepares. |
| 2026-03-30 | Migration 020 executee. 239 clients importes (239/239 OK). 7 OCR enrichies en ocr+excel, 232 nouvelles. |
| 2026-03-30 | Migration 021 : smart matching deploye. 16 doublons OCR/Excel fusionnes. Matching en cascade 9 niveaux (exact/alias/normalise/trgm). Auto-learn des variants OCR. Total : 239 entreprises (216 excel, 23 ocr+excel, 0 ocr). |
| 2026-04-08 | Migrations 022-024 : table pieces (6984 articles SAP), offre_lignes/commande_lignes (63322 lignes, 100% liees). 228 noms traduits ES→FR. JSONB designations mis a jour avec noms FR. |
| 2026-04-08 | Import montants CDE depuis Excel : 184/184 commandes matchees (9 nouveaux montants). |
| 2026-04-08 | Cloture 163 offres en_attente pre-2026 → expirees. |
| 2026-04-08 | Frontend : toggle top 10 clients recurrents (/analyse), recherche → fiche entreprise (/entreprises/[id]), section top pieces par client. |
| 2026-04-08 | Retours reunion Alice : top clients par CA (toggle Par CA/Par taux), liaison manuelle offre↔commande (dialog), enrichissement geo ~267 clients FR (code_postal→region), fix wording relance "derniere"→"relance", search API offres. |
| 2026-04-09 | UX Phase 2 : 5 retours Alice (migrations 031-033), cards alertes cliquables, modal sans email, endpoint PATCH entreprises. |
| 2026-04-09 | Review adversariale (3 agents) : 3 CRITICAL + 12 HIGH identifies. 6 fixes securite appliques (sort_by whitelist, reclassifier validation, batch delete, admin guard, CSP). |
| 2026-04-10 | Migration 034 : colonnes SAP (montant_sap, statut_sap, cree_par, donneur_ordre, source) sur offres + commandes. |
| 2026-04-10 | Import SAP complet : 5530 offres (28.65M EUR) + 2435 commandes (6.20M EUR). Backfill montant_ht. 5 nouvelles entreprises. |
| 2026-04-10 | Refacto expandable-row : fetch on-demand depuis offre_lignes/commande_lignes (au lieu de JSONB). Dedup migrations 022-024→035-037. |

## Prochaine session

1. **Relances avec vrais emails** — 212 clients avec email, alimenter WF-003 (en attente credential Outlook)
2. **Import montants historiques** — Demander a Alice un export CDE 2021-2025 pour completer les montant_ht (6271/6455 commandes sans montant)
4. **Page catalogue pieces** — Optionnel : page /pieces avec recherche, historique par piece

### Etat base de donnees
| Metrique | Valeur |
|----------|--------|
| Total entreprises | 409 |
| Total offres | 8144 |
| Total commandes | 6485 |
| Total pieces | 6984 |
| Offre lignes | 38765 |
| Commande lignes | 24557 |
| Pieces traduites ES→FR | 228 |
| Offres avec montant SAP | 5530 / 8144 (28.65M EUR) |
| Commandes avec montant SAP | 2435 / 6485 (6.20M EUR) |
| Offres avec donneur_ordre | 5530 |
| Commandes avec donneur_ordre | 2435 |

## Notes

- Potentiel business : 800k EUR/mois x 57% non transformees = 456k EUR d'opportunites
- Distinction France / Espagne par code postal du donneur d'ordre
- Bilingue FR/ES pour les relances
- Deploy auto via git push master -> Vercel (Root Directory: app)
