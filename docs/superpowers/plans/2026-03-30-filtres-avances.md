# Filtres Avancés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add advanced filters across all pages — status/enterprise/period on offres/commandes (Alice), month/year on direction (Éric Martin), region on analyse/dashboard, and enhanced global search with status badges.

**Architecture:** Single shared `<DataFilters>` client component using `usePathname()` + `useSearchParams()`, rendered inside `<Suspense>` on each page. Server-side filtering via Supabase conditional queries on offres/commandes/direction. Client-side region filtering on analyse. SQL migration for enhanced search RPC.

**Tech Stack:** Next.js 15 App Router, Supabase PostgREST, shadcn/ui Select, Tailwind CSS, i18n FR/ES.

**Spec:** `docs/superpowers/specs/2026-03-30-filtres-avances-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/src/lib/i18n.ts` | Modify | ~20 new translation keys |
| `app/src/components/data-filters.tsx` | **Create** | Shared filter bar (replaces dashboard-filters + analyse-filters) |
| `app/src/app/(app)/offres/page.tsx` | Modify | Add searchParams, conditional Supabase query, counter |
| `app/src/app/(app)/commandes/page.tsx` | Modify | Add searchParams, conditional Supabase query, counter |
| `app/src/app/(app)/direction/page.tsx` | Modify | Add searchParams, dynamic month/year |
| `app/src/app/(app)/analyse/page.tsx` | Modify | Add region filter, swap to DataFilters |
| `app/src/app/(app)/dashboard/page.tsx` | Modify | Add region filter, swap to DataFilters |
| `scripts/022-search-enhanced.sql` | **Create** | Enhanced recherche_globale RPC |
| `app/src/components/global-search.tsx` | Modify | Status badges + filtered enterprise links |
| `app/src/components/dashboard-filters.tsx` | **Delete** | Replaced by data-filters |
| `app/src/components/analyse-filters.tsx` | **Delete** | Replaced by data-filters |

---

### Task 1: i18n Translations

**Files:**
- Modify: `app/src/lib/i18n.ts`

- [ ] **Step 1: Add all new translation keys**

Add after `"filter.exclure_expirees"` entry (~line 78):

```typescript
  "filter.toutes_regions": { fr: "Toutes régions", es: "Todas las regiones" },
  "filter.tous_statuts": { fr: "Tous statuts", es: "Todos los estados" },
  "filter.tous_types": { fr: "Tous types", es: "Todos los tipos" },
  "filter.mois_selector": { fr: "Mois", es: "Mes" },
  "filter.annee_label": { fr: "Année", es: "Año" },
  "filter.annuel": { fr: "Annuel", es: "Anual" },
  "month.1": { fr: "Janvier", es: "Enero" },
  "month.2": { fr: "Février", es: "Febrero" },
  "month.3": { fr: "Mars", es: "Marzo" },
  "month.4": { fr: "Avril", es: "Abril" },
  "month.5": { fr: "Mai", es: "Mayo" },
  "month.6": { fr: "Juin", es: "Junio" },
  "month.7": { fr: "Juillet", es: "Julio" },
  "month.8": { fr: "Août", es: "Agosto" },
  "month.9": { fr: "Septembre", es: "Septiembre" },
  "month.10": { fr: "Octobre", es: "Octubre" },
  "month.11": { fr: "Novembre", es: "Noviembre" },
  "month.12": { fr: "Décembre", es: "Diciembre" },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/i18n.ts
git commit -m "add i18n translations for advanced filters and month names"
```

---

### Task 2: Create DataFilters Component

**Files:**
- Create: `app/src/components/data-filters.tsx`

- [ ] **Step 1: Create the shared filter component**

