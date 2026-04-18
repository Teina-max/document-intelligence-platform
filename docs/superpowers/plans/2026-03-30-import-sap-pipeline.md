# Import SAP Historique + Pipeline Excel Récurrent

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer 5 ans de données SAP (7,888 offres + ~6,500 commandes) dans Supabase, exécuter un rapprochement algorithmique offre→commande basé sur client+article+date, et créer un pipeline Excel récurrent pour les imports mensuels.

**Architecture:** Migration SQL pour le support SAP → script bun one-shot pour l'import historique → RPC PostgreSQL pour le rapprochement algorithmique → API endpoint Next.js + composant UI pour les imports récurrents.

**Tech Stack:** PostgreSQL (Supabase), TypeScript (bun), exceljs, Next.js API routes, React/shadcn/ui

---

## Données sources

| Fichier | Contenu | Volume | Clés disponibles |
|---------|---------|--------|------------------|
| `Commandes clients/EXPORT_20260330_100131.XLSX` | Lignes article commandes 2021→jan 2026 (ancien canal) | 32,031 lignes → 6,298 cde | doc_vente(704xxx), article, nom_client, qty |
| `Export liste commande 2026/EXPORT LISTE CDE 2026.XLSX` | Résumé commandes jan→mars 2026 (nouveau canal) | 157 cde | doc_commercial(704xxx), donneur_ordre(n° client), valeur_nette €, statut livraison |
| `Export liste commande 2026/EXPORT cde en 03.XLSX` | Résumé 27 cde jan 2026 (ancien canal) | 27 cde | idem LISTE CDE — recoupe avec Commandes clients |
| `Export offre 2026/EXPORT OFFRES 2021 à 2026.XLSX` | Lignes article offres 2021→jan 2026 (ancien canal) | 65,417 lignes → ~7,888 offres | doc_vente(504xxx), article, nom_client, qty |
| `Export offre 2026/EXPORT OFFRES 2026.XLSX` | Lignes article offres 2026 (nouveau canal) | 2,588 lignes → ~220 offres | idem |

### Contraintes clés

- **Deux canaux SAP** pour 2026 : changement distribution Allemagne en janvier → deux exports à fusionner
- **Doublons qty** : artefact SAP — lignes dupliquées avec qty=0 et qty>0 pour le même poste → prendre `MAX(qty)` par position
- **Pas de montant_ht** dans les fichiers détaillés (article-level)
- **Pas de lien explicite** offre→commande : le rapprochement est 100% algorithmique
- **94.8%** des articles commandés ont un match dans les offres du même client
- **281/284** clients commandes (99%) existent aussi dans les offres
- Séries de documents : offres = `504xxxxx`, commandes = `704xxxxx` — aucun overlap avec les refs OCR existantes (`OFF-xxx`, `CMD-xxx`)

---

## File Structure

| Action | Path | Responsabilité |
|--------|------|----------------|
| Create | `scripts/023-excel-import-support.sql` | Migration : colonnes + RPC rapprochement |
| Create | `app/src/lib/sap-parser.ts` | Module partagé : parsing XLSX, agrégation, mapping clients, batch upsert |
| Create | `scripts/import-sap-historique.ts` | Script one-shot : orchestre l'import historique via sap-parser |
| Create | `app/src/app/api/import-excel/route.ts` | API endpoint pour imports récurrents (utilise sap-parser) |
| Create | `app/src/components/excel-dropzone.tsx` | Composant upload XLSX |
| Modify | `app/src/app/(app)/upload/page.tsx` | Ajouter onglet Excel |
| Modify | `app/src/types/database.ts` | Nouveaux champs + types |
| Modify | `app/src/lib/i18n.ts` | Traductions upload Excel |
| Modify | `app/package.json` | Ajouter dépendance exceljs |

---

### Task 1: Migration 023 — Schema SAP import

