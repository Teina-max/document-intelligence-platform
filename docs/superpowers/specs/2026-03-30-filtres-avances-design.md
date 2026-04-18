# Filtres Avancés — Design Spec

## Goal

Add advanced filters across all dashboard pages to give Alice (daily user) fast document lookup and Éric Martin (DG) period comparison capabilities. Combined with enhanced global search, this enables the core workflow: identify untransformed offers → trigger relances → increase conversion rate from 43% to 50%+.

## Context

- **Alice** processes 15 offres + 5-10 commandes/day, currently on paper notebook
- **Éric Martin** needs KPI comparison across periods for comité de direction
- Meeting 26/03: filtering offres by status explicitly requested for relance automation
- 239 clients imported with region/department data (migration 020-021)
- Current filters: Dashboard has Période/Pays/Entreprise, Analyse has Période/Pays, Direction and Offres/Commandes have none

## Architecture

### Shared Component: `<DataFilters>`

Single reusable client component replacing existing `dashboard-filters.tsx` and `analyse-filters.tsx`.

```typescript
interface DataFiltersProps {
  filters: FilterType[];
  entreprises?: { id: string; nom: string; region: string | null }[];
  regions?: string[];
  locale: Locale;
}

type FilterType =
  | "periode"        // Toute période, Mois, Trimestre, Année
  | "pays"           // Tous, FR, ES
  | "entreprise"     // Toutes, [dynamic list]
  | "region"         // Toutes, [dynamic list]
  | "statut_offre"   // Tous, en_attente, transformee, partiellement_transformee, expiree
  | "type_commande"  // Tous, directe, egale, superieure, partielle
  | "mois"           // Tous (annuel), Janvier-Décembre
  | "annee";         // 2026, 2025, ...
```

**Routing:** Uses `usePathname()` to infer the current page path (no hardcoded routes). All filters use URL search params (existing pattern). Selecting a filter updates `?param=value` via `useRouter().push()`. Default values are omitted from URL. `URLSearchParams` handles encoding automatically (safe for region names with accents/spaces).

**Suspense requirement:** DataFilters uses `useSearchParams()` — it **must** be wrapped in `<Suspense>` in every server component that renders it (existing pattern in dashboard/analyse).

**Dependent filter reset:** When region changes, reset entreprise to "toutes". When pays changes, reset région and entreprise. This prevents stale filter combinations.

**File:** `app/src/components/data-filters.tsx` (new, replaces dashboard-filters + analyse-filters)

### Page-by-Page Changes

---

### 1. `/offres` — Status, Enterprise, Period, Country

**Filters:** `["periode", "statut_offre", "entreprise", "pays"]`

**URL:** `/offres?statut=en_attente&entreprise=<uuid>&periode=mois&pays=FR`

**Search params:**

| Param | Type | Default | Maps to |
|-------|------|---------|---------|
| `periode` | string | "tout" | `getDateRange()` → `.gte("date_offre", debut).lte("date_offre", fin)` |
| `statut` | StatutOffre | all | `.eq("statut", value)` |
| `entreprise` | UUID | all | `.eq("entreprise_id", value)` |
| `pays` | PaysEnum | all | `.eq("entreprises.pays", value)` via inner join |

**Query change — conditional inner join:**

The `!inner` join is **only used when pays filter is active** (otherwise offres with missing/deleted entreprise would silently disappear):

```typescript
const select = paysFilter
  ? "*, entreprises!inner(*)"
  : "*, entreprises(*)";
let query = supabase.from("offres").select(select)
  .order("date_offre", { ascending: false });

if (statut) query = query.eq("statut", statut);
if (entrepriseId) query = query.eq("entreprise_id", entrepriseId);
if (paysFilter) query = query.eq("entreprises.pays", paysFilter);
if (dateRange) {
  query = query.gte("date_offre", dateRange.debut).lte("date_offre", dateRange.fin);
}
```

**Counter:** Display filtered count in page header: "13 offres" (dynamic).

