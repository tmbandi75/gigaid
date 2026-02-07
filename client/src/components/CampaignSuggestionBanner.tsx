import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Users, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface CampaignSuggestion {
  id: string;
  userId: string;
  serviceId: string;
  eventType: string;
  detectedSignal: string;
  suggestedMessage: string;
  estimatedEligibleClients: number;
  status: string;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  environmental: "Weather/Environmental",
  seasonal: "Seasonal",
  availability: "Availability",
  risk: "Safety/Risk",
  relationship: "Relationship",
};

export function CampaignSuggestionBanner() {
  const [, setLocation] = useLocation();
  
  const { data: suggestions, isLoading } = useQuery<CampaignSuggestion[]>({
    queryKey: QUERY_KEYS.campaignSuggestions(),
    refetchInterval: 60000,
  });
  
  const dismissMutation = useApiMutation(
    async (suggestionId: string) => {
      return apiFetch<unknown>(`/api/notification-campaigns/suggestions/${suggestionId}/dismiss`, {
        method: "POST",
      });
    },
    [QUERY_KEYS.campaignSuggestions()],
  );

  if (isLoading || !suggestions || suggestions.length === 0) {
    return null;
  }

  const suggestion = suggestions[0];

  return (
    <Card className="border-primary/20 bg-primary/5 mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">Event Detected</span>
              <Badge variant="secondary" className="text-xs">
                {EVENT_LABELS[suggestion.eventType] || suggestion.eventType}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {suggestion.detectedSignal}
            </p>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Users className="h-3.5 w-3.5" />
              <span>About {suggestion.estimatedEligibleClients} clients could be notified</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                size="sm"
                onClick={() => setLocation("/notify-clients")}
                data-testid="button-review-suggestion"
              >
                Review Draft
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismissMutation.mutate(suggestion.id)}
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