**Files:**
- Create: `scripts/023-excel-import-support.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 023-excel-import-support.sql
-- Support for SAP Excel import + rapprochement algorithmique

-- ============================================================
-- 1. New columns
-- ============================================================

-- Track import source on offres
ALTER TABLE offres ADD COLUMN IF NOT EXISTS source_import TEXT NOT NULL DEFAULT 'ocr';
COMMENT ON COLUMN offres.source_import IS 'ocr | sap_export | manual';

-- Track import source + delivery status on commandes
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS source_import TEXT NOT NULL DEFAULT 'ocr';
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS statut_livraison TEXT;
COMMENT ON COLUMN commandes.source_import IS 'ocr | sap_export | manual';
COMMENT ON COLUMN commandes.statut_livraison IS 'liquide | non_livre | partiellement_livre (from SAP)';

-- SAP creator (MARAVAL, DUBOIS, etc.)
ALTER TABLE offres ADD COLUMN IF NOT EXISTS sap_created_by TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS sap_created_by TEXT;

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_offres_source_import ON offres(source_import);
CREATE INDEX IF NOT EXISTS idx_commandes_source_import ON commandes(source_import);
CREATE INDEX IF NOT EXISTS idx_commandes_statut_livraison ON commandes(statut_livraison)
  WHERE statut_livraison IS NOT NULL;

-- ============================================================
-- 3. Rapprochement algorithmique — preview function (read-only)
-- ============================================================

CREATE OR REPLACE FUNCTION rapprochement_algorithmique(
  p_window_days INTEGER DEFAULT 180,
  p_min_score NUMERIC DEFAULT 0.3
)
RETURNS TABLE(
  commande_id     UUID,
  commande_ref    TEXT,
  matched_offre_id UUID,
  offre_ref       TEXT,
  entreprise_nom  TEXT,
  nb_articles_match INTEGER,
  nb_articles_cde   INTEGER,
  score           NUMERIC,
  jours_ecart     INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  -- Extract unique articles per unlinked SAP commande
  cde_arts AS (
    SELECT DISTINCT c.id AS cde_id, c.reference_commande AS cde_ref,
           c.entreprise_id, c.date_commande,
           d->>'reference_materiel' AS art
    FROM commandes c
    CROSS JOIN LATERAL jsonb_array_elements(c.designations) d
    WHERE c.offre_id IS NULL
      AND c.source_import = 'sap_export'
      AND d->>'reference_materiel' IS NOT NULL
      AND d->>'reference_materiel' != ''
  ),
  cde_counts AS (
    SELECT cde_id, COUNT(*)::integer AS n FROM cde_arts GROUP BY cde_id
  ),
  -- Extract unique articles per SAP offre
  off_arts AS (
    SELECT DISTINCT o.id AS off_id, o.reference_offre AS off_ref,
           o.entreprise_id, o.date_offre,
           d->>'reference_materiel' AS art
    FROM offres o
    CROSS JOIN LATERAL jsonb_array_elements(o.designations) d
    WHERE o.source_import = 'sap_export'
      AND d->>'reference_materiel' IS NOT NULL
      AND d->>'reference_materiel' != ''
  ),
  -- Count matching articles: same client + same article + offre before commande within window
  matches AS (
    SELECT ca.cde_id, ca.cde_ref, ca.date_commande,
           oa.off_id, oa.off_ref, oa.date_offre,
           COUNT(*)::integer AS nb_match
    FROM cde_arts ca
    JOIN off_arts oa
      ON ca.entreprise_id = oa.entreprise_id
      AND ca.art = oa.art
      AND oa.date_offre <= ca.date_commande
      AND oa.date_offre >= ca.date_commande - make_interval(days => p_window_days)
    GROUP BY ca.cde_id, ca.cde_ref, ca.date_commande,
             oa.off_id, oa.off_ref, oa.date_offre
  ),
  -- Score and pick best offre per commande
  ranked AS (
    SELECT m.cde_id, m.cde_ref, m.off_id, m.off_ref,
           m.nb_match, cc.n AS nb_arts,
           ROUND(m.nb_match::numeric / GREATEST(cc.n, 1), 3) AS match_score,
           (m.date_commande - m.date_offre)::integer AS days_diff,
           ROW_NUMBER() OVER (
             PARTITION BY m.cde_id
             ORDER BY (m.nb_match::numeric / GREATEST(cc.n, 1)) DESC,
                      (m.date_commande - m.date_offre) ASC
           ) AS rn
    FROM matches m
    JOIN cde_counts cc ON cc.cde_id = m.cde_id
  )
  SELECT r.cde_id, r.cde_ref, r.off_id, r.off_ref,
         e.nom, r.nb_match, r.nb_arts, r.match_score, r.days_diff
  FROM ranked r
  JOIN commandes c ON c.id = r.cde_id
  JOIN entreprises e ON e.id = c.entreprise_id
  WHERE r.rn = 1 AND r.match_score >= p_min_score
  ORDER BY r.match_score DESC;
$$;

-- ============================================================
-- 4. Appliquer rapprochement — mutating function
-- ============================================================

CREATE OR REPLACE FUNCTION appliquer_rapprochement(
  p_window_days INTEGER DEFAULT 180,
  p_min_score NUMERIC DEFAULT 0.3
)
RETURNS TABLE(nb_matched INTEGER, nb_offres_transformees INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_matched INTEGER;
  v_transformed INTEGER;
BEGIN
  -- Link commandes to best matching offres
  UPDATE commandes c
  SET offre_id = r.matched_offre_id,
      type = 'egale'
  FROM rapprochement_algorithmique(p_window_days, p_min_score) r
  WHERE c.id = r.commande_id;
  GET DIAGNOSTICS v_matched = ROW_COUNT;

  -- Mark remaining unlinked SAP commandes as directe
  UPDATE commandes
  SET type = 'directe'
  WHERE offre_id IS NULL AND source_import = 'sap_export' AND type != 'directe';

  -- Update offre statuts: linked → transformee
  UPDATE offres o
  SET statut = 'transformee'
  WHERE o.source_import = 'sap_export'
    AND o.statut = 'en_attente'
    AND EXISTS (SELECT 1 FROM commandes c WHERE c.offre_id = o.id);
  GET DIAGNOSTICS v_transformed = ROW_COUNT;

  -- Expire old unmatched SAP offres (>6 months old) to avoid dashboard pollution
  UPDATE offres
  SET statut = 'expiree'
  WHERE source_import = 'sap_export'
    AND statut = 'en_attente'
    AND date_offre < NOW() - INTERVAL '6 months';

  RETURN QUERY SELECT v_matched, v_transformed;
END;
$$;

-- ============================================================
-- 5. Grant access
-- ============================================================

GRANT EXECUTE ON FUNCTION rapprochement_algorithmique TO authenticated;
GRANT EXECUTE ON FUNCTION appliquer_rapprochement TO authenticated;
```

- [ ] **Step 2: Run migration on Supabase**

```bash
# Via Supabase SQL Editor — paste the full migration
# Or via supabase CLI:
supabase db push --db-url $DATABASE_URL < scripts/023-excel-import-support.sql
```

- [ ] **Step 3: Verify columns and functions exist**

```sql
-- Quick checks
SELECT column_name FROM information_schema.columns
WHERE table_name = 'offres' AND column_name IN ('source_import', 'sap_created_by');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'commandes' AND column_name IN ('source_import', 'statut_livraison', 'sap_created_by');

SELECT proname FROM pg_proc WHERE proname IN ('rapprochement_algorithmique', 'appliquer_rapprochement');
```

