/**
 * Import pieces from Excel exports + existing JSONB designations
 *
 * Sources:
 * 1. EXPORT OFFRES 2021-2026 (65418 rows) — Article + Désignation
 * 2. EXPORT OFFRES 2026 (2589 rows) — Article + Désignation
 * 3. EXPORT_20260330 Commandes clients (32032 rows) — Article + Désignation
 * 4. Existing JSONB designations in offres/commandes tables
 *
 * Output: populates `pieces` table with normalized French names
 */

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env
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
// Spanish → French translation table
// Built from articles with both FR+ES designations in the exports
// ============================================================

const ES_TO_FR: Record<string, string> = {
  // Valves
  "válvula magnética": "électrovanne",
  "electroválvula": "électrovanne",
  "válvula de retroceso": "clapet anti-retour avec étranglement",
  "válvula del comando delantero": "vanne de commande avant",
  "válvula": "vanne",
  // Chains & gears
  "rueda de cadena": "pignon de chaîne",
  "cadena de transporte": "chaîne de transport",
  "cadena de precisión": "chaîne de précision",
  "cadena": "chaîne",
  "piñón": "pignon",
  "engranaje recto": "engrenage droit",
  "engranaje": "engrenage",
  // Bearings & bushings
  "casquillo": "douille",
  "rodillo de soporte": "galet d'appui",
  "rodillo": "rouleau",
  "cojinete": "palier",
  "perno del rodamiento": "axe de roulement",
  // Seals & kits
  "juego de juntas": "kit d'étanchéité",
  "junta": "joint",
  "anillo de junta": "joint torique",
  // Cutting & blades
  "cuchilla de aplaste": "molette de découpe",
  "cuchilla": "lame",
  "portacuchilla": "porte-lame",
  // Supports & structure
  "brazo de soporte": "bras de support",
  "soporte": "support",
  "columna guía": "colonne de guidage",
  "vía guía": "rail de guidage",
  "guía": "guide",
  "brida de soporte": "bride de support",
  "brida": "bride",
  // Controls & panels
  "panel de control": "tableau de commande",
  "panel": "panneau",
  // Misc mechanical
  "ventosas": "ventouses",
  "escala": "échelle",
  "manguera": "tuyau flexible",
  "resorte": "ressort",
  "tornillo": "vis",
  "tuerca": "écrou",
  "arandela": "rondelle",
  "eje": "arbre",
  "pistón": "piston",
  "cilindro": "cylindre",
  "correa dentada": "courroie dentée",
  "sinfín roscado": "vis sans fin filetée",
  "storage modul": "module de stockage",
};

/**
 * Translate a Spanish designation to French.
 * Matches the longest prefix from the translation table.
 */
function translateToFrench(designation: string): {
  translated: string;
  wasTranslated: boolean;
} {
  const lower = designation.toLowerCase();

  // Sort ES keys by length (longest first) for greedy matching
  const sortedKeys = Object.keys(ES_TO_FR).sort(
    (a, b) => b.length - a.length
  );

  for (const esKey of sortedKeys) {
    if (lower.startsWith(esKey)) {
      const frValue = ES_TO_FR[esKey];
      // Replace the ES prefix with FR, keep the technical suffix
      const suffix = designation.slice(esKey.length);
      return { translated: frValue + suffix, wasTranslated: true };
    }
  }

  return { translated: designation, wasTranslated: false };
}

// ============================================================
// Extract articles from Excel files
// ============================================================

interface ArticleData {
  designations: Map<string, number>; // designation → count
  sources: Set<string>;
}

const articles = new Map<string, ArticleData>();

function addArticle(
  reference: string,
  designation: string,
  source: string
): void {
  if (!reference || !designation) return;
  const ref = String(reference).trim();
  const des = String(designation).trim();
  if (!ref || !des) return;

  if (!articles.has(ref)) {
    articles.set(ref, { designations: new Map(), sources: new Set() });
  }
  const data = articles.get(ref)!;
  data.designations.set(des, (data.designations.get(des) || 0) + 1);
  data.sources.add(source);
}

async function parseExcel(
  filePath: string,
  articleCol: number,
  designationCol: number,
  source: string,
  startRow: number = 2
): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  let count = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;
    const article = row.getCell(articleCol).value;
    const designation = row.getCell(designationCol).value;
    if (article && designation) {
      addArticle(String(article), String(designation), source);
      count++;
    }
  });

  return count;
}

// ============================================================
// Extract articles from existing JSONB designations
// ============================================================

async function extractFromJsonb(): Promise<number> {
  let count = 0;

  // Offres
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("offres")
      .select("designations")
      .not("designations", "is", null)
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`offres query error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const desigs = row.designations as Array<{
        designation?: string;
        reference_materiel?: string;
      }>;
      if (!Array.isArray(desigs)) continue;
      for (const d of desigs) {
        if (d.reference_materiel && d.designation) {
          addArticle(d.reference_materiel, d.designation, "jsonb_offres");
          count++;
        }
      }
    }
    offset += batchSize;
  }

  // Commandes
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("commandes")
      .select("designations")
      .not("designations", "is", null)
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`commandes query error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const desigs = row.designations as Array<{
        designation?: string;
        reference_materiel?: string;
      }>;
      if (!Array.isArray(desigs)) continue;
      for (const d of desigs) {
        if (d.reference_materiel && d.designation) {
          addArticle(d.reference_materiel, d.designation, "jsonb_commandes");
          count++;
        }
      }
    }
    offset += batchSize;
  }

  return count;
}

