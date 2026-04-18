import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { formatCurrency, formatDate } from "@/lib/formatting";
import type {
  Entreprise,
  OffreWithEntreprise,
  CommandeWithRelations,
  FicheEntrepriseKpis,
  TopPieceEntreprise,
} from "@/types/database";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PdfLink } from "@/components/pdf-link";
import { Package } from "lucide-react";

export const revalidate = 300;

const statutStyle: Record<string, string> = {
  en_attente: "border-amber-accent/40 bg-amber-accent/10 text-amber-accent",
  transformee: "border-teal/40 bg-teal/10 text-teal",
  partiellement_transformee: "border-primary/40 bg-primary/10 text-primary",
  expiree: "border-destructive/40 bg-destructive/10 text-destructive",
};

const typeStyle: Record<string, string> = {
  directe: "border-muted-foreground/30 bg-muted text-muted-foreground",
  partielle: "border-amber-accent/40 bg-amber-accent/10 text-amber-accent",
  egale: "border-teal/40 bg-teal/10 text-teal",
  superieure: "border-primary/40 bg-primary/10 text-primary",
};

function getStatutLabel(statut: string, locale: Locale): string {
  const labelMap: Record<string, Record<Locale, string>> = {
    en_attente: { fr: "En attente", es: "Pendiente" },
    transformee: { fr: "Transformée", es: "Convertida" },
    partiellement_transformee: { fr: "Partielle", es: "Parcial" },
    expiree: { fr: "Expirée", es: "Vencida" },
  };
  return labelMap[statut]?.[locale] ?? statut;
}

function getTypeLabel(type: string, locale: Locale): string {
  const labelMap: Record<string, Record<Locale, string>> = {
    directe: { fr: "Directe", es: "Directo" },
    partielle: { fr: "Partielle", es: "Parcial" },
    egale: { fr: "Égale", es: "Igual" },
    superieure: { fr: "Supérieure", es: "Superior" },
  };
  return labelMap[type]?.[locale] ?? type;
}