- [ ] **Step 4: Commit**

```bash
git add scripts/023-excel-import-support.sql
git commit -m "add SAP import schema: source_import, statut_livraison, rapprochement algo RPCs"
```

---

### Task 2: Install dependencies + shared module + import script skeleton

**Files:**
- Modify: `app/package.json` (add exceljs)
- Create: `app/src/lib/sap-parser.ts` (shared parsing module — complete code in Task 7, Step 1)
- Create: `scripts/import-sap-historique.ts`

- [ ] **Step 1: Install exceljs**

```bash
cd app && bun add exceljs
```

- [ ] **Step 1b: Create the shared parsing module `app/src/lib/sap-parser.ts`**

Write the complete shared module (full code is in Task 7, Step 1 — "First, create the shared parsing module"). This module contains: types, header validation, XLSX parsers, aggregation, client mapping, and batch upsert.

- [ ] **Step 2: Create import script with Supabase connection**

```typescript
// scripts/import-sap-historique.ts
// Run: cd app && bun run ../scripts/import-sap-historique.ts
// Uses shared parsing module from app/src/lib/sap-parser.ts

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import {
  parseDetailWorksheet,
  parseSummaryWorksheet,
  aggregateByDocument,
  mapClientNames,
  batchUpsert,
  toISODate,
  mapStatutLivraison,
} from "./src/lib/sap-parser";

// ── Config ─────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DOCS_DIR = "../docs/nouveaux docs";

const FILES = {
  offresHistorique: `${DOCS_DIR}/Export offre 2026/EXPORT OFFRES 2021 à 2026.XLSX`,
  offres2026: `${DOCS_DIR}/Export offre 2026/EXPORT OFFRES 2026.XLSX`,
  commandesDetail: `${DOCS_DIR}/Commandes clients/EXPORT_20260330_100131.XLSX`,
  commandesSummaryOld: `${DOCS_DIR}/Export liste commande 2026/EXPORT cde en 03.XLSX`,
  commandesSummaryNew: `${DOCS_DIR}/Export liste commande 2026/EXPORT LISTE CDE 2026.XLSX`,
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper to load worksheet from file path
async function loadWorksheet(filePath: string): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb.getWorksheet(1)!;
}

// Continue in next steps...
```

- [ ] **Step 3: Verify script runs**

```bash
cd app && bun run ../scripts/import-sap-historique.ts --dry-run
```

Expected: connects to Supabase, prints "Connected" or similar diagnostic.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/bun.lockb scripts/import-sap-historique.ts
git commit -m "add exceljs + SAP import script skeleton"
```

---

### Task 3: Import script — XLSX parsing + client mapping

**Files:**
- Modify: `scripts/import-sap-historique.ts`

- [ ] **Step 1: All parsing, aggregation, and client mapping logic is in `app/src/lib/sap-parser.ts`** (created in Task 2, Step 2 above — see the shared module).

The one-shot script imports from it. No code duplication.

- [ ] **Step 2: Write the main() function with dry-run**

Add to `scripts/import-sap-historique.ts`:

```typescript
async function main() {
  console.log("=== SAP Historical Import ===\n");
  const isDryRun = process.argv.includes("--dry-run");

  // 1. Parse all XLSX files
  console.log("1. Parsing XLSX files...");
  const wsOffres1 = await loadWorksheet(FILES.offresHistorique);
  const wsOffres2 = await loadWorksheet(FILES.offres2026);
  const wsCde = await loadWorksheet(FILES.commandesDetail);
  const wsSummaryOld = await loadWorksheet(FILES.commandesSummaryOld);
  const wsSummaryNew = await loadWorksheet(FILES.commandesSummaryNew);

  const offreLines = [
    ...parseDetailWorksheet(wsOffres1, "offre"),
    ...parseDetailWorksheet(wsOffres2, "offre"),
  ];
  const cdeLines = parseDetailWorksheet(wsCde, "commande");
  const cdeSummaryOld = parseSummaryWorksheet(wsSummaryOld);
  const cdeSummaryNew = parseSummaryWorksheet(wsSummaryNew);

  // 2. Aggregate
  console.log("\n2. Aggregating documents...");
  const offres = aggregateByDocument(offreLines);
  const commandes = aggregateByDocument(cdeLines);
  console.log(`  Offres: ${offres.length} documents`);
  console.log(`  Commandes (detail): ${commandes.length} documents`);
  console.log(`  Commandes (summary old): ${cdeSummaryOld.length}`);
  console.log(`  Commandes (summary new): ${cdeSummaryNew.length}`);

  // 3. Unique clients
  const allClientNames = [...new Set([
    ...offres.map((o) => o.clientName),
    ...commandes.map((c) => c.clientName),
  ])].filter(Boolean);
  const summaryClientNumbers = [...new Set(cdeSummaryNew.map((s) => s.donneurOrdre))].filter(Boolean);
  console.log(`\n  Unique client names: ${allClientNames.length}`);
  console.log(`  Unique client numbers (summary): ${summaryClientNumbers.length}`);

  if (isDryRun) {
    console.log("\n=== DRY RUN — no data inserted ===");
    return;
  }

  // Continue with import (steps in Task 4)...
}

main().catch(console.error);
```

- [ ] **Step 3: Test dry-run**

Run: `cd app && bun run ../scripts/import-sap-historique.ts --dry-run`

Expected:
```
=== SAP Historical Import ===
1. Parsing XLSX files...
2. Aggregating documents...
  Offres: ~8108 documents
  Commandes (detail): ~6298 documents
  ...
