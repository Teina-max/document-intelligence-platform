import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { Suspense } from "react";
import { DataFilters } from "@/components/data-filters";
import type { KpisDirection, CaMensuel } from "@/types/database";
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
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ArrowRightLeft,
  FileText,
  ShoppingCart,
} from "lucide-react";
import { CsvExportButton } from "@/components/csv-export-button";
import { formatCurrency } from "@/lib/formatting";

function evolutionBadge(pct: number) {
  if (pct === 0) return <Badge variant="outline" className="font-mono text-[10px]">—</Badge>;
  if (pct > 0)
    return (
      <Badge className="bg-teal font-mono text-[10px] text-white hover:bg-teal/90">
        <TrendingUp className="mr-1 h-3 w-3" />+{pct}%
      </Badge>
    );
  return (
    <Badge variant="destructive" className="font-mono text-[10px]">
      <TrendingDown className="mr-1 h-3 w-3" />{pct}%
    </Badge>
  );
}

interface SearchParams {
  mois?: string;
  annee?: string;
}

export default async function DirectionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const supabase = await createClient();

  const params = await searchParams;

  const now = new Date();
  const year = params.annee ? parseInt(params.annee) : now.getFullYear();
  const moisParam = params.mois ?? "actuel";

  let debutMois: string;
  let finMois: string;
  let showAnnuel = false;
  let highlightMonth: number;

  if (moisParam === "tous") {
    showAnnuel = true;
    debutMois = `${year}-01-01`;
    finMois = `${year}-12-31`;
    highlightMonth = -1;
  } else {
    const month = moisParam === "actuel" ? now.getMonth() : parseInt(moisParam) - 1;
    debutMois = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    finMois = new Date(year, month + 1, 0).toISOString().split("T")[0];
    highlightMonth = month + 1;
  }

  const [kpiResult, kpiAllResult, mensuelResult] = await Promise.all([
    supabase.rpc("kpis_direction", {
      p_date_debut: debutMois,
      p_date_fin: finMois,
    }),
    supabase.rpc("kpis_direction"),
    supabase.rpc("ca_mensuel", { p_annee: year }),
  ]);

  const kpiMois: KpisDirection = kpiResult.data?.[0] ?? {
    ca_total: 0, ca_france: 0, ca_espagne: 0,
    nb_offres_emises: 0, nb_commandes_recues: 0,
    montant_offres: 0, montant_commandes: 0,
    taux_conversion: 0, ca_total_precedent: 0, evolution_pct: 0,
    nb_commandes_directes: 0, montant_commandes_directes: 0,
  };

  const kpiAll: KpisDirection = kpiAllResult.data?.[0] ?? {
    ca_total: 0, ca_france: 0, ca_espagne: 0,
    nb_offres_emises: 0, nb_commandes_recues: 0,
    montant_offres: 0, montant_commandes: 0,
    taux_conversion: 0, ca_total_precedent: 0, evolution_pct: 0,
    nb_commandes_directes: 0, montant_commandes_directes: 0,
  };

  const caMensuel: CaMensuel[] = mensuelResult.data ?? [];

  const errors = [kpiResult, kpiAllResult, mensuelResult]
    .filter((r) => r.error)
    .map((r) => r.error!.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("direction.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">{t("direction.subtitle", locale)}</p>
        </div>
        <Suspense>
          <DataFilters filters={["mois", "annee"]} locale={locale} />
        </Suspense>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          {errors.map((msg, i) => (
            <p key={i} className="text-sm text-destructive">{msg}</p>
          ))}
        </div>
      )}

      {/* KPIs mois en cours */}
      <div>
        <h2 className="mb-3 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {showAnnuel ? `${t("filter.annuel", locale)} ${year}` : t("direction.mois_en_cours", locale)}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="card-indicator card-indicator-amber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.ca_total", locale)}
              </CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{formatCurrency(kpiMois.ca_total)}</div>
              <div className="mt-1.5">{evolutionBadge(kpiMois.evolution_pct)}</div>
            </CardContent>
          </Card>

          <Card className="card-indicator">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.ca_france", locale)}
              </CardTitle>
              <span className="font-mono text-[10px] font-bold text-muted-foreground/60">FR</span>
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{formatCurrency(kpiMois.ca_france)}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {kpiMois.ca_total > 0
                  ? `${Math.round((kpiMois.ca_france / kpiMois.ca_total) * 100)}% ${t("direction.du_ca", locale)}`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="card-indicator">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.ca_espagne", locale)}
              </CardTitle>
              <span className="font-mono text-[10px] font-bold text-muted-foreground/60">ES</span>
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{formatCurrency(kpiMois.ca_espagne)}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {kpiMois.ca_total > 0
                  ? `${Math.round((kpiMois.ca_espagne / kpiMois.ca_total) * 100)}% ${t("direction.du_ca", locale)}`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="card-indicator card-indicator-teal">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.taux_conversion", locale)}
              </CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{kpiMois.taux_conversion}%</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {kpiMois.nb_offres_emises} {t("direction.offres_arrow_cmd", locale)} {kpiMois.nb_commandes_recues - kpiMois.nb_commandes_directes} {t("direction.cmd", locale)} · {t("dashboard.hors_directes", locale)}
              </p>
            </CardContent>
          </Card>

          <Card className="card-indicator card-indicator-red">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.cmd_directes", locale)}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{kpiMois.nb_commandes_directes}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatCurrency(kpiMois.montant_commandes_directes)} HT · {t("dashboard.sans_offre", locale)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cumul annuel */}
      <div className="section-divider">
        <h2 className="mb-3 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("direction.cumul_annuel", locale)} {year}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="card-indicator">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.ca_annuel", locale)}
              </CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{formatCurrency(kpiAll.ca_total)}</div>
            </CardContent>
          </Card>

          <Card className="card-indicator">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.offres_emises", locale)}
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{kpiAll.nb_offres_emises}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatCurrency(kpiAll.montant_offres)} HT
              </p>
            </CardContent>
          </Card>

          <Card className="card-indicator">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.commandes_recues", locale)}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{kpiAll.nb_commandes_recues}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatCurrency(kpiAll.montant_commandes)} HT
              </p>
            </CardContent>
          </Card>

          <Card className="card-indicator card-indicator-teal">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.conversion_annuelle", locale)}
              </CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{kpiAll.taux_conversion}%</div>
              <p className="mt-1 text-[11px] text-muted-foreground">{t("dashboard.hors_directes", locale)}</p>
            </CardContent>
          </Card>

          <Card className="card-indicator card-indicator-red">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
                {t("direction.directes_cumulees", locale)}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-2xl">{kpiAll.nb_commandes_directes}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatCurrency(kpiAll.montant_commandes_directes)} HT
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CA Mensuel */}
      <div className="section-divider">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("direction.ca_mensuel", locale)} {year}
          </h2>
          <CsvExportButton
            data={caMensuel}
            filename={`ca-mensuel-${year}`}
            headers={[
              { key: "mois_label", label: "Mois" },
              { key: "ca_france", label: "CA France" },
              { key: "ca_espagne", label: "CA Espagne" },
              { key: "ca_total", label: "CA Total" },
              { key: "nb_commandes", label: "Commandes" },
            ]}
          />
        </div>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="table-header-industrial hover:bg-transparent">
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("direction.mois", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("direction.ca_france", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("direction.ca_espagne", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("direction.ca_total", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("direction.cmd", locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caMensuel.map((m) => (
                <TableRow
                  key={m.mois}
                  className={m.mois === highlightMonth
                    ? "bg-primary/5 hover:bg-primary/8"
                    : "hover:bg-muted/30"
                  }
                >
                  <TableCell className="text-sm capitalize">
                    {m.mois === highlightMonth && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-thermopack-red status-dot" />
                    )}
                    {m.mois_label}
                  </TableCell>
                  <TableCell className="kpi-value text-right text-sm">{formatCurrency(m.ca_france)}</TableCell>
                  <TableCell className="kpi-value text-right text-sm">{formatCurrency(m.ca_espagne)}</TableCell>
                  <TableCell className="kpi-value text-right text-sm font-bold">{formatCurrency(m.ca_total)}</TableCell>
                  <TableCell className="kpi-value text-right text-sm">{m.nb_commandes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
