import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard,
  Users,
  DollarSign,
  Mail,
  Activity,
  FileText,
  BarChart3,
  Shield,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminNavItems = [
  { 
    title: "Dashboard", 
    href: "/admin/cockpit", 
    icon: LayoutDashboard,
    testId: "nav-dashboard",
  },
  { 
    title: "Users", 
    href: "/admin/users", 
    icon: Users,
    testId: "nav-users",
  },
  { 
    title: "Billing", 
    href: "/admin/billing", 
    icon: DollarSign,
    testId: "nav-billing",
  },
  { 
    title: "Customer.io", 
    href: "/admin/customerio", 
    icon: Mail,
    testId: "nav-customerio",
  },
  { 
    title: "System Health", 
    href: "/admin/system", 
    icon: Activity,
    testId: "nav-system-health",
  },
  { 
    title: "Audit Logs", 
    href: "/admin/audit-logs", 
    icon: FileText,
    testId: "nav-audit-logs",
  },
  { 
    title: "Analytics", 
    href: "/admin/analytics", 
    icon: BarChart3,
    testId: "nav-analytics",
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-muted/30" data-testid="admin-layout">
        <Sidebar className="border-r">
          <SidebarHeader className="border-b p-4">
            <Link href="/admin/cockpit" data-testid="link-admin-home">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div className="group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold text-sm">GigAid Admin</span>
                </div>
              </div>
            </Link>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavItems.map((item) => {
                    const isActive = location === item.href || 
                      (item.href !== "/admin/cockpit" && location.startsWith(item.href));
                    
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.href} data-testid={item.testId}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={toggleTheme}
                  data-testid="button-theme-toggle"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/" data-testid="link-exit-admin">
                    <LogOut className="h-4 w-4" />
                    <span>Exit Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
          </header>
          
          <main className="flex-1 overflow-auto p-6" data-testid="admin-main-content">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
