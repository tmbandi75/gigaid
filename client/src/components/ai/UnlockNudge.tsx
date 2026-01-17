import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2, X, ChevronRight } from "lucide-react";

interface FeatureNudge {
  message: string;
  callToAction: string;
  featureName: string;
  priority: "high" | "medium" | "low";
}

interface UnlockNudgeProps {
  completedFeatures?: string[];
  incompleteFeatures?: string[];
  onAction?: (featureName: string) => void;
}

export function UnlockNudge({
  completedFeatures = [],
  incompleteFeatures = ["profile", "services", "availability"],
  onAction,
}: UnlockNudgeProps) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [nudge, setNudge] = useState<FeatureNudge | null>(null);

  const nudgeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/feature-nudge", {
        completedFeatures,
        incompleteFeatures,
      });
      return response.json() as Promise<FeatureNudge>;
    },
    onSuccess: (data) => {
      setNudge(data);
    },
    onError: () => {
      toast({ title: "Failed to get suggestion", variant: "destructive" });
    },
  });

  const priorityColors = {
    high: "border-primary bg-primary/5",
    medium: "border-yellow-500/50 bg-yellow-500/5",
    low: "border-muted",
  };

  if (dismissed) return null;

  if (!nudge) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => nudgeMutation.mutate()}
        disabled={nudgeMutation.isPending}
        className="w-full justify-start text-muted-foreground"
        data-testid="button-get-nudge"
      >
        {nudgeMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Get personalized tip
      </Button>
    );
  }

  return (
    <Card className={`relative ${priorityColors[nudge.priority]}`}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6"
        onClick={() => setDismissed(true)}
        data-testid="button-dismiss-nudge"
      >
        <X className="h-3 w-3" />
      </Button>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm">{nudge.message}</p>
            <Button
              size="sm"
              onClick={() => onAction?.(nudge.featureName)}
              data-testid="button-nudge-action"
            >
              {nudge.callToAction}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