=== DRY RUN — no data inserted ===
```

- [ ] **Step 5: Commit**

```bash
git add scripts/import-sap-historique.ts
git commit -m "add SAP XLSX parsing and client mapping logic"
```

---

### Task 4: Import script — Insert offres + commandes

**Files:**
- Modify: `scripts/import-sap-historique.ts`

- [ ] **Step 1: Write batch insert helper**

```typescript
// ── Batch Insert ───────────────────────────────────────────

async function batchUpsert<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  table: string,
  rows: T[],
  conflictColumn: string
): Promise<ImportStats> {
  const stats: ImportStats = { parsed: rows.length, inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await sb
      .from(table)
      .upsert(batch, { onConflict: conflictColumn, ignoreDuplicates: true })
      .select("id");

    if (error) {
      stats.errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
    } else {
      stats.inserted += data?.length ?? 0;
    }

    // Progress
    if ((i / BATCH_SIZE) % 5 === 0) {
      process.stdout.write(`\r  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
  }
  stats.skipped = stats.parsed - stats.inserted;
  console.log(`\r  Done: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors.length} errors`);
  return stats;
}
```

- [ ] **Step 2: Write offre import logic**

Add to `main()` after dry-run check:

```typescript
  // 4. Map clients
  console.log("\n3. Mapping clients to entreprises...");
  const clientNameMap = await mapClientNames(allClientNames, supabase);
  const clientNumberMap = await mapClientNumbers(summaryClientNumbers, supabase);

  // 5. Import offres
  console.log("\n4. Importing offres...");
  const offreRows = offres
    .filter((o) => clientNameMap.has(o.clientName))
    .map((o) => ({
      reference_offre: o.reference,
      entreprise_id: clientNameMap.get(o.clientName)!,
      date_offre: o.date,
      statut: "en_attente" as const,
      designations: JSON.stringify(o.designations),
      source_import: "sap_export",
      sap_created_by: o.createdBy || null,
      correspondant: o.createdBy || null,
    }));

  const offreStats = await batchUpsert(supabase, "offres", offreRows, "reference_offre");
  console.log(`  Offres: ${offreStats.inserted} imported`);
```

- [ ] **Step 3: Write commande import logic (detail files)**

```typescript
  // 6. Import commandes from detail file
  console.log("\n5. Importing commandes (detail)...");
  const cdeRows = commandes
    .filter((c) => clientNameMap.has(c.clientName))
    .map((c) => ({
      reference_commande: c.reference,
      entreprise_id: clientNameMap.get(c.clientName)!,
      date_commande: c.date,
      type: "directe" as const, // will be updated by rapprochement
      designations: JSON.stringify(c.designations),
      source_import: "sap_export",
      sap_created_by: c.createdBy || null,
    }));

  const cdeStats = await batchUpsert(supabase, "commandes", cdeRows, "reference_commande");
  console.log(`  Commandes (detail): ${cdeStats.inserted} imported`);
```

- [ ] **Step 4: Enrich commandes with summary data (montant + statut livraison)**

```typescript
  // 7. Enrich commandes with summary data
  console.log("\n6. Enriching commandes with summary data...");
  const allSummaries = [...cdeSummaryOld, ...cdeSummaryNew];
  let enriched = 0;

  for (const summary of allSummaries) {
    const updates: Record<string, unknown> = {};
    if (summary.valeurNette > 0) updates.montant_ht = summary.valeurNette;
    if (summary.statut) updates.statut_livraison = mapStatutLivraison(summary.statut);
    if (summary.numCommandeAchat) updates.numero_commande_client = summary.numCommandeAchat;
    if (summary.creePar) updates.sap_created_by = summary.creePar;

    if (Object.keys(updates).length === 0) continue;

    const { error } = await supabase
      .from("commandes")
      .update(updates)
      .eq("reference_commande", summary.docCommercial);

    if (!error) enriched++;
  }
  console.log(`  Enriched: ${enriched}/${allSummaries.length} commandes`);
```

- [ ] **Step 5: Import summary-only commandes (EXPORT LISTE CDE without detail)**

```typescript
  // 8. Import commandes from EXPORT LISTE CDE that don't exist in detail
  console.log("\n7. Importing summary-only commandes (new SAP channel)...");
  const existingRefs = new Set(commandes.map((c) => c.reference));
  const summaryOnlyCdes = cdeSummaryNew
    .filter((s) => !existingRefs.has(s.docCommercial))
    .filter((s) => clientNumberMap.has(s.donneurOrdre))
    .map((s) => ({
      reference_commande: s.docCommercial,
      entreprise_id: clientNumberMap.get(s.donneurOrdre)!,
      date_commande: toISODate(s.dateDocument) || "2026-01-01",
      montant_ht: s.valeurNette > 0 ? s.valeurNette : null,
      type: "directe" as const,
      designations: "[]",
      source_import: "sap_export",
      sap_created_by: s.creePar || null,
      numero_commande_client: s.numCommandeAchat || null,
      statut_livraison: mapStatutLivraison(s.statut),
    }));

  const summaryStats = await batchUpsert(supabase, "commandes", summaryOnlyCdes, "reference_commande");
  console.log(`  Summary-only commandes: ${summaryStats.inserted} imported`);
```

- [ ] **Step 6: Run the full import**

```bash
cd app && bun run ../scripts/import-sap-historique.ts
```

- [ ] **Step 7: Verify counts in Supabase**

```sql
-- Check import results
SELECT source_import, COUNT(*) FROM offres GROUP BY source_import;
-- Expected: ocr ~13, sap_export ~8000+

SELECT source_import, COUNT(*) FROM commandes GROUP BY source_import;
-- Expected: ocr ~26, sap_export ~6400+

SELECT statut_livraison, COUNT(*) FROM commandes
WHERE statut_livraison IS NOT NULL GROUP BY statut_livraison;

SELECT COUNT(DISTINCT entreprise_id) FROM offres WHERE source_import = 'sap_export';
SELECT COUNT(DISTINCT entreprise_id) FROM commandes WHERE source_import = 'sap_export';
```

- [ ] **Step 8: Commit**

```bash
git add scripts/import-sap-historique.ts
git commit -m "import SAP historical data: offres + commandes with enrichment"
```

---

### Task 5: Run rapprochement algorithmique

**Files:**
- None (uses existing RPCs from Task 1)

- [ ] **Step 1: Run dry-run rapprochement**

```sql
-- Preview matches (read-only)
SELECT * FROM rapprochement_algorithmique(180, 0.3)
LIMIT 20;
```

Check: le score est-il cohérent ? Les noms d'entreprises matchent-ils logiquement ?

- [ ] **Step 2: Analyze match distribution**

```sql
-- Distribution des scores
SELECT
  CASE
    WHEN score >= 0.9 THEN '90-100%'
    WHEN score >= 0.7 THEN '70-89%'
    WHEN score >= 0.5 THEN '50-69%'
    ELSE '30-49%'
  END AS score_band,
  COUNT(*) AS nb_matches,
  ROUND(AVG(nb_articles_match)) AS avg_articles
FROM rapprochement_algorithmique(180, 0.3)
GROUP BY 1 ORDER BY 1 DESC;
```

- [ ] **Step 3: Apply rapprochement**

```sql
-- Apply matches
SELECT * FROM appliquer_rapprochement(180, 0.3);
```

Expected: returns `(nb_matched, nb_offres_transformees)`.

- [ ] **Step 4: Verify offre statuts**

```sql
-- Taux de transformation post-rapprochement
SELECT statut, COUNT(*) FROM offres WHERE source_import = 'sap_export' GROUP BY statut;

-- Commande types
SELECT type, COUNT(*) FROM commandes WHERE source_import = 'sap_export' GROUP BY type;
```

- [ ] **Step 5: Commit import script final version**

```bash
git add scripts/import-sap-historique.ts
git commit -m "complete SAP import with rapprochement algorithmique"
```

---

### Task 6: TypeScript types + RPC verification

**Files:**
- Modify: `app/src/types/database.ts`

- [ ] **Step 1: Add new fields to TypeScript types**

In `database.ts`, add to `Offre` interface:

```typescript
export interface Offre {
  // ... existing fields ...
  source_import: string;
  sap_created_by: string | null;
}
```

Add to `Commande` interface:

```typescript
export interface Commande {
  // ... existing fields ...
  numero_commande_client: string | null; // already in DB (migration 003), missing from types
  source_import: string;
  statut_livraison: string | null;
  sap_created_by: string | null;
}
```

Add type for statut_livraison:

```typescript
export type StatutLivraison = "liquide" | "non_livre" | "partiellement_livre";
```

- [ ] **Step 2: Verify dashboard RPCs with new data volume**

Test each RPC in Supabase SQL Editor:

```sql
-- These should all return results without errors or timeouts
SELECT * FROM taux_transformation(NULL, NULL, NULL, NULL);
SELECT * FROM offres_non_transformees(NULL, NULL);
SELECT * FROM top_clients(NULL, NULL, NULL, 10);
SELECT * FROM stats_par_pays(NULL, NULL);
SELECT * FROM kpis_direction(NULL, NULL);
SELECT * FROM ca_mensuel(2025);
SELECT * FROM top_materiaux(NULL, NULL, 20);
SELECT * FROM recurrence_clients(NULL, NULL);
SELECT * FROM stats_par_region();
```

**Check:** Each should return within 2 seconds. If `top_materiaux` is slow (JSONB scan on ~100K designations), note it for optimization.

- [ ] **Step 3: Fix NULL montant handling if needed**

If `taux_transformation` or `kpis_direction` return wrong numbers because of NULL montants from SAP data, update the RPCs to use `COALESCE(montant_ht, 0)` or exclude NULLs from amount sums. The count-based metrics (nb_offres, taux) should be unaffected.

Example fix if needed:

```sql
-- In taux_transformation, change:
--   SUM(o.montant_ht) AS montant_offres
-- To:
--   SUM(o.montant_ht) FILTER (WHERE o.montant_ht IS NOT NULL) AS montant_offres
```

- [ ] **Step 4: Commit**

```bash
git add app/src/types/database.ts
git commit -m "update TypeScript types for SAP import fields"
```

---

### Task 7: API endpoint + UI for recurring Excel import

**Files:**
- Create: `app/src/app/api/import-excel/route.ts`
- Create: `app/src/components/excel-dropzone.tsx`
- Modify: `app/src/app/(app)/upload/page.tsx`
- Modify: `app/src/lib/i18n.ts`

- [ ] **Step 1: Create API endpoint**

First, create the shared parsing module that both the one-shot script and the API route will use:

```typescript
// app/src/lib/sap-parser.ts
// Shared SAP Excel parsing logic — used by both the import script and the API route.
// This file contains the core parsing, aggregation, and client mapping functions.
// See scripts/import-sap-historique.ts for type definitions.

import type ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────

export interface SAPDetailLine {
  dateDoc: Date;
  docVente: string;
  poste: string;
  article: string;
  designation: string;
  clientName: string;
  qteConfirmee: number;
  creePar?: string;
}

export interface SAPSummaryLine {
  docCommercial: string;
  numCommandeAchat: string;
  dateDocument: Date;
  creePar: string;
  donneurOrdre: string;
  valeurNette: number;
  statut: string;
}

export interface AggregatedDoc {
  reference: string;
  clientName: string;
  date: string;
  createdBy: string;
  designations: Array<{
    position: string;
    reference_materiel: string;
    designation: string;
    quantite: number;
  }>;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

// ── Expected headers for validation ────────────────────────

const OFFRE_DETAIL_HEADERS = ["Date doc.", "Doc. vente", "Poste", "Article", "Désignation", "Dat.lv.req", "Nom 1", "SA", "Créé par", "Qté confirmée"];
const COMMANDE_DETAIL_HEADERS = ["Date doc.", "Doc. vente", "Poste", "Article", "Désignation", "Nom 1", "Qté confirmée"];
const COMMANDE_SUMMARY_HEADERS = ["Document commercial", "Nº commande d'achat", "Date du document", "Type document vente", "Créé par", "Donneur d'ordre", "Valeur nette", "Devise document", "Statut"];

export function validateHeaders(ws: ExcelJS.Worksheet, expected: string[]): void {
  const row1 = ws.getRow(1);
  for (let i = 0; i < expected.length; i++) {
    const actual = String(row1.getCell(i + 1).value || "").trim();
    if (actual !== expected[i]) {
      throw new Error(`Header mismatch col ${i + 1}: expected "${expected[i]}", got "${actual}"`);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

export function toISODate(d: Date | null | undefined): string | null {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export function mapStatutLivraison(sap: string): string | null {
  const s = sap?.toLowerCase().trim();
  if (s?.startsWith("liquid")) return "liquide";
  if (s?.includes("non liv")) return "non_livre";
  if (s?.startsWith("partiel")) return "partiellement_livre";
  return null;
}

// ── Parsing ────────────────────────────────────────────────

export function parseDetailWorksheet(
  ws: ExcelJS.Worksheet,
  type: "offre" | "commande"
): SAPDetailLine[] {
  validateHeaders(ws, type === "offre" ? OFFRE_DETAIL_HEADERS : COMMANDE_DETAIL_HEADERS);
  const lines: SAPDetailLine[] = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const dateDoc = row.getCell(1).value;
    if (!dateDoc || !(dateDoc instanceof Date)) return;

    lines.push({
      dateDoc,
      docVente: String(row.getCell(2).value || "").trim(),
      poste: String(row.getCell(3).value || "").trim(),
      article: String(row.getCell(4).value || "").trim(),
      designation: String(row.getCell(5).value || "").trim(),
      clientName: String(row.getCell(type === "offre" ? 7 : 6).value || "").trim(),
      qteConfirmee: Number(row.getCell(type === "offre" ? 10 : 7).value || 0),
      creePar: type === "offre" ? String(row.getCell(9).value || "").trim() : undefined,
    });
  });
  return lines;
}

export function parseSummaryWorksheet(ws: ExcelJS.Worksheet): SAPSummaryLine[] {
  validateHeaders(ws, COMMANDE_SUMMARY_HEADERS);
  const lines: SAPSummaryLine[] = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const doc = String(row.getCell(1).value || "").trim();
    if (!doc) return;

    lines.push({
      docCommercial: doc,
      numCommandeAchat: String(row.getCell(2).value || "").trim(),
      dateDocument: row.getCell(3).value as Date,
      creePar: String(row.getCell(5).value || "").trim(),
      donneurOrdre: String(row.getCell(6).value || "").trim(),
      valeurNette: Number(row.getCell(7).value || 0),
      statut: String(row.getCell(9).value || "").trim(),
    });
  });
  return lines;
}

export function aggregateByDocument(lines: SAPDetailLine[]): AggregatedDoc[] {
  const groups = new Map<string, SAPDetailLine[]>();
  for (const line of lines) {
    if (!line.docVente) continue;
    if (!groups.has(line.docVente)) groups.set(line.docVente, []);
    groups.get(line.docVente)!.push(line);
  }

  return Array.from(groups.entries()).map(([ref, groupLines]) => {
    const posMap = new Map<string, { poste: string; article: string; designation: string; maxQty: number }>();
    for (const line of groupLines) {
      const key = `${line.poste}|${line.article}`;
      const existing = posMap.get(key);
      if (!existing || line.qteConfirmee > existing.maxQty) {
        posMap.set(key, {
          poste: line.poste, article: line.article, designation: line.designation,
          maxQty: Math.max(line.qteConfirmee, existing?.maxQty ?? 0),
        });
      }
    }
    return {
      reference: ref,
      clientName: groupLines[0].clientName,
      date: toISODate(groupLines[0].dateDoc) || "2021-01-01",
      createdBy: groupLines[0].creePar || "",
      designations: Array.from(posMap.values())
        .filter((p) => p.maxQty > 0)
        .map((p) => ({ position: p.poste, reference_materiel: p.article, designation: p.designation, quantite: p.maxQty })),
    };
  });
}

// ── Client mapping ─────────────────────────────────────────

export async function mapClientNames(
  names: string[],
  sb: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const name of names) {
    if (!name.trim()) continue;
    const { data: id } = await sb.rpc("match_entreprise", { p_nom: name.trim(), p_code_postal: null });
    if (id) { map.set(name, id); continue; }
    const { data } = await sb.from("entreprises").insert({ nom: name.trim(), source: "sap_export" }).select("id").single();
    if (data) map.set(name, data.id);
  }
  return map;
}

// ── Batch upsert ───────────────────────────────────────────

export async function batchUpsert<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  table: string,
  rows: T[],
  conflictColumn: string,
  batchSize = 500
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await sb.from(table).upsert(batch, { onConflict: conflictColumn, ignoreDuplicates: true }).select("id");
    if (error) result.errors.push(error.message);
    else result.inserted += data?.length ?? 0;
  }
  result.skipped = rows.length - result.inserted;
  return result;
}
```

Then the API route imports from this shared module:

```typescript
// app/src/app/api/import-excel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";
import ExcelJS from "exceljs";
import {
  parseDetailWorksheet,
  parseSummaryWorksheet,
  aggregateByDocument,
  mapClientNames,
  batchUpsert,
  toISODate,
  mapStatutLivraison,
  type ImportResult,
} from "@/lib/sap-parser";

export const maxDuration = 120;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const rateLimiter = createRateLimiter(3, 60_000); // 3 imports/min

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  // 2. Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "commercial") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // 3. Parse form + validate
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const fileType = formData.get("type") as string;

  if (!file || !fileType) {
    return NextResponse.json({ error: "Fichier et type requis" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (50 Mo max)" }, { status: 413 });
  }
  if (!file.name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Format Excel requis (.xlsx)" }, { status: 400 });
  }

  // 4. Parse XLSX
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(1);
  if (!ws) return NextResponse.json({ error: "Feuille Excel vide" }, { status: 400 });

  // 5. Process
  const admin = createAdminClient();
  let result: ImportResult;

  try {
    switch (fileType) {
      case "offres_detail": {
        const lines = parseDetailWorksheet(ws, "offre");
        const docs = aggregateByDocument(lines);
        const names = [...new Set(docs.map((d) => d.clientName))].filter(Boolean);
        const clientMap = await mapClientNames(names, admin);
        const rows = docs
          .filter((d) => clientMap.has(d.clientName))
          .map((d) => ({
            reference_offre: d.reference,
            entreprise_id: clientMap.get(d.clientName)!,
            date_offre: d.date,
            statut: "en_attente",
            designations: JSON.stringify(d.designations),
            source_import: "sap_export",
            sap_created_by: d.createdBy || null,
          }));
        result = await batchUpsert(admin, "offres", rows, "reference_offre");
        break;
      }
      case "commandes_detail": {
        const lines = parseDetailWorksheet(ws, "commande");
        const docs = aggregateByDocument(lines);
        const names = [...new Set(docs.map((d) => d.clientName))].filter(Boolean);
        const clientMap = await mapClientNames(names, admin);
        const rows = docs
          .filter((d) => clientMap.has(d.clientName))
          .map((d) => ({
            reference_commande: d.reference,
            entreprise_id: clientMap.get(d.clientName)!,
            date_commande: d.date,
            type: "directe",
            designations: JSON.stringify(d.designations),
            source_import: "sap_export",
          }));
        result = await batchUpsert(admin, "commandes", rows, "reference_commande");
        break;
      }
      case "commandes_summary": {
        const summaries = parseSummaryWorksheet(ws);
        // Map donneur_ordre → entreprise via numero_client
        const { data: entreprises } = await admin
          .from("entreprises").select("id, numero_client").not("numero_client", "is", null);
        const numMap = new Map<string, string>();
        for (const e of entreprises || []) {
          if (e.numero_client) numMap.set(e.numero_client, e.id);
        }
        const rows = summaries
          .filter((s) => numMap.has(s.donneurOrdre))
          .map((s) => ({
            reference_commande: s.docCommercial,
            entreprise_id: numMap.get(s.donneurOrdre)!,
            date_commande: toISODate(s.dateDocument) || "2026-01-01",
            montant_ht: s.valeurNette > 0 ? s.valeurNette : null,
            type: "directe",
            designations: "[]",
            source_import: "sap_export",
            sap_created_by: s.creePar || null,
            numero_commande_client: s.numCommandeAchat || null,
            statut_livraison: mapStatutLivraison(s.statut),
          }));
        result = await batchUpsert(admin, "commandes", rows, "reference_commande");
        break;
      }
      default:
        return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Erreur d'import", details: String(err) }, { status: 500 });
  }

  return NextResponse.json(result);
}
```

The one-shot script (`scripts/import-sap-historique.ts`) should also import from `app/src/lib/sap-parser.ts` instead of duplicating logic. Since it runs from the `app/` directory (`cd app && bun run ../scripts/import-sap-historique.ts`), imports like `import { ... } from "./src/lib/sap-parser"` will resolve correctly.

- [ ] **Step 2: Add i18n keys**

In `app/src/lib/i18n.ts`, add (use `{ fr: "...", es: "..." }` object syntax to match existing pattern):

```typescript
"upload.tab_pdf": { fr: "Documents PDF", es: "Documentos PDF" },
"upload.tab_excel": { fr: "Import Excel SAP", es: "Importar Excel SAP" },
"upload.excel_subtitle": { fr: "Importez un export SAP (.xlsx) pour alimenter la base", es: "Importe una exportación SAP (.xlsx)" },
"upload.excel_type": { fr: "Type de fichier", es: "Tipo de archivo" },
"upload.excel_type_offres": { fr: "Offres (détail articles)", es: "Ofertas (detalle artículos)" },
"upload.excel_type_commandes": { fr: "Commandes (détail articles)", es: "Pedidos (detalle artículos)" },
"upload.excel_type_summary": { fr: "Commandes (résumé avec montants)", es: "Pedidos (resumen con importes)" },
"upload.excel_drop": { fr: "Glissez votre fichier Excel ici", es: "Arrastre su archivo Excel aquí" },
"upload.excel_or_click": { fr: "ou cliquez pour sélectionner · .xlsx uniquement", es: "o haga clic para seleccionar · solo .xlsx" },
"upload.excel_importing": { fr: "Import en cours...", es: "Importando..." },
"upload.excel_success": { fr: "Import terminé", es: "Importación completada" },
"upload.excel_inserted": { fr: "importés", es: "importados" },
"upload.excel_skipped": { fr: "ignorés (doublons)", es: "ignorados (duplicados)" },
```

- [ ] **Step 3: Create ExcelDropzone component**

```typescript
// app/src/components/excel-dropzone.tsx
"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { t, type Locale } from "@/lib/i18n";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ExcelDropzoneProps {
  locale: Locale;
}

type FileType = "offres_detail" | "commandes_detail" | "commandes_summary";

export function ExcelDropzone({ locale }: ExcelDropzoneProps) {
  const [fileType, setFileType] = useState<FileType>("offres_detail");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number; skipped: number; errors: string[];
  } | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", fileType);

    try {
      const res = await fetch("/api/import-excel", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur d'import");
        return;
      }

      setResult(data);
      toast.success(`${data.inserted} ${t("upload.excel_inserted", locale)}`);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsUploading(false);
    }
  }, [fileType, locale]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4">
      {/* File type selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("upload.excel_type", locale)}
        </label>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as FileType)}
          className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
        >
          <option value="offres_detail">{t("upload.excel_type_offres", locale)}</option>
          <option value="commandes_detail">{t("upload.excel_type_commandes", locale)}</option>
          <option value="commandes_summary">{t("upload.excel_type_summary", locale)}</option>
        </select>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
        } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-8 w-8 animate-pulse" />
            <span className="text-sm">{t("upload.excel_importing", locale)}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileSpreadsheet className="h-8 w-8" />
            <span className="text-sm font-medium">{t("upload.excel_drop", locale)}</span>
            <span className="text-[11px]">{t("upload.excel_or_click", locale)}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-lg border border-border/60 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            {result.errors.length === 0 ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            {t("upload.excel_success", locale)}
          </div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <p>{result.inserted} {t("upload.excel_inserted", locale)}</p>
            {result.skipped > 0 && (
              <p>{result.skipped} {t("upload.excel_skipped", locale)}</p>
            )}
            {result.errors.length > 0 && (
              <p className="text-destructive">{result.errors.length} erreurs</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update upload page with tabs**

Replace `app/src/app/(app)/upload/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { t, LOCALE_COOKIE, getLocaleFromCookie, type Locale } from "@/lib/i18n";
import { PdfDropzone } from "@/components/pdf-dropzone";
import { ExcelDropzone } from "@/components/excel-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadPage() {
  const [locale] = useState<Locale>(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
      return getLocaleFromCookie(match?.[1]);
    }
    return "fr";
  });

  const [tab, setTab] = useState<"pdf" | "excel">("pdf");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-bold tracking-tight">
          {t("upload.title", locale)}
        </h1>
        <p className="text-xs text-muted-foreground">{t("upload.subtitle", locale)}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border/60 p-1">
        <button
          onClick={() => setTab("pdf")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "pdf" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("upload.tab_pdf", locale)}
        </button>
        <button
          onClick={() => setTab("excel")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "excel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("upload.tab_excel", locale)}
        </button>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {tab === "pdf" ? t("upload.type_document", locale) : t("upload.excel_type", locale)}
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {tab === "pdf" ? t("upload.auto_detect", locale) : t("upload.excel_subtitle", locale)}
          </p>
        </CardHeader>
        <CardContent>
          {tab === "pdf" ? (
            <PdfDropzone locale={locale} />
          ) : (
            <ExcelDropzone locale={locale} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Test end-to-end**

1. Start dev server: `cd app && bun dev`
2. Login as admin
3. Go to /upload
4. Switch to "Import Excel SAP" tab
5. Select "Offres (détail articles)"
6. Upload one of the smaller XLSX files (EXPORT OFFRES 2026.XLSX)
7. Verify results appear

- [ ] **Step 6: Commit**

```bash
git add app/src/app/api/import-excel/route.ts \
       app/src/components/excel-dropzone.tsx \
       app/src/app/\(app\)/upload/page.tsx \
       app/src/lib/i18n.ts
git commit -m "add recurring Excel import: API endpoint, dropzone UI, upload tabs"
```

---

## Verification Checklist

After all tasks are complete, verify:

```sql
-- 1. Data volume
SELECT 'offres' AS table_name, source_import, COUNT(*) FROM offres GROUP BY source_import
UNION ALL
SELECT 'commandes', source_import, COUNT(*) FROM commandes GROUP BY source_import;

-- 2. Rapprochement results
SELECT type, COUNT(*) FROM commandes WHERE source_import = 'sap_export' GROUP BY type;
-- Expected: egale (matched) + directe (unmatched)

-- 3. Transformation rate
SELECT statut, COUNT(*) FROM offres WHERE source_import = 'sap_export' GROUP BY statut;
-- Expected: transformee (matched) + en_attente (unmatched)

-- 4. Dashboard works
SELECT * FROM taux_transformation(NULL, NULL, NULL, NULL);
-- Expected: includes both OCR and SAP data

-- 5. Top clients now meaningful
SELECT * FROM top_clients('2021-01-01', '2026-12-31', NULL, 10);

-- 6. Recurrence analysis works
SELECT * FROM recurrence_clients('2021-01-01', '2026-12-31');
```

## Risk Mitigation

| Risque | Mitigation |
|--------|------------|
| Rapprochement faux positifs | Dry-run preview + seuil ajustable (default 0.3) |
| Doublons OCR vs SAP | Séries de références différentes (OFF-xxx vs 504xxx) |
| Performance RPCs sur ~15K records | Indexes existants suffisants ; monitoring query time |
| Client non trouvé | Création automatique avec source='sap_export' |
| Import rejoué par erreur | `ON CONFLICT ... DO NOTHING` sur tous les upserts |
| NULL montants faussent les KPIs | RPCs utilisent COALESCE/FILTER ; métriques count-based fiables |
