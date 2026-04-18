"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import {
  BarChart3,
  FileText,
  ShoppingCart,
  Upload,
  LogOut,
  LayoutDashboard,
  PieChart,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems: { titleKey: TranslationKey; href: string; icon: typeof BarChart3 }[] = [
  { titleKey: "nav.dashboard", href: "/dashboard", icon: BarChart3 },
  { titleKey: "nav.direction", href: "/direction", icon: LayoutDashboard },
  { titleKey: "nav.analyse", href: "/analyse", icon: PieChart },
  { titleKey: "nav.offres", href: "/offres", icon: FileText },
  { titleKey: "nav.commandes", href: "/commandes", icon: ShoppingCart },
  { titleKey: "nav.upload", href: "/upload", icon: Upload },
  { titleKey: "nav.admin", href: "/admin/users", icon: Users },
];

interface AppSidebarProps {
  locale: Locale;
  urgentCount?: number;
}

export function AppSidebar({ locale, urgentCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex justify-center px-3 py-6">
            <Image
              src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png"
              alt="ThermoPack"
              width={44}
              height={44}
            />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "sidebar-active-glow" : "opacity-70 hover:opacity-100 transition-opacity"}
                    >
                      <a href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-[13px] font-medium">{t(item.titleKey, locale)}</span>
                      </a>
                    </SidebarMenuButton>
                    {item.href === "/offres" && urgentCount > 0 && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground text-[10px] font-bold">
                        {urgentCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/50 text-[13px]"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          {t("nav.logout", locale)}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
