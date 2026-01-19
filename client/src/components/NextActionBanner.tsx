import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, X, Zap } from "lucide-react";

interface NextAction {
  id: string;
  userId: string;
  entityType: "lead" | "job" | "invoice";
  entityId: string;
  stallType: string;
  action: string;
  reason: string;
  priority: number;
  status: "active" | "acted" | "dismissed" | "expired" | "auto_executed";
  autoExecutable: boolean;
  createdAt: string;
  expiresAt: string;
  actedAt: string | null;
  autoExecutedAt: string | null;
}

interface NextActionBannerProps {
  entityType: "lead" | "job" | "invoice";
  entityId: string;
  onActionClick?: () => void;
}

export function NextActionBanner({ entityType, entityId, onActionClick }: NextActionBannerProps) {
  const queryClient = useQueryClient();

  const { data: action } = useQuery<NextAction | null>({
    queryKey: ["/api/next-actions/entity", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/next-actions/entity/${entityType}/${entityId}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60000,
  });

  const actMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/next-actions/${id}/act`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/next-actions/entity", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/next-actions"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/next-actions/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/next-actions/entity", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/next-actions"] });
    },
  });

  if (!action) {
    return null;
  }

  const handleAct = () => {
    actMutation.mutate(action.id);
    onActionClick?.();
  };

  return (
    <Card 
      className="border-0 shadow-md bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent"
      data-testid="next-action-banner"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                Suggestion
              </span>
              {action.autoExecutable && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Auto-send eligible
                </span>
              )}
            </div>
            <p className="font-medium text-foreground text-sm">
              {action.action}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {action.reason}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleAct}
                disabled={actMutation.isPending}
                data-testid="button-act-suggestion"
              >
                Do It Now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismissMutation.mutate(action.id)}
                disabled={dismissMutation.isPending}
                data-testid="button-dismiss-suggestion"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
