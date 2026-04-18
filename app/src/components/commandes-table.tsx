"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, ArrowRightLeft, Link2 } from "lucide-react";
import { toast } from "sonner";
import { LinkOffreDialog } from "@/components/link-offre-dialog";
import { SortableHeader } from "@/components/sortable-header";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PdfLink } from "@/components/pdf-link";
import { ExpandableRow } from "@/components/expandable-row";
import { EditableCell } from "@/components/editable-cell";
import { formatCurrency, formatDate } from "@/lib/formatting";
import type { CommandeWithRelations } from "@/types/database";

interface CommandesTableProps {
  commandes: CommandeWithRelations[] | null;
  locale: Locale;
}

const typeStyle: Record<string, string> = {
  directe: "border-muted-foreground/30 bg-muted text-muted-foreground",
  partielle: "border-amber-accent/40 bg-amber-accent/10 text-amber-accent",
  egale: "border-teal/40 bg-teal/10 text-teal",
  superieure: "border-primary/40 bg-primary/10 text-primary",
};

function getTypeLabel(type: string, locale: Locale): string {
  const labelMap: Record<string, Record<Locale, string>> = {
    directe: { fr: "Directe", es: "Directo" },
    partielle: { fr: "Partielle", es: "Parcial" },
    egale: { fr: "Égale", es: "Igual" },
    superieure: { fr: "Supérieure", es: "Superior" },
  };
  return labelMap[type]?.[locale] ?? type;
}


export function CommandesTable({ commandes, locale }: CommandesTableProps) {
  const [localCommandes, setLocalCommandes] = useState<CommandeWithRelations[] | null>(commandes);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reclassifying, setReclassifying] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{
    commandeId: string;
    entrepriseId: string;
    currentOffreId: string | null;
  } | null>(null);

  async function handleDelete(id: string) {
    if (!confirm(t("table.delete_confirm", locale))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/commandes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setLocalCommandes(prev => prev?.filter(c => c.id !== id) ?? null);
      toast.success(t("table.deleted", locale));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setDeleting(null);
    }
  }

  async function handleReclassify(id: string) {
    if (!confirm(t("table.reclassify_as_offre", locale))) return;
    setReclassifying(id);
    try {
      const res = await fetch("/api/reclassifier", {
        method: "POST",
        body: JSON.stringify({ id, source: "commande", target: "offre" }),
      });
      if (!res.ok) throw new Error("Reclassify failed");
      setLocalCommandes(prev => prev?.filter(c => c.id !== id) ?? null);
      toast.success(t("table.reclassified", locale));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setReclassifying(null);
    }
  }

  async function handleSaveReference(id: string, value: string) {
    try {
      const res = await fetch(`/api/commandes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ reference_commande: value }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalCommandes(prev =>
        prev?.map(c => c.id === id ? { ...c, reference_commande: value } : c) ?? null
      );
      toast.success(t("table.updated", locale));
    } catch {
      toast.error(t("table.error", locale));
    }
  }

  async function handleSaveMontant(id: string, value: string) {
    try {
      const montant = parseFloat(value);
      if (isNaN(montant)) throw new Error("Invalid number");
      const res = await fetch(`/api/commandes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ montant_ht: montant }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalCommandes(prev =>
        prev?.map(c => c.id === id ? { ...c, montant_ht: montant } : c) ?? null
      );
      toast.success(t("table.updated", locale));
    } catch {
      toast.error(t("table.error", locale));
    }
  }

  function handleLinked(commandeId: string, offreId: string | null, offreRef: string | null) {
    setLocalCommandes(prev =>
      prev?.map(c => c.id === commandeId
        ? {
            ...c,
            offre_id: offreId,
            offres: offreId && offreRef
              ? { reference_offre: offreRef } as typeof c.offres
              : null,
          }
        : c
      ) ?? null
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
      <Table className="table-zebra">
        <TableHeader>
          <TableRow className="table-header-industrial hover:bg-transparent">
            <TableHead className="w-8" />
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider"><SortableHeader column="reference_commande" label={t("dashboard.reference", locale)} /></TableHead>
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.entreprise", locale)}</TableHead>
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("commandes.offre_liee", locale)}</TableHead>
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right"><SortableHeader column="montant_ht" label={t("dashboard.montant_ht", locale)} className="justify-end" /></TableHead>
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider"><SortableHeader column="date_commande" label={t("offres.date", locale)} /></TableHead>
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center"><SortableHeader column="type" label={t("commandes.type", locale)} className="justify-center" /></TableHead>
            <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center w-32">{t("table.actions", locale)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {localCommandes && localCommandes.length > 0 ? (
            localCommandes.map((cmd) => (
              <ExpandableRow key={cmd.id} recordId={cmd.id} recordType="commande" designations={cmd.designations} colSpan={8}>
                <TableCell className="font-mono text-xs font-medium">
                  <EditableCell
                    value={cmd.reference_commande}
                    onSave={(v) => handleSaveReference(cmd.id, v)}
                    type="text"
                  />
                </TableCell>
                <TableCell className="text-sm">
                  <Link href={`/entreprises/${cmd.entreprise_id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {cmd.entreprises.nom}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cmd.offres?.reference_offre ?? "—"}
                </TableCell>
                <TableCell className="kpi-value text-right text-sm">
                  <EditableCell
                    value={cmd.montant_ht}
                    onSave={(v) => handleSaveMontant(cmd.id, v)}
                    type="currency"
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(cmd.date_commande)}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={cn("font-condensed text-[10px] font-semibold uppercase", typeStyle[cmd.type] ?? "")}
                  >
                    {getTypeLabel(cmd.type, locale)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
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
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReclassify(cmd.id); }}
                      disabled={reclassifying === cmd.id}
                      className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-primary/5 p-1.5 text-xs text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50"
                      title={t("table.reclassify_as_offre", locale)}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(cmd.id); }}
                      disabled={deleting === cmd.id}
                      className="inline-flex items-center justify-center rounded-md border border-destructive/20 bg-destructive/5 p-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10 hover:border-destructive/40 disabled:opacity-50"
                      title={t("table.delete_confirm", locale)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <PdfLink storagePath={cmd.fichier_source} />
                  </div>
                </TableCell>
              </ExpandableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                {t("commandes.aucune", locale)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {linkDialog && (
        <LinkOffreDialog
          open={!!linkDialog}
          onOpenChange={(open) => { if (!open) setLinkDialog(null); }}
          commandeId={linkDialog.commandeId}
          entrepriseId={linkDialog.entrepriseId}
          currentOffreId={linkDialog.currentOffreId}
          locale={locale}
          onLinked={(offreId, offreRef) => handleLinked(linkDialog.commandeId, offreId, offreRef)}
        />
      )}
    </div>
  );
}
