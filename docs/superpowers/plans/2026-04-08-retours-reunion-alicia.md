# Retours réunion Alice — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter les 5 retours prioritaires de la réunion du 08/04 avec Alice : fix bug montants, top clients par CA, liaison manuelle offre↔commande, enrichissement géo des 267 clients, ajustements UI.

**Architecture:** Modifications incrémentales sur l'app Next.js existante + 2 nouvelles migrations SQL. Pas de nouveau endpoint API — on réutilise le PATCH `/api/commandes/[id]` existant (offre_id est déjà whitelisté). Le top clients par CA nécessite un nouveau paramètre sur la RPC existante `top_clients`. La liaison manuelle est un nouveau composant client `LinkOffreDialog` intégré dans `commandes-table.tsx`.

**Tech Stack:** Next.js 14, Supabase (PostgreSQL), TypeScript, React, shadcn/ui, Tailwind CSS

---

## File Structure

| Action | File | Responsabilité |
|--------|------|----------------|
| Modify | `scripts/016-top-clients-exclude-non-transformees.sql` | Référence — ne pas toucher (historique) |
| **Create** | `scripts/028-top-clients-sort-mode.sql` | Migration : nouveau param `p_sort_by` sur `top_clients` RPC |
| **Create** | `scripts/029-enrich-regions-from-cp.sql` | Migration : enrichir région/département depuis code_postal |
| Modify | `app/src/types/database.ts:152-160` | Ajouter `ca_commandes` au type `TopClient` |
| Modify | `app/src/app/(app)/dashboard/page.tsx:83-117,342-394` | Passer `p_sort_by` à RPC + toggle tri + afficher `ca_commandes` |
| Modify | `app/src/lib/i18n.ts` | Ajouter clés traduction (toggle CA, lier offre, etc.) |
| **Create** | `app/src/components/link-offre-dialog.tsx` | Dialog pour lier une commande à une offre |
| Modify | `app/src/components/commandes-table.tsx:47-205` | Ajouter bouton "Lier à une offre" + intégrer dialog |
| Modify | `app/src/lib/mailto-relance.ts:47-132` | Changer "dernière relance" → "relance classique" dans templates |

---

## Task 1 : Fix bug montants — Diagnostic + RPC `top_clients`

Le bug "Alpha Form affiché à zéro" vient de la RPC `top_clients` qui retourne `montant_total_offres` = somme des montant_ht des offres transformées. Si les offres n'ont pas de montant_ht renseigné, ça affiche 0. Ce n'est pas un bug de code — c'est un problème de données. Mais on peut améliorer l'UX en ajoutant le CA commandes (qui lui est plus souvent renseigné).

**Files:**
- Modify: `scripts/016-top-clients-exclude-non-transformees.sql` (lecture seule — référence)
- Create: `scripts/028-top-clients-sort-mode.sql`

- [ ] **Step 1: Créer la migration 028 — top_clients avec tri par CA et colonne ca_commandes**

```sql
-- scripts/028-top-clients-sort-mode.sql
-- ============================================================
-- Migration 028 : top_clients avec tri par CA commandes + colonne ca_commandes
-- Ajoute p_sort_by ('taux' | 'ca') et retourne ca_commandes
-- ============================================================

CREATE OR REPLACE FUNCTION top_clients(
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_pays pays_enum DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_sort_by TEXT DEFAULT 'ca'
)
RETURNS TABLE (
  entreprise_id UUID,
  entreprise_nom TEXT,
  pays pays_enum,
  nb_offres BIGINT,
  nb_transformees BIGINT,
  taux_transformation NUMERIC(5,2),
  montant_total_offres NUMERIC(14,2),
  ca_commandes NUMERIC(14,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS entreprise_id,
    e.nom AS entreprise_nom,
    e.pays,
    count(o.id)::BIGINT AS nb_offres,
    count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::BIGINT AS nb_transformees,
    CASE
      WHEN count(o.id) = 0 THEN 0
      ELSE round(
        count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC
        / count(o.id)::NUMERIC * 100, 2
      )
    END::NUMERIC(5,2) AS taux_transformation,
    coalesce(sum(o.montant_ht), 0)::NUMERIC(14,2) AS montant_total_offres,
    coalesce((
      SELECT sum(c.montant_ht)
      FROM commandes c
      WHERE c.entreprise_id = e.id
        AND (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
        AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
    ), 0)::NUMERIC(14,2) AS ca_commandes
  FROM entreprises e
  JOIN offres o ON o.entreprise_id = e.id
  WHERE o.statut IN ('transformee', 'partiellement_transformee')
    AND (p_date_debut IS NULL OR o.date_offre >= p_date_debut)
    AND (p_date_fin IS NULL OR o.date_offre <= p_date_fin)
    AND (p_pays IS NULL OR e.pays = p_pays)
  GROUP BY e.id, e.nom, e.pays
  ORDER BY
    CASE WHEN p_sort_by = 'ca' THEN coalesce((
      SELECT sum(c.montant_ht)
      FROM commandes c
      WHERE c.entreprise_id = e.id
        AND (p_date_debut IS NULL OR c.date_commande >= p_date_debut)
        AND (p_date_fin IS NULL OR c.date_commande <= p_date_fin)
    ), 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'taux' THEN
      CASE WHEN count(o.id) = 0 THEN 0
      ELSE round(count(o.id) FILTER (WHERE o.statut IN ('transformee', 'partiellement_transformee'))::NUMERIC / count(o.id)::NUMERIC * 100, 2)
      END
    END DESC NULLS LAST,
    count(o.id) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION top_clients IS 'Top N clients par CA commandes ou taux transformation, avec CA commandes';
```

