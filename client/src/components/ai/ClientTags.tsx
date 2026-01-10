import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tags, Loader2, Sparkles, Lightbulb } from "lucide-react";

interface ClientTagsResult {
  tags: string[];
  insights: string;
}

interface ClientHistory {
  name: string;
  totalJobs: number;
  totalSpent: number;
  lastJobDate?: string;
  cancellations?: number;
  noShows?: number;
  averageRating?: number;
  paymentHistory?: "prompt" | "delayed" | "mixed";
  referrals?: number;
}

interface ClientTagsProps {
  clientHistory: ClientHistory;
  onTagsGenerated?: (tags: string[], insights: string) => void;
}

export function ClientTags({ clientHistory, onTagsGenerated }: ClientTagsProps) {
  const { toast } = useToast();
  const [result, setResult] = useState<ClientTagsResult | null>(null);

  const tagMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/tag-client", { clientHistory });
      return response as unknown as ClientTagsResult;
    },
    onSuccess: (data) => {
      setResult(data);
      onTagsGenerated?.(data.tags, data.insights);
      toast({ title: "Client tagged!" });
    },
    onError: () => {
      toast({ title: "Failed to tag client", variant: "destructive" });
    },
  });

  const tagColors: Record<string, string> = {
    "VIP": "bg-purple-500/10 text-purple-600 border-purple-500/20",
    "Repeat": "bg-blue-500/10 text-blue-600 border-blue-500/20",
    "New": "bg-green-500/10 text-green-600 border-green-500/20",
    "High Value": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    "Referrer": "bg-pink-500/10 text-pink-600 border-pink-500/20",
    "Prompt Payer": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "Delayed Payer": "bg-orange-500/10 text-orange-600 border-orange-500/20",
    "No-Show Risk": "bg-red-500/10 text-red-600 border-red-500/20",
    "Loyal": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    "At Risk": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  };

  const getTagColor = (tag: string) => {
    return tagColors[tag] || "bg-muted text-muted-foreground";
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tags className="h-4 w-4 text-primary" />
          Smart Client Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-2 rounded-lg bg-muted/50 text-sm space-y-1">
          <p className="font-medium">{clientHistory.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{clientHistory.totalJobs} jobs</span>
            <span>{formatCurrency(clientHistory.totalSpent)} spent</span>
            {clientHistory.averageRating && (
              <span>{clientHistory.averageRating.toFixed(1)} avg rating</span>
            )}
          </div>
        </div>

        {!result ? (
          <Button
            onClick={() => tagMutation.mutate()}
            disabled={tagMutation.isPending}
            className="w-full"
            data-testid="button-generate-tags"
          >
            {tagMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analyze Client
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {result.tags.map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={getTagColor(tag)}
                  data-testid={`client-tag-${idx}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5">
              <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">{result.insights}</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => tagMutation.mutate()}
              disabled={tagMutation.isPending}
              data-testid="button-refresh-tags"
            >
              {tagMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
