# Dashboard Géographique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a geographic breakdown section to the /analyse page, showing client distribution, orders, and revenue by French region using the existing `stats_par_region()` RPC.

**Architecture:** Server-side data fetching via Supabase RPC in the Next.js Server Component. Table-based layout matching existing patterns (top matériaux, clients récurrents). No new components — reuses existing Table/Badge/CsvExportButton. The RPC already exists in production (migration 020).

**Tech Stack:** Next.js 15 App Router (Server Components), Supabase RPC, shadcn/ui Table, Tailwind CSS, lucide-react icons, i18n (FR/ES).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/src/types/database.ts` | Already modified | `StatsParRegion` type + `PaysEnum` extended + `Entreprise` enriched |
| `app/src/lib/i18n.ts` | Modify | Add 6 translations for geographic section (FR/ES) |
| `app/src/app/(app)/analyse/page.tsx` | Modify | Fetch `stats_par_region()` RPC + render geographic table |

## Existing Patterns to Follow

- **Section header:** `<h2>` with lucide icon + condensed uppercase font + count badge (see `analyse/page.tsx:98-108`)
- **Table:** shadcn Table with `table-header-industrial` header style (see `analyse/page.tsx:122-154`)
- **CSV export:** `<CsvExportButton>` with headers array (see `analyse/page.tsx:109-119`)
- **Badge:** `<Badge>` for visual markers (see `analyse/page.tsx:200-202` for pays badge pattern)
- **KPI values:** `kpi-value` class for numeric cells, `formatCurrency()` for EUR amounts
- **Empty state:** centered `text-muted-foreground` message in `colSpan` cell
- **Section separator:** `section-divider` class on container div

## Relevant Files for Reference

- `app/src/app/(app)/analyse/page.tsx` — page to modify, follow existing section patterns
- `app/src/app/(app)/dashboard/page.tsx:252-292` — "Répartition par pays" section (uses Globe icon)
- `app/src/components/csv-export-button.tsx` — props: `{ data, filename, headers: {key, label}[] }`
- `app/src/lib/formatting.ts` — `formatCurrency()` helper
- `app/src/lib/i18n.ts` — `t(key, locale)` translation function
- `app/src/types/database.ts` — `StatsParRegion` type (already added)

---

### Task 1: Add i18n Translations

**Files:**
- Modify: `app/src/lib/i18n.ts:101-116` (analyse section)

- [ ] **Step 1: Add geographic section translations**

In `app/src/lib/i18n.ts`, add these entries after the `"analyse.pas_assez_donnees"` entry (line ~116):

```typescript
  // Analyse — Geographic
  "analyse.repartition_geo": { fr: "Répartition géographique", es: "Distribución geográfica" },
  "analyse.region": { fr: "Région", es: "Región" },
  "analyse.clients": { fr: "Clients", es: "Clientes" },
  "analyse.offres": { fr: "Offres", es: "Ofertas" },
  "analyse.nb_commandes": { fr: "Commandes", es: "Pedidos" },
  "analyse.aucune_region": { fr: "Aucune donnée géographique", es: "Sin datos geográficos" },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to i18n keys

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/i18n.ts
git commit -m "add i18n translations for geographic analysis section"
```

---

### Task 2: Fetch stats_par_region in /analyse Page

**Files:**
- Modify: `app/src/app/(app)/analyse/page.tsx:1-8` (imports)
- Modify: `app/src/app/(app)/analyse/page.tsx:59-62` (data fetching)
- Modify: `app/src/app/(app)/analyse/page.tsx:64-75` (results + errors)

- [ ] **Step 1: Update imports**

In `analyse/page.tsx`, update the type import (line 7) to include `StatsParRegion`:

```typescript
import type { TopMateriau, RecurrenceClient, PaysEnum, StatsParRegion } from "@/types/database";
```

Add `MapPin` to the lucide-react import (line 17):

```typescript
import { Package, RefreshCw, MapPin } from "lucide-react";
```

- [ ] **Step 2: Add stats_par_region to the parallel fetch**

Replace the `Promise.all` block (lines 59-62) with:

```typescript
  const [materiauxResult, recurrenceResult, regionResult] = await Promise.all([
    supabase.rpc("top_materiaux", materiauxParams),
    supabase.rpc("recurrence_clients", recurrenceParams),
    supabase.rpc("stats_par_region"),
  ]);
```

- [ ] **Step 3: Add result processing**

After the existing `recurrenceClientsRaw` line (line 65), add:

```typescript
  const statsRegion: StatsParRegion[] = regionResult.data ?? [];
```

Update the errors array (line 73) to include regionResult:

```typescript
  const errors = [materiauxResult, recurrenceResult, regionResult]
    .filter((r) => r.error)
    .map((r) => r.error!.message);
```

- [ ] **Step 4: Verify no runtime errors**

Run: `cd app && npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add app/src/app/(app)/analyse/page.tsx
git commit -m "fetch stats_par_region RPC in analyse page"
```

---

### Task 3: Render Geographic Table Section

**Files:**
- Modify: `app/src/app/(app)/analyse/page.tsx:219-221` (before closing divs)

- [ ] **Step 1: Add the geographic section**

Insert after the "Clients récurrents" section closing `</div>` (line 220), before the final `</div>` (line 221):

```tsx
      {/* Répartition géographique */}
      <div className="section-divider">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {t("analyse.repartition_geo", locale)}
            {statsRegion.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
                {statsRegion.length}
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
              {statsRegion.length > 0 ? (
                statsRegion.map((r, i) => (
                  <TableRow key={r.region} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{r.region}</TableCell>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `cd app && npm run build 2>&1 | tail -20`
Expected: Build succeeds, `/analyse` page compiled

- [ ] **Step 4: Commit**

```bash
git add app/src/app/(app)/analyse/page.tsx
git commit -m "add geographic breakdown table to analyse page"
```

---

### Task 4: Visual Verification

- [ ] **Step 1: Start dev server and verify**

Run: `cd app && npm run dev`
Navigate to: `http://localhost:3000/analyse`

Expected:
- Three sections visible: "Pièces les plus vendues", "Clients récurrents", "Répartition géographique"
- Geographic table shows 14 regions (Auvergne-Rhône-Alpes at top with 28 clients)
- "Non renseigné" appears for clients without region data (118 clients)
- CSV export button works
- Count badge shows region count

- [ ] **Step 2: Verify filters don't break**

Test: Change Période and Pays filters
Expected: Geographic section stays visible (not affected by filters — `stats_par_region()` has no params)

---

## Acceptance Criteria

- [ ] AC1: `/analyse` page shows geographic table with region, clients, offres, commandes, CA
- [ ] AC2: Data comes from `stats_par_region()` RPC (14 regions)
- [ ] AC3: Table follows existing pattern (header, badges, CSV export)
- [ ] AC4: i18n: FR + ES translations present
- [ ] AC5: TypeScript types updated (StatsParRegion, PaysEnum, Entreprise)
- [ ] AC6: Build passes (`npm run build`)
