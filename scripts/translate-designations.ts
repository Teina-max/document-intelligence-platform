// scripts/translate-designations.ts
// Run: bun run scripts/translate-designations.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const BATCH_SIZE = 50;

interface LigneRow {
  id: string;
  designation_brute: string | null;
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are translating industrial part designations to French. These come from a Spanish/German parts catalog. Translate ALL descriptive words to French (e.g. "barra guía" → "barre de guidage", "placa" → "plaque", "tornillo" → "vis", "Heizung" → "chauffage"). Keep product codes, numbers, and dimensions as-is. Return ONLY a JSON array of translated strings, same order, same count.\n\n${JSON.stringify(texts)}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
  return JSON.parse(cleaned);
}

async function processTable(table: "offre_lignes" | "commande_lignes") {
  console.log(`\nProcessing ${table}...`);

  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("designation_fr", null)
    .not("designation_brute", "is", null);

  console.log(`  ${count} rows to translate`);
  let processed = 0;

  while (true) {
    const { data: rows } = (await supabase
      .from(table)
      .select("id, designation_brute")
      .is("designation_fr", null)
      .not("designation_brute", "is", null)
      .limit(BATCH_SIZE)) as { data: LigneRow[] | null };

    if (!rows || rows.length === 0) break;

    const texts = rows.map((r) => r.designation_brute!);

    try {
      const translations = await translateBatch(texts);

      for (let i = 0; i < rows.length; i++) {
        await supabase
          .from(table)
          .update({ designation_fr: translations[i] })
          .eq("id", rows[i].id);
      }

      processed += rows.length;
      console.log(`  ${processed}/${count} done`);
    } catch (err) {
      console.error("  Translation error, copying originals:", err);
      for (const row of rows) {
        await supabase
          .from(table)
          .update({ designation_fr: row.designation_brute })
          .eq("id", row.id);
      }
      processed += rows.length;
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`  Done: ${processed} rows translated in ${table}`);
}

async function updateParentJsonb(
  parentTable: "offres" | "commandes",
  lignesTable: "offre_lignes" | "commande_lignes",
  fkColumn: "offre_id" | "commande_id"
) {
  console.log(`\nUpdating ${parentTable} JSONB designations...`);
  const { data: parents } = await supabase
    .from(parentTable)
    .select("id, designations")
    .not("designations", "is", null);

  if (!parents) return;

  let updated = 0;
  for (const parent of parents) {
    if (!Array.isArray(parent.designations)) continue;

    const { data: lignes } = await supabase
      .from(lignesTable)
      .select("designation_brute, designation_fr, poste")
      .eq(fkColumn, parent.id);

    if (!lignes || lignes.length === 0) continue;

    const lookup = new Map(
      lignes.map((l: any) => [l.designation_brute, l.designation_fr])
    );

    const updatedDesignations = parent.designations.map((d: any) => ({
      ...d,
      designation_fr: lookup.get(d.designation) ?? d.designation,
    }));

    await supabase
      .from(parentTable)
      .update({ designations: updatedDesignations })
      .eq("id", parent.id);
    updated++;
  }

  console.log(`  ${updated} ${parentTable} JSONB arrays updated`);
}

async function main() {
  console.log("=== Designation Translation Backfill ===");
  await processTable("offre_lignes");
  await processTable("commande_lignes");
  await updateParentJsonb("offres", "offre_lignes", "offre_id");
  await updateParentJsonb("commandes", "commande_lignes", "commande_id");
  console.log("\n=== Complete ===");
}

main().catch(console.error);
