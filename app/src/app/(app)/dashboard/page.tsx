import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { t, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { formatCurrency, formatDate, getDateRange } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export const revalidate = 300;
import type {
  TauxTransformation,
  OffreNonTransformee,
  TopClient,
  StatsPays,
  PaysEnum,
  AlertesDashboard,
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
import {
  TrendingUp,
  FileText,
  ShoppingCart,
  Users,
  Globe,
  ChevronRight,
} from "lucide-react";
import { DataFilters } from "@/components/data-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { PrintButton } from "@/components/print-button";
import { OffresNonTransformeesSection } from "@/components/offres-non-transformees-section";
import { AlertesBanner } from "@/components/alertes-banner";
import { RecentActivitySection, type RecentItem } from "@/components/recent-activity-section";

interface SearchParams {
  periode?: string;
  pays?: string;
  region?: string;
  entreprise?: string;
  expirees?: string;
  tri_clients?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const periode = params.periode ?? "tout";
  const paysFilter = params.pays as PaysEnum | undefined;
  const entrepriseId = params.entreprise;
  const inclureExpirees = params.expirees !== "0";
  const triClients = params.tri_clients === "taux" ? "taux" : "ca";

  function buildToggleUrl(key: string, value: string) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== key) p.set(k, String(v));
    }
    p.set(key, value);
    return `?${p.toString()}`;
  }

  const supabase = await createClient();

  const dateRange = getDateRange(periode);
  const rpcParams: Record<string, unknown> = {};
  if (dateRange) {
    rpcParams.p_date_debut = dateRange.debut;
    rpcParams.p_date_fin = dateRange.fin;
  }
  if (paysFilter) rpcParams.p_pays = paysFilter;
  if (entrepriseId) rpcParams.p_entreprise_id = entrepriseId;

  // Build commandes directes query with filters
  let directesQuery = supabase
    .from("commandes")
    .select("montant_ht, entreprises!inner(pays)")
    .eq("type", "directe");
  if (paysFilter) directesQuery = directesQuery.eq("entreprises.pays", paysFilter);
  if (entrepriseId) directesQuery = directesQuery.eq("entreprise_id", entrepriseId);

  const [kpiResult, offresResult, clientsResult, paysResult, entreprisesResult, directesResult, alertesResult, recentOffresOcrResult, recentOffresOtherResult, recentCmdOcrResult, recentCmdOtherResult] =
    await Promise.all([
      supabase.rpc("taux_transformation", rpcParams),
      supabase.rpc("offres_non_transformees", {
        ...(paysFilter && { p_pays: paysFilter }),
        ...(entrepriseId && { p_entreprise_id: entrepriseId }),
      }),
      supabase.rpc("top_clients", {
        ...(dateRange && { p_date_debut: dateRange.debut, p_date_fin: dateRange.fin }),
        ...(paysFilter && { p_pays: paysFilter }),
        p_limit: 5,
        p_sort_by: triClients,
      }),
      supabase.rpc("stats_par_pays", {
        ...(dateRange && {
          p_date_debut: dateRange.debut,
          p_date_fin: dateRange.fin,
        }),
      }),
      supabase
        .from("entreprises")
        .select("id, nom, region")
        .order("nom"),
      directesQuery,
      supabase.rpc("alertes_dashboard"),
      // Recent offres — OCR uploads
      supabase
        .from("offres")
        .select("id, reference_offre, montant_ht, source_import, created_at, date_offre, entreprises(nom)")
        .eq("source_import", "ocr")
        .order("created_at", { ascending: false })
        .limit(5),
      // Recent offres — SAP/Excel imports
      supabase
        .from("offres")
        .select("id, reference_offre, montant_ht, source_import, created_at, date_offre, entreprises(nom)")
        .neq("source_import", "ocr")
        .order("created_at", { ascending: false })
        .limit(5),
      // Recent commandes — OCR uploads
      supabase
        .from("commandes")
        .select("id, reference_commande, montant_ht, source_import, created_at, date_commande, entreprises(nom)")
        .eq("source_import", "ocr")
        .order("created_at", { ascending: false })
        .limit(5),
      // Recent commandes — SAP/Excel imports
      supabase
        .from("commandes")
        .select("id, reference_commande, montant_ht, source_import, created_at, date_commande, entreprises(nom)")
        .neq("source_import", "ocr")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const kpi: TauxTransformation = kpiResult.data?.[0] ?? {
    total_offres: 0,
    offres_transformees: 0,
    offres_partielles: 0,
    offres_en_attente: 0,
    montant_offres: 0,
    montant_commandes: 0,
    taux_transformation: 0,
  };

  const offresNonTransformeesRaw: OffreNonTransformee[] =
    offresResult.data ?? [];
  const offresNonTransformees = inclureExpirees
    ? offresNonTransformeesRaw
    : offresNonTransformeesRaw.filter((o) => o.jours_restants == null || o.jours_restants >= 0);
  const topClients: TopClient[] = clientsResult.data ?? [];
  const statsPays: StatsPays[] = paysResult.data ?? [];
  const entreprises: { id: string; nom: string; region: string | null }[] =
    entreprisesResult.data ?? [];

  const regionList = [...new Set(
    (entreprises ?? [])
      .map((e: { region: string | null }) => e.region)
      .filter((r): r is string => r !== null && r !== undefined)
  )].sort();

  // Commandes directes stats
  const directes = (directesResult.data ?? []) as { montant_ht: number | null }[];
  const directesCount = directes.length;
  const directesMontant = directes.reduce((sum, d) => sum + (d.montant_ht ?? 0), 0);

  const alertes: AlertesDashboard = alertesResult.data?.[0] ?? {
    expirent_7j: 0,
    jamais_relancees: 0,
    sans_email: 0,
  };

  // Recent activity — merge OCR + non-OCR from both offres and commandes
  // This ensures OCR uploads always appear even when a large SAP import floods created_at
  type RecentOffreRaw = { id: string; reference_offre: string; montant_ht: number | null; source_import: string; created_at: string; date_offre: string | null; entreprises: { nom: string } };
  type RecentCmdRaw = { id: string; reference_commande: string; montant_ht: number | null; source_import: string; created_at: string; date_commande: string | null; entreprises: { nom: string } };

  const allRecentOffres = [
    ...((recentOffresOcrResult.data ?? []) as RecentOffreRaw[]),
    ...((recentOffresOtherResult.data ?? []) as RecentOffreRaw[]),
  ];
  const allRecentCmd = [
    ...((recentCmdOcrResult.data ?? []) as RecentCmdRaw[]),
    ...((recentCmdOtherResult.data ?? []) as RecentCmdRaw[]),
  ];

  const recentItems: RecentItem[] = [
    ...allRecentOffres.map((o) => ({
      id: o.id,
      type: "offre" as const,
      reference: o.reference_offre,
      entreprise_nom: o.entreprises?.nom ?? "—",
      montant_ht: o.montant_ht,
      source_import: o.source_import,
      created_at: o.created_at,
      document_date: o.date_offre,
    })),
    ...allRecentCmd.map((c) => ({
      id: c.id,
      type: "commande" as const,
      reference: c.reference_commande,
      entreprise_nom: c.entreprises?.nom ?? "—",
      montant_ht: c.montant_ht,
      source_import: c.source_import,
      created_at: c.created_at,
      document_date: c.date_commande,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);

  const errors = [kpiResult, offresResult, clientsResult, paysResult]
    .filter((r) => r.error)
    .map((r) => r.error!.message);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("dashboard.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">{t("dashboard.subtitle", locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense>
            <DataFilters
              filters={["periode", "pays", "region", "entreprise"]}
              entreprises={(entreprises ?? []).map((e: { id: string; nom: string; region: string | null }) => ({ id: e.id, nom: e.nom, region: e.region }))}
              regions={regionList}
              locale={locale}
            />
          </Suspense>
          <PrintButton locale={locale} />
        </div>
      </div>

      {alertes && <AlertesBanner alertes={alertes} locale={locale} />}

      {/* Recent activity */}
      <RecentActivitySection items={recentItems} locale={locale} />

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          {errors.map((msg, i) => (
            <p key={i} className="text-sm text-destructive">{msg}</p>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="card-indicator">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
              {t("dashboard.total_offres", locale)}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground/50" />
          </CardHeader>
          <CardContent>
            <div className="kpi-value text-2xl">{kpi.total_offres}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kpi.offres_en_attente} {t("dashboard.en_attente", locale)}
            </p>
          </CardContent>
        </Card>

        <Card className="card-indicator card-indicator-amber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
              {t("dashboard.taux_transformation", locale)}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
          </CardHeader>
          <CardContent>
            <div className="kpi-value text-2xl">{kpi.taux_transformation}%</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kpi.offres_transformees} {t("dashboard.transformees", locale)} · {kpi.offres_partielles} {t("dashboard.partielles", locale)} · {t("dashboard.hors_directes", locale)}
            </p>
          </CardContent>
        </Card>

        <Card className="card-indicator card-indicator-teal">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
              {t("dashboard.montant_offres", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-value text-2xl">{formatCurrency(kpi.montant_offres)}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("dashboard.total_ht", locale)}</p>
          </CardContent>
        </Card>

        <Card className="card-indicator card-indicator-teal">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
              {t("dashboard.montant_commandes", locale)}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground/50" />
          </CardHeader>
          <CardContent>
            <div className="kpi-value text-2xl">{formatCurrency(kpi.montant_commandes)}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("dashboard.liees_offre", locale)}</p>
          </CardContent>
        </Card>

        <Card className="card-indicator card-indicator-red">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-condensed">
              {t("dashboard.commandes_directes", locale)}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground/50" />
          </CardHeader>
          <CardContent>
            <div className="kpi-value text-2xl">{directesCount}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatCurrency(directesMontant)} HT · {t("dashboard.sans_offre", locale)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Répartition FR/ES */}
      {statsPays.length > 0 && (
        <div className="section-divider">
          <h2 className="mb-3 flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Globe className="h-4 w-4" />
            {t("dashboard.repartition_pays", locale)}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {statsPays.map((s) => (
              <Card key={s.pays} className="card-indicator">
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-condensed text-base font-bold">
                      {{ FR: "France", ES: "Espagne", MA: "Maroc", TN: "Tunisie", RE: "Réunion" }[s.pays] ?? s.pays}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.pays}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t("dashboard.offres", locale)}</span>
                      <span className="kpi-value text-sm">{s.nb_offres}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t("dashboard.transformees", locale)}</span>
                      <span className="kpi-value text-sm">{s.nb_transformees}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t("dashboard.taux", locale)}</span>
                      <span className="kpi-value text-sm text-thermopack-red">{s.taux_transformation}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t("dashboard.ca_commandes", locale)}</span>
                      <span className="kpi-value text-sm">{formatCurrency(s.montant_commandes)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Offres non transformées */}
      <OffresNonTransformeesSection
        offres={offresNonTransformees}
        locale={locale}
        inclureExpirees={inclureExpirees}
      />

      {/* Top clients */}
      {topClients.length > 0 && (
        <div className="section-divider">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-4 w-4" />
                {t("dashboard.top_clients", locale)}
              </h2>
              <div className="flex gap-1 rounded-md border border-border/60 bg-muted/40 p-1">
                <a
                  href={buildToggleUrl("tri_clients", "ca")}
                  className={cn(
                    "px-2 py-1 text-xs font-medium transition-colors rounded",
                    triClients === "ca"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t("dashboard.tri_par_ca", locale)}
                </a>
                <a
                  href={buildToggleUrl("tri_clients", "taux")}
                  className={cn(
                    "px-2 py-1 text-xs font-medium transition-colors rounded",
                    triClients === "taux"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t("dashboard.tri_par_taux", locale)}
                </a>
              </div>
            </div>
            <CsvExportButton
              data={topClients}
              filename="top-clients"
              headers={[
                { key: "entreprise_nom", label: t("dashboard.entreprise", locale) },
                { key: "pays", label: t("dashboard.pays", locale) },
                { key: "nb_offres", label: t("dashboard.offres", locale) },
                { key: "nb_transformees", label: t("dashboard.transformees", locale) },
                { key: "taux_transformation", label: `${t("dashboard.taux", locale)} %` },
                { key: "montant_total_offres", label: t("dashboard.montant_total", locale) },
                { key: "ca_commandes", label: t("dashboard.ca_commandes_col", locale) },
              ]}
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="table-header-industrial hover:bg-transparent">
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.entreprise", locale)}</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">{t("dashboard.pays", locale)}</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("dashboard.offres", locale)}</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("dashboard.transf", locale)}</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("dashboard.taux", locale)}</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("dashboard.montant_total", locale)}</TableHead>
                  <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("dashboard.ca_commandes_col", locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClients.map((c) => (
                  <TableRow key={c.entreprise_id} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium">{c.entreprise_nom}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-muted font-mono text-[10px] font-medium">
                        {c.pays}
                      </span>
                    </TableCell>
                    <TableCell className="kpi-value text-right text-sm">{c.nb_offres}</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{c.nb_transformees}</TableCell>
                    <TableCell className="kpi-value text-right text-sm text-amber-accent">{c.taux_transformation}%</TableCell>
                    <TableCell className="kpi-value text-right text-sm">{formatCurrency(c.montant_total_offres)}</TableCell>
                    <TableCell className="font-semibold text-primary text-right text-sm">{formatCurrency(c.ca_commandes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <a
              href="/analyse"
              className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              Voir tous les clients
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
