# Checklist Prerequisites — ThermoPack Industries

> Items a demander a l'équipe commerciale /  avant de lancer le Sprint 1.

## Budget et cadrage

- [ ] Confirmer le budget du projet (Phase 1)
- [ ] Confirmer la deadline souhaitee
- [ ] Quelle instance n8n ? (self-hosted client ou instance )
- [ ] Qui heberge Supabase ? (projet Teina ou projet client)

## Acces et credentials

- [ ] Acces au dossier OneDrive /Offres (Alice)
- [ ] Acces au dossier OneDrive /Commandes (Alice)
- [ ] Compte Microsoft 365 pour connecter n8n (ou app registration Azure AD)
- [ ] Acces Outlook pour les relances email (US-006)
- [ ] Lien vers le dashboard Zite actuel (Éric Martin)

## Donnees pour calibrage OCR

- [ ] 10-15 PDF exemples d'offres
- [ ] 10-15 PDF exemples de commandes (dont certaines liees aux offres fournies)
- [ ] Y a-t-il des formats de PDF tres differents ? (scans, exports ERP, manuels...)
- [ ] Les PDF sont en francais uniquement ou aussi en espagnol ?

## Validation metier

- [ ] Valider le schema BDD propose (tables Entreprises, Offres, Commandes) — cf. US-001 dans Backlog.md
- [ ] Comment distinguer France / Espagne ? (code postal du donneur d'ordre — confirmer la regle)
- [ ] Quelle est la duree de validite standard d'une offre ? (pour calculer les dates d'expiration)
- [ ] Regles de relance : quels delais avant expiration ? (propose : J-30, J-15, J-7, J-1)
- [ ] Ton et contenu des relances : formel ? commercial ? technique ?
- [ ] Templates emails relance FR + ES (Alice doit fournir)

## Dashboard

- [ ] Qui utilise le dashboard au quotidien ? (Éric Martin seul ? Alice aussi ?)
- [ ] Quels KPIs sont prioritaires ? (taux transformation, montants, top clients ?)
- [ ] Preference tech ? (outil no-code type Retool, ou interface custom)
- [ ] Tableau Excel KPIs de Gabrielle Petit (necessaire pour US-007 Phase 2, mais utile de l'avoir tot)

## Phase 2 (pas urgent, mais a mentionner)

- [ ] Base materiaux / catalogue pieces (necessaire pour US-008)
- [ ] Interet pour le dashboard KPI direction (US-007) — confirmer le scope Phase 2
