# UX Quick Wins Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve daily UX for Alice (commercial assistant) during the test phase — pagination, batch relances, urgency badges, designation translation, and dashboard polish.

**Architecture:** Server-side pagination via Supabase `.range()` + `{ count: 'exact' }`. URL query params for all filter/sort/page state. Selection state via Zustand store. Translation via Supabase Edge Function triggered by database webhook on INSERT.

**Tech Stack:** Next.js 16 App Router, shadcn/ui, Tailwind v4, Supabase (PostgreSQL + Edge Functions), Claude API for translation.

**Spec:** `docs/superpowers/specs/2026-04-08-ux-quick-wins-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `app/src/components/pagination.tsx` | Reusable pagination controls (prev/next/page indicator) |
| `app/src/components/floating-action-bar.tsx` | Sticky bottom bar for batch actions on selected rows |
| `app/src/components/sortable-header.tsx` | Clickable table header with sort arrow |
| `app/src/components/urgency-badge.tsx` | Color-coded urgency badge with pulsing animation |
| `app/src/stores/selection-store.ts` | Zustand store for row selection state |
| `scripts/030-designation-fr-column.sql` | Migration: add designation_fr to offre_lignes + commande_lignes |
| `scripts/translate-designations.ts` | Backfill script: batch-translate existing designations |
| `supabase/functions/translate-designation/index.ts` | Edge Function: detect language + translate via Claude API |

### Modified Files
| File | Changes |
|------|---------|
| `app/src/app/(app)/offres/page.tsx` | Add pagination, sort params, contextual counters |
| `app/src/app/(app)/commandes/page.tsx` | Add pagination, sort params |
| `app/src/components/offres-table.tsx` | Sortable headers, selection checkboxes, urgency column, floating bar |
| `app/src/components/commandes-table.tsx` | Sortable headers, pagination |
| `app/src/components/data-filters.tsx` | Add urgency quick filter toggle |
| `app/src/app/(app)/dashboard/page.tsx` | Reduce section limits to 5, add "Voir plus" to top clients |
| `app/src/components/recent-activity-section.tsx` | Reduce to 5 items + "Voir plus" |
| `app/src/components/offres-non-transformees-section.tsx` | Change INITIAL_LIMIT from 10 to 5 |
| `app/src/components/app-sidebar.tsx` | Add urgency badge on Offres nav item |
| `app/src/components/expandable-row.tsx` | Show designation_fr with tooltip for original |
| `app/src/types/database.ts` | Add designation_fr to Designation interface |
| `app/src/globals.css` | Add pulsing animation for urgent badges |

---

## Task 1: Pagination Component

**Files:**
- Create: `app/src/components/pagination.tsx`

- [ ] **Step 1: Create the pagination component**

```tsx
// app/src/components/pagination.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  stats?: { label: string; value: number; color?: string }[];
}

