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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  User,
  Settings,
  HelpCircle,
  LogOut,
  Share2,
  ChevronUp,
  Moon,
  Sun,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
  businessName?: string | null;
}

const mainNavItems = [
  { path: "/", icon: LayoutDashboard, label: "Game Plan" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/leads", icon: Users, label: "New Requests" },
  { path: "/invoices", icon: FileText, label: "Get Paid" },
];

const toolsItems = [
  { path: "/quickbook", icon: Zap, label: "QuickBook", badge: "New" },
  { path: "/ai-tools", icon: Sparkles, label: "AI Tools" },
  { path: "/messages", icon: MessageSquare, label: "Messages" },
  { path: "/crew", icon: Users, label: "Crew" },
  { path: "/reminders", icon: Bell, label: "Reminders" },
  { path: "/booking-requests", icon: Calendar, label: "Bookings" },
  { path: "/share", icon: Share2, label: "Quick Capture" },
];

const businessItems = [
  { path: "/owner", icon: Crown, label: "Owner View", badge: "Pro" },
  { path: "/money-plan", icon: Zap, label: "Money Plan" },
  { path: "/reviews", icon: Star, label: "Reviews" },
  { path: "/referrals", icon: Gift, label: "Referrals" },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(false);

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: unreadSmsData } = useQuery<{ count: number }>({
    queryKey: ["/api/sms/unread-count"],
    refetchInterval: 30000,
  });

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

  const displayName = profile?.name || "Gig Worker";
  const businessName = profile?.businessName || "Your Business";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <Sidebar data-testid="sidebar-desktop">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/">
          <div className="flex flex-col cursor-pointer" data-testid="sidebar-header">
            <img src="/gigaid-logo.png" alt="GigAid" className="h-8" />
            <span className="text-xs text-sidebar-foreground/60 mt-1">Pro Dashboard</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
                  >
                    <Link href={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider font-semibold px-2">Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map((item) => {
                const unreadCount = item.path === "/messages" ? (unreadSmsData?.count || 0) : 0;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={item.label}
                      data-testid={`sidebar-tool-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.path}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {item.badge}
                          </Badge>
                        )}
                        {unreadCount > 0 && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 min-w-5 flex items-center justify-center">
                            {unreadCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider font-semibold px-2">Business</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {businessItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    data-testid={`sidebar-biz-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={toggleDarkMode} 
              data-testid="sidebar-theme-toggle"
            >
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="w-full"
              data-testid="sidebar-user-menu"
            >
              <Avatar className="h-8 w-8">
                {profile?.photo ? (
                  <AvatarImage src={profile.photo} alt="Profile" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium truncate max-w-[120px] text-sidebar-foreground">
                  {displayName}
                </span>
                <span className="text-xs text-sidebar-foreground/60 truncate max-w-[120px]">
                  {businessName}
                </span>
              </div>
              <ChevronUp className="ml-auto h-4 w-4 text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width]"
          >
            <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="dropdown-profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="dropdown-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/help")} data-testid="dropdown-help">
              <HelpCircle className="h-4 w-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" data-testid="dropdown-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
