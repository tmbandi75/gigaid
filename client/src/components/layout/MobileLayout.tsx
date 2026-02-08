import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, Users, FileText, MoreHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Plan", badgeKey: null },
  { path: "/jobs", icon: Briefcase, label: "Jobs", badgeKey: "jobs" },
  { path: "/leads", icon: Users, label: "Requests", badgeKey: "leads" },
  { path: "/invoices", icon: FileText, label: "Get Paid", badgeKey: "invoices" },
  { path: "/more", icon: MoreHorizontal, label: "More", badgeKey: null },
];

function useNavBadgeCounts() {
  const { user } = useAuth();

  const { data: jobs } = useQuery<any[]>({
    queryKey: QUERY_KEYS.jobs(),
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: leads } = useQuery<any[]>({
    queryKey: QUERY_KEYS.leads(),
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: invoices } = useQuery<any[]>({
    queryKey: QUERY_KEYS.invoices(),
    enabled: !!user,
    staleTime: 30000,
  });

  const jobsCount = jobs?.filter(j => j.status !== "completed" && j.status !== "cancelled").length ?? 0;
  const leadsCount = leads?.filter(l => l.status === "new").length ?? 0;
  const invoicesCount = invoices?.filter(i => i.status === "sent").length ?? 0;

  return { jobs: jobsCount, leads: leadsCount, invoices: invoicesCount };
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const [location] = useLocation();
  const counts = useNavBadgeCounts();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>
      
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50"
        data-testid="nav-bottom"
      >
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = location === item.path || 
              (item.path !== "/" && location.startsWith(item.path));
            const Icon = item.icon;
            const badgeCount = item.badgeKey ? counts[item.badgeKey as keyof typeof counts] : 0;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div className={`flex flex-col items-center justify-center min-w-[64px] py-2 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  <div className="relative">
                    <Icon 
                      className={`h-6 w-6 ${isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} 
                    />
                    {badgeCount > 0 && (
                      <span
                        className="absolute -top-2 -right-3 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 leading-none"
                        data-testid={`badge-count-${item.badgeKey}`}
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? "font-medium" : ""}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
