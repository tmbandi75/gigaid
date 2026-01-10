import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { DollarSign, Loader2, Sparkles } from "lucide-react";

interface PriceEstimate {
  estimateRange: string;
  breakdown?: string;
}

interface PriceEstimatorProps {
  slug: string;
}

export function PriceEstimator({ slug }: PriceEstimatorProps) {
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);

  const estimateMutation = useMutation({
    mutationFn: async (desc: string) => {
      const res = await apiRequest("POST", "/api/public/ai/estimate-price", { 
        description: desc, 
        slug 
      });
      return res.json() as Promise<PriceEstimate>;
    },
    onSuccess: (data) => {
      setEstimate(data);
    },
  });

  const handleEstimate = () => {
    if (description.trim().length < 10) return;
    estimateMutation.mutate(description);
  };

  return (
    <Card data-testid="price-estimator">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Get a Price Estimate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Describe your job for an AI-powered estimate</span>
        </div>
        
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Fix a leaking kitchen faucet, replace the aerator, and check under-sink pipes for damage..."
          rows={3}
          data-testid="input-price-description"
        />

        <Button
          onClick={handleEstimate}
          disabled={description.trim().length < 10 || estimateMutation.isPending}
          className="w-full"
          variant="outline"
          data-testid="button-get-estimate"
        >
          {estimateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <DollarSign className="h-4 w-4 mr-2" />
          )}
          Get Estimate
        </Button>

        {estimate && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20" data-testid="price-estimate-result">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold text-primary">{estimate.estimateRange}</span>
            </div>
            {estimate.breakdown && (
              <p className="text-sm text-muted-foreground">{estimate.breakdown}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              This is an AI-generated estimate. Final price may vary based on actual job requirements.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
