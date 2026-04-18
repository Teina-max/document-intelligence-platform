# Fix — ThermoPack Industries Workflows

> Analyse du 2026-03-28 — Voir `compare-local-vs-prod.md` pour le detail.

## Statut : ❌ Fix majeur — local obsolete

5/5 existent des deux cotes MAIS les versions remote ont beaucoup plus de nodes. Le local est un snapshot obsolete.

## Ecarts

| Workflow | Local | Remote | Delta |
|----------|-------|--------|-------|
| WF-001 Ingestion PDF (OCR) | 14 | 44 | **+30** |
| WF-002 Rapprochement Offre-Commande | 10 | 32 | **+22** |
| WF-003 Relance Offres | 11 | 19 | **+8** (renomme "Non Transformees") |
| WF-003b Opt-out Relance | 6 | 12 | **+6** |
| WF-005 Health Check | 9 | 14 | **+5** |

## TODO

### Resync remote → local (PRIORITE 1)

Les versions prod sont les bonnes. Exporter et ecraser les fichiers locaux :

- [ ] Exporter WF-001 (`9qirw85dYuAVAOkj`) → ecraser le JSON local
- [ ] Exporter WF-002 (`UAXmyEfujZyW9Eik`) → ecraser le JSON local
- [ ] Exporter WF-003 (`IB3xjoFMubo0bfgy`) → ecraser le JSON local (renommer fichier si besoin)
- [ ] Exporter WF-003b (`t2yDP6p6STPCyuJi`) → ecraser le JSON local
- [ ] Exporter WF-005 (`BcLFigSGflHzCSww`) → ecraser le JSON local

Commande pour chaque :
```bash
n8n-prod-cli workflows get <ID> --json > "workflows/<filename>.json"
```

### Credentials

- [ ] Reconfigurer `Supabase-ThermoPack` (supabaseApi) dans WF-001, WF-002
- [ ] Reconfigurer `Claude-API` (httpHeaderAuth) dans WF-001 (OCR)
- [ ] Verifier les autres credentials (email SMTP, etc.)

### Activation

- [ ] Tous les workflows sont inactifs — reactiver WF-001 et WF-002 en priorite (etaient actifs avant migration)

### Clarification

- [ ] Confirmer que WF-003 "Relance Offres Non Transformees" (remote) remplace bien WF-003 "Relance Offres" (local)