export function Pagination({ currentPage, totalPages, totalCount, stats }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between border-b border-border/40 px-1 py-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{totalCount} résultats</span>
        {stats?.map((s) => (
          <span key={s.label} className={s.color ?? ""}>
            · {s.value} {s.label}
          </span>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component builds**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | head -30`
Expected: Build succeeds (component not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add app/src/components/pagination.tsx
git commit -m "add reusable pagination component"
```

---

## Task 2: Sortable Header Component

**Files:**
- Create: `app/src/components/sortable-header.tsx`

- [ ] **Step 1: Create the sortable header component**

```tsx
// app/src/components/sortable-header.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SortableHeaderProps {
  column: string;
  label: string;
  className?: string;
}

export function SortableHeader({ column, label, className }: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentSort = searchParams.get("sort_by");
  const currentOrder = searchParams.get("sort_order") ?? "desc";
  const isActive = currentSort === column;

  function toggleSort() {
    const params = new URLSearchParams(searchParams.toString());
    if (isActive && currentOrder === "desc") {
      params.set("sort_by", column);
      params.set("sort_order", "asc");
    } else if (isActive && currentOrder === "asc") {
      params.delete("sort_by");
      params.delete("sort_order");
    } else {
      params.set("sort_by", column);
      params.set("sort_order", "desc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const Icon = isActive ? (currentOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={toggleSort}
      className={`inline-flex items-center gap-1 text-left hover:text-foreground transition-colors ${className ?? ""}`}
    >
      {label}
      <Icon className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/sortable-header.tsx
git commit -m "add sortable header component"
```

---

## Task 3: Offres Page — Pagination + Sorting

**Files:**
- Modify: `app/src/app/(app)/offres/page.tsx`
- Modify: `app/src/components/offres-table.tsx`

- [ ] **Step 1: Read current offres page**

Read: `app/src/app/(app)/offres/page.tsx` (full file)

- [ ] **Step 2: Add pagination and sort params to offres page**

In `offres/page.tsx`, update the SearchParams interface and data fetching:

```typescript
// Add to SearchParams interface
interface SearchParams {
  periode?: string;
  statut?: string;
  entreprise?: string;
  pays?: string;
  page?: string;       // NEW
  sort_by?: string;    // NEW
  sort_order?: string;  // NEW
  urgentes?: string;   // NEW (for urgency filter)
}
```

Replace the Supabase query section. The key changes:
- Parse `page` (default 1), `sort_by` (default "date_offre"), `sort_order` (default "desc")
- Use `.range(from, to)` with `PAGE_SIZE = 30`
- Add `{ count: 'exact' }` to the select options
- Add stats subqueries for expiring_soon and no_relance counts
- Add urgentes filter: if set, filter `date_expiration` within 15 days
- Dynamic `.order()` based on sort params

Valid sort columns: `date_offre`, `date_expiration`, `montant_ht`, `reference_offre`, `statut`

Pass new props to OffresTable: `currentPage`, `totalPages`, `totalCount`, `stats`

- [ ] **Step 3: Compute pagination stats in the page**

After the main query, add two count queries in parallel:

```typescript
const PAGE_SIZE = 30;
const page = Math.max(1, parseInt(params.page ?? "1", 10));
const sortBy = params.sort_by ?? "date_offre";
const sortOrder = (params.sort_order ?? "desc") as "asc" | "desc";
const from = (page - 1) * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

// Main query with count
let query = supabase
  .from("offres")
  .select("*, entreprises(*)", { count: "exact" });

// Apply existing filters...
// Apply urgentes filter
if (params.urgentes === "1") {
  const in15Days = new Date();
  in15Days.setDate(in15Days.getDate() + 15);
  query = query
    .gte("date_expiration", new Date().toISOString().split("T")[0])
    .lte("date_expiration", in15Days.toISOString().split("T")[0]);
}

// Sort + paginate
query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

const { data: offres, count: totalCount, error } = await query;

// Stats queries in parallel
const today = new Date().toISOString().split("T")[0];
const in7Days = new Date();
in7Days.setDate(in7Days.getDate() + 7);
const in7DaysStr = in7Days.toISOString().split("T")[0];

const [expiringSoonResult, noRelanceResult] = await Promise.all([
  supabase
    .from("offres")
    .select("id", { count: "exact", head: true })
    .eq("statut", "en_attente")
    .gte("date_expiration", today)
    .lte("date_expiration", in7DaysStr),
  supabase
    .from("offres")
    .select("id", { count: "exact", head: true })
    .eq("statut", "en_attente")
    .is("derniere_relance", null),
]);

const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);
```

- [ ] **Step 4: Update OffresTable props and pass pagination data**

In the page's return JSX, add Pagination component above the table and pass stats:

```tsx
import { Pagination } from "@/components/pagination";

// In the JSX, before <OffresTable>:
<Pagination
  currentPage={page}
  totalPages={totalPages}
  totalCount={totalCount ?? 0}
  stats={[
    { label: "expirent cette semaine", value: expiringSoonResult.count ?? 0, color: "text-destructive" },
    { label: "sans relance", value: noRelanceResult.count ?? 0, color: "text-amber-accent" },
  ]}
/>
<OffresTable offres={offres ?? []} locale={locale} />
// After table, add bottom pagination:
<Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount ?? 0} />
```

- [ ] **Step 5: Read current offres-table component**

Read: `app/src/components/offres-table.tsx` (full file)

- [ ] **Step 6: Add sortable headers to offres-table**

Replace static `TableHead` elements with `SortableHeader` for sortable columns:

```tsx
import { SortableHeader } from "@/components/sortable-header";

// In the TableHeader row, replace:
// <TableHead>Référence</TableHead>
// with:
<TableHead><SortableHeader column="reference_offre" label="Référence" /></TableHead>
<TableHead>Entreprise</TableHead>
<TableHead className="text-right"><SortableHeader column="montant_ht" label="Montant HT" className="justify-end" /></TableHead>
<TableHead><SortableHeader column="date_offre" label="Date offre" /></TableHead>
<TableHead><SortableHeader column="date_expiration" label="Expiration" /></TableHead>
<TableHead><SortableHeader column="statut" label="Statut" /></TableHead>
```

- [ ] **Step 7: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add app/src/app/\(app\)/offres/page.tsx app/src/components/offres-table.tsx
git commit -m "add pagination and sortable columns to offres page"
```

---

## Task 4: Commandes Page — Pagination + Sorting

**Files:**
- Modify: `app/src/app/(app)/commandes/page.tsx`
- Modify: `app/src/components/commandes-table.tsx`

- [ ] **Step 1: Read current commandes page and table**

Read: `app/src/app/(app)/commandes/page.tsx` and `app/src/components/commandes-table.tsx`

- [ ] **Step 2: Add pagination and sort to commandes page**

Same pattern as Task 3 but for commandes:
- Add `page`, `sort_by`, `sort_order` to SearchParams
- Default sort: `date_commande` desc
- Valid sort columns: `date_commande`, `montant_ht`, `reference_commande`, `type`
- Use `.range(from, to)` with PAGE_SIZE = 30
- Add `{ count: 'exact' }` to select
- No stats counters needed (commandes don't have urgency)

- [ ] **Step 3: Add Pagination component above and below commandes table**

```tsx
import { Pagination } from "@/components/pagination";

<Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount ?? 0} />
<CommandesTable commandes={commandes ?? []} locale={locale} />
<Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount ?? 0} />
```

- [ ] **Step 4: Add sortable headers to commandes-table**

```tsx
import { SortableHeader } from "@/components/sortable-header";

<TableHead><SortableHeader column="reference_commande" label="Référence" /></TableHead>
<TableHead>Entreprise</TableHead>
<TableHead>Offre liée</TableHead>
<TableHead className="text-right"><SortableHeader column="montant_ht" label="Montant HT" className="justify-end" /></TableHead>
<TableHead><SortableHeader column="date_commande" label="Date" /></TableHead>
<TableHead><SortableHeader column="type" label="Type" /></TableHead>
```

- [ ] **Step 5: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add app/src/app/\(app\)/commandes/page.tsx app/src/components/commandes-table.tsx
git commit -m "add pagination and sortable columns to commandes page"
```

---

## Task 5: Dashboard Density Reduction

**Files:**
- Modify: `app/src/app/(app)/dashboard/page.tsx` (top_clients limit 10→5, add "Voir plus")
- Modify: `app/src/components/recent-activity-section.tsx` (15→5, add "Voir plus")
- Modify: `app/src/components/offres-non-transformees-section.tsx` (INITIAL_LIMIT 10→5)

- [ ] **Step 1: Read dashboard page, recent activity, and offres non transformees**

Read all three files to understand current limits.

- [ ] **Step 2: Reduce top_clients RPC limit from 10 to 5 on dashboard page**

In `dashboard/page.tsx`, find the `top_clients` RPC call (around line 92) and change:

```typescript
// Before:
p_limit: 10,
// After:
p_limit: 5,
```

Also add a "Voir plus" link below the top clients table that navigates to `/analyse`:

```tsx
// After the top clients table closing tag, add:
<a
  href="/analyse"
  className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
>
  Voir tous les clients
  <ChevronRight className="h-3.5 w-3.5" />
</a>
```

- [ ] **Step 3: Reduce recent activity slice from 15 to 5 + add "Voir plus"**

In `dashboard/page.tsx`, find the `.slice(0, 15)` for merged recent items and change to `.slice(0, 5)`. Then in `recent-activity-section.tsx`, add the same expand/collapse pattern used in `offres-non-transformees-section.tsx`:

```tsx
// Add state
const [expanded, setExpanded] = useState(false);
const INITIAL_LIMIT = 5;
const displayed = expanded ? items : items.slice(0, INITIAL_LIMIT);
const hasMore = items.length > INITIAL_LIMIT;
```

But since the data is sliced server-side to 5, we need to also pass the full list. Two options:
- Increase server-side limit back to 15 and do client-side slicing (simpler)
- Keep server-side at 5 (less data transfer)

Use approach 1: keep server limit at 15, pass full array, slice in component.

In `recent-activity-section.tsx`, add expand/collapse button at the bottom (follow the pattern from `offres-non-transformees-section.tsx` lines 262-280):

```tsx
{hasMore && (
  <button
    type="button"
    onClick={() => setExpanded(!expanded)}
    className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
  >
    {expanded ? (
      <><ChevronUp className="h-3.5 w-3.5" /> Réduire</>
    ) : (
      <><ChevronDown className="h-3.5 w-3.5" /> Voir les {items.length - INITIAL_LIMIT} autres</>
    )}
  </button>
)}
```

- [ ] **Step 4: Change INITIAL_LIMIT in offres-non-transformees from 10 to 5**

In `offres-non-transformees-section.tsx` line 24:

```typescript
// Before:
const INITIAL_LIMIT = 10;
// After:
const INITIAL_LIMIT = 5;
```

- [ ] **Step 5: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add app/src/app/\(app\)/dashboard/page.tsx app/src/components/recent-activity-section.tsx app/src/components/offres-non-transformees-section.tsx
git commit -m "reduce dashboard density: 5 items per section with Voir plus"
```

---

## Task 6: Selection Store + Floating Action Bar

**Files:**
- Create: `app/src/stores/selection-store.ts`
- Create: `app/src/components/floating-action-bar.tsx`

- [ ] **Step 1: Create Zustand selection store**

```typescript
// app/src/stores/selection-store.ts
import { create } from "zustand";

interface SelectionState {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  count: () => number;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  deselectAll: () => set({ selectedIds: new Set() }),
  isSelected: (id) => get().selectedIds.has(id),
  count: () => get().selectedIds.size,
}));
```

- [ ] **Step 2: Create floating action bar component**

```tsx
// app/src/components/floating-action-bar.tsx
"use client";

