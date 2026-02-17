import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight, Loader2, Bot } from "lucide-react";
import { NudgeChips } from "./NudgeChip";
import { NudgeActionSheet } from "./NudgeActionSheet";
import { QUERY_KEYS } from "@/lib/queryKeys";
import type { AiNudge } from "@shared/schema";

interface AIAssistantHeroProps {
  onHasNudges?: (hasNudges: boolean) => void;
}

export function AIAssistantHero({ onHasNudges }: AIAssistantHeroProps) {
  const [, navigate] = useLocation();
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: nudges = [], isLoading } = useQuery<AiNudge[]>({
    queryKey: QUERY_KEYS.nudges(),
    staleTime: 1000 * 60 * 5,
  });

  const activeNudges = nudges.filter((n) => n.status === "active").slice(0, 2);
  const totalActive = nudges.filter((n) => n.status === "active").length;

  const hasNudges = activeNudges.length > 0;
  const prevHasNudges = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevHasNudges.current !== hasNudges) {
      prevHasNudges.current = hasNudges;
      onHasNudges?.(hasNudges);
    }
  }, [hasNudges, onHasNudges]);

  const handleNudgeClick = (nudge: AiNudge) => {
    setSelectedNudge(nudge);
    setSheetOpen(true);
  };

  const handleCreateJob = (prefill: Record<string, string>) => {
    const params = new URLSearchParams();
    if (prefill.clientName) params.set("clientName", prefill.clientName);
    if (prefill.clientPhone) params.set("clientPhone", prefill.clientPhone);
    if (prefill.clientEmail) params.set("clientEmail", prefill.clientEmail);
    if (prefill.serviceType) params.set("serviceType", prefill.serviceType);
    if (prefill.description) params.set("description", prefill.description);
    navigate(`/jobs/new?${params.toString()}`);
  };

  const handleCreateInvoice = (prefill: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (prefill.jobId) params.set("jobId", String(prefill.jobId));
    if (prefill.clientName) params.set("clientName", String(prefill.clientName));
    if (prefill.clientEmail) params.set("clientEmail", String(prefill.clientEmail));
    if (prefill.clientPhone) params.set("clientPhone", String(prefill.clientPhone));
    if (prefill.serviceDescription) params.set("serviceDescription", String(prefill.serviceDescription));
    if (prefill.amount) params.set("amount", String(prefill.amount));
    navigate(`/invoices/new?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm" data-testid="card-ai-hero-loading">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasNudges) return null;

  return (
    <>
      <Card
        className="border-0 shadow-sm bg-gradient-to-br from-primary/5 via-violet-500/5 to-primary/5"
        data-testid="card-ai-assistant-hero"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" data-testid="text-ai-hero-title">Your Business Assistant</p>
                <p className="text-xs text-muted-foreground" data-testid="text-ai-hero-subtitle">
                  I'm watching your jobs and payments.
                </p>
              </div>
            </div>
            {totalActive > 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => navigate("/ai-tools")}
                data-testid="button-ai-hero-view-all"
              >
                View all
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {activeNudges.map((nudge) => (
              <div
                key={nudge.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background hover-elevate cursor-pointer"
                onClick={() => handleNudgeClick(nudge)}
                data-testid={`ai-hero-nudge-${nudge.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <p className="text-sm font-medium truncate">{nudge.explainText}</p>
                  </div>
                  <NudgeChips nudges={[nudge]} onNudgeClick={handleNudgeClick} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <NudgeActionSheet
        nudge={selectedNudge}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setSelectedNudge(null);
        }}
        onCreateJob={handleCreateJob}
        onCreateInvoice={handleCreateInvoice}
      />
    </>
  );
}