- [ ] **Step 2: Exécuter la migration sur Supabase**

Run: `supabase-cli` skill ou SQL Editor Supabase pour exécuter `scripts/028-top-clients-sort-mode.sql`
Expected: Function replaced successfully

- [ ] **Step 3: Tester la RPC avec les deux modes de tri**

```sql
-- Test tri par CA
SELECT * FROM top_clients(p_sort_by := 'ca', p_limit := 5);
-- Test tri par taux
SELECT * FROM top_clients(p_sort_by := 'taux', p_limit := 5);
-- Vérifier qu'Alpha Form a un ca_commandes > 0 même si montant_total_offres = 0
SELECT * FROM top_clients(p_limit := 20) WHERE entreprise_nom ILIKE '%alpha%';
```

- [ ] **Step 4: Commit**

```bash
git add scripts/028-top-clients-sort-mode.sql
git commit -m "add ca_commandes + sort mode to top_clients RPC"
```

---

## Task 2 : Type TopClient + i18n

**Files:**
- Modify: `app/src/types/database.ts:152-160`
- Modify: `app/src/lib/i18n.ts`

- [ ] **Step 1: Ajouter `ca_commandes` au type TopClient**

In `app/src/types/database.ts`, update the `TopClient` interface:

```typescript
export interface TopClient {
  entreprise_id: string;
  entreprise_nom: string;
  pays: PaysEnum;
  nb_offres: number;
  nb_transformees: number;
  taux_transformation: number;
  montant_total_offres: number;
  ca_commandes: number;
}
```

- [ ] **Step 2: Ajouter les clés i18n**

In `app/src/lib/i18n.ts`, add after the `"dashboard.montant_total"` key (line ~64):

```typescript
"dashboard.ca_commandes_col": { fr: "CA Commandes", es: "Fact. Pedidos" },
"dashboard.tri_par_ca": { fr: "Par CA", es: "Por fact." },
"dashboard.tri_par_taux": { fr: "Par taux", es: "Por tasa" },
"commandes.lier_offre": { fr: "Lier à une offre", es: "Vincular a una oferta" },
"commandes.lier_offre_titre": { fr: "Lier cette commande à une offre", es: "Vincular este pedido a una oferta" },
"commandes.lier_offre_recherche": { fr: "Rechercher une offre...", es: "Buscar una oferta..." },
"commandes.lier_offre_aucune": { fr: "Aucune offre trouvée", es: "No se encontraron ofertas" },
"commandes.lier_offre_succes": { fr: "Commande liée à l'offre", es: "Pedido vinculado a la oferta" },
"commandes.delier_offre": { fr: "Délier l'offre", es: "Desvincular la oferta" },
"commandes.delier_offre_succes": { fr: "Offre déliée", es: "Oferta desvinculada" },
```

- [ ] **Step 3: Commit**

```bash
git add app/src/types/database.ts app/src/lib/i18n.ts
git commit -m "add TopClient.ca_commandes type + i18n keys for link/sort"
```

---

## Task 3 : Toggle tri top clients dans le dashboard

