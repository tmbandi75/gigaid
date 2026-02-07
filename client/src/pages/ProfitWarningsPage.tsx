import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  MapPin,
  TrendingDown,
  CheckCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface ProfitWarning {
  jobId: number;
  title: string;
  type: "low_margin" | "slow_payer" | "high_travel" | "underpriced";
  message: string;
  severity: "high" | "medium";
}

interface ProfitWarningsResponse {
  warnings: ProfitWarning[];
  totalWarnings: number;
  highSeverityCount: number;
}

const TYPE_CONFIG: Record<
  ProfitWarning["type"],
  { icon: typeof DollarSign; label: string }
> = {
  low_margin: { icon: DollarSign, label: "Low Margin" },
  slow_payer: { icon: Clock, label: "Slow Payer" },
  high_travel: { icon: MapPin, label: "High Travel" },
  underpriced: { icon: TrendingDown, label: "Underpriced" },
};

function WarningCard({
  warning,
  onViewJob,
}: {
  warning: ProfitWarning;
  onViewJob: (jobId: number) => void;
}) {
  const config = TYPE_CONFIG[warning.type];
  const Icon = config.icon;
  const isHigh = warning.severity === "high";

  return (
    <Card data-testid={`card-warning-${warning.jobId}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
              isHigh
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                data-testid={`badge-type-${warning.jobId}`}
              >
                {config.label}
              </Badge>
              <Badge
                variant={isHigh ? "destructive" : "outline"}
                data-testid={`badge-severity-${warning.jobId}`}
              >
                {isHigh ? "High" : "Medium"}
              </Badge>
            </div>
            <h3
              className="text-sm font-semibold text-foreground"
              data-testid={`text-warning-title-${warning.jobId}`}
            >
              {warning.title}
            </h3>
            <p
              className="text-sm text-muted-foreground"
              data-testid={`text-warning-message-${warning.jobId}`}
            >
              {warning.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 -ml-2"
              onClick={() => onViewJob(warning.jobId)}
              data-testid={`button-view-job-${warning.jobId}`}
            >
              View Job
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WarningsList({
  warnings,
  onViewJob,
}: {
  warnings: ProfitWarning[];
  onViewJob: (jobId: number) => void;
}) {
  if (warnings.length === 0) {
    return (
      <div className="text-center py-16" data-testid="empty-state">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold mb-2">All clear!</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No profit issues detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning) => (
        <WarningCard
          key={`${warning.jobId}-${warning.type}`}
          warning={warning}
          onViewJob={onViewJob}
        />
      ))}
    </div>
  );
}

export default function ProfitWarningsPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("all");

  const { data, isLoading } = useQuery<ProfitWarningsResponse>({
    queryKey: QUERY_KEYS.profitWarnings(),
    queryFn: () => apiFetch<ProfitWarningsResponse>("/api/profit-warnings"),
  });

  const warnings = data?.warnings || [];
  const totalWarnings = data?.totalWarnings ?? 0;
  const highSeverityCount = data?.highSeverityCount ?? 0;

  const filteredWarnings =
    tab === "high"
      ? warnings.filter((w) => w.severity === "high")
      : tab === "medium"
        ? warnings.filter((w) => w.severity === "medium")
        : warnings;

  const handleViewJob = (jobId: number) => {
    navigate(`/jobs/${jobId}`);
  };

  return (
    <div
      className="flex flex-col min-h-full bg-background"
      data-testid="page-profit-warnings"
    >
      <div className="border-b bg-background sticky top-0 z-[999]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold text-foreground"
                data-testid="text-page-title"
              >
                Profit Alerts
              </h1>
              <p
                className="text-sm text-muted-foreground"
                data-testid="text-page-subtitle"
              >
                Stay on top of potential profit issues
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-4" data-testid="loading-skeleton">
            <Skeleton className="h-10 w-64" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-2 flex-wrap"
              data-testid="summary-bar"
            >
              <Badge variant="secondary" data-testid="badge-total-warnings">
                {totalWarnings} total warning{totalWarnings !== 1 ? "s" : ""}
              </Badge>
              {highSeverityCount > 0 && (
                <Badge variant="destructive" data-testid="badge-high-severity">
                  {highSeverityCount} high severity
                </Badge>
              )}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList data-testid="tabs-filter">
                <TabsTrigger value="all" data-testid="tab-all">
                  All
                </TabsTrigger>
                <TabsTrigger value="high" data-testid="tab-high">
                  High Severity
                </TabsTrigger>
                <TabsTrigger value="medium" data-testid="tab-medium">
                  Medium Severity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <WarningsList
                  warnings={filteredWarnings}
                  onViewJob={handleViewJob}
                />
              </TabsContent>
              <TabsContent value="high" className="mt-4">
                <WarningsList
                  warnings={filteredWarnings}
                  onViewJob={handleViewJob}
                />
              </TabsContent>
              <TabsContent value="medium" className="mt-4">
                <WarningsList
                  warnings={filteredWarnings}
                  onViewJob={handleViewJob}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