import { Mail, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelectionStore } from "@/stores/selection-store";

interface FloatingActionBarProps {
  onRelancer: () => void;
  onExportCsv: () => void;
  onDelete: () => void;
  relanceDisabled?: boolean;
  relanceTooltip?: string;
  isAdmin: boolean;
}

export function FloatingActionBar({
  onRelancer,
  onExportCsv,
  onDelete,
  relanceDisabled,
  relanceTooltip,
  isAdmin,
}: FloatingActionBarProps) {
  const count = useSelectionStore((s) => s.selectedIds.size);
  const deselectAll = useSelectionStore((s) => s.deselectAll);

  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-lg">
      <span className="text-sm font-medium">
        {count} offre{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}
      </span>
      <div className="h-5 w-px bg-border" />
      <Button
        size="sm"
        variant="default"
        onClick={onRelancer}
        disabled={relanceDisabled}
        title={relanceTooltip}
      >
        <Mail className="mr-1.5 h-3.5 w-3.5" />
        Relancer
      </Button>
      <Button size="sm" variant="outline" onClick={onExportCsv}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Exporter CSV
      </Button>
      {isAdmin && (
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Supprimer
        </Button>
      )}
      <button
        type="button"
        onClick={deselectAll}
        className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/stores/selection-store.ts app/src/components/floating-action-bar.tsx
git commit -m "add selection store and floating action bar component"
```

---

## Task 7: Wire Selection + Batch Actions into Offres Table

**Files:**
- Modify: `app/src/components/offres-table.tsx`

- [ ] **Step 1: Read current offres-table component**

Read: `app/src/components/offres-table.tsx` (full file)

- [ ] **Step 2: Add selection checkboxes to offres-table**

Import the store and add checkbox column:

```tsx
import { useSelectionStore } from "@/stores/selection-store";
import { FloatingActionBar } from "@/components/floating-action-bar";

// Inside the component, after existing state declarations:
const { selectedIds, toggle, selectAll, deselectAll, isSelected } = useSelectionStore();
const allIds = localOffres.map((o) => o.id);
const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

// Reset selection when offres change (page navigation)
useEffect(() => {
  deselectAll();
}, [offres, deselectAll]);
```

Add checkbox column as first column in TableHeader:

```tsx
<TableHead className="w-10">
  <input
    type="checkbox"
    checked={allSelected}
    onChange={() => allSelected ? deselectAll() : selectAll(allIds)}
    className="h-3.5 w-3.5 rounded border-border accent-primary"
  />
</TableHead>
```

Add checkbox cell as first cell in each TableRow:

```tsx
<TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
  <input
    type="checkbox"
    checked={isSelected(offre.id)}
    onChange={() => toggle(offre.id)}
    className="h-3.5 w-3.5 rounded border-border accent-primary"
  />
</TableCell>
```

Update `colSpan` in ExpandableRow from 10 to 11 to account for checkbox column.

- [ ] **Step 3: Add batch action handlers**

```tsx
// Batch CSV export handler
function handleBatchExport() {
  const selected = localOffres.filter((o) => selectedIds.has(o.id));
  // Reuse existing CSV export logic with selected subset
  // ... (follow pattern from existing CsvExportButton)
}

// Batch relance handler — shows toast since Outlook not configured
function handleBatchRelance() {
  toast.info("Connexion email en cours de configuration");
}

// Batch delete handler
async function handleBatchDelete() {
  if (!confirm(`Supprimer ${selectedIds.size} offre(s) ?`)) return;
  for (const id of selectedIds) {
    await fetch(`/api/offres/${id}`, { method: "DELETE" });
  }
  setLocalOffres((prev) => prev.filter((o) => !selectedIds.has(o.id)));
  deselectAll();
  toast.success(`${selectedIds.size} offre(s) supprimée(s)`);
}
```

- [ ] **Step 4: Add FloatingActionBar to the component**

At the bottom of the component return, before the closing fragment:

```tsx
<FloatingActionBar
  onRelancer={handleBatchRelance}
  onExportCsv={handleBatchExport}
  onDelete={handleBatchDelete}
  relanceDisabled={true}
  relanceTooltip="Connexion email en cours de configuration"
  isAdmin={/* pass isAdmin prop from page */}
/>
```

Note: `isAdmin` needs to be passed as a prop from the page. Add it to OffresTable props interface.

- [ ] **Step 5: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add app/src/components/offres-table.tsx app/src/app/\(app\)/offres/page.tsx
git commit -m "add selection checkboxes and batch actions to offres table"
```

---

## Task 8: Urgency Badge + Column + Quick Filter

**Files:**
- Create: `app/src/components/urgency-badge.tsx`
- Modify: `app/src/components/offres-table.tsx`
- Modify: `app/src/globals.css` (or `app/src/app/globals.css`)
- Modify: `app/src/components/data-filters.tsx`

- [ ] **Step 1: Find the globals.css file path**

Run: `find /home/teina/projects/thermopack-demo/app/src -name "globals.css" -type f`

- [ ] **Step 2: Add pulsing animation to globals.css**

```css
@keyframes pulse-urgent {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.animate-pulse-urgent {
  animation: pulse-urgent 1.5s ease-in-out infinite;
}
```

- [ ] **Step 3: Create urgency badge component**

```tsx
// app/src/components/urgency-badge.tsx
import { cn } from "@/lib/utils";

interface UrgencyBadgeProps {
  dateExpiration: string | null;
}

function getUrgency(dateExpiration: string | null): {
  label: string;
  className: string;
  priority: number;
} | null {
  if (!dateExpiration) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateExpiration);
  exp.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "Expirée", className: "bg-muted text-muted-foreground border-border", priority: 4 };
  if (daysLeft <= 3) return { label: "Urgent", className: "bg-destructive/15 text-destructive border-destructive/30 animate-pulse-urgent", priority: 1 };
  if (daysLeft <= 7) return { label: "Expire bientôt", className: "bg-destructive/10 text-destructive border-destructive/20", priority: 2 };
  if (daysLeft <= 15) return { label: "À surveiller", className: "bg-amber-accent/10 text-amber-accent border-amber-accent/20", priority: 3 };
  return null;
}

export { getUrgency };

export function UrgencyBadge({ dateExpiration }: UrgencyBadgeProps) {
  const urgency = getUrgency(dateExpiration);
  if (!urgency) return <span className="text-xs text-muted-foreground/50">—</span>;

  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", urgency.className)}>
      {urgency.label}
    </span>
  );
}
```

- [ ] **Step 4: Add urgency column to offres-table**

In `offres-table.tsx`, add a new column after "Statut":

Header:
```tsx
<TableHead><SortableHeader column="date_expiration" label="Urgence" /></TableHead>
```

Cell:
```tsx
<TableCell>
  <UrgencyBadge dateExpiration={offre.date_expiration} />
</TableCell>
```

Update colSpan from 11 to 12.

- [ ] **Step 5: Add urgency quick filter toggle to the offres page**

In `offres/page.tsx`, above the DataFilters, add a toggle button:

```tsx
// In the filters area, add:
<a
  href={params.urgentes === "1"
    ? `${pathname}?${new URLSearchParams(Object.entries(params).filter(([k]) => k !== "urgentes")).toString()}`
    : `${pathname}?${new URLSearchParams({ ...params, urgentes: "1" }).toString()}`
  }
  className={cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
    params.urgentes === "1"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-border bg-card text-muted-foreground hover:bg-muted/30"
  )}
>
  <AlertTriangle className="h-3.5 w-3.5" />
  Urgentes
</a>
```

- [ ] **Step 6: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add app/src/components/urgency-badge.tsx app/src/components/offres-table.tsx app/src/app/globals.css app/src/app/\(app\)/offres/page.tsx
git commit -m "add urgency badges, column, and quick filter to offres"
```

---

## Task 9: Sidebar Urgency Badge

**Files:**
- Modify: `app/src/components/app-sidebar.tsx`

- [ ] **Step 1: Read current app-sidebar**

Read: `app/src/components/app-sidebar.tsx` (full file)

- [ ] **Step 2: Add urgency count fetch and badge**

The sidebar is a server component (uses `async`). Add a Supabase query to count urgent offres:

```typescript
import { SidebarMenuBadge } from "@/components/ui/sidebar";

// Inside the component, after createClient():
const { count: urgentCount } = await supabase
  .from("offres")
  .select("id", { count: "exact", head: true })
  .eq("statut", "en_attente")
  .gte("date_expiration", new Date().toISOString().split("T")[0])
  .lte("date_expiration", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
```

In the nav items map, after the `SidebarMenuButton` for "Offres" (where `item.href === "/offres"`), add:

```tsx
{item.href === "/offres" && (urgentCount ?? 0) > 0 && (
  <SidebarMenuBadge className="bg-destructive text-destructive-foreground text-[10px] font-bold">
    {urgentCount}
  </SidebarMenuBadge>
)}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/components/app-sidebar.tsx
git commit -m "add urgency badge to offres nav item in sidebar"
```

---

## Task 10: Designation Translation — Schema Migration

**Files:**
- Create: `scripts/030-designation-fr-column.sql`
- Modify: `app/src/types/database.ts`

- [ ] **Step 1: Create migration script**

```sql
-- scripts/030-designation-fr-column.sql
-- Migration 030: Add designation_fr column for French translations of designations
-- Date: 2026-04-08

-- Add designation_fr to offre_lignes
ALTER TABLE offre_lignes ADD COLUMN IF NOT EXISTS designation_fr TEXT;

-- Add designation_fr to commande_lignes
ALTER TABLE commande_lignes ADD COLUMN IF NOT EXISTS designation_fr TEXT;

-- Comment
COMMENT ON COLUMN offre_lignes.designation_fr IS 'French translation of designation_brute (auto-translated if original is not French)';
COMMENT ON COLUMN commande_lignes.designation_fr IS 'French translation of designation_brute (auto-translated if original is not French)';
```

- [ ] **Step 2: Run migration via supabase-cli**

Run: Use the `supabase-cli` skill to execute the migration against the database.

- [ ] **Step 3: Update TypeScript Designation interface**

In `app/src/types/database.ts`, find the `Designation` interface and add `designation_fr`:

```typescript
export interface Designation {
  position?: number;
  reference_materiel?: string;
  designation: string;
  designation_fr?: string;  // NEW
  quantite: number;
  prix_unitaire: number;
  montant_ligne?: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/030-designation-fr-column.sql app/src/types/database.ts
git commit -m "add designation_fr column for translated designations"
```

---

## Task 11: Designation Translation — Backfill Script

**Files:**
- Create: `scripts/translate-designations.ts`

- [ ] **Step 1: Create the backfill script**

```typescript
// scripts/translate-designations.ts
// Run: bun run scripts/translate-designations.ts
// Translates non-French designations in offre_lignes and commande_lignes via Claude API

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY!;
const BATCH_SIZE = 50;

interface LigneRow {
  id: string;
  designation_brute: string | null;
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Translate these product/part designations to French. If already in French, return as-is. Return ONLY a JSON array of translated strings, same order, same count. No explanation.\n\n${JSON.stringify(texts)}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const content = data.content[0].text;
  return JSON.parse(content);
}

async function processTable(table: "offre_lignes" | "commande_lignes") {
  console.log(`\nProcessing ${table}...`);

  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("designation_fr", null)
    .not("designation_brute", "is", null);

  console.log(`  ${count} rows to translate`);
  let processed = 0;

  while (true) {
    const { data: rows } = await supabase
      .from(table)
      .select("id, designation_brute")
      .is("designation_fr", null)
      .not("designation_brute", "is", null)
      .limit(BATCH_SIZE) as { data: LigneRow[] | null };

    if (!rows || rows.length === 0) break;

    const texts = rows.map((r) => r.designation_brute!);

    try {
      const translations = await translateBatch(texts);

      for (let i = 0; i < rows.length; i++) {
        await supabase
          .from(table)
          .update({ designation_fr: translations[i] })
          .eq("id", rows[i].id);
      }

      processed += rows.length;
      console.log(`  ${processed}/${count} done`);
    } catch (err) {
      console.error("  Translation error, copying originals:", err);
      for (const row of rows) {
        await supabase
          .from(table)
          .update({ designation_fr: row.designation_brute })
          .eq("id", row.id);
      }
      processed += rows.length;
    }

    // Rate limit: wait 2s between batches
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`  Done: ${processed} rows translated in ${table}`);
}

async function main() {
  console.log("=== Designation Translation Backfill ===");
  await processTable("offre_lignes");
  await processTable("commande_lignes");
  console.log("\n=== Complete ===");
}

main().catch(console.error);
```

- [ ] **Step 2: Test with dry run (check count)**

Run: `cd /home/teina/projects/thermopack-demo && NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY bun run -e "const {createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);(async()=>{const {count:c1}=await s.from('offre_lignes').select('id',{count:'exact',head:true}).is('designation_fr',null).not('designation_brute','is',null);const {count:c2}=await s.from('commande_lignes').select('id',{count:'exact',head:true}).is('designation_fr',null).not('designation_brute','is',null);console.log('offre_lignes:',c1,'commande_lignes:',c2)})()"`

Verify counts are reasonable before running full script.

- [ ] **Step 3: Run backfill script**

Run: `cd /home/teina/projects/thermopack-demo && bun run scripts/translate-designations.ts`

This will take time (~2s per batch of 50). Monitor progress.

**IMPORTANT:** The `ExpandableRow` component reads designations from the JSONB `offres.designations` / `commandes.designations` column, NOT from the `offre_lignes`/`commande_lignes` tables. After translating the lignes rows, the script must ALSO update the parent JSONB arrays to include `designation_fr` in each designation object. Add a second pass:

```typescript
async function updateParentJsonb(parentTable: "offres" | "commandes", lignesTable: "offre_lignes" | "commande_lignes", fkColumn: "offre_id" | "commande_id") {
  console.log(`\nUpdating ${parentTable} JSONB designations...`);
  const { data: parents } = await supabase
    .from(parentTable)
    .select("id, designations")
    .not("designations", "is", null);

  if (!parents) return;

  for (const parent of parents) {
    if (!Array.isArray(parent.designations)) continue;

    // Get translated lignes for this parent
    const { data: lignes } = await supabase
      .from(lignesTable)
      .select("designation_brute, designation_fr, poste")
      .eq(fkColumn, parent.id);

    if (!lignes) continue;

    // Build lookup: designation_brute -> designation_fr
    const lookup = new Map(lignes.map(l => [l.designation_brute, l.designation_fr]));

    // Update each designation in JSONB
    const updated = parent.designations.map((d: any) => ({
      ...d,
      designation_fr: lookup.get(d.designation) ?? d.designation,
    }));

    await supabase.from(parentTable).update({ designations: updated }).eq("id", parent.id);
  }

  console.log(`  ${parents.length} ${parentTable} JSONB arrays updated`);
}

// Call after lignes translation:
await updateParentJsonb("offres", "offre_lignes", "offre_id");
await updateParentJsonb("commandes", "commande_lignes", "commande_id");
```

- [ ] **Step 4: Commit**

```bash
git add scripts/translate-designations.ts
git commit -m "add designation translation backfill script"
```

---

## Task 12: Designation Translation — Edge Function

**Files:**
- Create: `supabase/functions/translate-designation/index.ts`

- [ ] **Step 1: Initialize Supabase functions directory if needed**

Run: `ls /home/teina/projects/thermopack-demo/supabase/functions/ 2>/dev/null || mkdir -p /home/teina/projects/thermopack-demo/supabase/functions/translate-designation`

- [ ] **Step 2: Create the Edge Function**

```typescript
// supabase/functions/translate-designation/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function translateText(text: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Is this product designation in French? If yes, return it as-is. If not, translate to French. Return ONLY the text, no explanation.\n\n"${text}"`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.content[0].text.replace(/^["']|["']$/g, "").trim();
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database webhook payload: { type, table, record, old_record }
    const { record, table } = payload;

    if (!record?.designation_brute || record.designation_fr) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const translated = await translateText(record.designation_brute);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update the lignes row
    await supabase.from(table).update({ designation_fr: translated }).eq("id", record.id);

    // Also update the parent JSONB designations array
    const fkColumn = table === "offre_lignes" ? "offre_id" : "commande_id";
    const parentTable = table === "offre_lignes" ? "offres" : "commandes";
    const parentId = record[fkColumn];

    if (parentId) {
      const { data: parent } = await supabase
        .from(parentTable)
        .select("designations")
        .eq("id", parentId)
        .single();

      if (parent?.designations && Array.isArray(parent.designations)) {
        const updated = parent.designations.map((d: any) =>
          d.designation === record.designation_brute
            ? { ...d, designation_fr: translated }
            : d
        );
        await supabase.from(parentTable).update({ designations: updated }).eq("id", parentId);
      }
    }

    return new Response(JSON.stringify({ translated }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
```

- [ ] **Step 3: Deploy the Edge Function**

Use the `supabase-cli` skill to deploy:
1. Set the ANTHROPIC_API_KEY secret: `supabase secrets set ANTHROPIC_API_KEY=<key>`
2. Deploy: `supabase functions deploy translate-designation`

- [ ] **Step 4: Create database webhooks**

Via Supabase dashboard or SQL, create two database webhooks:
- On INSERT into `offre_lignes` → call Edge Function `translate-designation`
- On INSERT into `commande_lignes` → call Edge Function `translate-designation`

```sql
-- This is done via the Supabase Dashboard > Database > Webhooks
-- Or via pg_net if available
-- Webhook URL: https://<project-ref>.supabase.co/functions/v1/translate-designation
-- Table: offre_lignes, Events: INSERT
-- Table: commande_lignes, Events: INSERT
-- Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/translate-designation/
git commit -m "add Edge Function for auto-translating designations on insert"
```

---

## Task 13: Display Translated Designations in UI

**Files:**
- Modify: `app/src/components/expandable-row.tsx`

- [ ] **Step 1: Read current expandable-row component**

Read: `app/src/components/expandable-row.tsx` (full file)

- [ ] **Step 2: Update designation display to prefer designation_fr**

In the expanded content section where designations are rendered, replace the designation text display:

```tsx
// Before (around line 60):
<TableCell className="text-xs">{d.designation}</TableCell>

// After:
<TableCell className="text-xs" title={d.designation_fr && d.designation_fr !== d.designation ? d.designation : undefined}>
  {d.designation_fr ?? d.designation}
</TableCell>
```

This shows `designation_fr` by default with the original as a tooltip when they differ.

- [ ] **Step 3: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/components/expandable-row.tsx
git commit -m "display translated designations with original as tooltip"
```

---

## Task 14: Bug Fixes & Polish

**Files:**
- Modify: `app/src/app/(app)/dashboard/page.tsx` (Non renseigné styling)
- Verify: wording deployment

- [ ] **Step 1: Check "Non renseigné" display in geo section**

Read the dashboard page section that renders geographic stats. Find where region is displayed and ensure empty/null regions show "Non renseigné" with consistent muted styling:

```tsx
// Where region name is displayed, wrap with fallback:
<span className={!region.region || region.region === "Non renseigné" ? "text-muted-foreground italic" : ""}>
  {region.region || "Non renseigné"}
</span>
```

- [ ] **Step 2: Verify "relance" wording is deployed**

Run: `cd /home/teina/projects/thermopack-demo && grep -r "dernière relance" app/src/ --include="*.tsx" --include="*.ts"`

If matches found, replace with "relance". If none found, the fix from the previous session is already in place.

- [ ] **Step 3: Verify build**

Run: `cd /home/teina/projects/thermopack-demo/app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "polish: Non renseigné styling and wording verification"
```

- [ ] **Step 5: Push to master for Vercel deployment**

```bash
git push origin master
```

---

## Verification Checklist

After all tasks are complete, verify end-to-end:

- [ ] `/offres` page shows 30 rows max with pagination controls
- [ ] Column headers are clickable and sort correctly (asc/desc/none cycle)
- [ ] Contextual counter shows total + expiring + sans relance counts
- [ ] "Urgentes" filter toggle works
- [ ] Urgency badges show with correct colors (pulsing red for < 3 days)
- [ ] Checkbox selection works (individual + select all current page)
- [ ] Floating action bar appears with count
- [ ] "Relancer" button shows disabled toast
- [ ] CSV export works with selected rows
- [ ] `/commandes` page has pagination + sortable columns
- [ ] Dashboard sections show 5 items with "Voir plus"
- [ ] Sidebar shows red badge on Offres with urgent count
- [ ] Expanded rows show `designation_fr` with tooltip for original
- [ ] "Non renseigné" displays with italic muted style
- [ ] Vercel deployment succeeds