Create `app/src/components/data-filters.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterType =
  | "periode"
  | "pays"
  | "entreprise"
  | "region"
  | "statut_offre"
  | "type_commande"
  | "mois"
  | "annee";

interface EntrepriseOption {
  id: string;
  nom: string;
  region?: string | null;
}

interface DataFiltersProps {
  filters: FilterType[];
  entreprises?: EntrepriseOption[];
  regions?: string[];
  locale: Locale;
}

const DEFAULTS: Record<string, string> = {
  periode: "tout",
  pays: "tous",
  entreprise: "toutes",
  region: "toutes",
  statut: "tous",
  type: "tous",
  mois: "actuel",
  annee: String(new Date().getFullYear()),
};

export function DataFilters({ filters, entreprises = [], regions = [], locale }: DataFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const get = (key: string) => searchParams.get(key) ?? DEFAULTS[key] ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const defaultVal = DEFAULTS[key];
      if (value === defaultVal) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset dependent filters
      if (key === "pays") {
        params.delete("region");
        params.delete("entreprise");
      }
      if (key === "region") {
        params.delete("entreprise");
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, searchParams, pathname],
  );

  // Filter entreprises by selected region
  const regionFilter = get("region");
  const filteredEntreprises = regionFilter !== "toutes"
    ? entreprises.filter((e) => e.region === regionFilter)
    : entreprises;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.includes("periode") && (
        <Select value={get("periode")} onValueChange={(v) => updateParam("periode", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder={t("filter.periode", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tout">{t("filter.toute_periode", locale)}</SelectItem>
            <SelectItem value="mois">{t("filter.mois", locale)}</SelectItem>
            <SelectItem value="trimestre">{t("filter.trimestre", locale)}</SelectItem>
            <SelectItem value="annee">{t("filter.annee", locale)}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("statut_offre") && (
        <Select value={get("statut")} onValueChange={(v) => updateParam("statut", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder={t("filter.tous_statuts", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">{t("filter.tous_statuts", locale)}</SelectItem>
            <SelectItem value="en_attente">{t("offres.en_attente", locale)}</SelectItem>
            <SelectItem value="transformee">{t("offres.transformee", locale)}</SelectItem>
            <SelectItem value="partiellement_transformee">{t("offres.partielle", locale)}</SelectItem>
            <SelectItem value="expiree">{t("offres.expiree", locale)}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("type_commande") && (
        <Select value={get("type")} onValueChange={(v) => updateParam("type", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder={t("filter.tous_types", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">{t("filter.tous_types", locale)}</SelectItem>
            <SelectItem value="directe">{t("commandes.directe", locale)}</SelectItem>
            <SelectItem value="egale">{t("commandes.egale", locale)}</SelectItem>
            <SelectItem value="superieure">{t("commandes.superieure", locale)}</SelectItem>
            <SelectItem value="partielle">{t("offres.partielle", locale)}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("pays") && (
        <Select value={get("pays")} onValueChange={(v) => updateParam("pays", v)}>
          <SelectTrigger className="h-8 w-[120px] text-xs font-medium">
            <SelectValue placeholder={t("filter.tous_pays", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">{t("filter.tous_pays", locale)}</SelectItem>
            <SelectItem value="FR">France</SelectItem>
            <SelectItem value="ES">Espagne</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("region") && regions.length > 0 && (
        <Select value={get("region")} onValueChange={(v) => updateParam("region", v)}>
          <SelectTrigger className="h-8 w-[200px] text-xs font-medium">
            <SelectValue placeholder={t("filter.toutes_regions", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">{t("filter.toutes_regions", locale)}</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.includes("entreprise") && (
        <Select value={get("entreprise")} onValueChange={(v) => updateParam("entreprise", v)}>
          <SelectTrigger className="h-8 w-[200px] text-xs font-medium">
            <SelectValue placeholder={t("filter.toutes_entreprises", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">{t("filter.toutes_entreprises", locale)}</SelectItem>
            {filteredEntreprises.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.includes("mois") && (
        <Select value={get("mois")} onValueChange={(v) => updateParam("mois", v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs font-medium">
            <SelectValue placeholder={t("filter.mois_selector", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="actuel">{t("filter.mois", locale)}</SelectItem>
            <SelectItem value="tous">{t("filter.annuel", locale)}</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {t(`month.${i + 1}` as Parameters<typeof t>[0], locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.includes("annee") && (
        <Select value={get("annee")} onValueChange={(v) => updateParam("annee", v)}>
          <SelectTrigger className="h-8 w-[100px] text-xs font-medium">
            <SelectValue placeholder={t("filter.annee_label", locale)} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 3 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/data-filters.tsx
git commit -m "create shared DataFilters component with all filter types"
```

