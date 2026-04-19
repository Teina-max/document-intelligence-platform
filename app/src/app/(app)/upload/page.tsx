"use client";

import { useState } from "react";
import { t, LOCALE_COOKIE, getLocaleFromCookie, type Locale } from "@/lib/i18n";
import { PdfDropzone } from "@/components/pdf-dropzone";
import { ExcelDropzone } from "@/components/excel-dropzone";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "pdf" | "excel";

export default function UploadPage() {
  const [locale] = useState<Locale>(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
      return getLocaleFromCookie(match?.[1]);
    }
    return "fr";
  });

  const [activeTab, setActiveTab] = useState<Tab>("pdf");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-bold tracking-tight">{t("upload.title", locale)}</h1>
        <p className="text-xs text-muted-foreground">
          {activeTab === "pdf"
            ? t("upload.subtitle", locale)
            : t("upload.excel_subtitle", locale)}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("pdf")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            activeTab === "pdf"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("upload.tab_pdf", locale)}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("excel")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            activeTab === "excel"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("upload.tab_excel", locale)}
        </button>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {activeTab === "pdf"
              ? t("upload.type_document", locale)
              : t("upload.excel_type", locale)}
          </CardTitle>
          {activeTab === "pdf" && (
            <p className="text-[11px] text-muted-foreground">
              {t("upload.auto_detect", locale)}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {activeTab === "pdf" ? (
            <PdfDropzone locale={locale} />
          ) : (
            <ExcelDropzone locale={locale} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
