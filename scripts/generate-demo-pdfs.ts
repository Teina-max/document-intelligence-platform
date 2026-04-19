#!/usr/bin/env bun
/**
 * Generate 18 demo PDFs (6 offres + 12 commandes) using fake-clients
 * and fake-pieces fixtures. Layout mirrors the real OCR target so the
 * Claude Vision pipeline (workflows/prompts/ocr-extraction.md) can
 * extract the same fields.
 *
 * Run from the portfolio root:
 *   bun scripts/generate-demo-pdfs.ts
 *
 * Output:
 *   demo-pdfs/offres/<ref>-<client>.pdf    — 6 files
 *   demo-pdfs/commandes/<ref>-<client>.pdf — 12 files
 *   demo-pdfs/manifest.json                — index with expected values
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";

type Client = {
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

type Piece = {
  reference: string;
  nom_fr: string;
  categorie: string;
  prix_unitaire: number;
};

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = join(ROOT, "demo-pdfs");

const clients: Client[] = await Bun.file(join(ROOT, "scripts/fixtures/fake-clients.json")).json();
const pieces: Piece[] = await Bun.file(join(ROOT, "scripts/fixtures/fake-pieces.json")).json();

/* ------------------------------------------------------------------ */
/*  Scenario: 6 offres + 12 commandes                                  */
/*  - 4 offres FR, 2 offres ES                                         */
/*  - 8 commandes liées à une offre (2 partielles, 1 supérieure,      */
/*    1 avec remise cascadée, 4 "égales")                              */
/*  - 4 commandes directes (no offre)                                  */
/* ------------------------------------------------------------------ */

type OffreDraft = {
  reference: string;         // 504xxxxx
  client: Client;
  date: string;              // YYYY-MM-DD
  expirationDate: string;    // YYYY-MM-DD
  correspondant: string;     // ThermoPack rep
  lines: Array<{ piece: Piece; quantite: number }>;
  fraisTransport: number;
  fraisEmballage: number;
  tvaRate: number;           // 0.20 or 0.00
};

type CommandeDraft = {
  reference: string;         // 704xxxxx
  offreRef: string | null;   // link to offre or null
  client: Client;
  dateCommande: string;
  dateExpedition: string;
  numeroCommandeClient: string; // customer PO
  correspondant: string;
  lines: Array<{ piece: Piece; quantite: number }>;
  fraisTransport: number;
  fraisEmballage: number;
  tvaRate: number;
  remiseCascade?: number[];  // e.g., [0.20, 0.11] => -20% then -11%
};