**ISR note:** Adding `searchParams` makes this page fully dynamic (ISR `revalidate` is ignored by Next.js 15). Acceptable for this use case — Alice needs real-time data.

**Files:**
- Modify: `app/src/app/(app)/offres/page.tsx` — add searchParams, conditional queries, counter
- Use: `app/src/components/data-filters.tsx` (new shared component)

---

### 2. `/commandes` — Type, Enterprise, Period, Country

**Filters:** `["periode", "type_commande", "entreprise", "pays"]`

**URL:** `/commandes?type=directe&entreprise=<uuid>&periode=trimestre`

**Search params:**

| Param | Type | Default | Maps to |
|-------|------|---------|---------|
| `periode` | string | "tout" | `getDateRange()` → `.gte("date_commande", debut).lte("date_commande", fin)` |
| `type` | TypeCommande | all | `.eq("type", value)` |
| `entreprise` | UUID | all | `.eq("entreprise_id", value)` |
| `pays` | PaysEnum | all | `.eq("entreprises.pays", value)` via inner join |

**Query change — conditional inner join + explicit left join on offres:**

```typescript
const select = paysFilter
  ? "*, entreprises!inner(*), offres(*)"
  : "*, entreprises(*), offres(*)";
```

**Important:** `offres(*)` must remain a left join (no `!inner`) — commandes directes have `offre_id = null` and would vanish with an inner join.

**Counter:** "26 commandes" (dynamic).

**ISR note:** Same as offres — becomes dynamic with searchParams.

**Files:**
- Modify: `app/src/app/(app)/commandes/page.tsx`
- Use: `app/src/components/data-filters.tsx`

---

### 3. `/direction` — Month & Year selector

**Filters:** `["mois", "annee"]`

**URL:** `/direction?mois=3&annee=2026`

**Search params:**

| Param | Type | Default | Maps to |
|-------|------|---------|---------|
| `mois` | number (1-12) or "tous" | current month | `kpis_direction(p_date_debut, p_date_fin)` |
| `annee` | number | current year | `ca_mensuel(p_annee)` |

**Behavior:**
- Default: current month KPIs + current year CA mensuel (same as today)
- Select different month: KPIs for that month, evolution vs previous month
- Select "Tous": annual KPIs (call `kpis_direction()` without date params)
- Change year: `ca_mensuel` recalculated for that year

**No new RPCs needed.** `kpis_direction` and `ca_mensuel` already accept these params — currently hardcoded in the page.

**Files:**
- Modify: `app/src/app/(app)/direction/page.tsx` — add searchParams, dynamic date computation
- Use: `app/src/components/data-filters.tsx`

---

### 4. `/analyse` — Add Region filter

**Filters:** `["periode", "pays", "region"]` (was: periode, pays)

**URL:** `/analyse?periode=trimestre&pays=FR&region=NORMANDIE`

**Search params:**

| Param | Type | Default | Maps to |
|-------|------|---------|---------|
| `region` | string | all | Client-side filter on recurrence_clients and stats_par_region |

**Filtering approach:** Client-side. RPCs `top_materiaux` and `recurrence_clients` don't accept `p_region`. Filter by joining on entreprise.region in the result set (same pattern as existing pays client-side filter on recurrence_clients).

**Region list:** Fetched from `stats_par_region()` RPC result (already called in page) ��� extract distinct region names.

**Files:**
- Modify: `app/src/app/(app)/analyse/page.tsx` — add region searchParam, client-side filtering
- Use: `app/src/components/data-filters.tsx` (replaces analyse-filters.tsx)

---

### 5. `/dashboard` — Add Region filter

**Filters:** `["periode", "pays", "region", "entreprise"]` (was: periode, pays, entreprise)

**URL:** `/dashboard?periode=mois&pays=FR&region=NORMANDIE&entreprise=<uuid>`

**Behavior:** Region acts as a pre-filter on the entreprise dropdown. Selecting "NORMANDIE" shows only enterprises in that region in the entreprise dropdown. When region changes, enterprise resets to "toutes".

