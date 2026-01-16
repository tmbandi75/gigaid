import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, Users, FileText, MoreHorizontal } from "lucide-react";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Plan" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/leads", icon: Users, label: "Requests" },
  { path: "/invoices", icon: FileText, label: "Get Paid" },
  { path: "/more", icon: MoreHorizontal, label: "More" },
];

export function MobileLayout({ children }: MobileLayoutProps) {
  const [location] = useLocation();

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
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div className={`flex flex-col items-center justify-center min-w-[64px] py-2 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  <Icon 
                    className={`h-6 w-6 ${isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} 
                  />
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
