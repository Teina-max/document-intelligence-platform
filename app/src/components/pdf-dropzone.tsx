"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadStore, type FileProgress } from "@/lib/upload-store";
import { t, type Locale } from "@/lib/i18n";
import { Upload, FileCheck, AlertCircle, Loader2, Check, X, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatting";

interface PdfDropzoneProps {
  locale: Locale;
}

function FileResultRow({ file, locale }: { file: FileProgress; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const hasDetails = file.status === "done" && file.ocrResult;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 text-xs",
          hasDetails && "cursor-pointer hover:bg-muted/30 transition-colors",
        )}
        onClick={() => hasDetails && setOpen(!open)}
      >
        {/* Status icon */}
        {file.status === "done" && <Check className="h-3.5 w-3.5 text-teal shrink-0" />}
        {file.status === "error" && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
        {(file.status === "uploading" || file.status === "processing") && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        )}
        {file.status === "pending" && (
          <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
        )}

        {/* Filename */}
        <span className={cn(
          "truncate font-medium",
          file.status === "done" && "text-foreground",
          file.status === "error" && "text-destructive",
        )}>
          {file.name}
        </span>

        {/* Status badges */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {file.status === "uploading" && (
            <span className="text-[10px] text-muted-foreground">Upload…</span>
          )}
          {file.status === "processing" && (
            <span className="text-[10px] text-muted-foreground">OCR…</span>
          )}
          {file.status === "error" && file.error && (
            <span className="text-[10px] text-destructive truncate max-w-[200px]">
              {file.error}
            </span>
          )}
          {file.status === "done" && file.ocrResult?.type_document && (
            <Badge
              variant="outline"
              className={cn(
                "font-condensed text-[10px] font-semibold uppercase",
                file.ocrResult.type_document === "offre"
                  ? "border-amber-accent/40 bg-amber-accent/10 text-amber-accent"
                  : "border-teal/40 bg-teal/10 text-teal"
              )}
            >
              {file.ocrResult.type_document === "offre"
                ? t("upload.type_offre", locale)
                : t("upload.type_commande", locale)}
            </Badge>
          )}
          {hasDetails && (
            <ChevronRight className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
              open && "rotate-90 text-primary"
            )} />
          )}
        </div>
      </div>

      {/* Expandable details */}
      {open && file.ocrResult && (
        <div className="border-t border-border/30 bg-muted/20 px-4 py-2.5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
            {file.ocrResult.reference && (
              <>
                <span className="text-muted-foreground">{t("upload.reference", locale)}</span>
                <span className="font-mono font-medium">{file.ocrResult.reference}</span>
              </>
            )}
            {file.ocrResult.entreprise && (
              <>
                <span className="text-muted-foreground">{t("upload.entreprise", locale)}</span>
                <span className="font-medium">{file.ocrResult.entreprise}</span>
              </>
            )}
            {file.ocrResult.montant_ht != null && (
              <>
                <span className="text-muted-foreground">{t("upload.montant", locale)}</span>
                <span className="font-mono font-medium">{formatCurrency(file.ocrResult.montant_ht)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PdfDropzone({ locale }: PdfDropzoneProps) {
  const { uploading, files, current, total, step, result, startUpload, reset } =
    useUploadStore();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      startUpload(acceptedFiles);
    },
    [startUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
  });

  const progressPct = total > 0 ? Math.round((current / total) * 100) : 0;
  const showResults = !uploading && result && files.length > 0;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-all",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
          uploading && "pointer-events-none",
        )}
      >
        <input {...getInputProps()} />

        {uploading && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-lg bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {uploading ? (
          <>
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="font-mono text-sm font-medium">
              {current}/{total}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{step}</p>
          </>
        ) : result ? (
          <>
            {result.success ? (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal/10">
                <FileCheck className="h-6 w-6 text-teal" />
              </div>
            ) : (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            )}
            <p className={cn("text-sm font-medium", result.success ? "text-teal" : "text-destructive")}>
              {result.message}
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              {result.success ? t("upload.new_upload", locale) : t("upload.retry", locale)}
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {isDragActive ? t("upload.drop_here", locale) : t("upload.drag_pdf", locale)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("upload.or_click", locale)}
            </p>
          </>
        )}
      </div>

      {/* File results list — during upload (progress) or after (detailed results) */}
      {files.length > 0 && (
        <div>
          {showResults && (
            <h3 className="mb-2 font-condensed text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("upload.results_title", locale)}
            </h3>
          )}
          <div className="rounded-lg border border-border/60 shadow-sm divide-y divide-border/40 overflow-hidden">
            {files.map((f) => (
              <FileResultRow key={f.name} file={f} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
