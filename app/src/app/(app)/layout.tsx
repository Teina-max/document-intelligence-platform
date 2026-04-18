import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { LocaleToggle } from "@/components/locale-toggle";
import { GlobalSearch } from "@/components/global-search";
import { PageTitle } from "@/components/page-title";
import { UploadIndicator } from "@/components/upload-indicator";
import { getLocale } from "@/lib/get-locale";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const { count: urgentCount } = await supabase
    .from("offres")
    .select("id", { count: "exact", head: true })
    .eq("statut", "en_attente")
    .gte("date_expiration", today)
    .lte("date_expiration", in7Days);

  return (
    <SidebarProvider>
      <AppSidebar locale={locale} urgentCount={urgentCount ?? 0} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-card px-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 text-muted-foreground/70 hover:text-foreground transition-colors" />
            <Separator orientation="vertical" className="mr-1 h-5 bg-border/50" />
            <PageTitle locale={locale} />
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <LocaleToggle locale={locale} />
          </div>
        </header>
        <main className="flex-1 bg-background p-4 md:p-6">{children}</main>
      </SidebarInset>
      <UploadIndicator />
    </SidebarProvider>
  );
}
