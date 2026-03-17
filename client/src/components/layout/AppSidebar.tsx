import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Zap,
  Sparkles,
  Bell,
  Calendar,
  Crown,
  Star,
  Gift,
  Share2,
  ChevronUp,
  ChevronDown,
  Moon,
  Sun,
  MessageSquare,
  Mic,
  Send,
  Shield,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";
import { QUERY_KEYS } from "@/lib/queryKeys";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const mainNavItems = [
  { path: "/", icon: LayoutDashboard, label: "Game Plan" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/leads", icon: Users, label: "New Requests" },
  { path: "/invoices", icon: FileText, label: "Get Paid" },
];

const aiToolsItems = [
  { path: "/quickbook", icon: Zap, label: "QuickBook", badge: "New" },
  { path: "/voice-notes", icon: Mic, label: "Voice Notes" },
  { path: "/ai-tools", icon: Sparkles, label: "AI Tools" },
  { path: "/share", icon: Share2, label: "Quick Capture" },
];

const operationsItems = [
  { path: "/messages", icon: MessageSquare, label: "Messages" },
  { path: "/notify-clients", icon: Send, label: "Notify Clients" },
  { path: "/crew", icon: Users, label: "Crew" },
  { path: "/reminders", icon: Bell, label: "Reminders" },
  { path: "/booking-requests", icon: Calendar, label: "Bookings" },
];

const businessItems = [
  { path: "/owner", icon: Crown, label: "Owner View", badge: "Pro" },
  { path: "/money-plan", icon: Zap, label: "Money Plan" },
  { path: "/view-all-stats", icon: BarChart3, label: "Statistics" },
  { path: "/reviews", icon: Star, label: "Reviews" },
  { path: "/referrals", icon: Gift, label: "Referrals" },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [opsOpen, setOpsOpen] = useState(true);
  const [bizOpen, setBizOpen] = useState(true);

  const { data: unreadSmsData } = useQuery<{ count: number }>({
    queryKey: QUERY_KEYS.smsUnreadCount(),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: adminStatus } = useQuery<{ isAdmin: boolean; role?: string }>({
    queryKey: QUERY_KEYS.adminStatus(),
    retry: false,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  const isAdmin = adminStatus?.isAdmin === true;

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const unreadCount = unreadSmsData?.count || 0;

  return (
    <Sidebar data-testid="sidebar-desktop">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border bg-background">
        <Link href="/">
          <div className="flex flex-col cursor-pointer" data-testid="sidebar-header">
            <img src="/gigaid-logo.png" alt="GigAid" className="h-[120px]" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            <span className="text-xs text-sidebar-foreground/60 mt-1">Pro Dashboard</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        {isAdmin && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.startsWith("/admin")}
                      tooltip="Admin Cockpit"
                      data-testid="sidebar-admin-cockpit"
                      className="relative transition-colors duration-150 rounded-md"
                    >
                      <Link href="/admin/cockpit">
                        <Shield className="h-4 w-4" />
                        <span>Admin Cockpit</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator className="my-2" />
          </>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider font-semibold px-2">
            Work
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const active = isActive(item.path);
                const showRequestBadge = item.path === "/leads";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
                      className={`relative transition-colors duration-150 rounded-md ${active ? "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-emerald-500" : ""}`}
                    >
                      <Link href={item.path}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel
                className="text-emerald-500 dark:text-emerald-400 uppercase text-xs tracking-wider font-semibold px-2 cursor-pointer select-none flex items-center justify-between hover:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                data-testid="sidebar-section-ai"
              >
                <span>AI & Tools</span>
                {aiOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 rotate-90" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {aiToolsItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          data-testid={`sidebar-tool-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                          className={`relative transition-colors duration-150 rounded-md ${active ? "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-emerald-500" : ""}`}
                        >
                          <Link href={item.path}>
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator className="my-2" />

        <Collapsible open={opsOpen} onOpenChange={setOpsOpen}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel
                className="text-sidebar-foreground/50 uppercase text-xs tracking-wider font-semibold px-2 cursor-pointer select-none flex items-center justify-between hover:text-sidebar-foreground/70 transition-colors"
                data-testid="sidebar-section-operations"
              >
                <span>Operations</span>
                {opsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 rotate-90" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operationsItems.map((item) => {
                    const active = isActive(item.path);
                    const itemUnreadCount = item.path === "/messages" ? unreadCount : 0;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          data-testid={`sidebar-tool-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                          className={`relative transition-colors duration-150 rounded-md ${active ? "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-emerald-500" : ""}`}
                        >
                          <Link href={item.path}>
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            {itemUnreadCount > 0 && (
                              <Badge className="ml-auto bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full border-0" data-testid={`badge-unread-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                                {itemUnreadCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator className="my-2" />

        <Collapsible open={bizOpen} onOpenChange={setBizOpen}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel
                className="text-sidebar-foreground/50 uppercase text-xs tracking-wider font-semibold px-2 cursor-pointer select-none flex items-center justify-between hover:text-sidebar-foreground/70 transition-colors"
                data-testid="sidebar-section-business"
              >
                <span>Business</span>
                {bizOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 rotate-90" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {businessItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          data-testid={`sidebar-biz-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                          className={`relative transition-colors duration-150 rounded-md ${active ? "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-emerald-500" : ""}`}
                        >
                          <Link href={item.path}>
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-amber-500 to-yellow-500 border-0">
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              data-testid="sidebar-theme-toggle"
              className="transition-colors duration-150 rounded-md"
            >
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

      </SidebarFooter>
    </Sidebar>
  );
}
