import { Card, CardContent } from "@/components/ui/card";
import { Plus, UserPlus, FileText, Calendar } from "lucide-react";
import { Link } from "wouter";

const actions = [
  { 
    icon: Plus, 
    label: "Add Job", 
    href: "/jobs/new",
    color: "bg-primary/10 text-primary"
  },
  { 
    icon: UserPlus, 
    label: "Add Lead", 
    href: "/leads/new",
    color: "bg-chart-3/10 text-chart-3"
  },
  { 
    icon: FileText, 
    label: "Invoice", 
    href: "/invoices/new",
    color: "bg-chart-4/10 text-chart-4"
  },
  { 
    icon: Calendar, 
    label: "Schedule", 
    href: "/jobs",
    color: "bg-chart-5/10 text-chart-5"
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-3" data-testid="quick-actions">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.label} href={action.href}>
            <Card className="hover-elevate active-elevate-2 cursor-pointer">
              <CardContent className="p-3 flex flex-col items-center">
                <div className={`h-10 w-10 rounded-full ${action.color} flex items-center justify-center mb-2`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs text-muted-foreground text-center">
                  {action.label}
                </span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
