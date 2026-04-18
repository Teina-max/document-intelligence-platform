#!/usr/bin/env bun
/**
 * Seed the anonymized Supabase demo project with:
 * - 20 fake entreprises (from scripts/fixtures/fake-clients.json)
 * - 40 fake pieces      (from scripts/fixtures/fake-pieces.json)
 * - 6 offres + 12 commandes (from demo-pdfs/manifest.json)
 *
 * Idempotent: clears tables first (safe on a demo project).
 *
 * Requires env vars loaded from app/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_PROJECT_ID   (must match the approved demo project)
 *
 * Optional safety (for this fork only):
 *   FORBIDDEN_SUPABASE_REFS = comma-separated list of refs the script
 *   MUST refuse to run against. Loaded from .env.local; if empty, no
 *   ref-level guard is applied and the script trusts SUPABASE_PROJECT_ID.
 *
 * Run from portfolio root:
 *   bun scripts/seed-demo-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/* ------------------------------------------------------------------ */
/*  1. Load env from app/.env.local                                     */
/* ------------------------------------------------------------------ */

const envFile = readFileSync(join(ROOT, "app/.env.local"), "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_ID = env.SUPABASE_PROJECT_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !PROJECT_ID) {
  console.error("Missing env vars in app/.env.local");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  2. Safety guard — refuse known-forbidden refs                       */
/* ------------------------------------------------------------------ */

const forbiddenRefs = (env.FORBIDDEN_SUPABASE_REFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

for (const ref of forbiddenRefs) {
  if (PROJECT_ID === ref || SUPABASE_URL.includes(ref)) {
    console.error(`REFUSED: target project ref is in FORBIDDEN_SUPABASE_REFS.`);
    console.error("See .claude/rules/supabase-prod-protection.md.");
    process.exit(1);
  }
}
console.log(`target project: ${PROJECT_ID}`);
console.log(`target URL:     ${SUPABASE_URL}`);

/* ------------------------------------------------------------------ */
/*  3. Load fixtures                                                    */
/* ------------------------------------------------------------------ */

type FakeClient = {
  id: string;
  nom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: "FR" | "ES";
  contact_nom: string;
  contact_telephone: string;
  contact_email: string;
  numero_client: string;
};
type FakePiece = {
  reference: string;
  nom_fr: string;
  categorie: string;
  prix_unitaire: number;
};
type ManifestOffre = {
  reference: string;
  client: string;
  numero_client: string;
  date: string;
  expirationDate: string;
  correspondant: string;
  pays: "FR" | "ES";
  lines: number;
  somme_articles: number;
  montant_ht: number;
  montant_ttc: number;
};
type ManifestCommande = {
  reference: string;
  offreRef: string | null;
  numero_commande_client: string;
  client: string;
  numero_client: string;
  dateCommande: string;
  dateExpedition: string;
  correspondant: string;
  pays: "FR" | "ES";
  lines: number;
  somme_articles: number;
  montant_ht: number;
  montant_ttc: number;
  directe: boolean;
  remise_cascade: number[] | null;
};

const clients: FakeClient[] = JSON.parse(
  readFileSync(join(ROOT, "scripts/fixtures/fake-clients.json"), "utf-8"),
);
const pieces: FakePiece[] = JSON.parse(
  readFileSync(join(ROOT, "scripts/fixtures/fake-pieces.json"), "utf-8"),
);
const manifest: { offres: ManifestOffre[]; commandes: ManifestCommande[] } = JSON.parse(
  readFileSync(join(ROOT, "demo-pdfs/manifest.json"), "utf-8"),
);

console.log(`fixtures: ${clients.length} clients, ${pieces.length} pieces`);
console.log(`manifest: ${manifest.offres.length} offres, ${manifest.commandes.length} commandes`);

/* ------------------------------------------------------------------ */
/*  4. Supabase client                                                  */
/* ------------------------------------------------------------------ */

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ------------------------------------------------------------------ */
/*  5. Seed                                                             */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  // --- 5.1 Clear existing demo data -----------------------------------
  console.log("\n[1/5] clearing tables…");
  const tables = [
    "commande_lignes",
    "offre_lignes",
    "commandes",
    "offres",
    "pieces",
    "entreprises",
  ];
  for (const t of tables) {
    const { error } = await supabase
      .from(t)
      .delete()
      .gte("created_at", "1970-01-01");
    if (error && !error.message.includes("does not exist")) {
      console.warn(`  warn (${t}): ${error.message}`);
    }
  }

  // --- 5.2 Entreprises ------------------------------------------------
  console.log("\n[2/5] inserting entreprises…");
  const { data: insEntreprises, error: eEntreprises } = await supabase
    .from("entreprises")
    .insert(
      clients.map((c) => ({
        nom: c.nom,
        code_postal: c.code_postal,
        pays: c.pays,
        adresse: `${c.adresse}, ${c.ville}`,
        contact_nom: c.contact_nom,
        contact_email: c.contact_email,
        contact_telephone: c.contact_telephone,
      })),
    )
    .select("id, nom");
  if (eEntreprises) throw eEntreprises;
  const entrepriseIdByNom = new Map<string, string>();
  for (const row of insEntreprises ?? []) entrepriseIdByNom.set(row.nom, row.id);
  console.log(`  inserted ${insEntreprises?.length ?? 0} entreprises`);

  // --- 5.3 Pieces -----------------------------------------------------
  console.log("\n[3/5] inserting pieces…");
  const { error: ePieces } = await supabase.from("pieces").insert(
    pieces.map((p) => ({
      reference: p.reference,
      nom_fr: p.nom_fr,
      nom_original: p.nom_fr,
      categorie: p.categorie,
    })),
  );
  if (ePieces) console.warn(`  warn: ${ePieces.message}`);
  else console.log(`  inserted ${pieces.length} pieces`);

  // --- 5.4 Offres -----------------------------------------------------
  console.log("\n[4/5] inserting offres…");
  const offreRows = manifest.offres.map((o) => ({
    reference_offre: o.reference,
    entreprise_id: entrepriseIdByNom.get(o.client),
    montant_ht: o.montant_ht,
    montant_ttc: o.montant_ttc,
    date_offre: o.date,
    date_expiration: o.expirationDate,
    statut: "en_attente" as const,
    correspondant: o.correspondant,
    designations: [],
    fichier_source: `demo-pdfs/offres/${o.reference}_${o.client
      .replace(/\s+/g, "_")
      .toUpperCase()}.pdf`,
  }));
  const { data: insOffres, error: eOffres } = await supabase
    .from("offres")
    .insert(offreRows)
    .select("id, reference_offre");
  if (eOffres) throw eOffres;
  const offreIdByRef = new Map<string, string>();
  for (const row of insOffres ?? []) offreIdByRef.set(row.reference_offre, row.id);
  console.log(`  inserted ${insOffres?.length ?? 0} offres`);

  // --- 5.5 Commandes --------------------------------------------------
  console.log("\n[5/5] inserting commandes…");
  const commandeRows = manifest.commandes.map((c) => {
    const offreId = c.offreRef ? offreIdByRef.get(c.offreRef) ?? null : null;
    // Determine type: directe if no offre, else compute by montant
    let type: "partielle" | "egale" | "superieure" | "directe";
    if (!offreId) {
      type = "directe";
    } else {
      const offre = manifest.offres.find((o) => o.reference === c.offreRef);
      if (!offre) type = "directe";
      else if (c.montant_ht < offre.montant_ht * 0.98) type = "partielle";
      else if (c.montant_ht > offre.montant_ht * 1.02) type = "superieure";
      else type = "egale";
    }
    return {
      reference_commande: c.reference,
      offre_id: offreId,
      entreprise_id: entrepriseIdByNom.get(c.client),
      montant_ht: c.montant_ht,
      montant_ttc: c.montant_ttc,
      date_commande: c.dateCommande,
      date_expedition: c.dateExpedition,
      type,
      designations: [],
      fichier_source: `demo-pdfs/commandes/${c.reference}_${c.client
        .replace(/\s+/g, "_")
        .toUpperCase()}.pdf`,
    };
  });
  const { data: insCommandes, error: eCommandes } = await supabase
    .from("commandes")
    .insert(commandeRows)
    .select("id, reference_commande");
  if (eCommandes) throw eCommandes;
  console.log(`  inserted ${insCommandes?.length ?? 0} commandes`);

  // --- 5.6 Update offres statut based on commandes --------------------
  console.log("\n[post] updating offre statut…");
  for (const [offreRef, offreId] of offreIdByRef.entries()) {
    const linkedCommandes = manifest.commandes.filter(
      (c) => c.offreRef === offreRef,
    );
    if (linkedCommandes.length === 0) continue;
    const offre = manifest.offres.find((o) => o.reference === offreRef);
    if (!offre) continue;
    const totalCommandes = linkedCommandes.reduce((s, c) => s + c.montant_ht, 0);
    const statut = totalCommandes >= offre.montant_ht * 0.98 ? "transformee" : "partiellement_transformee";
    await supabase.from("offres").update({ statut }).eq("id", offreId);
  }
  console.log("  done");

  console.log("\n✓ seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
