import { Link, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { LayoutDashboard, Briefcase, Users, FileText, MoreHorizontal, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

interface DashboardSummary {
  pendingReminders?: number;
}

const mobileNavItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/leads", icon: Users, label: "Leads" },
  { path: "/invoices", icon: FileText, label: "Invoices" },
  { path: "/more", icon: MoreHorizontal, label: "More" },
];

const routeLabels: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Dashboard" },
  "/jobs": { label: "Jobs" },
  "/jobs/new": { label: "New Job", parent: "/jobs" },
  "/leads": { label: "Leads" },
  "/leads/new": { label: "New Lead", parent: "/leads" },
  "/invoices": { label: "Invoices" },
  "/invoices/new": { label: "New Invoice", parent: "/invoices" },
  "/reminders": { label: "Reminders" },
  "/crew": { label: "Crew" },
  "/settings": { label: "Settings" },
  "/profile": { label: "Profile" },
  "/reviews": { label: "Reviews" },
  "/referrals": { label: "Referrals" },
  "/help": { label: "Help & Support" },
  "/guides": { label: "User Guides" },
  "/ai-tools": { label: "AI Tools" },
  "/booking-requests": { label: "Booking Requests" },
  "/share": { label: "Quick Capture" },
  "/quickbook": { label: "QuickBook" },
  "/money-plan": { label: "Money Plan" },
  "/owner": { label: "Owner View" },
  "/more": { label: "More" },
};

function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50 md:hidden safe-area-bottom"
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {mobileNavItems.map((item) => {
          const isActive =
            location === item.path ||
            (item.path !== "/" && location.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path} data-testid={`nav-${item.label.toLowerCase()}`}>
              <div
                className={`flex flex-col items-center justify-center min-w-[64px] py-2 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-6 w-6 ${isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
                <span className={`text-xs mt-1 ${isActive ? "font-medium" : ""}`}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DesktopHeader() {
  const [location] = useLocation();

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const currentRoute = routeLabels[location] || { label: "Page" };
  const parentRoute = currentRoute.parent ? routeLabels[currentRoute.parent] : null;

  return (
    <header className="hidden md:flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" data-testid="button-sidebar-toggle" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      
      <Breadcrumb>
        <BreadcrumbList>
          {parentRoute && (
            <>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href={currentRoute.parent!}>{parentRoute.label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{currentRoute.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-9 h-9"
            data-testid="input-search"
          />
        </div>

        <Link href="/reminders">
          <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
            <Bell className="h-5 w-5" />
            {(summary?.pendingReminders ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground">
                {summary?.pendingReminders}
              </span>
            )}
          </Button>
        </Link>
      </div>
    </header>
  );
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 overflow-auto pb-20">{children}</main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <DesktopHeader />
          <main className="flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
