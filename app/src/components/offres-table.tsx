"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trash2, ArrowRightLeft, Mail } from "lucide-react";
import { toast } from "sonner";
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
import type { OffreWithEntreprise } from "@/types/database";
import { buildMailtoUrl } from "@/lib/mailto-relance";
import { SortableHeader } from "@/components/sortable-header";
import { useSelectionStore } from "@/stores/selection-store";
import { FloatingActionBar } from "@/components/floating-action-bar";
import { UrgencyBadge } from "@/components/urgency-badge";

interface OffresTableProps {
  offres: OffreWithEntreprise[] | null;
  locale: Locale;
  isAdmin: boolean;
}

const statutStyle: Record<string, string> = {
  en_attente: "border-amber-accent/40 bg-amber-accent/10 text-amber-accent",
  transformee: "border-teal/40 bg-teal/10 text-teal",
  partiellement_transformee: "border-primary/40 bg-primary/10 text-primary",
  expiree: "border-destructive/40 bg-destructive/10 text-destructive",
};

function getStatutLabel(statut: string, locale: Locale): string {
  const labelMap: Record<string, Record<Locale, string>> = {
    en_attente: { fr: "En attente", es: "Pendiente" },
    transformee: { fr: "Transformée", es: "Convertida" },
    partiellement_transformee: { fr: "Partielle", es: "Parcial" },
    expiree: { fr: "Expirée", es: "Vencida" },
  };
  return labelMap[statut]?.[locale] ?? statut;
}