**Files:**
- Modify: `app/src/app/(app)/dashboard/page.tsx:44-50` (SearchParams)
- Modify: `app/src/app/(app)/dashboard/page.tsx:90-94` (RPC call)
- Modify: `app/src/app/(app)/dashboard/page.tsx:342-394` (render top clients)

- [ ] **Step 1: Ajouter `tri_clients` aux searchParams**

In `app/src/app/(app)/dashboard/page.tsx`, add to the SearchParams interface (~line 44-50):

```typescript
interface SearchParams {
  periode?: string;
  pays?: string;
  region?: string;
  entreprise?: string;
  expirees?: string;
  tri_clients?: string;
}
```

And extract the param (~line 56-62, after existing param extraction):

```typescript
const triClients = (await searchParams).tri_clients === "taux" ? "taux" : "ca";
```

- [ ] **Step 2: Passer `p_sort_by` à la RPC top_clients**

In the `Promise.all` block (~line 90-94), modify the `top_clients` call:

```typescript
supabase.rpc("top_clients", {
  ...(dateRange && { p_date_debut: dateRange.debut, p_date_fin: dateRange.fin }),
  ...(paysFilter && { p_pays: paysFilter }),
  p_limit: 10,
  p_sort_by: triClients,
}),
```

- [ ] **Step 3: Ajouter le toggle + colonne CA Commandes dans le rendu**

Replace the top clients section (~lines 342-394) in `dashboard/page.tsx`:

```tsx
{/* Top clients */}
{topClients.length > 0 && (
  <div className="section-divider">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-4 w-4" />
        {t("dashboard.top_clients", locale)}
      </h2>
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border/60 text-xs">
          <a
            href={`?${new URLSearchParams({ ...Object.fromEntries(new URL(request.url ?? "", "http://localhost").searchParams), tri_clients: "ca" }).toString()}`}
            className={cn(
              "px-2.5 py-1 font-condensed text-[11px] font-semibold uppercase transition-colors",
              triClients === "ca" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t("dashboard.tri_par_ca", locale)}
          </a>
          <a
            href={`?${new URLSearchParams({ ...Object.fromEntries(new URL(request.url ?? "", "http://localhost").searchParams), tri_clients: "taux" }).toString()}`}
            className={cn(
              "px-2.5 py-1 font-condensed text-[11px] font-semibold uppercase transition-colors",
              triClients === "taux" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t("dashboard.tri_par_taux", locale)}
          </a>
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
              <TableCell className="kpi-value text-right text-sm font-semibold text-primary">{formatCurrency(c.ca_commandes)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
)}
```

Note: Le `request.url` n'est pas directement dispo dans un server component Next.js. Il faut utiliser `searchParams` directement. La méthode la plus propre est de construire les URLs avec les params existants. On va utiliser une approche plus simple avec des liens qui ajoutent le param.

En réalité, comme les searchParams sont déjà passés, on peut construire l'URL côté serveur. Voici l'approche correcte — ajouter juste après l'extraction des params existants :

```typescript
// Build toggle URL helper
const resolvedParams = await searchParams;
function buildToggleUrl(overrides: Record<string, string>) {
  const merged = { ...resolvedParams, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) sp.set(k, String(v));
  }
  return `?${sp.toString()}`;
}
```

Puis utiliser `href={buildToggleUrl({ tri_clients: "ca" })}` et `href={buildToggleUrl({ tri_clients: "taux" })}`.

- [ ] **Step 4: Vérifier le build**

Run: `cd /home/teina/projects/thermopack-demo/app && bun run build`
Expected: Build success, no type errors

- [ ] **Step 5: Commit**

```bash
git add app/src/app/\(app\)/dashboard/page.tsx
git commit -m "add top clients sort toggle (CA vs taux) + CA commandes column"
```

---

## Task 4 : Liaison manuelle offre↔commande — Dialog component

**Files:**
- Create: `app/src/components/link-offre-dialog.tsx`

- [ ] **Step 1: Créer le composant LinkOffreDialog**