---

### Task 3: Add Filters to Offres Page

**Files:**
- Modify: `app/src/app/(app)/offres/page.tsx`

- [ ] **Step 1: Add imports and searchParams**

Replace the entire page with filtered version (removes `export const revalidate = 300` — page becomes dynamic with searchParams). Key changes:
- Add `searchParams` prop to page function
- Add `Suspense` import
- Import `DataFilters` and `getDateRange`
- Add `PaysEnum` type import
- Conditional Supabase query with `!inner` only when pays filter active
- Input validation: invalid filter params are ignored (show all)
- Dynamic counter

```typescript
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { getDateRange } from "@/lib/formatting";
import type { OffreWithEntreprise, PaysEnum, StatutOffre } from "@/types/database";
import { CsvExportButton } from "@/components/csv-export-button";
import { OffresTable } from "@/components/offres-table";
import { DataFilters } from "@/components/data-filters";
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
}

export default async function OffresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const supabase = await createClient();

  const periode = params.periode ?? "tout";
  // Validate statut param — invalid values ignored (show all)
  const validStatuts = ["en_attente", "transformee", "partiellement_transformee", "expiree"];
  const statutFilter = validStatuts.includes(params.statut ?? "") ? params.statut as StatutOffre : undefined;
  const entrepriseId = params.entreprise;
  const paysFilter = params.pays as PaysEnum | undefined;
  const dateRange = getDateRange(periode);

  // Conditional inner join: only when pays filter active
  const select = paysFilter
    ? "*, entreprises!inner(*)"
    : "*, entreprises(*)";

  let query = supabase
    .from("offres")
    .select(select)
    .order("date_offre", { ascending: false });

  if (statutFilter) query = query.eq("statut", statutFilter);
  if (entrepriseId) query = query.eq("entreprise_id", entrepriseId);
  if (paysFilter) query = query.eq("entreprises.pays", paysFilter);
  if (dateRange) {
    query = query.gte("date_offre", dateRange.debut).lte("date_offre", dateRange.fin);
  }

  const [{ data: offres, error }, { data: entreprises }] = await Promise.all([
    query.returns<OffreWithEntreprise[]>(),
    supabase.from("entreprises").select("id, nom").order("nom"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("offres.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">
            {offres ? `${offres.length} ${offres.length !== 1 ? t("offres.count_plural", locale) : t("offres.count", locale)}` : t("common.chargement", locale)}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <OffresTable offres={offres} locale={locale} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Test in browser**

Navigate to `http://localhost:3000/offres`
- Filters bar visible
- Select "En attente" → only pending offres shown
- Select an entreprise → filtered to that client
- Counter updates dynamically

- [ ] **Step 4: Commit**

```bash
git add app/src/app/(app)/offres/page.tsx
git commit -m "add status/enterprise/period/country filters to offres page"
```

---

### Task 4: Add Filters to Commandes Page

**Files:**
- Modify: `app/src/app/(app)/commandes/page.tsx`

- [ ] **Step 1: Add filters**

Replace the entire page (removes `export const revalidate = 300`). Same pattern as offres. Key differences:
- Filter on `type` (TypeCommande) instead of `statut`
- Query uses `date_commande` instead of `date_offre`
- Keep `offres(*)` as left join (no `!inner`) — commandes directes have `offre_id = null`
- Input validation: invalid type params ignored (show all)

