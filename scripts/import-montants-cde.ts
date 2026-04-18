/**
 * Import montants (Valeur nette) from CDE Excel exports
 *
 * Sources:
 * - EXPORT LISTE CDE 2026.XLSX (157 commandes)
 * - EXPORT cde en 03.XLSX (27 commandes)
 *
 * Matches on: Document commercial → reference_commande
 * Updates: commandes.montant_ht = Valeur nette
 */

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dir, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  if (line && !line.startsWith("#")) {
    const [key, ...rest] = line.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

interface CdeRecord {
  reference: string;
  montant_ht: number;
  date: string | null;
  statut: string | null;
  source: string;
}

async function parseExcel(
  filePath: string,
  source: string
): Promise<CdeRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const records: CdeRecord[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 2) return;

    const docCommercial = row.getCell(1).value; // Document commercial
    const dateDoc = row.getCell(3).value; // Date du document
    const valeurNette = row.getCell(7).value; // Valeur nette
    const statut = row.getCell(9).value; // Statut

    if (!docCommercial || valeurNette === null || valeurNette === undefined)
      return;

    const montant = typeof valeurNette === "number" ? valeurNette : parseFloat(String(valeurNette));
    if (isNaN(montant)) return;

    records.push({
      reference: String(
        typeof docCommercial === "number" ? docCommercial : docCommercial
      ).trim(),
      montant_ht: montant,
      date: dateDoc instanceof Date ? dateDoc.toISOString().slice(0, 10) : null,
      statut: statut ? String(statut).trim() : null,
      source,
    });
  });

  return records;
}

async function main() {
  console.log("=== Import montants CDE ===\n");

  const basePath = resolve(
    import.meta.dir,
    "../docs/nouveaux docs/Export liste commande 2026"
  );

  // 1. Parse both CDE files
  console.log("1. Parsing CDE Excel files...");

  const cde2026 = await parseExcel(
    resolve(basePath, "EXPORT LISTE CDE 2026.XLSX"),
    "cde_2026"
  );
  console.log(`   CDE 2026: ${cde2026.length} records`);

  const cdeMars = await parseExcel(
    resolve(basePath, "EXPORT cde en 03.XLSX"),
    "cde_mars"
  );
  console.log(`   CDE Mars: ${cdeMars.length} records`);

  // Deduplicate (CDE 2026 takes priority)
  const allCdes = new Map<string, CdeRecord>();
  for (const r of cdeMars) allCdes.set(r.reference, r);
  for (const r of cde2026) allCdes.set(r.reference, r); // overwrite mars if duplicate

  console.log(`   Total unique: ${allCdes.size}`);

  // 2. Match and update commandes
  console.log("\n2. Updating commandes.montant_ht...");

  let updated = 0;
  let notFound = 0;
  let alreadySet = 0;
  const notFoundRefs: string[] = [];

  for (const [reference, cde] of allCdes) {
    // Check if commande exists
    const { data, error } = await supabase
      .from("commandes")
      .select("id, montant_ht")
      .eq("reference_commande", reference)
      .limit(1);

    if (error) {
      console.error(`   Error querying ${reference}: ${error.message}`);
      continue;
    }

    if (!data || data.length === 0) {
      notFound++;
      notFoundRefs.push(reference);
      continue;
    }

    const commande = data[0];

    if (commande.montant_ht !== null) {
      alreadySet++;
      continue;
    }

    // Update montant_ht
    const { error: updateError } = await supabase
      .from("commandes")
      .update({ montant_ht: cde.montant_ht })
      .eq("id", commande.id);

    if (updateError) {
      console.error(`   Error updating ${reference}: ${updateError.message}`);
    } else {
      updated++;
    }
  }

  // 3. Summary
  console.log(`\n=== Summary ===`);
  console.log(`Total CDE records: ${allCdes.size}`);
  console.log(`Updated: ${updated}`);
  console.log(`Already had montant: ${alreadySet}`);
  console.log(`Not found in DB: ${notFound}`);

  if (notFoundRefs.length > 0 && notFoundRefs.length <= 20) {
    console.log(`Not found refs: ${notFoundRefs.join(", ")}`);
  }
}

main().catch(console.error);
