/**
 * import-sap-historique.ts
 * One-shot SAP historical import script.
 *
 * Usage (from app/ directory):
 *   bun run ../scripts/import-sap-historique.ts [--dry-run]
 */

import ExcelJS from "exceljs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  validateHeaders,
  toISODate,
  mapStatutLivraison,
  parseDetailWorksheet,
  parseSummaryWorksheet,
  aggregateByDocument,
  mapClientNames,
  batchUpsert,
  OFFRE_DETAIL_HEADERS,
  COMMANDE_DETAIL_HEADERS,
  SUMMARY_HEADERS,
  type SAPDetailLine,
  type SAPSummaryLine,
  type AggregatedDoc,
} from "../app/src/lib/sap-parser";

// ============================================================
// Config
// ============================================================

// Script is run from app/ directory — resolve relative to that
const APP_DIR = process.cwd();

const FILES = {
  offresHistorique: path.resolve(
    APP_DIR,
    "../docs/nouveaux docs/Export offre 2026/EXPORT OFFRES 2021 à 2026.XLSX"
  ),
  offres2026: path.resolve(
    APP_DIR,
    "../docs/nouveaux docs/Export offre 2026/EXPORT OFFRES 2026.XLSX"
  ),
  commandesDetail: path.resolve(
    APP_DIR,
    "../docs/nouveaux docs/Commandes clients/EXPORT_20260330_100131.XLSX"
  ),
  commandesSummaryOld: path.resolve(
    APP_DIR,
    "../docs/nouveaux docs/Export liste commande 2026/EXPORT cde en 03.XLSX"
  ),
  commandesSummaryNew: path.resolve(
    APP_DIR,
    "../docs/nouveaux docs/Export liste commande 2026/EXPORT LISTE CDE 2026.XLSX"
  ),
};

const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================
// Supabase client (only needed for live import)
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================================
// Helpers
// ============================================================