const correspondantsFR = ["Éric MARTIN", "Isabelle BERTRAND", "Marc LEFEVRE"];
const correspondantsES = ["Carmen ROJAS", "Pablo NAVARRO"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function piecesFor(indices: number[]): Piece[] { return indices.map((i) => pieces[i]); }

/* ------------------------------------------------------------------ */
/*  Build the data                                                      */
/* ------------------------------------------------------------------ */

const offres: OffreDraft[] = [
  {
    reference: "50400101",
    client: clients[0], // Polymax SA (FR)
    date: "2026-03-02",
    expirationDate: "2026-04-02",
    correspondant: correspondantsFR[0],
    lines: [
      { piece: pieces[0], quantite: 4 },
      { piece: pieces[8], quantite: 12 },
      { piece: pieces[12], quantite: 2 },
    ],
    fraisTransport: 130.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
  {
    reference: "50400102",
    client: clients[1], // NordPack Annecy
    date: "2026-03-10",
    expirationDate: "2026-04-10",
    correspondant: correspondantsFR[1],
    lines: [
      { piece: pieces[25], quantite: 1 },
      { piece: pieces[21], quantite: 4 },
      { piece: pieces[18], quantite: 6 },
    ],
    fraisTransport: 95.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
  {
    reference: "50400103",
    client: clients[4], // PolyPress (ES)
    date: "2026-03-14",
    expirationDate: "2026-04-14",
    correspondant: correspondantsES[0],
    lines: [
      { piece: pieces[3], quantite: 6 },
      { piece: pieces[4], quantite: 4 },
      { piece: pieces[13], quantite: 1 },
      { piece: pieces[32], quantite: 10 },
    ],
    fraisTransport: 250.0,
    fraisEmballage: 60.0,
    tvaRate: 0.21, // ES TVA
  },
  {
    reference: "50400104",
    client: clients[6], // Solera Industries
    date: "2026-03-20",
    expirationDate: "2026-04-20",
    correspondant: correspondantsFR[2],
    lines: [
      { piece: pieces[28], quantite: 1 },
      { piece: pieces[30], quantite: 2 },
      { piece: pieces[37], quantite: 4 },
    ],
    fraisTransport: 120.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
  {
    reference: "50400105",
    client: clients[13], // Uria Forming (ES)
    date: "2026-03-25",
    expirationDate: "2026-04-25",
    correspondant: correspondantsES[1],
    lines: [
      { piece: pieces[16], quantite: 2 },
      { piece: pieces[22], quantite: 2 },
      { piece: pieces[9], quantite: 8 },
      { piece: pieces[33], quantite: 20 },
    ],
    fraisTransport: 340.0,
    fraisEmballage: 85.0,
    tvaRate: 0.21,
  },
  {
    reference: "50400106",
    client: clients[11], // Sigma Plastics
    date: "2026-03-28",
    expirationDate: "2026-04-28",
    correspondant: correspondantsFR[0],
    lines: [
      { piece: pieces[1], quantite: 2 },
      { piece: pieces[5], quantite: 2 },
      { piece: pieces[34], quantite: 5 },
      { piece: pieces[19], quantite: 8 },
    ],
    fraisTransport: 110.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
];

const commandes: CommandeDraft[] = [
  // -- 8 linked to an offre --
  {
    reference: "70400201",
    offreRef: "50400101",
    client: clients[0],
    dateCommande: "2026-03-12",
    dateExpedition: "2026-03-26",
    numeroCommandeClient: "PO-PMX-0419",
    correspondant: correspondantsFR[0],
    lines: [
      { piece: pieces[0], quantite: 4 },
      { piece: pieces[8], quantite: 12 },
      { piece: pieces[12], quantite: 2 },
    ],
    fraisTransport: 130.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
  {
    // partielle — only 2 of 3 lines from offre 102
    reference: "70400202",
    offreRef: "50400102",
    client: clients[1],
    dateCommande: "2026-03-18",
    dateExpedition: "2026-04-01",
    numeroCommandeClient: "NP-22-00814",
    correspondant: correspondantsFR[1],
    lines: [
      { piece: pieces[21], quantite: 4 },
      { piece: pieces[18], quantite: 4 },
    ],
    fraisTransport: 65.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
  {
    // partielle #2 — partial volumes on offre 106
    reference: "70400203",
    offreRef: "50400106",
    client: clients[11],
    dateCommande: "2026-04-02",
    dateExpedition: "2026-04-15",
    numeroCommandeClient: "SP-2026-114",
    correspondant: correspondantsFR[0],
    lines: [
      { piece: pieces[1], quantite: 1 },
      { piece: pieces[5], quantite: 2 },
      { piece: pieces[34], quantite: 3 },
    ],
    fraisTransport: 80.0,
    fraisEmballage: 30.0,
    tvaRate: 0.20,
  },
  {
    // cascade remise -20% then -11% on offre 103
    reference: "70400204",
    offreRef: "50400103",
    client: clients[4],
    dateCommande: "2026-03-26",
    dateExpedition: "2026-04-08",
    numeroCommandeClient: "PPR-24-31",
    correspondant: correspondantsES[0],
    lines: [
      { piece: pieces[3], quantite: 6 },
      { piece: pieces[4], quantite: 4 },
      { piece: pieces[13], quantite: 1 },
      { piece: pieces[32], quantite: 10 },
    ],
    fraisTransport: 250.0,
    fraisEmballage: 60.0,
    tvaRate: 0.21,
    remiseCascade: [0.20, 0.11],
  },
  {
    // supérieure — larger volumes than offre 104
    reference: "70400205",
    offreRef: "50400104",
    client: clients[6],
    dateCommande: "2026-04-04",
    dateExpedition: "2026-04-18",
    numeroCommandeClient: "SOL-26-907",
    correspondant: correspondantsFR[2],
    lines: [
      { piece: pieces[28], quantite: 2 },
      { piece: pieces[30], quantite: 3 },
      { piece: pieces[37], quantite: 6 },
      { piece: pieces[35], quantite: 2 }, // extra line
    ],
    fraisTransport: 150.0,
    fraisEmballage: 45.0,
    tvaRate: 0.20,
  },
  {
    reference: "70400206",
    offreRef: "50400105",
    client: clients[13],
    dateCommande: "2026-04-05",
    dateExpedition: "2026-04-19",
    numeroCommandeClient: "UF-26-02211",
    correspondant: correspondantsES[1],
    lines: [
      { piece: pieces[16], quantite: 2 },
      { piece: pieces[22], quantite: 2 },
      { piece: pieces[9], quantite: 8 },
      { piece: pieces[33], quantite: 20 },
    ],
    fraisTransport: 340.0,
    fraisEmballage: 85.0,
    tvaRate: 0.21,
  },
  {
    reference: "70400207",
    offreRef: "50400101",
    client: clients[0],
    dateCommande: "2026-04-10",
    dateExpedition: "2026-04-24",
    numeroCommandeClient: "PO-PMX-0488",
    correspondant: correspondantsFR[0],
    lines: [{ piece: pieces[0], quantite: 2 }],
    fraisTransport: 45.0,
    fraisEmballage: 15.0,
    tvaRate: 0.20,
  },
  {
    reference: "70400208",
    offreRef: "50400106",
    client: clients[11],
    dateCommande: "2026-04-12",
    dateExpedition: "2026-04-26",
    numeroCommandeClient: "SP-2026-142",
    correspondant: correspondantsFR[0],
    lines: [{ piece: pieces[19], quantite: 8 }],
    fraisTransport: 40.0,
    fraisEmballage: 15.0,
    tvaRate: 0.20,
  },
  // -- 4 commandes directes (no offre) --
  {
    reference: "70400301",
    offreRef: null,
    client: clients[2], // AgriForm
    dateCommande: "2026-03-30",
    dateExpedition: "2026-04-13",
    numeroCommandeClient: "AGR-26-4001",
    correspondant: correspondantsFR[1],
    lines: [
      { piece: pieces[36], quantite: 1 },
      { piece: pieces[35], quantite: 1 },
    ],
    fraisTransport: 60.0,
    fraisEmballage: 20.0,
    tvaRate: 0.20,
  },
  {
    reference: "70400302",
    offreRef: null,
    client: clients[9], // Apteca
    dateCommande: "2026-04-01",
    dateExpedition: "2026-04-15",
    numeroCommandeClient: "APT-26-218",
    correspondant: correspondantsFR[2],
    lines: [
      { piece: pieces[17], quantite: 1 },
      { piece: pieces[20], quantite: 4 },
      { piece: pieces[9], quantite: 4 },
    ],
    fraisTransport: 85.0,
    fraisEmballage: 25.0,
    tvaRate: 0.20,
  },
  {
    reference: "70400303",
    offreRef: null,
    client: clients[18], // Termoformados Iberia (ES)
    dateCommande: "2026-04-03",
    dateExpedition: "2026-04-17",
    numeroCommandeClient: "TFI-26-0099",
    correspondant: correspondantsES[0],
    lines: [
      { piece: pieces[2], quantite: 4 },
      { piece: pieces[6], quantite: 1 },
      { piece: pieces[14], quantite: 1 },
    ],
    fraisTransport: 285.0,
    fraisEmballage: 70.0,
    tvaRate: 0.21,
  },
  {
    reference: "70400304",
    offreRef: null,
    client: clients[14], // FrostForm
    dateCommande: "2026-04-08",
    dateExpedition: "2026-04-22",
    numeroCommandeClient: "FF-2026-0321",
    correspondant: correspondantsFR[2],
    lines: [
      { piece: pieces[29], quantite: 2 },
      { piece: pieces[23], quantite: 12 },
    ],
    fraisTransport: 70.0,
    fraisEmballage: 22.0,
    tvaRate: 0.20,
  },
];

/* ------------------------------------------------------------------ */
/*  Totals calculator                                                   */
/* ------------------------------------------------------------------ */

function computeTotals(
  lines: Array<{ piece: Piece; quantite: number }>,
  frais: { transport: number; emballage: number; tvaRate: number; remiseCascade?: number[] },
) {
  let sommeArticles = lines.reduce(
    (s, l) => s + l.quantite * l.piece.prix_unitaire,
    0,
  );
  for (const r of frais.remiseCascade ?? []) {
    sommeArticles = sommeArticles * (1 - r);
  }
  const ht = sommeArticles + frais.transport + frais.emballage;
  const tva = ht * frais.tvaRate;
  const ttc = ht + tva;
  return { sommeArticles, ht, tva, ttc };
}

/* ------------------------------------------------------------------ */
/*  Formatters                                                          */
/* ------------------------------------------------------------------ */

function fmtEur(n: number): string {
  // European format: 6.174,00 EUR (period=thousands, comma=decimals)
  const parts = n.toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intPart},${parts[1]}`;
}

function fmtDateFR(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function fmtDateES(iso: string): string {
  return fmtDateFR(iso);
}

/* ------------------------------------------------------------------ */
/*  PDF rendering                                                       */
/* ------------------------------------------------------------------ */

type DocType = "offre" | "commande";

async function renderPDF(type: DocType, o: OffreDraft | CommandeDraft): Promise<Buffer> {
  const lang = (o as any).client.pays === "ES" ? "ES" : "FR";
  const isOffre = type === "offre";
  const o2 = o as any;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const donePromise = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Header: ThermoPack sender
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("ThermoPack Industries", 50, 50);
  doc
    .font("Helvetica")
    .fontSize(9)
    .text("Machines de thermoformage • Pièces détachées", 50, 72)
    .text("12 Rue de l'Industrie · 69200 Vénissieux · France", 50, 86)
    .text("sav@thermopack.example · +33 4 72 00 00 00", 50, 100);

  // Client address block (right)
  const client: Client = o.client;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(client.nom, 340, 50, { width: 200 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .text(client.adresse, 340, 66, { width: 200 })
    .text(`${client.code_postal} ${client.ville}`, 340, 80, { width: 200 })
    .text(client.pays === "FR" ? "FRANCE" : "ESPAÑA", 340, 94, { width: 200 });

  // Title
  doc.moveDown(2);
  const titleText =
    isOffre
      ? lang === "FR" ? "OFFRE" : "OFERTA"
      : lang === "FR" ? "CONFIRMATION DE COMMANDE" : "CONFIRMACIÓN DE PEDIDO";
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(titleText, 50, 140);

  // Metadata grid
  let y = 170;
  doc.font("Helvetica-Bold").fontSize(9);
  if (isOffre) {
    doc.text(lang === "FR" ? "N° de référence :" : "Nº de referencia:", 50, y);
    doc.text(lang === "FR" ? "Date :" : "Fecha:", 250, y);
    doc.text(lang === "FR" ? "Valable jusqu'au :" : "Válido hasta:", 400, y);
    doc.font("Helvetica");
    doc.text(o.reference, 140, y);
    doc.text(lang === "FR" ? fmtDateFR(o2.date) : fmtDateES(o2.date), 285, y);
    doc.text(lang === "FR" ? fmtDateFR(o2.expirationDate) : fmtDateES(o2.expirationDate), 485, y);
  } else {
    doc.text(lang === "FR" ? "N° de commande :" : "Nº de pedido:", 50, y);
    doc.text(lang === "FR" ? "Date :" : "Fecha:", 250, y);
    doc.text(lang === "FR" ? "Date expédition :" : "Fecha envío:", 400, y);
    doc.font("Helvetica");
    doc.text(o.reference, 140, y);
    doc.text(fmtDateFR(o2.dateCommande), 285, y);
    doc.text(fmtDateFR(o2.dateExpedition), 485, y);

    y += 18;
    doc.font("Helvetica-Bold").text(lang === "FR" ? "N° de l'offre :" : "Nº de oferta:", 50, y);
    doc.font("Helvetica").text(o2.offreRef ?? "—", 140, y);
    doc.font("Helvetica-Bold").text(lang === "FR" ? "Votre commande :" : "Su pedido:", 250, y);
    doc.font("Helvetica").text(o2.numeroCommandeClient, 335, y);
  }

  y += 30;
  doc.font("Helvetica-Bold").text(lang === "FR" ? "Correspondant :" : "Interlocutor:", 50, y);
  doc.font("Helvetica").text(o.correspondant, 140, y);
  doc.font("Helvetica-Bold").text(lang === "FR" ? "Contact client :" : "Contacto cliente:", 300, y);
  doc.font("Helvetica").text(client.contact_nom, 395, y);

  y += 16;
  doc.font("Helvetica-Bold").text(lang === "FR" ? "N° client :" : "Nº cliente:", 50, y);
  doc.font("Helvetica").text(client.numero_client, 140, y);

  y += 30;

  // Line items table
  const cols = { pos: 50, ref: 80, desig: 140, qte: 360, pu: 400, total: 470 };
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(lang === "FR" ? "Pos." : "Pos.", cols.pos, y);
  doc.text(lang === "FR" ? "Matériel" : "Material", cols.ref, y);
  doc.text(lang === "FR" ? "Désignation" : "Descripción", cols.desig, y);
  doc.text(lang === "FR" ? "Qté" : "Cant.", cols.qte, y);
  doc.text("PU", cols.pu, y);
  doc.text(lang === "FR" ? "Prix total" : "Importe", cols.total, y);
  doc.moveTo(50, y + 12).lineTo(550, y + 12).stroke();
  y += 18;

  doc.font("Helvetica").fontSize(9);
  let pos = 10;
  for (const line of o.lines) {
    const lineTotal = line.piece.prix_unitaire * line.quantite;
    doc.text(String(pos), cols.pos, y);
    doc.text(line.piece.reference, cols.ref, y);
    doc.text(line.piece.nom_fr, cols.desig, y, { width: 210 });
    doc.text(String(line.quantite), cols.qte, y);
    doc.text(fmtEur(line.piece.prix_unitaire), cols.pu, y);
    doc.text(fmtEur(lineTotal), cols.total, y);
    y += 18;
    pos += 10;
  }

  // Totals
  const totals = computeTotals(o.lines, {
    transport: (o as any).fraisTransport,
    emballage: (o as any).fraisEmballage,
    tvaRate: (o as any).tvaRate,
    remiseCascade: (o as any).remiseCascade,
  });
  y += 20;
  doc.font("Helvetica").fontSize(9);
  const labelX = 340;
  const amountX = 470;
  doc.text(lang === "FR" ? "Somme des articles :" : "Suma de artículos:", labelX, y);
  doc.text(fmtEur(totals.sommeArticles), amountX, y);
  y += 14;
  if ((o as any).remiseCascade) {
    for (const r of (o as any).remiseCascade as number[]) {
      doc.text(`Remise ${(r * 100).toFixed(0)}%`, labelX, y);
      y += 14;
    }
  }
  doc.text(lang === "FR" ? "Frais de transport :" : "Gastos de transporte:", labelX, y);
  doc.text(fmtEur((o as any).fraisTransport), amountX, y);
  y += 14;
  doc.text(lang === "FR" ? "Frais d'emballage :" : "Gastos de embalaje:", labelX, y);
  doc.text(fmtEur((o as any).fraisEmballage), amountX, y);
  y += 14;
  doc.font("Helvetica-Bold");
  doc.text(lang === "FR" ? "Total HT :" : "Total sin IVA:", labelX, y);
  doc.text(fmtEur(totals.ht), amountX, y);
  y += 14;
  doc.font("Helvetica");
  const tvaLabel = `${lang === "FR" ? "T.V.A." : "IVA"} ${((o as any).tvaRate * 100).toFixed(0)}% :`;
  doc.text(tvaLabel, labelX, y);
  doc.text(fmtEur(totals.tva), amountX, y);
  y += 14;
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text(lang === "FR" ? "Total TTC :" : "Total con IVA:", labelX, y);
  doc.text(`${fmtEur(totals.ttc)} EUR`, amountX, y);

  // Footer conditions
  y = 760;
  doc.font("Helvetica").fontSize(8);
  doc.text(
    lang === "FR"
      ? "Conditions de paiement : 30 jours nets · Conditions de livraison : DAP destination"
      : "Condiciones de pago: 30 días neto · Condiciones de entrega: DAP destino",
    50,
    y,
    { width: 500 },
  );

  doc.end();
  await donePromise;
  return Buffer.concat(chunks);
}

/* ------------------------------------------------------------------ */
/*  Manifest (used by seed scripts to validate OCR extraction)         */
/* ------------------------------------------------------------------ */

function buildManifest() {
  return {
    generated_at: new Date().toISOString(),
    offres: offres.map((o) => {
      const t = computeTotals(o.lines, {
        transport: o.fraisTransport,
        emballage: o.fraisEmballage,
        tvaRate: o.tvaRate,
      });
      return {
        reference: o.reference,
        client: o.client.nom,
        numero_client: o.client.numero_client,
        date: o.date,
        expirationDate: o.expirationDate,
        correspondant: o.correspondant,
        pays: o.client.pays,
        lines: o.lines.length,
        somme_articles: +t.sommeArticles.toFixed(2),
        montant_ht: +t.ht.toFixed(2),
        montant_ttc: +t.ttc.toFixed(2),
      };
    }),
    commandes: commandes.map((c) => {
      const t = computeTotals(c.lines, {
        transport: c.fraisTransport,
        emballage: c.fraisEmballage,
        tvaRate: c.tvaRate,
        remiseCascade: c.remiseCascade,
      });
      return {
        reference: c.reference,
        offreRef: c.offreRef,
        numero_commande_client: c.numeroCommandeClient,
        client: c.client.nom,
        numero_client: c.client.numero_client,
        dateCommande: c.dateCommande,
        dateExpedition: c.dateExpedition,
        correspondant: c.correspondant,
        pays: c.client.pays,
        lines: c.lines.length,
        somme_articles: +t.sommeArticles.toFixed(2),
        montant_ht: +t.ht.toFixed(2),
        montant_ttc: +t.ttc.toFixed(2),
        directe: c.offreRef === null,
        remise_cascade: c.remiseCascade ?? null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  await mkdir(join(OUT_DIR, "offres"), { recursive: true });
  await mkdir(join(OUT_DIR, "commandes"), { recursive: true });

  for (const o of offres) {
    const buf = await renderPDF("offre", o);
    const slug = o.client.nom.replace(/\s+/g, "_").toUpperCase();
    const path = join(OUT_DIR, "offres", `${o.reference}_${slug}.pdf`);
    await writeFile(path, buf);
    console.log(`wrote offre:    ${path}`);
  }

  for (const c of commandes) {
    const buf = await renderPDF("commande", c);
    const slug = c.client.nom.replace(/\s+/g, "_").toUpperCase();
    const path = join(OUT_DIR, "commandes", `${c.reference}_${slug}.pdf`);
    await writeFile(path, buf);
    console.log(`wrote commande: ${path}`);
  }

  const manifest = buildManifest();
  await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`wrote manifest: ${join(OUT_DIR, "manifest.json")}`);
  console.log(`---`);
  console.log(`offres:    ${offres.length}`);
  console.log(`commandes: ${commandes.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