**Filtering:** RPCs accept `p_entreprise_id` — region narrows the enterprise list, then the selected enterprise filters the RPCs. No RPC changes needed.

**Files:**
- Modify: `app/src/app/(app)/dashboard/page.tsx` — add region param, filter entreprise list
- Use: `app/src/components/data-filters.tsx` (replaces dashboard-filters.tsx)

---

### 6. Global Search Enhancement

**File:** `app/src/components/global-search.tsx`

**Current:** Search returns results with type/title/subtitle/href. `SearchResult` interface at `global-search.tsx:9`.

**Enhancements:**

1. **Status badge in results:** When result_type is "offre", display the statut as a colored badge next to the title. Reuse existing i18n keys: `offres.en_attente`, `offres.transformee`, `offres.partielle`, `offres.expiree`. Colors: en_attente=yellow, transformee=green, partielle=amber, expiree=red.

2. **Filtered action link:** Clicking an offre result navigates to `/offres?entreprise=<entreprise_id>` (all offres for that client, no forced statut). A secondary small icon link offers `/offres?entreprise=<id>&statut=en_attente` for quick "see pending offers" access.

**SearchResult type update** (in `global-search.tsx`):

```typescript
interface SearchResult {
  result_type: "offre" | "commande" | "entreprise";
  result_id: string;
  title: string;
  subtitle: string | null;
  href: string;
  statut?: string | null;        // NEW: offre statut
  entreprise_id?: string | null;  // NEW: for filtered links
}
```

**SQL migration required** — `recherche_globale` RPC change:

```sql
-- Migration 022: Add statut and entreprise_id to recherche_globale results
DROP FUNCTION IF EXISTS recherche_globale(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION recherche_globale(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  title TEXT,
  subtitle TEXT,
  href TEXT,
  statut TEXT,
  entreprise_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Offres: include statut and entreprise_id
  (SELECT
    'offre'::TEXT as result_type,
    o.id as result_id,
    o.reference_offre as title,
    e.nom as subtitle,
    '/offres' as href,
    o.statut::TEXT as statut,
    o.entreprise_id as entreprise_id
  FROM offres o
  LEFT JOIN entreprises e ON e.id = o.entreprise_id
  WHERE o.reference_offre ILIKE '%' || p_query || '%'
     OR e.nom ILIKE '%' || p_query || '%'
  ORDER BY o.date_offre DESC
  LIMIT p_limit)

  UNION ALL

  -- Commandes: statut=NULL, include entreprise_id
  (SELECT
    'commande'::TEXT,
    c.id,
    c.reference_commande,
    e.nom,
    '/commandes',
    NULL::TEXT,
    c.entreprise_id
  FROM commandes c
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE c.reference_commande ILIKE '%' || p_query || '%'
     OR e.nom ILIKE '%' || p_query || '%'
  ORDER BY c.date_commande DESC
  LIMIT p_limit)

  UNION ALL

  -- Entreprises: statut=NULL, entreprise_id=self
  (SELECT
    'entreprise'::TEXT,
    e.id,
    e.nom,
    e.code_postal,
    '/offres',
    NULL::TEXT,
    e.id
  FROM entreprises e
  WHERE e.nom ILIKE '%' || p_query || '%'
     OR e.numero_client ILIKE '%' || p_query || '%'
     OR EXISTS(SELECT 1 FROM unnest(e.noms_alternatifs) AS alias WHERE alias ILIKE '%' || p_query || '%')
  ORDER BY e.nom
  LIMIT p_limit)
$$;
```

**Note:** The RPC also searches `noms_alternatifs` for enterprise alias matches (leveraging migration 021 smart matching data).

**Files:**
- Modify: `app/src/components/global-search.tsx` — update interface, add badge rendering, filtered links
- Create: `scripts/022-search-enhanced.sql` — DROP + CREATE recherche_globale with statut/entreprise_id

---

## i18n

New translation keys needed:

