import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Zap,
  BarChart3,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import type { DashboardSummary } from "@shared/schema";
import { TodayInsightsPanel } from "./TodayInsightsPanel";
import { RecommendedActionsPanel } from "./RecommendedActionsPanel";
import { AiAssistantPanel } from "./AiAssistantPanel";
import { ToolGridSection } from "./ToolGridSection";

interface AIFeature {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  category: "create" | "automate" | "grow";
  gradient: string;
  requiresUnlock?: boolean;
}

interface BusinessCoPilotDesktopViewProps {
  summary: DashboardSummary | undefined;
  summaryLoading: boolean;
  features: AIFeature[];
  hasUnlockedAdvanced: boolean;
  onOpenTool: (toolId: string) => void;
  onLockedClick: () => void;
}

function BusinessHealthPanel({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const metrics = [
    {
      label: "Bookings",
      value: summary?.weeklyStats?.jobsThisWeek ?? null,
      sublabel: "this week",
      icon: Briefcase,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      label: "Follow-ups",
      value: summary?.newLeads ?? null,
      sublabel: "pending",
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Earnings",
      value: summary?.weeklyStats?.earningsThisWeek != null
        ? `$${(summary.weeklyStats.earningsThisWeek / 100).toLocaleString()}`
        : null,
      sublabel: "this week",
      icon: BarChart3,
      color: "text-violet-600",
      bg: "bg-violet-500/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <section data-testid="section-business-health">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Business Health
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="rounded-xl border shadow-sm" data-testid={`card-health-${metric.label.toLowerCase()}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${metric.bg} flex items-center justify-center flex-shrink-0`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div>
                <div className="text-xl font-bold">{metric.value ?? "—"}</div>
                <p className="text-xs text-muted-foreground">{metric.label} · {metric.sublabel}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function BusinessCoPilotDesktopView({
  summary,
  summaryLoading,
  features,
  hasUnlockedAdvanced,
  onOpenTool,
  onLockedClick,
}: BusinessCoPilotDesktopViewProps) {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-6" data-testid="desktop-copilot-view">
      <div className="space-y-8">
        <BusinessHealthPanel summary={summary} isLoading={summaryLoading} />

        <TodayInsightsPanel summary={summary} isLoading={summaryLoading} />

        <RecommendedActionsPanel onOpenTool={onOpenTool} />

        <AiAssistantPanel />

        <Card className="bg-gradient-to-br from-primary/5 to-violet-500/5 border-primary/20 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Pro Tip</h3>
                <p className="text-sm text-muted-foreground">
                  Use the voice button at the bottom of any screen to quickly create jobs, leads, or invoices hands-free.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ToolGridSection
          features={features}
          hasUnlockedAdvanced={hasUnlockedAdvanced}
          onOpenTool={onOpenTool}
          onLockedClick={onLockedClick}
        />
      </div>
    </div>
  );
}
