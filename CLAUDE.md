# ThermoPack Industries — Automatisation Pole Pieces + Dashboard

## Contexte

- **Client** : ThermoPack Industries (machines thermoformage, pole pieces detachees)
- **Interlocuteur(s)** : l'équipe commerciale /  () — jamais directement avec Alice/Éric Martin
- **Utilisateurs finaux** : Alice (assistante commerciale), Éric Martin (DG), Gabrielle Petit (comptable)
- **Budget** : A confirmer
- **Deadline** : A confirmer
- **Statut** : Setup

## Scope

Automatiser le suivi offres/commandes du pole pieces : ingestion OCR des PDF depuis OneDrive, rapprochement automatique offre/commande, dashboard taux de transformation, et relances automatiques des offres non transformees. Objectif business : passer de 43% a 50%+ de taux de transformation (~240k EUR/an).

## Stack

| Layer | Outil |
|-------|-------|
| Automation | n8n (self-hosted) |
| Database | Supabase (PostgreSQL) |
| AI / OCR | Claude API (Anthropic) |
| Cloud Storage | Microsoft 365 (OneDrive) |
| Email | Microsoft 365 (Outlook) |
| Dashboard | A trancher (Retool / Lovable / Metabase) |

## Structure du projet

- `About.md` — Source unique de verite (statut, decisions, blocages)
- `docs/` — Documentation technique, schemas, specs
- `scripts/` — Scripts utilitaires (setup, migration, patches)
- `workflows/` — Specs et exports n8n
- `.env` — Secrets et credentials (gitignore)

## Workflows n8n

| ID | Nom | Trigger | Statut |
|----|-----|---------|--------|
| WF-001 | Ingestion offres | OneDrive /Offres | Backlog |
| WF-002 | Ingestion commandes | OneDrive /Commandes | Backlog |
| WF-003 | Rapprochement offre/commande | Post-ingestion ou cron | Backlog |
| WF-004 | Relance offres non transformees | Cron (J-30/J-15/J-7/J-1) | Backlog |

## Sprints

| Sprint | Objectif | Estimation |
|--------|----------|------------|
| S1 | Fondations : schema Supabase + env n8n + OneDrive + calibrage OCR | 3 jours |
| S2 | Ingestion OCR offres + commandes (WF-001, WF-002) | 5 jours |
| S3 | Rapprochement offre/commande (WF-003) | 4 jours |
| S4 | Dashboard taux de transformation | 5 jours |
| S5 | Relances auto + handoff (WF-004) | 5 jours |

## Comment travailler ici

- Toujours lire `About.md` avant de commencer une session
- Un workflow = un fichier spec (.md) + un export (.json) dans `workflows/`
- Mettre a jour `About.md` a chaque decision ou changement de statut
- Documenter les choix techniques dans `docs/`
- Ne pas deviner quand le contexte manque — demander
- `.env` pour les secrets, jamais en dur dans le code
- Commits courts et descriptifs en anglais

## Conventions

- TypeScript strict, ESM modules
- camelCase pour variables/fonctions, PascalCase pour types/classes
- Pas de sur-ingenierie — resoudre le probleme actuel
- Messages d'erreur clairs, fail fast, pas de fallbacks silencieux

## Avancement

| Date | Action |
|------|--------|
| 2026-03-10 | Kickoff — repo cree, structure initiale |
