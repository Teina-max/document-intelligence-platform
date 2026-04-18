# Schema BDD — ThermoPack Industries

## Diagramme

```mermaid
erDiagram
    ENTREPRISES {
        uuid id PK
        text nom
        text code_postal
        enum pays "FR | ES"
        text adresse
        text contact_nom
        text contact_email
        text contact_telephone
        timestamptz created_at
        timestamptz updated_at
    }

    OFFRES {
        uuid id PK
        text reference_offre UK
        uuid entreprise_id FK
        numeric montant_ht
        numeric montant_ttc
        date date_offre
        date date_expiration
        enum statut "en_attente | transformee | partiellement_transformee | expiree"
        text correspondant
        jsonb designations
        text fichier_source
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    COMMANDES {
        uuid id PK
        text reference_commande UK
        uuid offre_id FK "nullable = commande directe"
        uuid entreprise_id FK
        numeric montant_ht
        numeric montant_ttc
        date date_commande
        date date_expedition
        enum type "partielle | egale | superieure | directe"
        jsonb designations
        text fichier_source
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    OCR_LOGS {
        uuid id PK
        text fichier_source
        text type_document "offre | commande"
        enum statut "success | partial | failed"
        jsonb donnees_extraites
        text[] erreurs
        numeric score_confiance "0 a 1"
        uuid record_id "offre ou commande creee"
        integer duree_ms
        timestamptz created_at
    }

    ENTREPRISES ||--o{ OFFRES : "emet"
    ENTREPRISES ||--o{ COMMANDES : "passe"
    OFFRES ||--o{ COMMANDES : "transformee en"
```

## Roles et permissions (RLS)

| Role | Entreprises | Offres | Commandes | OCR Logs |
|------|-------------|--------|-----------|----------|
| **admin** (Éric Martin) | Lecture + Ecriture + Suppression | Lecture + Ecriture + Suppression | Lecture + Ecriture + Suppression | Lecture |
| **commercial** (Alice) | Lecture + Ecriture | Lecture + Ecriture | Lecture + Ecriture | Lecture |
| **comptable** (Gabrielle Petit) | Lecture | Lecture | Lecture | — |
| **service_role** (n8n / Edge Functions) | Acces complet | Acces complet | Acces complet | Acces complet |

## Fonctions SQL

| Fonction | Role | Description |
|----------|------|-------------|
| `rapprocher_commande(id)` | Rapprochement | Classe la commande (partielle/egale/superieure/directe) et met a jour le statut de l'offre |
| `taux_transformation(date_debut?, date_fin?, pays?)` | KPI | Calcule le taux de transformation avec filtres optionnels |
| `offres_a_relancer(jours?)` | Relances | Liste les offres non transformees proches de l'expiration |
| `expirer_offres()` | Maintenance | Passe en "expiree" les offres depassees (cron) |

## Statuts offre

```
en_attente → transformee (commande recue = montant offre)
en_attente → partiellement_transformee (commande recue < montant offre)
en_attente → expiree (date_expiration depassee)
```

## Types de commande

| Type | Condition |
|------|-----------|
| **directe** | Pas de reference offre (offre_id = NULL) |
| **partielle** | Montant commande < montant offre |
| **egale** | Montant commande = montant offre |
| **superieure** | Montant commande > montant offre (upsell) |
