# ThermoPack — Document Intelligence Platform

**OCR → rapprochement automatique → dashboard → relances email** pour
le suivi offres/commandes d'une ETI en plasturgie / thermoformage.

> Démonstration publique, anonymisée, d'une mission freelance réelle
> livrée en 6 semaines. Les noms, chiffres et données client sont
> fictifs. Voir [`CASE_STUDY.md`](./CASE_STUDY.md) pour le contexte
> métier et les résultats.

---

## Démo

- **App live** : *(à déployer sur Vercel après provisionnement de
  l'instance Supabase de démo)*
- **Vidéo** : *(à tourner sur le dataset `demo-pdfs/`)*
- **Jeu de test** : 18 PDF fictifs (6 offres + 12 commandes) dans
  [`demo-pdfs/`](./demo-pdfs/) + un `manifest.json` avec les valeurs
  d'extraction attendues.

---

## Ce que fait l'app

- **Ingestion OCR** : l'utilisateur dépose un PDF (offre ou commande) →
  Claude Vision extrait les champs → Supabase persiste un enregistrement
  normalisé (entreprise, montants, lignes, références croisées).
- **Rapprochement automatique** : chaque commande est liée à son offre
  d'origine (si `N° de l'offre` présent), classée en
  `partielle / égale / supérieure / directe`, et met à jour le statut
  de l'offre.
- **Dashboard temps réel** : taux de transformation, offres urgentes
  (expiration ≤ 30 j), top clients, répartition géographique FR/ES, CA
  mensuel, analyse des pièces les plus commandées.
- **Relances automatiques** : séquence J‑30 / J‑15 / J‑7 / J‑1 avant
  expiration, templates HTML bilingues (FR/ES), opt‑out par lien dans
  l'email.

## Architecture

```
┌─────────────┐   upload    ┌──────────────┐   Vision     ┌──────────────┐
│  Next.js 16 │ ──────────▶ │   n8n WF-001 │ ───────────▶ │  Claude API  │
│   (app/)    │             │   (OCR)      │              │ (Anthropic)  │
└──────┬──────┘             └──────┬───────┘              └──────────────┘
       │                           │  extracted JSON
       │                           ▼
       │                    ┌──────────────┐
       │      RPC / REST    │   Supabase   │
       └──────────────────▶ │  Postgres +  │
                            │   RLS + SB   │
                            └──────┬───────┘
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
           ┌────────────┐  ┌──────────────┐  ┌──────────────┐
           │  WF-002    │  │    WF-003    │  │    WF-005    │
           │Rapprochmt  │  │   Relances   │  │ Health check │
           │ (cron/hook)│  │ J-30/15/7/1  │  │    (cron)    │
           └────────────┘  └──────┬───────┘  └──────────────┘
                                  │
                                  ▼
                           ┌──────────────┐
                           │   Outlook    │
                           │  (SMTP API)  │
                           └──────────────┘
```

## Stack

| Layer       | Outil                                              |
|-------------|----------------------------------------------------|
| Frontend    | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui |
| Backend     | Supabase (Postgres, Auth, RLS, Edge Functions)     |
| Automation  | n8n (self-hosted)                                  |
| AI / OCR    | Anthropic Claude Vision                            |
| Email       | Microsoft Outlook OAuth2 (production)              |
| Deploy      | Vercel                                             |

## Features notables

- **Schema normalisé** : 4 tables principales (`entreprises`, `offres`,
  `commandes`, `pieces`) + 2 tables lignes (`offre_lignes`,
  `commande_lignes`), 37 migrations idempotentes dans `scripts/`.
- **Smart matching** clients : cascade à 9 niveaux (exact → alias →
  normalisé → trigram pg_trgm), auto‑apprentissage des variantes OCR.
- **Sécurité** : middleware Next, RLS sur toutes les tables, admin check
  sur les API routes, rate‑limit en mémoire, CSP + security headers,
  password policy, filename sanitization.
- **Observabilité** : workflow WF‑005 (health check) + table
  `error_logs` alimentée par webhook.
- **i18n** : UI FR/ES, templates de relance FR/ES.
- **Tests E2E** : Playwright — auth, navigation, API CRUD, hardening,
  business logic.

## Dataset de démo

| Fichier                    | Contenu                                      |
|----------------------------|----------------------------------------------|
| `demo-pdfs/offres/`        | 6 offres fictives (réf. 504xxxxx), FR + ES   |
| `demo-pdfs/commandes/`     | 12 commandes (704xxxxx), 8 liées + 4 directes |
| `demo-pdfs/manifest.json`  | Valeurs attendues (OCR + totaux)             |
| `scripts/fixtures/fake-clients.json` | 20 entreprises plasturgie fictives  |
| `scripts/fixtures/fake-pieces.json`  | 40 pièces SAP fictives              |

Les PDF démo couvrent : remises cascadées (‑20 % puis ‑11 %), commandes
partielles, supérieures, directes, bilingue FR/ES, et la totalité du
flux OCR → rapprochement → dashboard.

## Getting started

```bash
# 1. Clone
git clone <this-repo>.git thermopack-demo && cd thermopack-demo

# 2. Install
cd app && bun install && cd ..

# 3. Provision a dedicated Supabase project
#    (do NOT reuse any existing prod project)
#    Then copy the ref into .env:
cp app/.env.example app/.env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, N8N_*_URL

# 4. Apply migrations
#    supabase db push --include-all  (or use supabase SQL editor)

# 5. Generate demo PDFs (optional — already in demo-pdfs/)
bun scripts/generate-demo-pdfs.ts

# 6. Start the dev server
cd app && bun run dev
```

## Structure

```
app/             Next.js 16 application (frontend + API routes)
workflows/       n8n workflows (WF-001 to WF-005) + templates + prompts
scripts/         37 SQL migrations + fixtures + PDF generator
supabase/        Supabase Edge Functions
demo-pdfs/       Demo dataset (committed for reproducibility)
.claude/         Project rules & conventions for Claude Code collaborators
```

## Contexte portfolio

Ce dépôt est une version anonymisée d'une mission freelance réelle
livrée début 2026 pour une ETI française du secteur plasturgie. Le
workflow, l'architecture et les choix techniques sont identiques à la
version de production ; seuls les noms, chiffres et données client ont
été remplacés par des fictions. Résultats business, décisions produit
et leçons apprises dans [`CASE_STUDY.md`](./CASE_STUDY.md).

Pour un contact freelance : teinateinauri@gmail.com
