import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

export const revalidate = 300;
import type { TopMateriau, RecurrenceClient, PaysEnum, StatsParRegion } from "@/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin } from "lucide-react";
import { CsvExportButton } from "@/components/csv-export-button";
import { RecurrenceClientsSection } from "@/components/recurrence-clients-section";
import { DataFilters } from "@/components/data-filters";
import { formatCurrency, formatDate, getDateRange } from "@/lib/formatting";

interface SearchParams {
  periode?: string;
  pays?: string;
  region?: string;
}

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const periode = params.periode ?? "tout";
  const paysFilter = params.pays as PaysEnum | undefined;
  const regionFilter = params.region;

  const supabase = await createClient();
  const dateRange = getDateRange(periode);

  const materiauxParams: Record<string, unknown> = { p_limit: 20 };
  const recurrenceParams: Record<string, unknown> = {};

  if (dateRange) {
    materiauxParams.p_date_debut = dateRange.debut;
    materiauxParams.p_date_fin = dateRange.fin;
    recurrenceParams.p_date_debut = dateRange.debut;
    recurrenceParams.p_date_fin = dateRange.fin;
  }

  const [materiauxResult, recurrenceResult, regionResult] = await Promise.all([
    supabase.rpc("top_materiaux", materiauxParams),
    supabase.rpc("recurrence_clients", recurrenceParams),
    supabase.rpc("stats_par_region"),
  ]);

  const topMateriauxRaw: TopMateriau[] = materiauxResult.data ?? [];
  const recurrenceClientsRaw: RecurrenceClient[] = recurrenceResult.data ?? [];
  const statsRegion: StatsParRegion[] = regionResult.data ?? [];

  const regionList = statsRegion
    .map((r) => r.region)
    .filter((r) => r !== "Non renseigné");

  // Region filter only applies to geographic table (known limitation:
  // recurrence_clients RPC does not return region field)
  const filteredRegion = regionFilter
    ? statsRegion.filter((r) => r.region === regionFilter)
    : statsRegion;

  // Client-side pays filter (RPCs don't have p_pays param for these)
  const topMateriaux = topMateriauxRaw;
  const recurrenceClients = paysFilter
    ? recurrenceClientsRaw.filter((c) => c.pays === paysFilter)
    : recurrenceClientsRaw;

  const errors = [materiauxResult, recurrenceResult, regionResult]
    .filter((r) => r.error)
    .map((r) => r.error!.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("analyse.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">{t("analyse.subtitle", locale)}</p>
        </div>
        <Suspense>
          <DataFilters
              filters={["periode", "pays", "region"]}
              regions={regionList}
              locale={locale}
            />
        </Suspense>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          {errors.map((msg, i) => (
            <p key={i} className="text-sm text-destructive">{msg}</p>
          ))}
        </div>
      )}

      {/* Top matériaux */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-4 w-4" />
            {t("analyse.top_pieces", locale)}
            {topMateriaux.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
                {topMateriaux.length}
              </span>
            )}
          </h2>
          <CsvExportButton
            data={topMateriaux}
            filename="top-materiaux"
            headers={[
              { key: "reference_materiel", label: t("dashboard.reference", locale) },
              { key: "designation", label: t("analyse.designation", locale) },
              { key: "nb_commandes", label: t("analyse.commandes", locale) },
              { key: "quantite_totale", label: t("analyse.quantite", locale) },
              { key: "ca_total", label: t("analyse.ca_total", locale) },
            ]}
          />
        </div>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="table-header-industrial hover:bg-transparent">
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider w-8">#</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.reference", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("analyse.designation", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">Cmd.</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">Qté</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("analyse.ca_total", locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topMateriaux.length > 0 ? (
                topMateriaux.map((m, i) => (
                  <TableRow key={`${m.reference_materiel}-${i}`} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{m.reference_materiel}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{m.designation}</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{m.nb_commandes}</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{m.quantite_totale}</TableCell>
                    <TableCell className="kpi-value text-right text-sm font-bold">{formatCurrency(m.ca_total)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {t("analyse.aucune_donnee", locale)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Clients récurrents */}
      <RecurrenceClientsSection data={recurrenceClients} locale={locale} />

      {/* Répartition géographique */}
      <div className="section-divider">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {t("analyse.repartition_geo", locale)}
            {filteredRegion.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
                {filteredRegion.length}
              </span>
            )}
          </h2>
          <CsvExportButton
            data={statsRegion}
            filename="repartition-geographique"
            headers={[
              { key: "region", label: t("analyse.region", locale) },
              { key: "nb_clients", label: t("analyse.clients", locale) },
              { key: "nb_offres", label: t("analyse.offres", locale) },
              { key: "nb_commandes", label: t("analyse.nb_commandes", locale) },
              { key: "ca_total", label: t("analyse.ca_total", locale) },
            ]}
          />
        </div>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="table-header-industrial hover:bg-transparent">
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider w-8">#</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("analyse.region", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("analyse.clients", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("analyse.offres", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("analyse.nb_commandes", locale)}</TableHead>
                <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("analyse.ca_total", locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegion.length > 0 ? (
                filteredRegion.map((r, i) => (
                  <TableRow key={r.region} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">
                      <span className={!r.region || r.region === "Non renseigné" ? "text-muted-foreground italic" : ""}>
                        {r.region || "Non renseigné"}
                      </span>
                    </TableCell>
                    <TableCell className="kpi-value text-right text-sm">{r.nb_clients}</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{r.nb_offres}</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{r.nb_commandes}</TableCell>
                    <TableCell className="kpi-value text-right text-sm font-bold">{formatCurrency(r.ca_total)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {t("analyse.aucune_region", locale)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