export default async function EntrepriseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const { id } = await params;
  const supabase = await createClient();

  const [entrepriseResult, kpisResult, offresResult, commandesResult, piecesResult] =
    await Promise.all([
      supabase
        .from("entreprises")
        .select("*")
        .eq("id", id)
        .single(),
      supabase.rpc("fiche_entreprise_kpis", { p_entreprise_id: id }),
      supabase
        .from("offres")
        .select("*, entreprises(*)")
        .eq("entreprise_id", id)
        .order("date_offre", { ascending: false })
        .limit(50),
      supabase
        .from("commandes")
        .select("*, offres(reference_offre), entreprises(*)")
        .eq("entreprise_id", id)
        .order("date_commande", { ascending: false })
        .limit(50),
      supabase.rpc("top_pieces_par_entreprise", { p_entreprise_id: id, p_limit: 10 }),
    ]);

  const entreprise = entrepriseResult.data as Entreprise | null;
  const kpis = kpisResult.data?.[0] as FicheEntrepriseKpis | null;
  const offres = offresResult.data as OffreWithEntreprise[] | null;
  const commandes = commandesResult.data as CommandeWithRelations[] | null;
  const topPieces = (piecesResult.data as TopPieceEntreprise[] | null) ?? [];

  if (!entreprise) {
    return (
      <div className="space-y-6">
        <Link href="/offres" className="text-primary hover:underline text-sm">
          {t("entreprise.retour", locale)}
        </Link>
        <p className="text-muted-foreground">{t("common.chargement", locale)}</p>
      </div>
    );
  }

  const kpisData = kpis || {
    nb_offres: 0,
    nb_commandes: 0,
    nb_transformees: 0,
    taux_transformation: 0,
    ca_offres: 0,
    ca_commandes: 0,
  };

  const ca_total = kpisData.ca_offres + kpisData.ca_commandes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-condensed text-3xl font-bold tracking-tight">
            {entreprise.nom}
          </h1>
          {entreprise.pays && (
            <p className="text-xs text-muted-foreground mt-1">
              {entreprise.pays}
              {entreprise.code_postal && ` · ${entreprise.code_postal}`}
              {entreprise.ville && ` · ${entreprise.ville}`}
            </p>
          )}
        </div>
        <Link href="/offres" className="text-primary hover:underline text-sm">
          {t("entreprise.retour", locale)}
        </Link>
      </div>

      {/* Contact Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-condensed text-base font-semibold">
            {t("entreprise.contact", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {entreprise.contact_nom && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nom:</span>
              <span className="font-medium">{entreprise.contact_nom}</span>
            </div>
          )}
          {entreprise.contact_email && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <a
                href={`mailto:${entreprise.contact_email}`}
                className="text-primary hover:underline"
              >
                {entreprise.contact_email}
              </a>
            </div>
          )}
          {entreprise.contact_telephone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Téléphone:</span>
              <a
                href={`tel:${entreprise.contact_telephone}`}
                className="text-primary hover:underline"
              >
                {entreprise.contact_telephone}
              </a>
            </div>
          )}
          {entreprise.adresse && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adresse:</span>
              <span className="text-right font-medium">{entreprise.adresse}</span>
            </div>
          )}
          {entreprise.siret && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">SIRET:</span>
              <span className="font-mono text-xs">{entreprise.siret}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="card-indicator border-border/60 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-condensed uppercase font-semibold mb-2">
              {t("dashboard.total_offres", locale)}
            </p>
            <p className="kpi-value font-condensed text-2xl font-bold">
              {kpisData.nb_offres}
            </p>
          </CardContent>
        </Card>

        <Card className="card-indicator border-border/60 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-condensed uppercase font-semibold mb-2">
              {t("direction.commandes_recues", locale)}
            </p>
            <p className="kpi-value font-condensed text-2xl font-bold">
              {kpisData.nb_commandes}
            </p>
          </CardContent>
        </Card>

        <Card className="card-indicator border-border/60 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-condensed uppercase font-semibold mb-2">
              {t("dashboard.taux_transformation", locale)}
            </p>
            <p className="kpi-value font-condensed text-2xl font-bold">
              {kpisData.taux_transformation.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="card-indicator border-border/60 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-condensed uppercase font-semibold mb-2">
              CA Total {t("common.ht", locale)}
            </p>
            <p className="kpi-value font-condensed text-lg font-bold">
              {formatCurrency(ca_total)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top pièces commandées */}
      {topPieces.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 font-condensed text-lg font-semibold mb-3">
            <Package className="h-4 w-4" />
            {t("entreprise.top_pieces", locale)}
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
              {topPieces.length}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="table-header-industrial hover:bg-transparent">
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider w-8">#</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("dashboard.reference", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    Désignation
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                    Cmd.
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                    Qté totale
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPieces.map((p, i) => (
                  <TableRow key={p.reference} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{p.reference}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm">{p.nom_fr}</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{p.nb_commandes}</TableCell>
                    <TableCell className="kpi-value text-right text-sm font-bold">{p.quantite_totale}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Offres Table */}
      <div>
        <h2 className="font-condensed text-lg font-semibold mb-3">
          {t("entreprise.historique_offres", locale)}
        </h2>
        {offres && offres.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="table-header-industrial hover:bg-transparent">
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("dashboard.reference", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                    {t("dashboard.montant_ht", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("offres.date", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("dashboard.expiration", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">
                    {t("offres.statut", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {offres.map((offre) => (
                  <TableRow key={offre.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-medium">
                      {offre.reference_offre}
                    </TableCell>
                    <TableCell className="kpi-value text-right text-sm">
                      {formatCurrency(offre.montant_ht)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(offre.date_offre)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {offre.date_expiration
                        ? formatDate(offre.date_expiration)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-condensed text-[10px] font-semibold uppercase",
                          statutStyle[offre.statut] ?? ""
                        )}
                      >
                        {getStatutLabel(offre.statut, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <PdfLink storagePath={offre.fichier_source} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("entreprise.aucune_offre", locale)}
          </p>
        )}
      </div>

      {/* Commandes Table */}
      <div>
        <h2 className="font-condensed text-lg font-semibold mb-3">
          {t("entreprise.historique_commandes", locale)}
        </h2>
        {commandes && commandes.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="table-header-industrial hover:bg-transparent">
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("dashboard.reference", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                    {t("dashboard.montant_ht", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("offres.date", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                    {t("commandes.offre_liee", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">
                    {t("commandes.type", locale)}
                  </TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandes.map((cmd) => (
                  <TableRow key={cmd.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-medium">
                      {cmd.reference_commande}
                    </TableCell>
                    <TableCell className="kpi-value text-right text-sm">
                      {formatCurrency(cmd.montant_ht)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(cmd.date_commande)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cmd.offres?.reference_offre ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-condensed text-[10px] font-semibold uppercase",
                          typeStyle[cmd.type] ?? ""
                        )}
                      >
                        {getTypeLabel(cmd.type, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <PdfLink storagePath={cmd.fichier_source} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("entreprise.aucune_commande", locale)}
          </p>
        )}
      </div>
    </div>
  );
}
