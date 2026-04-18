"use client";

import { useState, useCallback } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import type { Designation } from "@/types/database";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatting";
import { createClient } from "@/lib/supabase/client";

interface LigneRow {
  designation_brute: string | null;
  quantite: number;
  prix_unitaire: number | null;
  pieces: { reference: string; nom_fr: string } | null;
}

interface ExpandableRowProps {
  children: React.ReactNode;
  recordId: string;
  recordType: "offre" | "commande";
  designations?: Designation[] | null;
  colSpan: number;
}

export function ExpandableRow({ children, recordId, recordType, designations, colSpan }: ExpandableRowProps) {
  const [open, setOpen] = useState(false);
  const [lignes, setLignes] = useState<LigneRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fallbackItems = Array.isArray(designations) ? designations : [];

  const fetchLignes = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const table = recordType === "offre" ? "offre_lignes" : "commande_lignes";
      const fk = recordType === "offre" ? "offre_id" : "commande_id";

      const { data, error } = await supabase
        .from(table)
        .select("designation_brute, quantite, prix_unitaire, pieces(reference, nom_fr)")
        .eq(fk, recordId)
        .order("poste", { ascending: true });

      if (error) throw error;
      setLignes((data as LigneRow[]) ?? []);
    } catch {
      setLignes(null);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [recordId, recordType, fetched]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !fetched) {
      fetchLignes();
    }
  };

  const items = lignes && lignes.length > 0 ? lignes : null;
  const hasFallback = fallbackItems.length > 0;
  const hasContent = fetched ? items !== null : hasFallback;

  return (
    <>
      <TableRow
        className={cn(
          "transition-colors",
          (hasContent || !fetched) && "cursor-pointer hover:bg-muted/40",
          !hasContent && fetched && "hover:bg-muted/20",
          open && "bg-muted/20"
        )}
        onClick={handleToggle}
      >
        {(hasContent || !fetched) ? (
          <TableCell className="w-8 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted/60 transition-colors">
              {loading ? (
                <Loader2 className="h-4 w-4 text-muted-foreground/70 animate-spin" />
              ) : (
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground/70 transition-transform duration-200", open && "rotate-90 text-primary")} />
              )}
            </div>
          </TableCell>
        ) : (
          <TableCell className="w-8 px-2" />
        )}
        {children}
      </TableRow>
      {open && !loading && (
        <>
          {items ? (
            <TableRow className="bg-muted/20">
              <TableCell colSpan={colSpan + 1} className="p-0">
                <div className="px-8 py-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-1.5 text-left font-semibold">Réf. pièce</th>
                        <th className="pb-1.5 text-left font-semibold">Désignation</th>
                        <th className="pb-1.5 text-right font-semibold">Qté</th>
                        <th className="pb-1.5 text-right font-semibold">P.U.</th>
                        <th className="pb-1.5 text-right font-semibold">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((l, i) => {
                        const montant = l.prix_unitaire != null ? l.quantite * l.prix_unitaire : null;
                        return (
                          <tr key={i} className="border-t border-border/30">
                            <td className="py-1 font-mono text-[11px]">{l.pieces?.reference ?? "—"}</td>
                            <td className="py-1 max-w-[250px] truncate" title={l.designation_brute ?? undefined}>
                              {l.pieces?.nom_fr ?? l.designation_brute ?? "—"}
                            </td>
                            <td className="py-1 text-right tabular-nums">{l.quantite}</td>
                            <td className="py-1 text-right tabular-nums">{l.prix_unitaire != null ? formatCurrency(l.prix_unitaire, 2) : "—"}</td>
                            <td className="py-1 text-right font-medium tabular-nums">
                              {montant != null ? formatCurrency(montant, 2) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TableCell>
            </TableRow>
          ) : hasFallback ? (
            <TableRow className="bg-muted/20">
              <TableCell colSpan={colSpan + 1} className="p-0">
                <div className="px-8 py-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-1.5 text-left font-semibold">Réf.</th>
                        <th className="pb-1.5 text-left font-semibold">Désignation</th>
                        <th className="pb-1.5 text-right font-semibold">Qté</th>
                        <th className="pb-1.5 text-right font-semibold">P.U.</th>
                        <th className="pb-1.5 text-right font-semibold">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fallbackItems.map((d, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="py-1 font-mono text-[11px]">{d.reference_materiel ?? "—"}</td>
                          <td
                            className="py-1 max-w-[250px] truncate"
                            title={d.designation_fr && d.designation_fr !== d.designation ? d.designation : undefined}
                          >
                            {d.designation_fr ?? d.designation}
                          </td>
                          <td className="py-1 text-right tabular-nums">{d.quantite}</td>
                          <td className="py-1 text-right tabular-nums">{formatCurrency(d.prix_unitaire, 2)}</td>
                          <td className="py-1 text-right font-medium tabular-nums">
                            {formatCurrency(d.montant_ligne ?? d.quantite * d.prix_unitaire, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableCell>
            </TableRow>
          ) : fetched ? (
            <TableRow className="bg-muted/20">
              <TableCell colSpan={colSpan + 1} className="p-0">
                <div className="px-8 py-3 text-xs text-muted-foreground">
                  Aucune ligne de détail disponible.
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </>
      )}
    </>
  );
}