async function loadWorksheet(
  filePath: string,
  sheetIndex = 0
): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[sheetIndex];
  if (!ws) {
    throw new Error(`No worksheet at index ${sheetIndex} in ${filePath}`);
  }
  return ws;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== SAP Historical Import ===\n");

  // ---- Step 1: Parse all XLSX files ----
  console.log("1. Parsing XLSX files...");

  // Offres historique
  const wsOffresHist = await loadWorksheet(FILES.offresHistorique);
  validateHeaders(wsOffresHist, OFFRE_DETAIL_HEADERS);
  const offresHistLines = parseDetailWorksheet(wsOffresHist, "offre");
  console.log(`  offres historique: ${offresHistLines.length} lines`);

  // Offres 2026
  const wsOffres2026 = await loadWorksheet(FILES.offres2026);
  validateHeaders(wsOffres2026, OFFRE_DETAIL_HEADERS);
  const offres2026Lines = parseDetailWorksheet(wsOffres2026, "offre");
  console.log(`  offres 2026: ${offres2026Lines.length} lines`);

  // Commandes detail
  const wsCmdesDetail = await loadWorksheet(FILES.commandesDetail);
  validateHeaders(wsCmdesDetail, COMMANDE_DETAIL_HEADERS);
  const commandesDetailLines = parseDetailWorksheet(wsCmdesDetail, "commande");
  console.log(`  commandes detail: ${commandesDetailLines.length} lines`);

  // Summary old
  const wsSummaryOld = await loadWorksheet(FILES.commandesSummaryOld);
  validateHeaders(wsSummaryOld, SUMMARY_HEADERS);
  const summaryOldLines = parseSummaryWorksheet(wsSummaryOld);
  console.log(`  commandes summary (old): ${summaryOldLines.length} lines`);

  // Summary new
  const wsSummaryNew = await loadWorksheet(FILES.commandesSummaryNew);
  validateHeaders(wsSummaryNew, SUMMARY_HEADERS);
  const summaryNewLines = parseSummaryWorksheet(wsSummaryNew);
  console.log(`  commandes summary (new): ${summaryNewLines.length} lines`);

  // ---- Step 2: Aggregate documents ----
  console.log("\n2. Aggregating documents...");

  // Combine both offre files — deduplicate by docVente (2026 file may overlap)
  const allOffreLines: SAPDetailLine[] = [...offresHistLines, ...offres2026Lines];
  const offresAggregated = aggregateByDocument(allOffreLines);

  const commandesAggregated = aggregateByDocument(commandesDetailLines);

  // All summary lines combined (for enrichment)
  const allSummaryLines: SAPSummaryLine[] = [...summaryOldLines, ...summaryNewLines];

  // Unique client names from detail files
  const offreClientNames = new Set(offresAggregated.map((d) => d.clientName));
  const commandeClientNames = new Set(commandesAggregated.map((d) => d.clientName));
  const allDetailClientNames = new Set([...offreClientNames, ...commandeClientNames]);

  // Unique client numbers from summary files (donneur d'ordre)
  const summaryDonneurOrdres = new Set(
    allSummaryLines.map((l) => l.donneurOrdre).filter(Boolean)
  );

  console.log(`  Offres: ${offresAggregated.length} documents`);
  console.log(`  Commandes (detail): ${commandesAggregated.length} documents`);
  console.log(`  Commandes (summary old): ${summaryOldLines.length}`);
  console.log(`  Commandes (summary new): ${summaryNewLines.length}`);
  console.log(`\n  Unique client names: ${allDetailClientNames.size}`);
  console.log(`  Unique client numbers (summary): ${summaryDonneurOrdres.size}`);

  if (DRY_RUN) {
    console.log("\n=== DRY RUN — no data inserted ===");
    return;
  }

  // ---- Live import ----
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Step 3: Map clients ----
  console.log("\n3. Mapping clients...");

  const clientNameMap = await mapClientNames(
    [...allDetailClientNames],
    supabase
  );
  console.log(`  Mapped ${clientNameMap.size} client names to entreprise_id`);

  // Build numero_client map from summary donneurOrdre
  // Summary donneurOrdre is a client name string, not a number in these exports
  // We use the same name mapping for summary clients
  const summaryClientMap = await mapClientNames(
    [...summaryDonneurOrdres],
    supabase
  );
  console.log(`  Mapped ${summaryClientMap.size} summary client names`);

  // ---- Step 4: Insert offres ----
  console.log("\n4. Inserting offres...");

  const offresRows = offresAggregated
    .filter((d) => clientNameMap.has(d.clientName))
    .map((d) => ({
      reference_offre: d.docVente,
      entreprise_id: clientNameMap.get(d.clientName)!,
      date_offre: toISODate(d.dateDoc)!,
      statut: "en_attente" as const,
      designations: JSON.stringify(d.designations),
      source_import: "sap_export",
      sap_created_by: d.correspondant ?? null,
      correspondant: d.correspondant ?? null,
    }));

  const offresResult = await batchUpsert(
    supabase,
    "offres",
    offresRows,
    "reference_offre"
  );
  console.log(
    `  Inserted: ${offresResult.inserted}, Skipped: ${offresResult.skipped}`
  );
  if (offresResult.errors.length > 0) {
    console.error("  Errors:", offresResult.errors);
  }

  // ---- Step 5: Insert commandes (detail) ----
  console.log("\n5. Inserting commandes (detail)...");

  const commandesRows = commandesAggregated
    .filter((d) => clientNameMap.has(d.clientName))
    .map((d) => ({
      reference_commande: d.docVente,
      entreprise_id: clientNameMap.get(d.clientName)!,
      date_commande: toISODate(d.dateDoc)!,
      type: "directe" as const,
      designations: JSON.stringify(d.designations),
      source_import: "sap_export",
    }));

  const commandesResult = await batchUpsert(
    supabase,
    "commandes",
    commandesRows,
    "reference_commande"
  );
  console.log(
    `  Inserted: ${commandesResult.inserted}, Skipped: ${commandesResult.skipped}`
  );
  if (commandesResult.errors.length > 0) {
    console.error("  Errors:", commandesResult.errors);
  }

  // ---- Step 6: Enrich commandes with summary data ----
  console.log("\n6. Enriching commandes with summary data...");

  // Build a map: docCommercial → summary line (prefer new over old)
  const summaryMap = new Map<string, SAPSummaryLine>();
  for (const line of summaryOldLines) {
    summaryMap.set(line.docCommercial, line);
  }
  for (const line of summaryNewLines) {
    // New file overrides old
    summaryMap.set(line.docCommercial, line);
  }

  let enriched = 0;
  let enrichErrors = 0;

  for (const [docRef, summary] of summaryMap) {
    const statutLiv = mapStatutLivraison(summary.statut);

    const updates: Record<string, unknown> = {};
    if (summary.valeurNette != null) updates.montant_ht = summary.valeurNette;
    if (statutLiv) updates.statut_livraison = statutLiv;
    if (summary.numeroCdeAchat) updates.numero_commande_client = summary.numeroCdeAchat;
    if (summary.creePar) updates.sap_created_by = summary.creePar;

    if (Object.keys(updates).length === 0) continue;

    const { error } = await supabase
      .from("commandes")
      .update(updates)
      .eq("reference_commande", docRef)
      .eq("source_import", "sap_export");

    if (error) {
      enrichErrors++;
      console.error(`  Enrich error for ${docRef}:`, error.message);
    } else {
      enriched++;
    }
  }

  console.log(
    `  Enriched: ${enriched} commandes, Errors: ${enrichErrors}`
  );

  // ---- Step 7: Import summary-only commandes ----
  console.log("\n7. Importing summary-only commandes...");

  // Find commandes that exist in summary but not in detail file
  const detailRefs = new Set(commandesAggregated.map((d) => d.docVente));
  const summaryOnlyLines = allSummaryLines.filter(
    (l) => !detailRefs.has(l.docCommercial)
  );

  // Deduplicate by docCommercial (take last seen)
  const summaryOnlyMap = new Map<string, SAPSummaryLine>();
  for (const line of summaryOnlyLines) {
    summaryOnlyMap.set(line.docCommercial, line);
  }

  const summaryOnlyRows: Record<string, unknown>[] = [];

  for (const [docRef, summary] of summaryOnlyMap) {
    const entrepriseId = summaryClientMap.get(summary.donneurOrdre);
    if (!entrepriseId) {
      console.warn(
        `  No entreprise found for summary-only commande ${docRef} (client: ${summary.donneurOrdre})`
      );
      continue;
    }

    const dateDoc = toISODate(summary.dateDoc);
    if (!dateDoc) continue;

    summaryOnlyRows.push({
      reference_commande: docRef,
      entreprise_id: entrepriseId,
      date_commande: dateDoc,
      type: "directe",
      montant_ht: summary.valeurNette ?? null,
      statut_livraison: mapStatutLivraison(summary.statut),
      numero_commande_client: summary.numeroCdeAchat || null,
      sap_created_by: summary.creePar || null,
      designations: JSON.stringify([]),
      source_import: "sap_export",
    });
  }

  const summaryOnlyResult = await batchUpsert(
    supabase,
    "commandes",
    summaryOnlyRows,
    "reference_commande"
  );
  console.log(
    `  Inserted: ${summaryOnlyResult.inserted}, Skipped: ${summaryOnlyResult.skipped}`
  );
  if (summaryOnlyResult.errors.length > 0) {
    console.error("  Errors:", summaryOnlyResult.errors);
  }

  console.log("\n=== Import complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