```typescript
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { getDateRange } from "@/lib/formatting";
import type { CommandeWithRelations, PaysEnum, TypeCommande } from "@/types/database";
import { CsvExportButton } from "@/components/csv-export-button";
import { CommandesTable } from "@/components/commandes-table";
import { DataFilters } from "@/components/data-filters";
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
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const supabase = await createClient();

  const periode = params.periode ?? "tout";
  // Validate type param — invalid values ignored (show all)
  const validTypes = ["directe", "egale", "superieure", "partielle"];
  const typeFilter = validTypes.includes(params.type ?? "") ? params.type as TypeCommande : undefined;
  const entrepriseId = params.entreprise;
  const paysFilter = params.pays as PaysEnum | undefined;
  const dateRange = getDateRange(periode);

  // Conditional inner join on entreprises, always left join on offres
  const select = paysFilter
    ? "*, entreprises!inner(*), offres(*)"
    : "*, entreprises(*), offres(*)";

  let query = supabase
    .from("commandes")
    .select(select)
    .order("date_commande", { ascending: false });

  if (typeFilter) query = query.eq("type", typeFilter);
  if (entrepriseId) query = query.eq("entreprise_id", entrepriseId);
  if (paysFilter) query = query.eq("entreprises.pays", paysFilter);
  if (dateRange) {
    query = query.gte("date_commande", dateRange.debut).lte("date_commande", dateRange.fin);
  }

  const [{ data: commandes, error }, { data: entreprises }] = await Promise.all([
    query.returns<CommandeWithRelations[]>(),
    supabase.from("entreprises").select("id, nom").order("nom"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("commandes.title", locale)}</h1>
          <p className="text-xs text-muted-foreground">
            {commandes ? `${commandes.length} ${commandes.length !== 1 ? t("commandes.count_plural", locale) : t("commandes.count", locale)}` : t("common.chargement", locale)}
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

      <CommandesTable commandes={commandes} locale={locale} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Test in browser**

Navigate to `http://localhost:3000/commandes`
- Select "Directe" → only direct commandes shown
- Counter updates

- [ ] **Step 4: Commit**

```bash
git add app/src/app/(app)/commandes/page.tsx
git commit -m "add type/enterprise/period/country filters to commandes page"
```

---

### Task 5: Add Month/Year Selector to Direction Page

**Files:**
- Modify: `app/src/app/(app)/direction/page.tsx`

- [ ] **Step 1: Replace the entire direction page**

Replace the full file content (removes `export const revalidate = 300`). Key changes:
- Add `searchParams`, `Suspense`, `DataFilters`
- Dynamic month/year computation from URL params instead of hardcoded `new Date()`
- `highlightMonth` variable for CA mensuel table highlight
- DataFilters bar with `["mois", "annee"]`

The agent implementing this task should:
1. Read the current `direction/page.tsx` fully
2. Keep ALL existing JSX for KPI cards, cumul annuel, CA mensuel table unchanged
3. Only modify: imports, page function signature (add searchParams), date computation block, title section (add DataFilters), section "Mois en cours" title (show selected period), and CA mensuel highlight logic
4. Replace `export default async function DirectionPage()` with `export default async function DirectionPage({ searchParams })` pattern
5. Replace hardcoded `now.getMonth()` / `now.getFullYear()` with params-driven computation:

```typescript
import { Suspense } from "react";
import { DataFilters } from "@/components/data-filters";
// ... keep all other existing imports ...

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
  const params = await searchParams;
  const supabase = await createClient();

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

  // ... keep existing Promise.all with kpis_direction, ca_mensuel ...
  // ... keep existing kpiMois, kpiAll, caMensuel, errors ...
```

6. Replace title section with DataFilters bar:

```tsx
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="...">{t("direction.title", locale)}</h1>
      <p className="...">{t("direction.subtitle", locale)}</p>
    </div>
    <Suspense>
      <DataFilters filters={["mois", "annee"]} locale={locale} />
    </Suspense>
  </div>
```

7. Replace "Mois en cours" section title:

