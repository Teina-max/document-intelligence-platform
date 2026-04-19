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
