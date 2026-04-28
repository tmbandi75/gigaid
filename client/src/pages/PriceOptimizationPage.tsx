import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { queryClient } from "@/lib/queryClient";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  DollarSign,
  Percent,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { isFinitePositiveNumber } from "@/lib/safePrice";

interface PriceInsight {
  serviceType: string;
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  winRate: number;
  cancelRate: number;
  avgPrice: number;
  hourlyRate: number;
  suggestedChange: number;
  suggestion: string;
}

interface PriceOptimizationResponse {
  insights: PriceInsight[];
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

function capitalize(s: string): string {
  return s
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function PriceOptimizationPage() {
  const { toast } = useToast();
  const [appliedServices, setAppliedServices] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<PriceOptimizationResponse>({
    queryKey: QUERY_KEYS.priceOptimization(),
  });

  const insights = data?.insights || [];

  const applyMutation = useMutation({
    mutationFn: (insight: PriceInsight) =>
      apiFetch("/api/price-adjustments", {
        method: "POST",
        body: JSON.stringify({
          serviceType: insight.serviceType,
          changePercent: insight.suggestedChange,
          previousPriceCents: insight.avgPrice,
          newPriceCents: Math.round(insight.avgPrice * (1 + insight.suggestedChange / 100)),
        }),
      }),
    onSuccess: (_data, insight) => {
      setAppliedServices((prev) => new Set(prev).add(insight.serviceType));
      toast({
        title: "Price adjustment applied",
        description: `Price adjustment applied for ${capitalize(insight.serviceType)}!`,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.priceOptimization() });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply price adjustment",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-price-optimization">
      <div className="border-b bg-background sticky top-0 z-[999]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-page-title">
                Price Optimization
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
                See how your pricing performs and get suggestions
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-4" data-testid="loading-skeleton">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-16" data-testid="empty-state">
            <div className="h-16 w-16 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Pricing Insights Yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Complete more jobs to get pricing insights
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => {
              const isApplied = appliedServices.has(insight.serviceType);
              const isPending = applyMutation.isPending && applyMutation.variables?.serviceType === insight.serviceType;

              return (
                <Card key={insight.serviceType} data-testid={`card-insight-${insight.serviceType}`}>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold" data-testid={`text-service-type-${insight.serviceType}`}>
                        {capitalize(insight.serviceType)}
                      </h2>
                      <Badge variant="secondary" data-testid={`badge-total-jobs-${insight.serviceType}`}>
                        {insight.totalJobs} jobs
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="rounded-lg bg-muted/40 p-3" data-testid={`stat-total-jobs-${insight.serviceType}`}>
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <BarChart3 className="h-3.5 w-3.5" />
                          <span className="text-xs">Total Jobs</span>
                        </div>
                        <p className="text-lg font-semibold">{insight.totalJobs}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3" data-testid={`stat-win-rate-${insight.serviceType}`}>
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Percent className="h-3.5 w-3.5" />
                          <span className="text-xs">Win Rate</span>
                        </div>
                        <p className="text-lg font-semibold">{insight.winRate}%</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3" data-testid={`stat-cancel-rate-${insight.serviceType}`}>
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Percent className="h-3.5 w-3.5" />
                          <span className="text-xs">Cancel Rate</span>
                        </div>
                        <p className="text-lg font-semibold">{insight.cancelRate}%</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3" data-testid={`stat-avg-price-${insight.serviceType}`}>
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="text-xs">Avg Price</span>
                        </div>
                        <p className="text-lg font-semibold">
                          {isFinitePositiveNumber(insight.avgPrice) ? formatPrice(insight.avgPrice) : "--"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 col-span-2 sm:col-span-1" data-testid={`stat-hourly-rate-${insight.serviceType}`}>
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="text-xs">Hourly Rate</span>
                        </div>
                        <p className="text-lg font-semibold">
                          {isFinitePositiveNumber(insight.hourlyRate) ? `${formatPrice(insight.hourlyRate)}/hr` : "--"}
                        </p>
                      </div>
                    </div>

                    {insight.suggestedChange !== 0 ? (
                      <div
                        className={`rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                          insight.suggestedChange > 0
                            ? "bg-emerald-500/10 border border-emerald-500/20"
                            : "bg-destructive/10 border border-destructive/20"
                        }`}
                        data-testid={`suggestion-card-${insight.serviceType}`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {insight.suggestedChange > 0 ? (
                            <ArrowUpRight className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm" data-testid={`text-suggestion-${insight.serviceType}`}>
                            {insight.suggestion}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isApplied ? "outline" : insight.suggestedChange > 0 ? "default" : "outline"}
                          className="shrink-0"
                          disabled={isApplied || isPending}
                          onClick={() => applyMutation.mutate(insight)}
                          data-testid={`button-apply-suggestion-${insight.serviceType}`}
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : isApplied ? (
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                          ) : insight.suggestedChange > 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1.5" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1.5" />
                          )}
                          {isApplied
                            ? "Applied"
                            : `Apply ${Math.abs(insight.suggestedChange)}% ${insight.suggestedChange > 0 ? "Increase" : "Decrease"}`}
                        </Button>
                      </div>
                    ) : (
                      <p
                        className="text-sm text-muted-foreground"
                        data-testid={`text-no-suggestion-${insight.serviceType}`}
                      >
                        No changes suggested
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
