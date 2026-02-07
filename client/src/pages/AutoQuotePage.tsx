import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  DollarSign,
  Clock,
  TrendingUp,
  Copy,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface QuoteEstimate {
  low: number;
  high: number;
  median: number;
  source: "historical" | "ai";
  rationale: string;
  averageDuration?: number;
  sampleSize?: number;
}

const jobTypes = [
  { value: "handyman", label: "Handyman" },
  { value: "cleaning", label: "Cleaning" },
  { value: "lawn", label: "Lawn" },
  { value: "moving", label: "Moving" },
  { value: "tutoring", label: "Tutoring" },
  { value: "other", label: "Other" },
];

export default function AutoQuotePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [jobType, setJobType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const estimateMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<QuoteEstimate>("/api/quote-estimate", {
        method: "POST",
        body: JSON.stringify({ jobType, location, description }),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    estimateMutation.mutate();
  };

  const handleUsePrice = async () => {
    if (!estimateMutation.data) return;
    const dollars = (estimateMutation.data.median / 100).toFixed(2);
    try {
      await navigator.clipboard.writeText(dollars);
      toast({ title: `$${dollars} copied to clipboard` });
    } catch {
      toast({ title: `Suggested price: $${dollars}` });
    }
  };

  const handleCreateJob = () => {
    const params = new URLSearchParams();
    if (jobType) params.set("serviceType", jobType);
    if (description) params.set("description", description);
    if (estimateMutation.data) {
      params.set("price", String(estimateMutation.data.median));
    }
    navigate(`/jobs/new?${params.toString()}`);
  };

  const result = estimateMutation.data;

  const renderMobileHeader = () => (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background px-4 pt-6 pb-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-8 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Smart Pricing</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">Get AI-powered price suggestions based on your history</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Smart Pricing</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">Get AI-powered price suggestions based on your history</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}

      <div className={isMobile ? "px-4 pb-24 space-y-6" : "max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8"}>
        <Card>
          <CardContent className="pt-6 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type</Label>
                <Select value={jobType} onValueChange={setJobType}>
                  <SelectTrigger data-testid="select-job-type" id="jobType">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value} data-testid={`option-job-type-${t.value}`}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Austin, TX"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the job..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  data-testid="input-description"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!jobType || estimateMutation.isPending}
                data-testid="button-get-estimate"
              >
                {estimateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get Estimate
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card data-testid="card-estimate-result">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Price Estimate
                </h2>
                <Badge
                  variant={result.source === "historical" ? "secondary" : "default"}
                  data-testid="badge-estimate-source"
                >
                  {result.source === "historical" ? "Based on your history" : "AI Estimate"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Price Range</p>
                  <p className="text-xl font-bold" data-testid="text-price-range">
                    ${(result.low / 100).toFixed(0)} - ${(result.high / 100).toFixed(0)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Suggested Price</p>
                  <p className="text-2xl font-bold text-primary" data-testid="text-suggested-price">
                    <DollarSign className="h-5 w-5 inline -mt-1" />
                    {(result.median / 100).toFixed(0)}
                  </p>
                </div>
                {result.averageDuration && (
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Duration</p>
                    <p className="text-xl font-bold flex items-center justify-center gap-1" data-testid="text-avg-duration">
                      <Clock className="h-4 w-4" />
                      {result.averageDuration} min
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground" data-testid="text-rationale">{result.rationale}</p>
                {result.source === "historical" && result.sampleSize && (
                  <p className="text-xs text-muted-foreground mt-2" data-testid="text-sample-size">
                    Based on {result.sampleSize} similar job{result.sampleSize !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleUsePrice}
                  data-testid="button-use-price"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Use This Price
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateJob}
                  data-testid="button-create-job"
                >
                  Create Job
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
