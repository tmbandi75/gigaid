import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  ChevronLeft,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  Users,
  Briefcase,
  FileText,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { ActionQueueItem } from "@shared/schema";

interface FeatureFlag {
  key: string;
  enabled: boolean;
}

function getSourceIcon(sourceType: string) {
  switch (sourceType) {
    case "lead":
      return Users;
    case "job":
      return Briefcase;
    case "invoice":
      return FileText;
    default:
      return DollarSign;
  }
}

function getSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "lead":
      return "Lead";
    case "job":
      return "Job";
    case "invoice":
      return "Invoice";
    default:
      return "Action";
  }
}

function getPriorityColor(priority: number): string {
  if (priority >= 90) return "bg-destructive/10 border-destructive/20";
  if (priority >= 75) return "bg-amber-500/10 border-amber-500/20";
  return "bg-muted/50 border-muted";
}

function getPriorityBadge(priority: number) {
  if (priority >= 90) return { label: "Urgent", variant: "destructive" as const };
  if (priority >= 75) return { label: "Important", variant: "default" as const };
  return { label: "Normal", variant: "secondary" as const };
}

export default function MoneyPlanPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: flag } = useQuery<FeatureFlag>({
    queryKey: ["/api/feature-flags", "today_money_plan"],
  });

  const { data: items, isLoading, refetch } = useQuery<ActionQueueItem[]>({
    queryKey: ["/api/action-queue"],
    enabled: flag?.enabled === true,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/action-queue/generate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-queue"] });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/action-queue/${id}/done`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-queue"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/action-queue/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-queue"] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ id, hours }: { id: string; hours: number }) => {
      return apiRequest("POST", `/api/action-queue/${id}/snooze`, { hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-queue"] });
    },
  });

  const openItems = items?.filter(i => i.status === "open") || [];
  const doneItems = items?.filter(i => i.status === "done") || [];

  const handleAction = (item: ActionQueueItem) => {
    try {
      const action = JSON.parse(item.ctaPrimaryAction);
      if (action.route) {
        navigate(action.route);
      }
    } catch {
      console.error("Failed to parse action");
    }
  };

  if (!flag?.enabled) {
    return (
      <div className="flex flex-col min-h-full bg-background p-4" data-testid="page-money-plan-disabled">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Today's Money Plan</h1>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Feature Not Enabled</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Today's Money Plan helps you prioritize actions across leads, jobs, and invoices.
              Enable the "today_money_plan" feature flag to use this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-money-plan">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Today's Money Plan
              </h1>
              <p className="text-xs text-muted-foreground">
                {openItems.length} actions to grow your revenue
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : openItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Quiet day</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Great time to follow up or send invoices.
            </p>
            <Button
              variant="outline"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-check-actions"
            >
              Check for new actions
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {openItems.map((item, index) => {
              const Icon = getSourceIcon(item.sourceType);
              const priorityBadge = getPriorityBadge(item.priorityScore);
              return (
                <Card
                  key={item.id}
                  className={`border ${getPriorityColor(item.priorityScore)} overflow-hidden`}
                  data-testid={`action-card-${item.id}`}
                >
                  <CardContent className="p-0">
                    <div
                      className="flex items-start gap-3 p-4 cursor-pointer hover-elevate"
                      onClick={() => handleAction(item)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                          {index + 1}
                        </span>
                        <div className="h-12 w-12 rounded-xl bg-background border flex items-center justify-center">
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{item.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={priorityBadge.variant}>
                              {priorityBadge.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {getSourceLabel(item.sourceType)}
                            </Badge>
                          </div>
                        </div>
                        {item.explainText && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {item.explainText}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => snoozeMutation.mutate({ id: item.id, hours: 4 })}
                        disabled={snoozeMutation.isPending}
                        data-testid={`button-snooze-${item.id}`}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Later
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => dismissMutation.mutate(item.id)}
                          disabled={dismissMutation.isPending}
                          data-testid={`button-dismiss-${item.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Skip
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => markDoneMutation.mutate(item.id)}
                          disabled={markDoneMutation.isPending}
                          data-testid={`button-done-${item.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Done
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {doneItems.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Completed Today ({doneItems.length})
            </h2>
            <div className="space-y-2">
              {doneItems.slice(0, 5).map((item) => {
                const Icon = getSourceIcon(item.sourceType);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-60"
                    data-testid={`done-item-${item.id}`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-through truncate">{item.title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {getSourceLabel(item.sourceType)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
