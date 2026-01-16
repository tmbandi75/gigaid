import { Link, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  FileText, 
  MoreHorizontal, 
  Bell, 
  Search,
  Plus,
  Command
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
  businessName?: string | null;
}

const quickActions = [
  { label: "New Job", path: "/jobs/new", icon: Briefcase },
  { label: "New Lead", path: "/leads/new", icon: Users },
  { label: "New Invoice", path: "/invoices/new", icon: FileText },
];

const mobileNavItems = [
  { path: "/", icon: LayoutDashboard, label: "Plan" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/leads", icon: Users, label: "Requests" },
  { path: "/invoices", icon: FileText, label: "Get Paid" },
  { path: "/more", icon: MoreHorizontal, label: "More" },
];

const routeLabels: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Game Plan" },
  "/dashboard": { label: "Game Plan" },
  "/jobs": { label: "Jobs" },
  "/jobs/new": { label: "Add a Job", parent: "/jobs" },
  "/leads": { label: "New Requests" },
  "/leads/new": { label: "New Request", parent: "/leads" },
  "/invoices": { label: "Get Paid" },
  "/invoices/new": { label: "Ask for Payment", parent: "/invoices" },
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
  const [location, navigate] = useLocation();

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const currentRoute = routeLabels[location] || { label: "Page" };
  const parentRoute = currentRoute.parent ? routeLabels[currentRoute.parent] : null;

  const displayName = profile?.name || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="hidden md:flex h-16 shrink-0 items-center gap-4 border-b px-6 bg-background">
      <SidebarTrigger className="-ml-2" data-testid="button-sidebar-toggle" />
      <Separator orientation="vertical" className="h-6" />
      
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {parentRoute && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={currentRoute.parent!}>{parentRoute.label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          {currentRoute.label !== "Game Plan" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{currentRoute.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <div className="relative hidden lg:flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search jobs, leads, invoices..."
            className="w-80 pl-10 h-10 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
            data-testid="input-search"
          />
          <kbd className="absolute right-3 pointer-events-none hidden xl:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="sm" className="h-9 gap-2" data-testid="button-quick-add">
              <Plus className="h-4 w-4" />
              <span className="hidden xl:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {quickActions.map((action) => (
              <DropdownMenuItem
                key={action.path}
                onClick={() => navigate(action.path)}
                data-testid={`quick-add-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 hidden lg:block" />

        <Link href="/reminders">
          <Button variant="ghost" size="icon" className="relative h-9 w-9" data-testid="button-notifications">
            <Bell className="h-5 w-5" />
            {(summary?.pendingReminders ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground animate-pulse">
                {summary?.pendingReminders}
              </span>
            )}
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" data-testid="header-user-menu">
              <Avatar className="h-8 w-8">
                {profile?.photo ? (
                  <AvatarImage src={profile.photo} alt="Profile" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{profile?.email || "user@example.com"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="header-dropdown-profile">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="header-dropdown-settings">
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/help")} data-testid="header-dropdown-help">
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" data-testid="header-dropdown-logout">
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
