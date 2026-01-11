import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";

interface ServiceRecommendation {
  serviceId: string;
  serviceName: string;
  confidence: number;
  reason: string;
}

interface SmartServiceRecommenderProps {
  slug: string;
  onSelectService: (serviceId: string) => void;
}

export function SmartServiceRecommender({ slug, onSelectService }: SmartServiceRecommenderProps) {
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<ServiceRecommendation[]>([]);

  const recommendMutation = useMutation({
    mutationFn: async (userInput: string) => {
      const res = await apiRequest("POST", "/api/public/ai/recommend-service", { userInput, slug });
      return res.json() as Promise<{ recommendations: ServiceRecommendation[] }>;
    },
    onSuccess: (data) => {
      setRecommendations(data.recommendations || []);
    },
  });

  const handleSearch = () => {
    if (query.trim().length < 5) return;
    recommendMutation.mutate(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-3" data-testid="smart-service-recommender">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Not sure what to book? Describe your issue</span>
      </div>
      
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., My kitchen sink is leaking..."
          className="flex-1"
          data-testid="input-service-query"
        />
        <Button
          type="button"
          onClick={handleSearch}
          disabled={query.trim().length < 5 || recommendMutation.isPending}
          data-testid="button-find-service"
        >
          {recommendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Find"
          )}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((rec) => (
            <Card key={rec.serviceId} className="hover-elevate" data-testid={`recommendation-${rec.serviceId}`}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rec.serviceName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {rec.confidence}% match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onSelectService(rec.serviceId)}
                  data-testid={`button-book-${rec.serviceId}`}
                >
                  Book <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
