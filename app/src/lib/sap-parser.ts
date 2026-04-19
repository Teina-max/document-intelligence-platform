/**
 * sap-parser.ts
 * Shared module for parsing SAP Excel exports (offres + commandes).
 * Used by both the one-shot import script and the future API endpoint.
 */

import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Types
// ============================================================

export interface SAPDetailLine {
  dateDoc: Date | null;
  docVente: string;
  poste: string;
  article: string;
  designation: string;
  datLvReq: Date | null; // offres only
  clientName: string;
  correspondant: string | null; // offres only (Créé par)
  qtyConfirmee: number;
  type: "offre" | "commande";
}

export interface SAPSummaryLine {
  docCommercial: string;
  numeroCdeAchat: string;
  dateDoc: Date | null;
  typeDocVente: string;
  creePar: string;
  donneurOrdre: string;
  valeurNette: number | null;
  devise: string;
  statut: string;
}

export interface DesignationItem {
  reference_materiel: string;
  designation: string;
  quantite: number;
}

export interface AggregatedDoc {
  docVente: string;
  dateDoc: Date | null;
  clientName: string;
  correspondant: string | null;
  datLvReq: Date | null; // offres only
  designations: DesignationItem[];
  type: "offre" | "commande";
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

// ============================================================
// Header validation
// ============================================================

export function validateHeaders(
  ws: ExcelJS.Worksheet,
  expected: string[]
): void {
  const headerRow = ws.getRow(1);
  const actual: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber <= expected.length) {
      actual.push(String(cell.value ?? "").trim());
    }
  });

  const mismatches: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      mismatches.push(`Col ${i + 1}: expected "${expected[i]}", got "${actual[i]}"`);
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Header mismatch in worksheet "${ws.name}":\n${mismatches.join("\n")}`
    );
  }
}

// ============================================================
// Utility helpers
// ============================================================

export function toISODate(d: Date | null | undefined): string | null {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Maps SAP statut livraison strings to normalized values.
 * SAP uses: "Liquidé", "Non livré", "Partiellement livré" (and variations)
 */
export function mapStatutLivraison(
  sapStatut: string | null | undefined
): string | null {
  if (!sapStatut) return null;
  const s = sapStatut.toLowerCase().trim();
  if (s.includes("liquid") || s === "c") return "liquide";
  if (s.includes("partiell")) return "partiellement_livre";
  if (s.includes("non livr") || s === "a" || s === "b") return "non_livre";
  // Some SAP exports use single letters: A=not shipped, B=partial, C=complete
  return null;
}

function cellValue(
  row: ExcelJS.Row,
  col: number
): ExcelJS.CellValue | undefined {
  return row.getCell(col).value;
}

function cellString(
  row: ExcelJS.Row,
  col: number
): string {
  const v = cellValue(row, col);
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").trim();
  }
  return String(v).trim();
}

function cellDate(row: ExcelJS.Row, col: number): Date | null {
  const v = cellValue(row, col);
  if (!v) return null;
  if (v instanceof Date) return v;
  // ExcelJS sometimes gives a Date-like object
  if (typeof v === "object" && "getTime" in (v as object)) return v as unknown as Date;
  return null;
}

function cellNumber(row: ExcelJS.Row, col: number): number {
  const v = cellValue(row, col);
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ============================================================
// Worksheet parsers
// ============================================================

export const OFFRE_DETAIL_HEADERS = [
  "Date doc.",
  "Doc. vente",
  "Poste",
  "Article",
  "Désignation",
  "Dat.lv.req",
  "Nom 1",
  "SA",
  "Créé par",
  "Qté confirmée",
];

export const COMMANDE_DETAIL_HEADERS = [
  "Date doc.",
  "Doc. vente",
  "Poste",
  "Article",
  "Désignation",
  "Nom 1",
  "Qté confirmée",
];

export const SUMMARY_HEADERS = [
  "Document commercial",
  "Nº commande d'achat",
  "Date du document",
  "Type document vente",
  "Créé par",
  "Donneur d'ordre",
  "Valeur nette",
  "Devise document",
  "Statut",
];

export function parseDetailWorksheet(
  ws: ExcelJS.Worksheet,
  type: "offre" | "commande"
): SAPDetailLine[] {
  const lines: SAPDetailLine[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const dateDoc = cellDate(row, 1);
    if (!dateDoc) return; // skip rows without a date

    const docVente = cellString(row, 2);
    if (!docVente) return;

    const poste = cellString(row, 3);
    const article = cellString(row, 4);
    const designation = cellString(row, 5);

    if (type === "offre") {
      // Offre: datLvReq col 6, Nom 1 col 7, SA col 8, Créé par col 9, Qté confirmée col 10
      const datLvReq = cellDate(row, 6);
      const clientName = cellString(row, 7);
      const correspondant = cellString(row, 9) || null;
      const qty = cellNumber(row, 10);

      lines.push({
        dateDoc,
        docVente,
        poste,
        article,
        designation,
        datLvReq,
        clientName,
        correspondant,
        qtyConfirmee: qty,
        type: "offre",
      });
    } else {
      // Commande: Nom 1 col 6, Qté confirmée col 7
      const clientName = cellString(row, 6);
      const qty = cellNumber(row, 7);

      lines.push({
        dateDoc,
        docVente,
        poste,
        article,
        designation,
        datLvReq: null,
        clientName,
        correspondant: null,
        qtyConfirmee: qty,
        type: "commande",
      });
    }
  });

  return lines;
}

export function parseSummaryWorksheet(ws: ExcelJS.Worksheet): SAPSummaryLine[] {
  const lines: SAPSummaryLine[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const docCommercial = cellString(row, 1);
    if (!docCommercial) return;

    lines.push({
      docCommercial,
      numeroCdeAchat: cellString(row, 2),
      dateDoc: cellDate(row, 3),
      typeDocVente: cellString(row, 4),
      creePar: cellString(row, 5),
      donneurOrdre: cellString(row, 6),
      valeurNette: cellNumber(row, 7) || null,
      devise: cellString(row, 8),
      statut: cellString(row, 9),
    });
  });

  return lines;
}

// ============================================================
// Aggregation
// ============================================================

/**
 * Groups detail lines by doc_vente.
 * SAP artefact: same (doc_vente, poste, article) may appear with qty=0 AND qty>0.
 * Takes MAX(qty) per position, then filters out zero-qty positions.
 */
export function aggregateByDocument(lines: SAPDetailLine[]): AggregatedDoc[] {
  // Group by docVente
  const docMap = new Map<
    string,
    {
      dateDoc: Date | null;
      clientName: string;
      correspondant: string | null;
      datLvReq: Date | null;
      type: "offre" | "commande";
      // key: `${poste}|${article}` → max qty
      positions: Map<string, { article: string; designation: string; qty: number }>;
    }
  >();

  for (const line of lines) {
    if (!docMap.has(line.docVente)) {
      docMap.set(line.docVente, {
        dateDoc: line.dateDoc,
        clientName: line.clientName,
        correspondant: line.correspondant,
        datLvReq: line.datLvReq,
        type: line.type,
        positions: new Map(),
      });
    }

    const doc = docMap.get(line.docVente)!;
    const posKey = `${line.poste}|${line.article}`;
    const existing = doc.positions.get(posKey);

    if (!existing || line.qtyConfirmee > existing.qty) {
      doc.positions.set(posKey, {
        article: line.article,
        designation: line.designation,
        qty: line.qtyConfirmee,
      });
    }
  }

  const result: AggregatedDoc[] = [];

  for (const [docVente, doc] of docMap) {
    const designations: DesignationItem[] = [];

    for (const pos of doc.positions.values()) {
      if (pos.qty > 0) {
        designations.push({
          reference_materiel: pos.article,
          designation: pos.designation,
          quantite: pos.qty,
        });
      }
    }

    result.push({
      docVente,
      dateDoc: doc.dateDoc,
      clientName: doc.clientName,
      correspondant: doc.correspondant,
      datLvReq: doc.datLvReq,
      designations,
      type: doc.type,
    });
  }

  return result;
}

// ============================================================
// Client name mapping
// ============================================================

/**
 * Matches client names to entreprise_id via match_entreprise RPC.
 * Creates new entreprise records for unmatched names.
 * Returns a Map<clientName, entreprise_id>.
 */
export async function mapClientNames(
  names: string[],
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uniqueNames = [...new Set(names.filter(Boolean))];

  for (const name of uniqueNames) {
    // Try RPC match first
    const { data: matchedId, error } = await supabase.rpc("match_entreprise", {
      p_nom: name,
      p_code_postal: null,
    });

    if (!error && matchedId) {
      result.set(name, matchedId as string);
      continue;
    }

    // No match — create new entreprise
    const { data: newEnt, error: insertError } = await supabase
      .from("entreprises")
      .insert({ nom: name })
      .select("id")
      .single();

    if (!insertError && newEnt) {
      result.set(name, newEnt.id);
    } else {
      console.error(`Failed to create entreprise for "${name}":`, insertError?.message);
    }
  }

  return result;
}

// ============================================================
// Batch upsert
// ============================================================

/**
 * Batch upsert rows into a Supabase table with ON CONFLICT DO NOTHING.
 */
export async function batchUpsert<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  conflictColumn: string,
  batchSize = 100
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from(table)
      .upsert(batch, {
        onConflict: conflictColumn,
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      result.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
    } else {
      const inserted = data?.length ?? 0;
      result.inserted += inserted;
      result.skipped += batch.length - inserted;
    }
  }

  return result;
}
