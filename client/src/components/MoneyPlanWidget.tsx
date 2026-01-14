import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Users,
  Briefcase,
  FileText,
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

function getPriorityColor(priority: number): string {
  if (priority >= 90) return "text-destructive";
  if (priority >= 75) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function getPriorityBadge(priority: number) {
  if (priority >= 90) return { label: "Urgent", variant: "destructive" as const };
  if (priority >= 75) return { label: "Important", variant: "default" as const };
  return { label: "Normal", variant: "secondary" as const };
}

export function MoneyPlanWidget() {
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

  if (!flag?.enabled) {
    return null;
  }

  const openItems = items?.filter(i => i.status === "open") || [];
  const topItems = openItems.slice(0, 5); // Show up to 5 items on dashboard
  const totalCount = openItems.length;

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

  const handleDone = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markDoneMutation.mutate(id);
  };

  return (
    <Card className="border-0 shadow-sm" data-testid="card-money-plan">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <CardTitle className="text-base font-semibold">Today's Money Plan</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-refresh-money-plan"
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/money-plan">
            <Button variant="ghost" size="sm" className="h-8 px-2" data-testid="link-view-money-plan">
              <span className="text-primary">View All</span>
              <ChevronRight className="h-4 w-4 ml-1 text-primary" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : topItems.length === 0 ? (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">All caught up!</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-money-plan"
            >
              {generateMutation.isPending ? "Checking..." : "Check for actions"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {topItems.map((item) => {
              const Icon = getSourceIcon(item.sourceType);
              const priorityBadge = getPriorityBadge(item.priorityScore);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                  onClick={() => handleAction(item)}
                  data-testid={`action-item-${item.id}`}
                >
                  <div className={`h-10 w-10 rounded-lg bg-background flex items-center justify-center shrink-0 ${getPriorityColor(item.priorityScore)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                      <Badge variant={priorityBadge.variant} className="shrink-0 text-[10px]">
                        {priorityBadge.label}
                      </Badge>
                    </div>
                    {item.explainText && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {item.explainText}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => handleDone(e, item.id)}
                    disabled={markDoneMutation.isPending}
                    data-testid={`button-done-${item.id}`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </Button>
                </div>
              );
            })}
            {totalCount > 3 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{totalCount - 3} more actions
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