// ============================================================
// Choose best French name for each article
// ============================================================

interface PieceRecord {
  reference: string;
  nom_fr: string;
  nom_original: string | null;
  variantes: string[];
}

function isSpanish(text: string): boolean {
  const lower = text.toLowerCase();
  const esKeywords = Object.keys(ES_TO_FR);
  return esKeywords.some((kw) => lower.startsWith(kw));
}

function chooseFrenchName(
  reference: string,
  designations: Map<string, number>
): PieceRecord {
  const allNames = Array.from(designations.entries());

  // Separate FR and non-FR names
  const frNames: Array<[string, number]> = [];
  const esNames: Array<[string, number]> = [];
  const otherNames: Array<[string, number]> = [];

  for (const [name, count] of allNames) {
    if (isSpanish(name)) {
      esNames.push([name, count]);
    } else {
      // Assume French (or technical — treat as FR)
      frNames.push([name, count]);
    }
  }

  let nomFr: string;
  let nomOriginal: string | null = null;
  const variantes: string[] = [];

  if (frNames.length > 0) {
    // Pick the most frequent French name
    frNames.sort((a, b) => b[1] - a[1]);
    nomFr = frNames[0][0];

    // Add other FR names as variantes
    for (let i = 1; i < frNames.length; i++) {
      if (frNames[i][0] !== nomFr) variantes.push(frNames[i][0]);
    }
  } else if (esNames.length > 0) {
    // No French name — translate from Spanish
    esNames.sort((a, b) => b[1] - a[1]);
    const best = esNames[0][0];
    const { translated } = translateToFrench(best);
    nomFr = translated;
    nomOriginal = best;
  } else {
    // Fallback: use the most frequent name
    allNames.sort((a, b) => b[1] - a[1]);
    nomFr = allNames[0][0];
  }

  // Add all ES names as variantes
  for (const [name] of esNames) {
    if (name !== nomOriginal && !variantes.includes(name))
      variantes.push(name);
  }

  return { reference, nom_fr: nomFr, nom_original: nomOriginal, variantes };
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== Import pieces ThermoPack ===\n");

  const basePath = resolve(import.meta.dir, "../docs/nouveaux docs");

  // 1. Parse Excel files
  console.log("1. Parsing Excel files...");

  const count1 = await parseExcel(
    resolve(basePath, "Export offre 2026/EXPORT OFFRES 2021 à 2026.XLSX"),
    4, // Article col
    5, // Désignation col
    "offres_hist"
  );
  console.log(`   OFFRES 2021-2026: ${count1} rows`);

  const count2 = await parseExcel(
    resolve(basePath, "Export offre 2026/EXPORT OFFRES 2026.XLSX"),
    4,
    5,
    "offres_2026"
  );
  console.log(`   OFFRES 2026: ${count2} rows`);

  const count3 = await parseExcel(
    resolve(basePath, "Commandes clients/EXPORT_20260330_100131.XLSX"),
    4,
    5,
    "commandes_hist"
  );
  console.log(`   COMMANDES CLIENTS: ${count3} rows`);

  // 2. Extract from existing JSONB
  console.log("\n2. Extracting from JSONB designations...");
  const countJsonb = await extractFromJsonb();
  console.log(`   JSONB: ${countJsonb} designations`);

  // 3. Build pieces records
  console.log(`\n3. Building pieces (${articles.size} unique articles)...`);

  const pieces: PieceRecord[] = [];
  let translated = 0;
  let withVariantes = 0;

  for (const [reference, data] of articles) {
    const piece = chooseFrenchName(reference, data.designations);
    pieces.push(piece);
    if (piece.nom_original) translated++;
    if (piece.variantes.length > 0) withVariantes++;
  }

  console.log(`   Translated ES→FR: ${translated}`);
  console.log(`   With variantes: ${withVariantes}`);

  // 4. Insert into Supabase
  console.log(`\n4. Inserting ${pieces.length} pieces into DB...`);

  const batchSize = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < pieces.length; i += batchSize) {
    const batch = pieces.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("pieces")
      .upsert(
        batch.map((p) => ({
          reference: p.reference,
          nom_fr: p.nom_fr,
          nom_original: p.nom_original,
          variantes: p.variantes,
        })),
        { onConflict: "reference" }
      )
      .select("id");

    if (error) {
      console.error(`   Batch ${i / batchSize + 1} error: ${error.message}`);
      errors++;
    } else {
      inserted += data?.length || 0;
    }
  }

  console.log(`   Inserted: ${inserted}`);
  if (errors > 0) console.log(`   Batch errors: ${errors}`);

  // 5. Stats
  console.log("\n=== Summary ===");
  console.log(`Total articles: ${articles.size}`);
  console.log(`Inserted into pieces: ${inserted}`);
  console.log(`Translated ES→FR: ${translated}`);
  console.log(`With variantes: ${withVariantes}`);
}

main().catch(console.error);
