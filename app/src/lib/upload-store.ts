import { create } from "zustand";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export interface OcrResult {
  type_document?: string;
  reference?: string;
  entreprise?: string;
  montant_ht?: number;
}

export interface FileProgress {
  name: string;
  storagePath?: string;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
  ocrResult?: OcrResult;
}

interface UploadState {
  uploading: boolean;
  files: FileProgress[];
  current: number;
  total: number;
  step: string;
  result: { success: boolean; message: string } | null;
  startUpload: (acceptedFiles: File[]) => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL = 5_000;
const POLL_MAX_ATTEMPTS = 60; // 5min max

export const useUploadStore = create<UploadState>((set, get) => ({
  uploading: false,
  files: [],
  current: 0,
  total: 0,
  step: "",
  result: null,

  reset: () => set({ uploading: false, files: [], current: 0, total: 0, step: "", result: null }),

  startUpload: async (acceptedFiles) => {
    if (get().uploading || acceptedFiles.length === 0) return;

    const fileList: FileProgress[] = acceptedFiles.map((f) => ({
      name: f.name,
      status: "pending",
    }));

    set({
      uploading: true,
      result: null,
      files: fileList,
      current: 0,
      total: acceptedFiles.length,
      step: "Upload vers Supabase Storage...",
    });

    const supabase = createClient();
    const uploadedFiles: { fileName: string; storagePath: string; index: number }[] = [];

    // Phase 1: Upload all files to Supabase Storage
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];

      set((s) => ({
        step: `Upload ${file.name} (${i + 1}/${acceptedFiles.length})`,
        current: i,
        files: s.files.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f),
      }));

      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.{2,}/g, ".")
        .slice(0, 100);
      const path = `uploads/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage.from("documents").upload(path, file);

      if (error) {
        toast.error(`Erreur upload ${file.name} : ${error.message}`);
        set((s) => ({
          files: s.files.map((f, idx) => idx === i ? { ...f, status: "error", error: error.message } : f),
        }));
        continue;
      }

      uploadedFiles.push({ fileName: file.name, storagePath: path, index: i });
      set((s) => ({
        files: s.files.map((f, idx) => idx === i ? { ...f, status: "done", storagePath: path } : f),
      }));
    }

    if (uploadedFiles.length === 0) {
      set({ uploading: false, result: { success: false, message: "Aucun fichier uploadé" } });
      return;
    }

    // Phase 2: Send all paths to n8n for batch OCR
    set({
      step: `Lancement OCR pour ${uploadedFiles.length} fichier(s)...`,
      files: get().files.map((f) =>
        f.status === "done" ? { ...f, status: "processing" as const } : f
      ),
    });

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploadedFiles.map(({ fileName, storagePath }) => ({ fileName, storagePath })) }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Erreur ${res.status}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erreur OCR";
      toast.error(errMsg);
      set({ uploading: false, result: { success: false, message: errMsg } });
      return;
    }

    // Phase 3: Poll ocr_logs for results
    const storagePaths = uploadedFiles.map((f) => f.storagePath);
    let attempts = 0;

    set({ step: `Traitement OCR en cours (0/${uploadedFiles.length})...` });

    const poll = async () => {
      while (attempts < POLL_MAX_ATTEMPTS) {
        attempts++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));

        const { data: logs } = await supabase
          .from("ocr_logs")
          .select("fichier_source, statut, donnees_extraites")
          .in("fichier_source", storagePaths);

        if (!logs) continue;

        // Update file statuses based on logs
        const logMap = new Map(logs.map((l) => [l.fichier_source, l]));
        let doneCount = 0;

        set((s) => ({
          step: `Traitement OCR en cours (${logs.length}/${uploadedFiles.length})...`,
          current: logs.length,
          files: s.files.map((f) => {
            if (!f.storagePath) return f;
            const log = logMap.get(f.storagePath);
            if (!log) return f; // still processing

            doneCount++;

            if (log.statut === "success") {
              let ocrResult: OcrResult | undefined;
              try {
                const d = typeof log.donnees_extraites === "string"
                  ? JSON.parse(log.donnees_extraites)
                  : log.donnees_extraites;
                ocrResult = {
                  type_document: d?.type_document,
                  reference: d?.reference,
                  entreprise: d?.entreprise_nom,
                  montant_ht: d?.montant_ht,
                };
              } catch {}
              return { ...f, status: "done" as const, ocrResult };
            }

            const errMsg = typeof log.donnees_extraites === "string"
              ? (() => { try { return JSON.parse(log.donnees_extraites)?.error; } catch { return undefined; } })()
              : log.donnees_extraites?.error;
            return { ...f, status: "error" as const, error: errMsg || "Erreur OCR" };
          }),
        }));

        // All files processed?
        if (logs.length >= uploadedFiles.length) {
          const successCount = logs.filter((l) => l.statut === "success").length;
          const failCount = logs.length - successCount;

          let message = `${successCount} fichier(s) traité(s)`;
          if (failCount > 0) message += `, ${failCount} erreur(s)`;

          toast.success(message);
          set({
            uploading: false,
            step: "",
            current: uploadedFiles.length,
            result: { success: failCount === 0, message },
          });
          return;
        }
      }

      // Timeout
      set({
        uploading: false,
        result: { success: false, message: "Timeout — certains fichiers sont peut-être encore en cours de traitement. Rafraîchissez la page." },
      });
    };

    await poll();
  },
}));
