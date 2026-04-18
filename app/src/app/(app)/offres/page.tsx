import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { getDateRange } from "@/lib/formatting";
import type { OffreWithEntreprise, PaysEnum, StatutOffre } from "@/types/database";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CsvExportButton } from "@/components/csv-export-button";
import { OffresTable } from "@/components/offres-table";
import { DataFilters } from "@/components/data-filters";
import { Pagination } from "@/components/pagination";
import type { Locale } from "@/lib/i18n";

function getStatutLabel(statut: string, locale: Locale): string {
  const labelMap: Record<string, Record<Locale, string>> = {
    en_attente: { fr: "En attente", es: "Pendiente" },
    transformee: { fr: "Transformée", es: "Convertida" },
    partiellement_transformee: { fr: "Partielle", es: "Parcial" },
    expiree: { fr: "Expirée", es: "Vencida" },
  };
  return labelMap[statut]?.[locale] ?? statut;
}

interface SearchParams {
  periode?: string;
  statut?: string;
  entreprise?: string;
  pays?: string;
  page?: string;
  sort_by?: string;
  sort_order?: string;
  urgentes?: string;
  expire_7j?: string;
  jamais_relancees?: string;
}

export default async function OffresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = user?.app_metadata?.role === "admin";

  const PAGE_SIZE = 30;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const ALLOWED_SORT = ["date_offre", "date_expiration", "montant_ht", "reference_offre", "statut"] as const;
  const sortBy = ALLOWED_SORT.includes(params.sort_by as typeof ALLOWED_SORT[number])
    ? params.sort_by as string
    : "date_offre";
  const sortOrder = (params.sort_order ?? "desc") as "asc" | "desc";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const periode = params.periode ?? "tout";
  const validStatuts = ["en_attente", "transformee", "partiellement_transformee", "expiree"];
  const statutFilter = validStatuts.includes(params.statut ?? "") ? params.statut as StatutOffre : undefined;
  const entrepriseId = params.entreprise;
  const paysFilter = params.pays as PaysEnum | undefined;
  const dateRange = getDateRange(periode);

  const todayStr = new Date().toISOString().split("T")[0];
  const in7DaysStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  // Conditional inner join: only when pays filter active
  const select = paysFilter
    ? "*, entreprises!inner(*)"
    : "*, entreprises(*)";

  let query = supabase
    .from("offres")
    .select(select, { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(from, to);

  if (statutFilter) query = query.eq("statut", statutFilter);
  if (entrepriseId) query = query.eq("entreprise_id", entrepriseId);
  if (paysFilter) query = query.eq("entreprises.pays", paysFilter);
  if (dateRange) {
    query = query.gte("date_offre", dateRange.debut).lte("date_offre", dateRange.fin);
  }
  if (params.urgentes === "1") {
    const today = new Date().toISOString().split("T")[0];
    const in15Days = new Date();
    in15Days.setDate(in15Days.getDate() + 15);
    query = query
      .gte("date_expiration", today)
      .lte("date_expiration", in15Days.toISOString().split("T")[0]);
  }
  if (params.expire_7j === "1") {
    query = query
      .eq("statut", "en_attente")
      .gte("date_expiration", todayStr)
      .lte("date_expiration", in7DaysStr);
  }
  if (params.jamais_relancees === "1") {
    query = query
      .eq("statut", "en_attente")
      .is("derniere_relance", null);
  }

  const [{ data: offres, error, count: totalCount }, { data: entreprises }, expiringSoonResult, noRelanceResult] = await Promise.all([
    query.returns<OffreWithEntreprise[]>(),
    supabase.from("entreprises").select("id, nom").order("nom"),
    supabase
      .from("offres")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente")
      .gte("date_expiration", todayStr)
      .lte("date_expiration", in7DaysStr),
    supabase
      .from("offres")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente")
      .is("derniere_relance", null),
  ]);

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("offres.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount != null ? `${totalCount} ${totalCount !== 1 ? t("offres.count_plural", locale) : t("offres.count", locale)}` : t("common.chargement", locale)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const urgentesActive = params.urgentes === "1";
            const toggleHref = urgentesActive
              ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k]) => k !== "urgentes"))).toString()}`
              : `?${new URLSearchParams({ ...params, urgentes: "1" }).toString()}`;
            return (
              <a
                href={toggleHref}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  urgentesActive
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Urgentes
              </a>
            );
          })()}
          <Suspense>
            <DataFilters
              filters={["periode", "statut_offre", "entreprise", "pays"]}
              entreprises={entreprises ?? []}
              locale={locale}
            />
          </Suspense>
          {offres && offres.length > 0 && (
            <CsvExportButton
              data={offres.map((offre) => ({
                reference_offre: offre.reference_offre,
                entreprise_nom: offre.entreprises.nom,
                montant_ht: offre.montant_ht,
                date_offre: offre.date_offre,
                statut: getStatutLabel(offre.statut, locale),
              }))}
              filename="offres"
              headers={[
                { key: "reference_offre", label: t("dashboard.reference", locale) },
                { key: "entreprise_nom", label: t("dashboard.entreprise", locale) },
                { key: "montant_ht", label: t("dashboard.montant_ht", locale) },
                { key: "date_offre", label: t("dashboard.date_offre", locale) },
                { key: "statut", label: t("offres.statut", locale) },
              ]}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">Erreur : {error.message}</p>
        </div>
      )}

      <Suspense>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount ?? 0}
          stats={[
            { label: "expirent cette semaine", value: expiringSoonResult.count ?? 0, color: "text-destructive" },
            { label: "sans relance", value: noRelanceResult.count ?? 0, color: "text-amber-accent" },
          ]}
        />
      </Suspense>

      <OffresTable offres={offres} locale={locale} isAdmin={isAdmin} />

      <Suspense>
        <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount ?? 0} />
      </Suspense>
    </div>
  );
}
