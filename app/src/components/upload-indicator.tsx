"use client";

import { useUploadStore } from "@/lib/upload-store";
import { Loader2, X } from "lucide-react";

export function UploadIndicator() {
  const { uploading, current, total, step, files } = useUploadStore();

  if (!uploading) return null;

  const progressPct = total > 0 ? Math.round((current / total) * 100) : 0;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border border-border/60 bg-card p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="font-mono text-xs font-medium">
          {doneCount}/{total} fichiers
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground truncate mb-2">{step}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
