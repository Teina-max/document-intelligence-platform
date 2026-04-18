import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";
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

const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });

type ImportType = "offres_detail" | "commandes_detail" | "commandes_summary";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes — max 3 imports par minute" }, { status: 429 });
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (!role || !["admin", "commercial"].includes(role as string)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const file = formData.get("file");
  const type = formData.get("type") as ImportType | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Champ 'file' requis" }, { status: 400 });
  }

  const validTypes: ImportType[] = ["offres_detail", "commandes_detail", "commandes_summary"];
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Champ 'type' requis : ${validTypes.join(" | ")}` },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Seuls les fichiers .xlsx sont acceptés" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 50 MB)" }, { status: 413 });
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const xlsxBuffer = Buffer.from(arrayBuffer) as unknown as ArrayBuffer;

  // Parse with ExcelJS
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(xlsxBuffer);
  } catch (err) {
    console.error("[api/import-excel] ExcelJS load error:", err);
    return NextResponse.json({ error: "Impossible de lire le fichier Excel" }, { status: 422 });
  }

  const ws = workbook.worksheets[0];
  if (!ws) {
    return NextResponse.json({ error: "Aucune feuille trouvée dans le fichier" }, { status: 422 });
  }

  const admin = createAdminClient();
  let result: ImportResult;

  try {
    if (type === "offres_detail") {
      result = await importDetail(ws, "offre", admin);
    } else if (type === "commandes_detail") {
      result = await importDetail(ws, "commande", admin);
    } else {
      result = await importSummary(ws, admin);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/import-excel] import error:", message);
    return NextResponse.json({ error: message }, { status: 422 });
  }

  return NextResponse.json(result);
}

// --------------------------------------------------------
// Offres detail / Commandes detail
// --------------------------------------------------------

async function importDetail(
  ws: ExcelJS.Worksheet,
  type: "offre" | "commande",
  admin: ReturnType<typeof createAdminClient>,
): Promise<ImportResult> {
  const lines = parseDetailWorksheet(ws, type);

  if (lines.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["Aucune ligne valide trouvée"] };
  }

  const docs = aggregateByDocument(lines);

  // Map client names to entreprise IDs
  const clientNames = docs.map((d) => d.clientName);
  const clientMap = await mapClientNames(clientNames, admin);

  const table = type === "offre" ? "offres" : "commandes";
  const rows = docs.map((doc) => ({
    reference: doc.docVente,
    date_doc: toISODate(doc.dateDoc),
    entreprise_id: clientMap.get(doc.clientName) ?? null,
    correspondant: doc.correspondant ?? null,
    date_livraison_requise: toISODate(doc.datLvReq),
    designations: doc.designations,
    source: "excel_sap",
  }));

  return batchUpsert(admin, table, rows, "reference");
}

// --------------------------------------------------------
// Commandes summary
// --------------------------------------------------------

async function importSummary(
  ws: ExcelJS.Worksheet,
  admin: ReturnType<typeof createAdminClient>,
): Promise<ImportResult> {
  const lines = parseSummaryWorksheet(ws);

  if (lines.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["Aucune ligne valide trouvée"] };
  }

  // Resolve donneurOrdre → entreprise_id via numero_client lookup
  const donneurOrdres = [...new Set(lines.map((l) => l.donneurOrdre).filter(Boolean))];
  const clientMap = await mapClientNames(donneurOrdres, admin);

  const rows = lines.map((line) => ({
    reference: line.docCommercial,
    date_doc: toISODate(line.dateDoc),
    entreprise_id: clientMap.get(line.donneurOrdre) ?? null,
    numero_cde_achat: line.numeroCdeAchat || null,
    type_doc_vente: line.typeDocVente || null,
    cree_par: line.creePar || null,
    valeur_nette: line.valeurNette,
    devise: line.devise || null,
    statut_livraison: mapStatutLivraison(line.statut),
    source: "excel_sap",
  }));

  return batchUpsert(admin, "commandes", rows, "reference");
}