```tsx
// app/src/components/link-offre-dialog.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { t, type Locale } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/formatting";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OffreOption {
  id: string;
  reference_offre: string;
  entreprise_nom: string;
  montant_ht: number | null;
  date_offre: string;
  statut: string;
}

interface LinkOffreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandeId: string;
  entrepriseId: string;
  currentOffreId: string | null;
  locale: Locale;
  onLinked: (offreId: string | null, offreRef: string | null) => void;
}

export function LinkOffreDialog({
  open,
  onOpenChange,
  commandeId,
  entrepriseId,
  currentOffreId,
  locale,
  onLinked,
}: LinkOffreDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OffreOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    // Load offres for this entreprise on open
    searchOffres("");
  }, [open, entrepriseId]);

  async function searchOffres(q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entreprise_id: entrepriseId });
      if (q) params.set("q", q);
      const res = await fetch(`/api/offres/search?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.offres ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchOffres(value), 300);
  }

  async function handleLink(offreId: string, offreRef: string) {
    setLinking(true);
    try {
      const res = await fetch(`/api/commandes/${commandeId}`, {
        method: "PATCH",
        body: JSON.stringify({ offre_id: offreId }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("commandes.lier_offre_succes", locale));
      onLinked(offreId, offreRef);
      onOpenChange(false);
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setLinking(true);
    try {
      const res = await fetch(`/api/commandes/${commandeId}`, {
        method: "PATCH",
        body: JSON.stringify({ offre_id: null }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("commandes.delier_offre_succes", locale));
      onLinked(null, null);
      onOpenChange(false);
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setLinking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-condensed text-sm uppercase tracking-wider">
            {t("commandes.lier_offre_titre", locale)}
          </DialogTitle>
        </DialogHeader>

        {currentOffreId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnlink}
            disabled={linking}
            className="mb-3 w-full border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Unlink className="mr-2 h-3.5 w-3.5" />
            {t("commandes.delier_offre", locale)}
          </Button>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("commandes.lier_offre_recherche", locale)}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">...</p>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("commandes.lier_offre_aucune", locale)}
            </p>
          ) : (
            results.map((offre) => (
              <button
                key={offre.id}
                type="button"
                onClick={() => handleLink(offre.id, offre.reference_offre)}
                disabled={linking || offre.id === currentOffreId}
                className="flex w-full items-center justify-between rounded-md border border-border/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs font-medium">{offre.reference_offre}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(offre.date_offre)}
                    {offre.montant_ht ? ` · ${formatCurrency(offre.montant_ht)}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {offre.id === currentOffreId && (
                    <Badge variant="outline" className="text-[10px]">Liée</Badge>
                  )}
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Vérifier le build (pas encore intégré, juste le composant)**

Run: `cd /home/teina/projects/thermopack-demo/app && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/link-offre-dialog.tsx
git commit -m "add LinkOffreDialog component for manual offre-commande linking"
```

---

## Task 5 : API route search offres (pour le dialog)

**Files:**
- Create: `app/src/app/api/offres/search/route.ts`

- [ ] **Step 1: Créer l'endpoint GET /api/offres/search**

```typescript
// app/src/app/api/offres/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entrepriseId = searchParams.get("entreprise_id");
  const q = searchParams.get("q")?.trim() ?? "";

  let query = supabase
    .from("offres")
    .select("id, reference_offre, montant_ht, date_offre, statut, entreprises!inner(nom)")
    .order("date_offre", { ascending: false })
    .limit(20);

  if (entrepriseId) {
    query = query.eq("entreprise_id", entrepriseId);
  }

  if (q) {
    query = query.ilike("reference_offre", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/offres/search]", error.message);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }

  const offres = (data ?? []).map((o: Record<string, unknown>) => ({
    id: o.id,
    reference_offre: o.reference_offre,
    entreprise_nom: (o.entreprises as Record<string, unknown>)?.nom ?? "",
    montant_ht: o.montant_ht,
    date_offre: o.date_offre,
    statut: o.statut,
  }));

  return NextResponse.json({ offres });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/offres/search/route.ts
git commit -m "add GET /api/offres/search endpoint for link dialog"
```

---

## Task 6 : Intégrer le dialog dans commandes-table

**Files:**
- Modify: `app/src/components/commandes-table.tsx`

- [ ] **Step 1: Ajouter les imports et le state**

In `app/src/components/commandes-table.tsx`, add to the imports (after line 5):

```typescript
import { Link2 } from "lucide-react";
import { LinkOffreDialog } from "@/components/link-offre-dialog";
```

Add state inside `CommandesTable` (after line 50):

```typescript
const [linkDialog, setLinkDialog] = useState<{
  commandeId: string;
  entrepriseId: string;
  currentOffreId: string | null;
} | null>(null);
```

- [ ] **Step 2: Ajouter le handler onLinked**

Add after the existing handlers (after `handleSaveMontant`, ~line 117):

```typescript
function handleLinked(commandeId: string, offreId: string | null, offreRef: string | null) {
  setLocalCommandes(prev =>
    prev?.map(c => c.id === commandeId
      ? { ...c, offre_id: offreId, offres: offreId && offreRef ? { ...c.offres!, reference_offre: offreRef } as typeof c.offres : null }
      : c
    ) ?? null
  );
}
```

- [ ] **Step 3: Ajouter le bouton Link2 dans les actions**

In the actions cell (~line 170), add the Link2 button before the reclassify button:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    setLinkDialog({
      commandeId: cmd.id,
      entrepriseId: cmd.entreprise_id,
      currentOffreId: cmd.offre_id,
    });
  }}
  className="inline-flex items-center justify-center rounded-md border border-teal/20 bg-teal/5 p-1.5 text-xs text-teal transition-colors hover:bg-teal/10 hover:border-teal/40"
  title={t("commandes.lier_offre", locale)}
>
  <Link2 className="h-3.5 w-3.5" />
</button>
```

- [ ] **Step 4: Ajouter le dialog en bas du composant**

Just before the closing `</div>` of the return (~line 203), add:

```tsx
{linkDialog && (
  <LinkOffreDialog
    open={!!linkDialog}
    onOpenChange={(open) => !open && setLinkDialog(null)}
    commandeId={linkDialog.commandeId}
    entrepriseId={linkDialog.entrepriseId}
    currentOffreId={linkDialog.currentOffreId}
    locale={locale}
    onLinked={(offreId, offreRef) => handleLinked(linkDialog.commandeId, offreId, offreRef)}
  />
)}
```

- [ ] **Step 5: Vérifier le build**

Run: `cd /home/teina/projects/thermopack-demo/app && bun run build`
Expected: Build success

- [ ] **Step 6: Commit**

```bash
git add app/src/components/commandes-table.tsx
git commit -m "integrate link-offre dialog in commandes table"
```

---

## Task 7 : Enrichissement géographique des 267 clients sans région

**Files:**
- Create: `scripts/029-enrich-regions-from-cp.sql`

- [ ] **Step 1: Créer la migration d'enrichissement**

```sql
-- scripts/029-enrich-regions-from-cp.sql
-- ============================================================
-- Migration 029 : Enrichir région/département depuis code_postal
-- Pour les 267 entreprises FR sans région renseignée
-- ============================================================

-- Mapping département → région pour la France métropolitaine + DOM
-- Basé sur les 2 premiers chiffres du code postal

CREATE OR REPLACE FUNCTION enrich_regions_from_cp()
RETURNS TABLE (updated_count BIGINT) AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  WITH cp_mapping AS (
    SELECT
      e.id,
      LEFT(e.code_postal, 2) AS dept,
      CASE LEFT(e.code_postal, 2)
        WHEN '01' THEN 'Auvergne-Rhône-Alpes'
        WHEN '02' THEN 'Hauts-de-France'
        WHEN '03' THEN 'Auvergne-Rhône-Alpes'
        WHEN '04' THEN 'Provence-Alpes-Côte d''Azur'
        WHEN '05' THEN 'Provence-Alpes-Côte d''Azur'
        WHEN '06' THEN 'Provence-Alpes-Côte d''Azur'
        WHEN '07' THEN 'Auvergne-Rhône-Alpes'
        WHEN '08' THEN 'Grand Est'
        WHEN '09' THEN 'Occitanie'
        WHEN '10' THEN 'Grand Est'
        WHEN '11' THEN 'Occitanie'
        WHEN '12' THEN 'Occitanie'
        WHEN '13' THEN 'Provence-Alpes-Côte d''Azur'
        WHEN '14' THEN 'Normandie'
        WHEN '15' THEN 'Auvergne-Rhône-Alpes'
        WHEN '16' THEN 'Nouvelle-Aquitaine'
        WHEN '17' THEN 'Nouvelle-Aquitaine'
        WHEN '18' THEN 'Centre-Val de Loire'
        WHEN '19' THEN 'Nouvelle-Aquitaine'
        WHEN '20' THEN 'Corse'
        WHEN '21' THEN 'Bourgogne-Franche-Comté'
        WHEN '22' THEN 'Bretagne'
        WHEN '23' THEN 'Nouvelle-Aquitaine'
        WHEN '24' THEN 'Nouvelle-Aquitaine'
        WHEN '25' THEN 'Bourgogne-Franche-Comté'
        WHEN '26' THEN 'Auvergne-Rhône-Alpes'
        WHEN '27' THEN 'Normandie'
        WHEN '28' THEN 'Centre-Val de Loire'
        WHEN '29' THEN 'Bretagne'
        WHEN '30' THEN 'Occitanie'
        WHEN '31' THEN 'Occitanie'
        WHEN '32' THEN 'Occitanie'
        WHEN '33' THEN 'Nouvelle-Aquitaine'
        WHEN '34' THEN 'Occitanie'
        WHEN '35' THEN 'Bretagne'
        WHEN '36' THEN 'Centre-Val de Loire'
        WHEN '37' THEN 'Centre-Val de Loire'
        WHEN '38' THEN 'Auvergne-Rhône-Alpes'
        WHEN '39' THEN 'Bourgogne-Franche-Comté'
        WHEN '40' THEN 'Nouvelle-Aquitaine'
        WHEN '41' THEN 'Centre-Val de Loire'
        WHEN '42' THEN 'Auvergne-Rhône-Alpes'
        WHEN '43' THEN 'Auvergne-Rhône-Alpes'
        WHEN '44' THEN 'Pays de la Loire'
        WHEN '45' THEN 'Centre-Val de Loire'
        WHEN '46' THEN 'Occitanie'
        WHEN '47' THEN 'Nouvelle-Aquitaine'
        WHEN '48' THEN 'Occitanie'
        WHEN '49' THEN 'Pays de la Loire'
        WHEN '50' THEN 'Normandie'
        WHEN '51' THEN 'Grand Est'
        WHEN '52' THEN 'Grand Est'
        WHEN '53' THEN 'Pays de la Loire'
        WHEN '54' THEN 'Grand Est'
        WHEN '55' THEN 'Grand Est'
        WHEN '56' THEN 'Bretagne'
        WHEN '57' THEN 'Grand Est'
        WHEN '58' THEN 'Bourgogne-Franche-Comté'
        WHEN '59' THEN 'Hauts-de-France'
        WHEN '60' THEN 'Hauts-de-France'
        WHEN '61' THEN 'Normandie'
        WHEN '62' THEN 'Hauts-de-France'
        WHEN '63' THEN 'Auvergne-Rhône-Alpes'
        WHEN '64' THEN 'Nouvelle-Aquitaine'
        WHEN '65' THEN 'Occitanie'
        WHEN '66' THEN 'Occitanie'
        WHEN '67' THEN 'Grand Est'
        WHEN '68' THEN 'Grand Est'
        WHEN '69' THEN 'Auvergne-Rhône-Alpes'
        WHEN '70' THEN 'Bourgogne-Franche-Comté'
        WHEN '71' THEN 'Bourgogne-Franche-Comté'
        WHEN '72' THEN 'Pays de la Loire'
        WHEN '73' THEN 'Auvergne-Rhône-Alpes'
        WHEN '74' THEN 'Auvergne-Rhône-Alpes'
        WHEN '75' THEN 'Île-de-France'
        WHEN '76' THEN 'Normandie'
        WHEN '77' THEN 'Île-de-France'
        WHEN '78' THEN 'Île-de-France'
        WHEN '79' THEN 'Nouvelle-Aquitaine'
        WHEN '80' THEN 'Hauts-de-France'
        WHEN '81' THEN 'Occitanie'
        WHEN '82' THEN 'Occitanie'
        WHEN '83' THEN 'Provence-Alpes-Côte d''Azur'
        WHEN '84' THEN 'Provence-Alpes-Côte d''Azur'
        WHEN '85' THEN 'Pays de la Loire'
        WHEN '86' THEN 'Nouvelle-Aquitaine'
        WHEN '87' THEN 'Nouvelle-Aquitaine'
        WHEN '88' THEN 'Grand Est'
        WHEN '89' THEN 'Bourgogne-Franche-Comté'
        WHEN '90' THEN 'Bourgogne-Franche-Comté'
        WHEN '91' THEN 'Île-de-France'
        WHEN '92' THEN 'Île-de-France'
        WHEN '93' THEN 'Île-de-France'
        WHEN '94' THEN 'Île-de-France'
        WHEN '95' THEN 'Île-de-France'
        WHEN '97' THEN 'Outre-mer'
        ELSE NULL
      END AS region_calc,
      CASE LEFT(e.code_postal, 2)
        WHEN '01' THEN 'Ain' WHEN '02' THEN 'Aisne' WHEN '03' THEN 'Allier'
        WHEN '04' THEN 'Alpes-de-Haute-Provence' WHEN '05' THEN 'Hautes-Alpes'
        WHEN '06' THEN 'Alpes-Maritimes' WHEN '07' THEN 'Ardèche'
        WHEN '08' THEN 'Ardennes' WHEN '09' THEN 'Ariège' WHEN '10' THEN 'Aube'
        WHEN '11' THEN 'Aude' WHEN '12' THEN 'Aveyron'
        WHEN '13' THEN 'Bouches-du-Rhône' WHEN '14' THEN 'Calvados'
        WHEN '15' THEN 'Cantal' WHEN '16' THEN 'Charente'
        WHEN '17' THEN 'Charente-Maritime' WHEN '18' THEN 'Cher'
        WHEN '19' THEN 'Corrèze' WHEN '20' THEN 'Corse'
        WHEN '21' THEN 'Côte-d''Or' WHEN '22' THEN 'Côtes-d''Armor'
        WHEN '23' THEN 'Creuse' WHEN '24' THEN 'Dordogne' WHEN '25' THEN 'Doubs'
        WHEN '26' THEN 'Drôme' WHEN '27' THEN 'Eure'
        WHEN '28' THEN 'Eure-et-Loir' WHEN '29' THEN 'Finistère'
        WHEN '30' THEN 'Gard' WHEN '31' THEN 'Haute-Garonne' WHEN '32' THEN 'Gers'
        WHEN '33' THEN 'Gironde' WHEN '34' THEN 'Hérault'
        WHEN '35' THEN 'Ille-et-Vilaine' WHEN '36' THEN 'Indre'
        WHEN '37' THEN 'Indre-et-Loire' WHEN '38' THEN 'Isère'
        WHEN '39' THEN 'Jura' WHEN '40' THEN 'Landes'
        WHEN '41' THEN 'Loir-et-Cher' WHEN '42' THEN 'Loire'
        WHEN '43' THEN 'Haute-Loire' WHEN '44' THEN 'Loire-Atlantique'
        WHEN '45' THEN 'Loiret' WHEN '46' THEN 'Lot'
        WHEN '47' THEN 'Lot-et-Garonne' WHEN '48' THEN 'Lozère'
        WHEN '49' THEN 'Maine-et-Loire' WHEN '50' THEN 'Manche'
        WHEN '51' THEN 'Marne' WHEN '52' THEN 'Haute-Marne'
        WHEN '53' THEN 'Mayenne' WHEN '54' THEN 'Meurthe-et-Moselle'
        WHEN '55' THEN 'Meuse' WHEN '56' THEN 'Morbihan'
        WHEN '57' THEN 'Moselle' WHEN '58' THEN 'Nièvre'
        WHEN '59' THEN 'Nord' WHEN '60' THEN 'Oise' WHEN '61' THEN 'Orne'
        WHEN '62' THEN 'Pas-de-Calais' WHEN '63' THEN 'Puy-de-Dôme'
        WHEN '64' THEN 'Pyrénées-Atlantiques' WHEN '65' THEN 'Hautes-Pyrénées'
        WHEN '66' THEN 'Pyrénées-Orientales' WHEN '67' THEN 'Bas-Rhin'
        WHEN '68' THEN 'Haut-Rhin' WHEN '69' THEN 'Rhône'
        WHEN '70' THEN 'Haute-Saône' WHEN '71' THEN 'Saône-et-Loire'
        WHEN '72' THEN 'Sarthe' WHEN '73' THEN 'Savoie'
        WHEN '74' THEN 'Haute-Savoie' WHEN '75' THEN 'Paris'
        WHEN '76' THEN 'Seine-Maritime' WHEN '77' THEN 'Seine-et-Marne'
        WHEN '78' THEN 'Yvelines' WHEN '79' THEN 'Deux-Sèvres'
        WHEN '80' THEN 'Somme' WHEN '81' THEN 'Tarn'
        WHEN '82' THEN 'Tarn-et-Garonne' WHEN '83' THEN 'Var'
        WHEN '84' THEN 'Vaucluse' WHEN '85' THEN 'Vendée'
        WHEN '86' THEN 'Vienne' WHEN '87' THEN 'Haute-Vienne'
        WHEN '88' THEN 'Vosges' WHEN '89' THEN 'Yonne'
        WHEN '90' THEN 'Territoire de Belfort'
        WHEN '91' THEN 'Essonne' WHEN '92' THEN 'Hauts-de-Seine'
        WHEN '93' THEN 'Seine-Saint-Denis' WHEN '94' THEN 'Val-de-Marne'
        WHEN '95' THEN 'Val-d''Oise'
        ELSE NULL
      END AS dept_calc
    FROM entreprises e
    WHERE e.pays = 'FR'
      AND e.region IS NULL
      AND e.code_postal IS NOT NULL
      AND LENGTH(e.code_postal) >= 2
  )
  UPDATE entreprises e
  SET
    region = m.region_calc,
    departement = COALESCE(e.departement, m.dept_calc)
  FROM cp_mapping m
  WHERE e.id = m.id
    AND m.region_calc IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute immediately
SELECT * FROM enrich_regions_from_cp();

-- Cleanup
DROP FUNCTION enrich_regions_from_cp();
```

- [ ] **Step 2: Exécuter la migration**

Run: `supabase-cli` skill ou SQL Editor Supabase pour exécuter `scripts/029-enrich-regions-from-cp.sql`
Expected: Returns `updated_count` > 0 (hopefully close to 267)

- [ ] **Step 3: Vérifier le résultat**

```sql
-- Combien de clients FR sans région maintenant ?
SELECT count(*) FROM entreprises WHERE pays = 'FR' AND region IS NULL;
-- Répartition par région
SELECT region, count(*) FROM entreprises WHERE pays = 'FR' GROUP BY region ORDER BY count(*) DESC;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/029-enrich-regions-from-cp.sql
git commit -m "enrich 267 FR clients with region/departement from code_postal"
```

---

## Task 8 : Ajustements UI — texte relance + limites affichage

**Files:**
- Modify: `app/src/lib/mailto-relance.ts:47-132`
- Modify: `app/src/components/offres-non-transformees-section.tsx:24`

- [ ] **Step 1: Changer "dernière relance" → "relance classique" dans les templates mail**

In `app/src/lib/mailto-relance.ts`, dans les templates `bodies` (les 4 paliers FR), remplacer toute occurrence de "dernière relance" par "relance classique" dans le contenu des emails. Chercher dans le fichier :

```bash
grep -n "dernière relance\|derniere relance" app/src/lib/mailto-relance.ts
```

Si trouvé dans les templates body, remplacer. Si le terme "dernière relance" n'apparaît que dans le palier J-1, modifier le sujet et le corps du J-1 FR pour utiliser "Relance classique" au lieu de "Dernière relance".

Spécifiquement, dans les `subjects` (~line 28), si le J-1 FR dit "Dernière relance", le changer en "Relance" tout court (Alice a demandé de ne pas utiliser "dernière").

- [ ] **Step 2: Vérifier le build**

Run: `cd /home/teina/projects/thermopack-demo/app && bun run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/mailto-relance.ts
git commit -m "rename derniere relance to relance classique in email templates"
```

---

## Task 9 : Vérification finale + About.md

**Files:**
- Modify: `About.md`

- [ ] **Step 1: Build complet**

Run: `cd /home/teina/projects/thermopack-demo/app && bun run build`
Expected: Build success, 0 errors

- [ ] **Step 2: Tester manuellement sur localhost**

Run: `cd /home/teina/projects/thermopack-demo/app && bun run dev`

Vérifier :
1. Dashboard → Top clients : toggle "Par CA" / "Par taux" fonctionne, colonne CA Commandes visible
2. Commandes → Bouton Link2 (chaînon) ouvre le dialog, recherche d'offres fonctionne, liaison OK
3. Commandes → Offre liée s'affiche après liaison
4. Dashboard → Répartition géographique : les régions sont mieux renseignées
5. Relance mail : le wording "dernière relance" n'apparaît plus

- [ ] **Step 3: Mettre à jour About.md**

Ajouter dans la section Décisions :

```markdown
| 2026-04-08 | Retours réunion Alice : top clients par CA (toggle), liaison manuelle offre↔commande, enrichissement géo 267 clients, fix wording relance. |
```

- [ ] **Step 4: Commit final**

```bash
git add About.md
git commit -m "update About.md with 08/04 meeting feedback implementation"
```

- [ ] **Step 5: Push**

```bash
git push origin master
```
