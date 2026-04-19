/**
 * Migrate JSONB designations to offre_lignes / commande_lignes
 *
 * For each offre/commande with JSONB designations, create rows in
 * the new line tables with FK to pieces (matched by reference_materiel).
 */

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

// ============================================================
// Load pieces lookup (reference → id)
// ============================================================

async function loadPiecesLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("pieces")
      .select("id, reference")
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`pieces query error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      lookup.set(row.reference, row.id);
    }
    offset += batchSize;
  }

  return lookup;
}

// ============================================================
// Migrate offres designations
// ============================================================

interface DesignationItem {
  designation?: string;
  reference_materiel?: string;
  quantite?: number;
  prix_unitaire?: number;
}

async function migrateOffres(
  piecesLookup: Map<string, string>
): Promise<{ total: number; linked: number; unlinked: number }> {
  let total = 0;
  let linked = 0;
  let unlinked = 0;
  let offset = 0;
  const batchSize = 500;

  while (true) {
    const { data: offres, error } = await supabase
      .from("offres")
      .select("id, designations")
      .not("designations", "is", null)
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`offres query error: ${error.message}`);
    if (!offres || offres.length === 0) break;

    const lignes: Array<{
      offre_id: string;
      piece_id: string | null;
      poste: number;
      designation_brute: string;
      quantite: number;
      prix_unitaire: number | null;
    }> = [];

    for (const offre of offres) {
      const desigs = offre.designations as DesignationItem[];
      if (!Array.isArray(desigs)) continue;

      let poste = 10;
      for (const d of desigs) {
        const ref = d.reference_materiel ? String(d.reference_materiel) : null;
        const pieceId = ref ? piecesLookup.get(ref) || null : null;

        lignes.push({
          offre_id: offre.id,
          piece_id: pieceId,
          poste,
          designation_brute: d.designation || "",
          quantite: d.quantite || 0,
          prix_unitaire: d.prix_unitaire || null,
        });

        if (pieceId) linked++;
        else unlinked++;
        total++;
        poste += 10;
      }
    }

    // Insert batch
    if (lignes.length > 0) {
      const { error: insertError } = await supabase
        .from("offre_lignes")
        .insert(lignes);

      if (insertError) {
        console.error(`  offre_lignes insert error: ${insertError.message}`);
      }
    }

    offset += batchSize;
  }

  return { total, linked, unlinked };
}

// ============================================================
// Migrate commandes designations
// ============================================================

async function migrateCommandes(
  piecesLookup: Map<string, string>
): Promise<{ total: number; linked: number; unlinked: number }> {
  let total = 0;
  let linked = 0;
  let unlinked = 0;
  let offset = 0;
  const batchSize = 500;

  while (true) {
    const { data: commandes, error } = await supabase
      .from("commandes")
      .select("id, designations")
      .not("designations", "is", null)
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`commandes query error: ${error.message}`);
    if (!commandes || commandes.length === 0) break;

    const lignes: Array<{
      commande_id: string;
      piece_id: string | null;
      poste: number;
      designation_brute: string;
      quantite: number;
      prix_unitaire: number | null;
    }> = [];

    for (const commande of commandes) {
      const desigs = commande.designations as DesignationItem[];
      if (!Array.isArray(desigs)) continue;

      let poste = 10;
      for (const d of desigs) {
        const ref = d.reference_materiel ? String(d.reference_materiel) : null;
        const pieceId = ref ? piecesLookup.get(ref) || null : null;

        lignes.push({
          commande_id: commande.id,
          piece_id: pieceId,
          poste,
          designation_brute: d.designation || "",
          quantite: d.quantite || 0,
          prix_unitaire: d.prix_unitaire || null,
        });

        if (pieceId) linked++;
        else unlinked++;
        total++;
        poste += 10;
      }
    }

    if (lignes.length > 0) {
      const { error: insertError } = await supabase
        .from("commande_lignes")
        .insert(lignes);

      if (insertError) {
        console.error(
          `  commande_lignes insert error: ${insertError.message}`
        );
      }
    }

    offset += batchSize;
  }

  return { total, linked, unlinked };
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== Migration JSONB → lignes ===\n");

  // 1. Load pieces lookup
  console.log("1. Loading pieces lookup...");
  const piecesLookup = await loadPiecesLookup();
  console.log(`   ${piecesLookup.size} pieces loaded`);

  // 2. Migrate offres
  console.log("\n2. Migrating offre designations → offre_lignes...");
  const offresResult = await migrateOffres(piecesLookup);
  console.log(`   Total: ${offresResult.total}`);
  console.log(`   Linked to piece: ${offresResult.linked}`);
  console.log(`   Unlinked: ${offresResult.unlinked}`);

  // 3. Migrate commandes
  console.log("\n3. Migrating commande designations → commande_lignes...");
  const commandesResult = await migrateCommandes(piecesLookup);
  console.log(`   Total: ${commandesResult.total}`);
  console.log(`   Linked to piece: ${commandesResult.linked}`);
  console.log(`   Unlinked: ${commandesResult.unlinked}`);

  // 4. Summary
  const totalLignes = offresResult.total + commandesResult.total;
  const totalLinked = offresResult.linked + commandesResult.linked;
  console.log("\n=== Summary ===");
  console.log(`Total lignes: ${totalLignes}`);
  console.log(`Linked to pieces: ${totalLinked} (${((totalLinked / totalLignes) * 100).toFixed(1)}%)`);
  console.log(`Unlinked: ${totalLignes - totalLinked}`);
}

main().catch(console.error);
