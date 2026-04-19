# ThermoPack Industries — Local vs Prod n8n Workflows

**Generated**: 2026-03-28
**Source**: Local workflows in `~/projects/thermopack-demo/workflows/` vs n8n-prod-cli API

## Summary Table

| Workflow | Local Nodes | Remote Nodes | Delta | Remote Active | Status |
|----------|-------------|--------------|-------|---------------|--------|
| WF-001 Ingestion PDF (OCR) | 14 | 44 | +30 | no | Mismatch — Remote has 30 extra nodes |
| WF-002 Rapprochement Offre-Commande | 10 | 32 | +22 | no | Mismatch — Remote has 22 extra nodes |
| WF-003 Relance Offres | 11 | — | — | — | **Missing from prod** |
| WF-003b Opt-out Relance | 6 | 12 | +6 | no | Mismatch — Remote has 6 extra nodes |
| WF-005 Health Check & Monitoring | 9 | 14 | +5 | no | Mismatch — Remote has 5 extra nodes |

## Analysis

### Key Finding

**All remote workflows have significantly MORE nodes than the local versions.**

This indicates that:
1. Local workflow files are outdated snapshots (possibly stubs or cleaned versions)
2. Remote (prod) workflows have been enhanced with additional logic, error handling, or integrations
3. Local files are NOT synced with current prod state

### Remote Workflow IDs (n8n)

- `9qirw85dYuAVAOkj` → WF-001
- `UAXmyEfujZyW9Eik` → WF-002
- `IB3xjoFMubo0bfgy` → WF-003 (Relance Offres Non Transformees)
- `t2yDP6p6STPCyuJi` → WF-003b
- `BcLFigSGflHzCSww` → WF-005

### Remote Status

**All workflows are inactive** (`active: no`)

## Issues

### 1. Missing from Prod
- **ThermoPack - WF-003 Relance Offres** (11 nodes locally)
  - Remote has different name: **"WF-003 Relance Offres Non Transformees"** (19 nodes)
  - May be a rename, or the local version is an earlier iteration

### 2. Missing from Local
- **ThermoPack - WF-003 Relance Offres Non Transformees** (19 nodes, remote only)
  - This exists in prod but not in `/workflows/` directory
  - Need to export from n8n to get latest version

### 3. Node Count Deltas
All workflows have been expanded in prod:
- **WF-001**: +30 nodes (14 → 44) — likely added error handling, logging, additional API calls
- **WF-002**: +22 nodes (10 → 32) — major expansion
- **WF-003b**: +6 nodes (6 → 12) — moderate additions
- **WF-005**: +5 nodes (9 → 14) — minor additions

## Recommendations

1. **Export current prod workflows** from n8n to update local versions:
   ```bash
   n8n-prod-cli workflows get 9qirw85dYuAVAOkj --json > "workflows/ThermoPack - WF-001 Ingestion PDF (OCR).json"
   # etc. for each ID
   ```

2. **Clarify WF-003 situation**: Determine if local "WF-003 Relance Offres" is obsolete or if "Relance Offres Non Transformees" is a rename

3. **Activate workflows in prod** (all are currently `inactive`) — confirm if this is intentional or a deployment issue

4. **Establish sync workflow**: After updates, implement a process to keep local and prod in sync (e.g., git-based versioning of n8n exports)