```tsx
  <h2 className="...">
    {showAnnuel
      ? `${t("filter.annuel", locale)} ${year}`
      : `${t("direction.mois_en_cours", locale)}`}
  </h2>
```

8. Replace CA mensuel highlight condition `m.mois === month + 1` with `m.mois === highlightMonth`

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Test in browser**

Navigate to `http://localhost:3000/direction`
- Default: same as before (current month)
- Select "Janvier" → KPIs for January
- Select "Annuel" → full year KPIs
- Change year to 2025 → recalculated

- [ ] **Step 4: Commit**

```bash
git add app/src/app/(app)/direction/page.tsx
git commit -m "add month/year selector to direction page"
```

---

### Task 6: Swap Analyse Filters to DataFilters + Region

**Files:**
- Modify: `app/src/app/(app)/analyse/page.tsx`

- [ ] **Step 1: Replace AnalyseFilters with DataFilters**

Replace `import { AnalyseFilters }` with `import { DataFilters }`.

Add `region` to search params interface.

Extract region list from `statsRegion` data (already fetched).

Add region client-side filtering on `recurrenceClients` and `statsRegion`.

```typescript
// In searchParams interface, add:
  region?: string;

// After data fetching, add region filter:
  const regionFilter = params.region;
  const regionList = statsRegion
    .map((r) => r.region)
    .filter((r) => r !== "Non renseigné");

  // Known limitation: region filter only applies to geographic table,
  // NOT to recurrence_clients (RPC does not return region field).
  // This is acceptable — recurrence table still filters by pays.

  const filteredRegion = regionFilter
    ? statsRegion.filter((r) => r.region === regionFilter)
    : statsRegion;
```

Replace `<AnalyseFilters locale={locale} />` with:

```tsx
<DataFilters
  filters={["periode", "pays", "region"]}
  regions={regionList}
  locale={locale}
/>
```

Use `filteredRegion` instead of `statsRegion` in the geographic table section.

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(app)/analyse/page.tsx
git commit -m "swap analyse filters to DataFilters with region filter"
```

---

### Task 7: Swap Dashboard Filters to DataFilters + Region

**Files:**
- Modify: `app/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace DashboardFilters with DataFilters**

Replace `import { DashboardFilters }` with `import { DataFilters }`.

**Important:** The `expirees` search param and any ExpiredOffersToggle component must remain alongside DataFilters — DataFilters does not handle this filter type.

Add `region` to search params interface.

Fetch entreprises with region field: `.select("id, nom, region")`.

Filter entreprise list by selected region before passing to DataFilters.

Extract region list from entreprises.

```typescript
// In searchParams, add:
  region?: string;

// After fetching entreprises:
  const regionFilter = params.region;
  const regionList = [...new Set(
    (entreprises ?? [])
      .map((e) => e.region)
      .filter((r): r is string => r !== null && r !== undefined)
  )].sort();
```

Replace `<DashboardFilters>` with:

```tsx
<DataFilters
  filters={["periode", "pays", "region", "entreprise"]}
  entreprises={(entreprises ?? []).map((e) => ({ id: e.id, nom: e.nom, region: e.region ?? null }))}
  regions={regionList}
  locale={locale}
/>
```

Update the entreprises query to include region:

```typescript
supabase.from("entreprises").select("id, nom, region").order("nom"),
```

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(app)/dashboard/page.tsx
git commit -m "swap dashboard filters to DataFilters with region filter"
```

---

### Task 8: Enhanced Search SQL Migration

**Files:**
- Create: `scripts/022-search-enhanced.sql`

- [ ] **Step 1: Write the migration**

Create `scripts/022-search-enhanced.sql` with the full RPC from the spec (see spec section 6 for complete SQL). Key additions: `statut TEXT` and `entreprise_id UUID` columns in return type. Also searches `noms_alternatifs` for enterprise alias matching.

- [ ] **Step 2: Execute on Supabase**

```bash
source .env && cat scripts/022-search-enhanced.sql | supabase db query --linked --agent=yes
```

- [ ] **Step 3: Test the RPC**

```bash
source .env && supabase db query --linked "
SELECT * FROM recherche_globale('AgriForm', 5);
" --agent=yes -o table
```

Expected: Results with `statut` and `entreprise_id` populated for offre results.

- [ ] **Step 4: Commit**

```bash
git add scripts/022-search-enhanced.sql
git commit -m "enhance recherche_globale RPC with statut and entreprise_id"
```

---

### Task 9: Enhance Global Search Component

**Files:**
- Modify: `app/src/components/global-search.tsx`

- [ ] **Step 1: Update SearchResult interface and rendering**

Add `statut` and `entreprise_id` to `SearchResult` interface.

Add status badge rendering for offre results. Add filtered enterprise link.

In the result button, after the title line, add statut badge:

```tsx
{r.result_type === "offre" && r.statut && (
  <span className={cn(
    "ml-1 inline-flex rounded px-1 py-0.5 text-[9px] font-medium",
    r.statut === "en_attente" && "bg-amber-100 text-amber-700",
    r.statut === "transformee" && "bg-teal/10 text-teal",
    r.statut === "expiree" && "bg-red-100 text-red-700",
    r.statut === "partiellement_transformee" && "bg-orange-100 text-orange-700",
  )}>
    {r.statut === "en_attente" ? "En attente"
      : r.statut === "transformee" ? "Transformée"
      : r.statut === "expiree" ? "Expirée"
      : "Partielle"}
  </span>
)}
```

Update `navigate` function to use filtered links:

```typescript
const navigate = useCallback(
  (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (result.entreprise_id && result.result_type !== "entreprise") {
      router.push(`${result.href}?entreprise=${result.entreprise_id}`);
    } else if (result.result_type === "entreprise") {
      router.push(`/offres?entreprise=${result.result_id}`);
    } else {
      router.push(result.href);
    }
  },
  [router],
);
```

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Test in browser**

Open search (Ctrl+K), type "AgriForm":
- Offre results show status badge (yellow "En attente" or green "Transformée")
- Clicking an offre navigates to `/offres?entreprise=<id>`
- Clicking an entreprise navigates to `/offres?entreprise=<id>`

- [ ] **Step 4: Commit**

```bash
git add app/src/components/global-search.tsx
git commit -m "add status badges and filtered links to global search"
```

---

### Task 10: Delete Old Filter Components

**Files:**
- Delete: `app/src/components/dashboard-filters.tsx`
- Delete: `app/src/components/analyse-filters.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "dashboard-filters\|analyse-filters\|DashboardFilters\|AnalyseFilters" app/src/ --include="*.tsx" --include="*.ts"`
Expected: No results (already replaced in tasks 6-7)

- [ ] **Step 2: Delete old files**

```bash
rm app/src/components/dashboard-filters.tsx app/src/components/analyse-filters.tsx
```

- [ ] **Step 3: Full build check**

Run: `cd app && npm run build 2>&1 | tail -25`
Expected: Build succeeds, all pages compiled

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "remove old dashboard-filters and analyse-filters components"
```

---

## Acceptance Criteria

- [ ] AC1: `/offres` has Statut, Entreprise, Période, Pays filters — server-side filtering
- [ ] AC2: `/commandes` has Type, Entreprise, Période, Pays filters — server-side filtering
- [ ] AC3: `/direction` has Mois and Année selectors — dynamic KPI computation
- [ ] AC4: `/analyse` has Région filter — client-side filtering on geographic table (known limitation: region filter does not apply to recurrence_clients table, only to geographic breakdown)
- [ ] AC5: `/dashboard` has Région filter — pre-filters entreprise dropdown
- [ ] AC6: Global search shows status badges on offre results
- [ ] AC7: Global search clicking navigates to filtered pages
- [ ] AC8: Old filter components deleted, DataFilters used everywhere
- [ ] AC9: Build passes, no TypeScript errors
- [ ] AC10: i18n: all new keys have FR + ES translations
