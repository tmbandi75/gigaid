import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Users,
  Star,
  CalendarClock,
  ArrowRight,
  Inbox,
} from "lucide-react";
import type { DashboardSummary } from "@shared/schema";

interface TodayInsightsPanelProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}

interface InsightItem {
  id: string;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  label: string;
  count: number | null;
  actionLabel: string;
  route: string;
}

export function TodayInsightsPanel({ summary, isLoading }: TodayInsightsPanelProps) {
  const [, navigate] = useLocation();

  const insights: InsightItem[] = [
    {
      id: "leads-follow-up",
      icon: Users,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      label: "leads need follow-up",
      count: summary?.newLeads ?? null,
      actionLabel: "Send Follow-Up",
      route: "/leads",
    },
    {
      id: "reviews-waiting",
      icon: Star,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      label: "reviews waiting",
      count: null,
      actionLabel: "Respond to Reviews",
      route: "/reviews",
    },
    {
      id: "clients-inactive",
      icon: CalendarClock,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600",
      label: "clients haven't booked recently",
      count: null,
      actionLabel: "Notify Clients",
      route: "/notify-clients",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <section data-testid="section-today-insights">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        Today in Your Business
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((insight) => {
          const displayCount = insight.count ?? "—";
          return (
            <Card
              key={insight.id}
              className="rounded-xl border shadow-sm hover:shadow-md transition-shadow"
              data-testid={`card-insight-${insight.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`h-10 w-10 rounded-lg ${insight.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <insight.icon className={`h-5 w-5 ${insight.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold">{displayCount}</div>
                    <p className="text-sm text-muted-foreground">{insight.label}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg text-sm group"
                  onClick={() => navigate(insight.route)}
                  data-testid={`button-insight-${insight.id}`}
                >
                  {insight.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
