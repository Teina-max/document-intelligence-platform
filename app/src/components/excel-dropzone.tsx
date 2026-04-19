"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ExcelDropzoneProps {
  locale: Locale;
}

type ImportType = "offres_detail" | "commandes_detail" | "commandes_summary";

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

type DropzoneState =
  | { status: "idle" }
  | { status: "importing" }
  | { status: "done"; result: ImportResult }
  | { status: "error"; message: string };

export function ExcelDropzone({ locale }: ExcelDropzoneProps) {
  const [importType, setImportType] = useState<ImportType>("offres_detail");
  const [state, setState] = useState<DropzoneState>({ status: "idle" });

  const upload = useCallback(
    async (file: File) => {
      setState({ status: "importing" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType);

      try {
        const res = await fetch("/api/import-excel", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();

        if (!res.ok) {
          const msg = json?.error || `Erreur ${res.status}`;
          setState({ status: "error", message: msg });
          toast.error(msg);
          return;
        }

        const result = json as ImportResult;
        setState({ status: "done", result });

        if (result.errors.length > 0) {
          toast.warning(
            `${t("upload.excel_success", locale)} — ${result.errors.length} erreur(s)`,
          );
        } else {
          toast.success(
            `${t("upload.excel_success", locale)} · ${result.inserted} ${t("upload.excel_inserted", locale)}, ${result.skipped} ${t("upload.excel_skipped", locale)}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur réseau";
        setState({ status: "error", message: msg });
        toast.error(msg);
      }
    },
    [importType, locale],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        upload(acceptedFiles[0]);
      }
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxSize: 50 * 1024 * 1024,
    maxFiles: 1,
    disabled: state.status === "importing",
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors[0]?.message || "Fichier invalide";
      toast.error(reason);
    },
  });

  const reset = () => setState({ status: "idle" });

  const typeOptions: { value: ImportType; label: string }[] = [
    { value: "offres_detail", label: t("upload.excel_type_offres", locale) },
    { value: "commandes_detail", label: t("upload.excel_type_commandes", locale) },
    { value: "commandes_summary", label: t("upload.excel_type_summary", locale) },
  ];

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t("upload.excel_type", locale)}
        </label>
        <select
          value={importType}
          onChange={(e) => setImportType(e.target.value as ImportType)}
          disabled={state.status === "importing"}
          className={cn(
            "w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-1 focus:ring-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-all",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
          state.status === "importing" && "pointer-events-none",
        )}
      >
        <input {...getInputProps()} />

        {state.status === "importing" && (
          <>
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{t("upload.excel_importing", locale)}</p>
          </>
        )}

        {state.status === "done" && (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal/10">
              <Check className="h-6 w-6 text-teal" />
            </div>
            <p className="text-sm font-medium text-teal">{t("upload.excel_success", locale)}</p>
            <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              <p>
                {state.result.inserted} {t("upload.excel_inserted", locale)}
                {" · "}
                {state.result.skipped} {t("upload.excel_skipped", locale)}
              </p>
              {state.result.errors.length > 0 && (
                <p className="text-amber-500">
                  {state.result.errors.length} erreur(s)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="mt-3 text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              Nouvel import
            </button>
          </>
        )}

        {state.status === "error" && (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-medium text-destructive">{state.message}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              Réessayer
            </button>
          </>
        )}

        {state.status === "idle" && (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {isDragActive ? (
                <Upload className="h-5 w-5 text-primary" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium">
              {isDragActive ? "Déposez le fichier ici" : t("upload.excel_drop", locale)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("upload.excel_or_click", locale)}
            </p>
          </>
        )}
      </div>

      {/* Errors list */}
      {state.status === "done" && state.result.errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            Erreurs ({state.result.errors.length})
          </p>
          <ul className="space-y-0.5">
            {state.result.errors.map((err, i) => (
              <li key={i} className="text-[11px] text-muted-foreground font-mono">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
