/**
 * Fix remaining Spanish names in pieces.nom_fr
 *
 * Comprehensive ES→FR translation of piece designations.
 * Handles compound words and technical suffixes.
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

// Comprehensive ES→FR translation (longest match first)
const ES_TO_FR: [RegExp, string][] = [
  // Compound terms (must come first - longest match)
  [/^accionamiento de roscado de la bobina/i, "entraînement de filetage de la bobine"],
  [/^accionamiento de tornillo sinfín/i, "entraînement à vis sans fin"],
  [/^caballete del rodamiento/i, "chevalet de roulement"],
  [/^carcasa del rodamiento/i, "carter de roulement"],
  [/^chapa de guía/i, "tôle de guidage"],
  [/^clavija de válvula/i, "fiche de vanne"],
  [/^desvío de cadena/i, "déviation de chaîne"],
  [/^disco de correa dentada/i, "disque de courroie dentée"],
  [/^disco de leva/i, "disque de came"],
  [/^disco de tensión/i, "disque de tension"],
  [/^dispositivo de descarga/i, "dispositif de décharge"],
  [/^elementos de resorte/i, "éléments de ressort"],
  [/^entrada analógica/i, "entrée analogique"],
  [/^eslabón de cadena con perno/i, "maillon de chaîne avec axe"],
  [/^husillo de rosca de bolas/i, "vis à billes"],
  [/^juego de cables/i, "jeu de câbles"],
  [/^juego de mantenimiento/i, "kit de maintenance"],
  [/^juego de reparación/i, "kit de réparation"],
  [/^leva de desvío/i, "came de déviation"],
  [/^módulo de entrada/i, "module d'entrée"],
  [/^motorreductor de tornillo sinfín/i, "motoréducteur à vis sans fin"],
  [/^motorreductor freno/i, "motoréducteur frein"],
  [/^muelle de ajuste/i, "clavette d'ajustement"],
  [/^muelle de compresión/i, "ressort de compression"],
  [/^palanca extractora/i, "levier extracteur"],
  [/^perno de fijación/i, "axe de fixation"],
  [/^perno de la palanca articulada/i, "axe de la genouillère"],
  [/^perno de sujeción/i, "axe de serrage"],
  [/^perno del borde/i, "axe de bord"],
  [/^perno del rodamiento/i, "axe de roulement"],
  [/^perno distanciador/i, "axe entretoise"],
  [/^perno receptor/i, "axe récepteur"],
  [/^perno rotativo/i, "axe rotatif"],
  [/^placa del rodamiento/i, "plaque de roulement"],
  [/^placa portaventosas/i, "plaque porte-ventouses"],
  [/^rodamiento con soporte abridado/i, "roulement à bride"],
  [/^rodamiento de bolillas ranuradas/i, "roulement à billes"],
  [/^rodamiento de cilindro/i, "roulement à rouleaux cylindriques"],
  [/^rodamiento de rodillos cónicos/i, "roulement à rouleaux coniques"],
  [/^rodamiento del marco de fijación/i, "roulement du cadre de fixation"],
  [/^rodamiento deslizante/i, "palier lisse"],
  [/^rodamiento oscilante a rodillos/i, "roulement oscillant à rouleaux"],
  [/^rueda con pinchos/i, "roue à picots"],
  [/^rueda dentada/i, "roue dentée"],
  [/^sinfín de rosca trapezoidal/i, "vis trapézoïdale"],
  [/^sinfín de ajuste/i, "vis sans fin de réglage"],
  [/^support del cilindro/i, "support du cylindre"],
  [/^taco de tope del ángulo/i, "butée d'angle"],
  [/^tapa del rodamiento/i, "couvercle de roulement"],
  [/^barra de tracción/i, "barre de traction"],
  [/^bloque de alimentación/i, "bloc d'alimentation"],
  [/^caño de cilindro/i, "tube de cylindre"],
  [/^freno_EP_juego_engranaje cónico/i, "frein_EP_jeu_engrenage conique"],
  [/^ángulo de soporte/i, "équerre de support"],
  [/^pantalla_arriba/i, "écran_haut"],

  // Simple terms
  [/^accionamiento/i, "entraînement"],
  [/^ángulo/i, "équerre"],
  [/^cubierta/i, "couvercle"],
  [/^desvío/i, "déviation"],
  [/^motorreductor/i, "motoréducteur"],
  [/^perno/i, "axe"],
  [/^rodamiento/i, "roulement"],
  [/^sinfín/i, "vis sans fin"],

  // Directional suffixes (for partial translations like "arbre_descarga")
  [/^arbre_descarga/i, "arbre_de déchargement"],
  [/^arbre_entrada/i, "arbre_d'entrée"],
  [/^arbre de accionamiento/i, "arbre d'entraînement"],
  [/^lame de corte/i, "lame de coupe"],
  [/^bride, arriba/i, "bride, haut"],
];

// Spanish positional words appearing in suffixes
const ES_SUFFIX_REPLACEMENTS: [RegExp, string][] = [
  [/arriba/gi, "haut"],
  [/abajo/gi, "bas"],
  [/izquierda/gi, "gauche"],
  [/derecha/gi, "droite"],
  [/entrada/gi, "entrée"],
  [/descarga/gi, "déchargement"],
  [/salida/gi, "sortie"],
  [/lado operador/gi, "côté opérateur"],
  [/frente al lado/gi, "face côté"],
  [/compartido/gi, "partagé"],
  [/completo/gi, "complet"],
  [/especial/gi, "spécial"],
];

function translateName(name: string): string | null {
  let translated = name;
  let changed = false;

  // Try prefix replacements (longest match first - already sorted)
  for (const [pattern, replacement] of ES_TO_FR) {
    if (pattern.test(translated)) {
      translated = translated.replace(pattern, replacement);
      changed = true;
      break;
    }
  }

  // Apply suffix replacements for remaining Spanish words
  for (const [pattern, replacement] of ES_SUFFIX_REPLACEMENTS) {
    if (pattern.test(translated)) {
      translated = translated.replace(pattern, replacement);
      changed = true;
    }
  }

  return changed ? translated : null;
}

async function main() {
  console.log("=== Fix Spanish names in pieces ===\n");

  // Fetch all pieces
  let allPieces: Array<{ id: string; nom_fr: string; nom_original: string | null }> = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("pieces")
      .select("id, nom_fr, nom_original")
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allPieces = allPieces.concat(data);
    offset += batchSize;
  }

  console.log(`Total pieces: ${allPieces.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const piece of allPieces) {
    const newName = translateName(piece.nom_fr);
    if (!newName) continue;

    // Update piece
    const updateData: Record<string, string | null> = { nom_fr: newName };

    // If nom_original was null, save the old Spanish name
    if (!piece.nom_original) {
      updateData.nom_original = piece.nom_fr;
    }

    const { error } = await supabase
      .from("pieces")
      .update(updateData)
      .eq("id", piece.id);

    if (error) {
      console.error(`  Error updating ${piece.id}: ${error.message}`);
      skipped++;
    } else {
      fixed++;
      if (fixed <= 15) {
        console.log(`  ${piece.nom_fr}  →  ${newName}`);
      }
    }
  }

  console.log(`\nFixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);

  // Verify remaining
  const { data: remaining } = await supabase
    .from("pieces")
    .select("nom_fr")
    .or(
      "nom_fr.ilike.%válvula%,nom_fr.ilike.%rueda%,nom_fr.ilike.%rodamiento%,nom_fr.ilike.%perno%,nom_fr.ilike.%sinfín%,nom_fr.ilike.%desvío%,nom_fr.ilike.%accionamiento%,nom_fr.ilike.%husillo%,nom_fr.ilike.%juego de%,nom_fr.ilike.%motorreductor%"
    );

  console.log(`\nRemaining with Spanish keywords: ${remaining?.length || 0}`);
  if (remaining && remaining.length > 0) {
    for (const r of remaining.slice(0, 10)) {
      console.log(`  - ${r.nom_fr}`);
    }
  }
}

main().catch(console.error);