export function OffresTable({ offres, locale, isAdmin }: OffresTableProps) {
  const [localOffres, setLocalOffres] = useState<OffreWithEntreprise[] | null>(offres);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reclassifying, setReclassifying] = useState<string | null>(null);
  const [relancing, setRelancing] = useState<string | null>(null);

  const { selectedIds, toggle, selectAll, deselectAll, isSelected } = useSelectionStore();
  const allIds = (localOffres ?? []).map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  // Reset selection when offres change (page navigation)
  useEffect(() => {
    deselectAll();
  }, [offres, deselectAll]);

  async function handleDelete(id: string) {
    if (!confirm(t("table.delete_confirm", locale))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/offres/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setLocalOffres(prev => prev?.filter(o => o.id !== id) ?? null);
      toast.success(t("table.deleted", locale));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setDeleting(null);
    }
  }

  async function handleReclassify(id: string) {
    if (!confirm(t("table.reclassify_as_commande", locale))) return;
    setReclassifying(id);
    try {
      const res = await fetch("/api/reclassifier", {
        method: "POST",
        body: JSON.stringify({ id, source: "offre", target: "commande" }),
      });
      if (!res.ok) throw new Error("Reclassify failed");
      setLocalOffres(prev => prev?.filter(o => o.id !== id) ?? null);
      toast.success(t("table.reclassified", locale));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setReclassifying(null);
    }
  }

  async function handleSaveReference(id: string, value: string) {
    try {
      const res = await fetch(`/api/offres/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ reference_offre: value }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalOffres(prev =>
        prev?.map(o => o.id === id ? { ...o, reference_offre: value } : o) ?? null
      );
      toast.success(t("table.updated", locale));
    } catch {
      toast.error(t("table.error", locale));
    }
  }

  async function handleSaveNotes(id: string, value: string) {
    try {
      const res = await fetch(`/api/offres/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: value }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalOffres(prev =>
        prev?.map(o => o.id === id ? { ...o, notes: value } : o) ?? null
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
      const res = await fetch(`/api/offres/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ montant_ht: montant }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalOffres(prev =>
        prev?.map(o => o.id === id ? { ...o, montant_ht: montant } : o) ?? null
      );
      toast.success(t("table.updated", locale));
    } catch {
      toast.error(t("table.error", locale));
    }
  }

  async function handleRelancer(offre: OffreWithEntreprise) {
    if (!offre.entreprises.contact_email) {
      toast.error(t("table.no_email", locale));
      return;
    }

    setRelancing(offre.id);
    try {
      window.open(
        buildMailtoUrl({
          reference_offre: offre.reference_offre,
          contact_email: offre.entreprises.contact_email,
          contact_nom: offre.entreprises.contact_nom,
          montant_ht: offre.montant_ht,
          date_expiration: offre.date_expiration,
          jours_restants: offre.date_expiration
            ? Math.ceil((new Date(offre.date_expiration).getTime() - Date.now()) / 86400000)
            : null,
          entreprise_pays: offre.entreprises.pays,
        }),
        '_blank'
      );

      const res = await fetch(`/api/offres/${offre.id}`, {
        method: "PATCH",
        body: JSON.stringify({ derniere_relance: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error("Update failed");

      setLocalOffres(prev =>
        prev?.map(o => o.id === offre.id ? { ...o, derniere_relance: new Date().toISOString() } : o) ?? null
      );
      toast.success(t("table.relance_ok", locale));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setRelancing(null);
    }
  }

  function handleBatchRelance() {
    toast.info("Connexion email en cours de configuration");
  }

  function handleBatchExport() {
    const selected = (localOffres ?? []).filter((o) => selectedIds.has(o.id));
    const headers = ["Référence", "Entreprise", "Montant HT", "Date offre", "Statut"];
    const rows = selected.map((o) => [
      o.reference_offre,
      o.entreprises?.nom ?? "",
      o.montant_ht?.toString() ?? "",
      o.date_offre ?? "",
      o.statut,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offres-selection-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    deselectAll();
    toast.success(`${selected.length} offre(s) exportée(s)`);
  }

  async function handleBatchDelete() {
    if (!confirm(`Supprimer ${selectedIds.size} offre(s) ?`)) return;
    const ids = Array.from(selectedIds);
    const deletedIds: string[] = [];
    const failedIds: string[] = [];
    for (const id of ids) {
      try {
        const res = await fetch(`/api/offres/${id}`, { method: "DELETE" });
        if (res.ok) {
          deletedIds.push(id);
        } else {
          failedIds.push(id);
        }
      } catch {
        failedIds.push(id);
      }
    }
    const deletedSet = new Set(deletedIds);
    setLocalOffres((prev) => prev?.filter((o) => !deletedSet.has(o.id)) ?? null);
    deselectAll();
    if (failedIds.length === 0) {
      toast.success(`${deletedIds.length} offre(s) supprimée(s)`);
    } else if (deletedIds.length === 0) {
      toast.error(`Échec de suppression des ${failedIds.length} offre(s)`);
    } else {
      toast.warning(`${deletedIds.length} supprimée(s), ${failedIds.length} en erreur`);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow className="table-header-industrial hover:bg-transparent">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => allSelected ? deselectAll() : selectAll(allIds)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
              </TableHead>
              <TableHead className="w-8" />
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                <SortableHeader column="reference_offre" label={t("dashboard.reference", locale)} />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.entreprise", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                <SortableHeader column="montant_ht" label={t("dashboard.montant_ht", locale)} className="justify-end" />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                <SortableHeader column="date_offre" label={t("offres.date", locale)} />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                <SortableHeader column="date_expiration" label={t("dashboard.expiration", locale)} />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">
                <SortableHeader column="statut" label={t("offres.statut", locale)} />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                <SortableHeader column="date_expiration" label="Urgence" />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("offres.notes", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("table.derniere_relance", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center w-32">{t("table.actions", locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localOffres && localOffres.length > 0 ? (
              localOffres.map((offre) => (
                <ExpandableRow key={offre.id} recordId={offre.id} recordType="offre" designations={offre.designations} colSpan={12}>
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(offre.id)}
                      onChange={() => toggle(offre.id)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">
                    <EditableCell
                      value={offre.reference_offre}
                      onSave={(v) => handleSaveReference(offre.id, v)}
                      type="text"
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={`/entreprises/${offre.entreprise_id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {offre.entreprises.nom}
                    </Link>
                  </TableCell>
                  <TableCell className="kpi-value text-right text-sm">
                    <EditableCell
                      value={offre.montant_ht}
                      onSave={(v) => handleSaveMontant(offre.id, v)}
                      type="currency"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(offre.date_offre)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {offre.date_expiration ? formatDate(offre.date_expiration) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={cn("font-condensed text-[10px] font-semibold uppercase", statutStyle[offre.statut] ?? "")}
                    >
                      {getStatutLabel(offre.statut, locale)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UrgencyBadge dateExpiration={offre.date_expiration} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <EditableCell
                      value={offre.notes}
                      onSave={(v) => handleSaveNotes(offre.id, v)}
                      type="text"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {offre.derniere_relance ? formatDate(offre.derniere_relance) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {offre.statut === "en_attente" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRelancer(offre); }}
                          disabled={relancing === offre.id || !offre.entreprises.contact_email}
                          className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-primary/5 p-1.5 text-xs text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t("table.relancer", locale)}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReclassify(offre.id); }}
                        disabled={reclassifying === offre.id}
                        className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-primary/5 p-1.5 text-xs text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50"
                        title={t("table.reclassify_as_commande", locale)}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(offre.id); }}
                        disabled={deleting === offre.id}
                        className="inline-flex items-center justify-center rounded-md border border-destructive/20 bg-destructive/5 p-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10 hover:border-destructive/40 disabled:opacity-50"
                        title={t("table.delete_confirm", locale)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <PdfLink storagePath={offre.fichier_source} />
                    </div>
                  </TableCell>
                </ExpandableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
                  {t("offres.aucune", locale)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <FloatingActionBar
        onRelancer={handleBatchRelance}
        onExportCsv={handleBatchExport}
        onDelete={handleBatchDelete}
        relanceDisabled={true}
        relanceTooltip="Connexion email en cours de configuration"
        isAdmin={isAdmin}
      />
    </>
  );
}