```typescript
// DataFilters
"filter.toutes_regions": { fr: "Toutes régions", es: "Todas las regiones" }
"filter.tous_statuts": { fr: "Tous statuts", es: "Todos los estados" }
"filter.tous_types": { fr: "Tous types", es: "Todos los tipos" }
"filter.mois_selector": { fr: "Mois", es: "Mes" }
"filter.annee_label": { fr: "Année", es: "Año" }
"filter.annuel": { fr: "Annuel", es: "Anual" }

// Month names (for direction selector)
"month.1": { fr: "Janvier", es: "Enero" }
"month.2": { fr: "Février", es: "Febrero" }
"month.3": { fr: "Mars", es: "Marzo" }
"month.4": { fr: "Avril", es: "Abril" }
"month.5": { fr: "Mai", es: "Mayo" }
"month.6": { fr: "Juin", es: "Junio" }
"month.7": { fr: "Juillet", es: "Julio" }
"month.8": { fr: "Août", es: "Agosto" }
"month.9": { fr: "Septembre", es: "Septiembre" }
"month.10": { fr: "Octobre", es: "Octubre" }
"month.11": { fr: "Novembre", es: "Noviembre" }
"month.12": { fr: "Décembre", es: "Diciembre" }

// Counters
"offres.count_filtered": { fr: "{count} offre(s)", es: "{count} oferta(s)" }
"commandes.count_filtered": { fr: "{count} commande(s)", es: "{count} pedido(s)" }
```

**Reused existing keys:** `offres.en_attente`, `offres.transformee`, `offres.partielle`, `offres.expiree` for search result status badges.

**Note:** `filter.mois_selector` is distinct from existing `filter.mois` ("Mois en cours" in p��riode filter) to avoid semantic collision.

## Design Decisions

- **Pays filter limited to FR/ES** by design (matches current business scope: 186 FR, 50 ES, 3 others). If MA/TN/RE clients grow, DataFilters should dynamically populate from distinct `entreprises.pays` values.
- **ISR → Dynamic:** Adding `searchParams` to offres/commandes/direction makes them fully dynamic (Next.js 15 ignores `revalidate`). Acceptable — Alice needs real-time data, and Supabase load is minimal for 239 clients.
- **Client-side region filtering on /analyse:** Acceptable for 239 clients. If dataset grows significantly, add `p_region` params to RPCs.

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `app/src/components/data-filters.tsx` | **Create** | Shared filter bar component (usePathname, useSearchParams) |
| `app/src/components/dashboard-filters.tsx` | **Delete** | Replaced by data-filters |
| `app/src/components/analyse-filters.tsx` | **Delete** | Replaced by data-filters |
| `app/src/app/(app)/offres/page.tsx` | Modify | Add searchParams + filters + conditional queries + counter |
| `app/src/app/(app)/commandes/page.tsx` | Modify | Add searchParams + filters + conditional queries + counter |
| `app/src/app/(app)/direction/page.tsx` | Modify | Add searchParams + dynamic month/year |
| `app/src/app/(app)/analyse/page.tsx` | Modify | Add region filter, use DataFilters |
| `app/src/app/(app)/dashboard/page.tsx` | Modify | Add region filter, use DataFilters |
| `app/src/components/global-search.tsx` | Modify | SearchResult type + status badges + filtered links |
| `app/src/lib/i18n.ts` | Modify | ~20 new translation keys |
| `scripts/022-search-enhanced.sql` | **Create** | Enhanced recherche_globale RPC |

## Testing

Basic E2E smoke tests to add (extend existing Playwright suite):

- `/offres?statut=en_attente` renders without error, shows filtered results
- `/commandes?type=directe` renders without error
- `/direction?mois=1&annee=2026` renders January KPIs
- `/analyse?region=NORMANDIE` renders filtered geographic table
- `/dashboard?region=NORMANDIE` filters enterprise dropdown
- Invalid filter params (e.g., `?statut=invalid`) gracefully ignored (show all)

## Out of Scope

- Invoice tracking module (mentioned in meeting — separate feature)
- Inactive client management (needs discussion with stakeholders)
- Modifying RPCs to accept `p_region` parameter (client-side filtering sufficient for 239 clients)
