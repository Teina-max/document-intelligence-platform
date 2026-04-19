import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { getDateRange } from "@/lib/formatting";
import type { CommandeWithRelations, PaysEnum, TypeCommande } from "@/types/database";
import { CsvExportButton } from "@/components/csv-export-button";
import { CommandesTable } from "@/components/commandes-table";
import { DataFilters } from "@/components/data-filters";
import { Pagination } from "@/components/pagination";
import type { Locale } from "@/lib/i18n";

function getTypeLabel(type: string, locale: Locale): string {
  const labelMap: Record<string, Record<Locale, string>> = {
    directe: { fr: "Directe", es: "Directo" },
    partielle: { fr: "Partielle", es: "Parcial" },
    egale: { fr: "Égale", es: "Igual" },
    superieure: { fr: "Supérieure", es: "Superior" },
  };
  return labelMap[type]?.[locale] ?? type;
}

interface SearchParams {
  periode?: string;
  type?: string;
  entreprise?: string;
  pays?: string;
  page?: string;
  sort_by?: string;
  sort_order?: string;
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const supabase = await createClient();

  const PAGE_SIZE = 30;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const ALLOWED_SORT = ["date_commande", "montant_ht", "reference_commande", "type"] as const;
  const sortBy = ALLOWED_SORT.includes(params.sort_by as typeof ALLOWED_SORT[number])
    ? params.sort_by as string
    : "date_commande";
  const sortOrder = (params.sort_order ?? "desc") as "asc" | "desc";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const periode = params.periode ?? "tout";
  const validTypes = ["directe", "egale", "superieure", "partielle"];
  const typeFilter = validTypes.includes(params.type ?? "") ? params.type as TypeCommande : undefined;
  const entrepriseId = params.entreprise;
  const paysFilter = params.pays as PaysEnum | undefined;
  const dateRange = getDateRange(periode);

  // Conditional inner join on entreprises only, always left join on offres
  const select = paysFilter
    ? "*, entreprises!inner(*), offres(*)"
    : "*, entreprises(*), offres(*)";

  let query = supabase
    .from("commandes")
    .select(select, { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(from, to);

  if (typeFilter) query = query.eq("type", typeFilter);
  if (entrepriseId) query = query.eq("entreprise_id", entrepriseId);
  if (paysFilter) query = query.eq("entreprises.pays", paysFilter);
  if (dateRange) {
    query = query.gte("date_commande", dateRange.debut).lte("date_commande", dateRange.fin);
  }

  const [{ data: commandes, error, count: totalCount }, { data: entreprises }] = await Promise.all([
    query.returns<CommandeWithRelations[]>(),
    supabase.from("entreprises").select("id, nom").order("nom"),
  ]);

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("commandes.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount != null ? `${totalCount} ${totalCount !== 1 ? t("commandes.count_plural", locale) : t("commandes.count", locale)}` : t("common.chargement", locale)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense>
            <DataFilters
              filters={["periode", "type_commande", "entreprise", "pays"]}
              entreprises={entreprises ?? []}
              locale={locale}
            />
          </Suspense>
          {commandes && commandes.length > 0 && (
            <CsvExportButton
              data={commandes.map((cmd) => ({
                reference_commande: cmd.reference_commande,
                entreprise_nom: cmd.entreprises.nom,
                montant_ht: cmd.montant_ht,
                date_commande: cmd.date_commande,
                type: getTypeLabel(cmd.type, locale),
              }))}
              filename="commandes"
              headers={[
                { key: "reference_commande", label: t("dashboard.reference", locale) },
                { key: "entreprise_nom", label: t("dashboard.entreprise", locale) },
                { key: "montant_ht", label: t("dashboard.montant_ht", locale) },
                { key: "date_commande", label: t("dashboard.date_offre", locale) },
                { key: "type", label: t("commandes.type", locale) },
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
        <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount ?? 0} />
      </Suspense>

      <CommandesTable commandes={commandes} locale={locale} />

      <Suspense>
        <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount ?? 0} />
      </Suspense>
    </div>
  );
}
