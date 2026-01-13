import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { NudgeChips } from "./NudgeChip";
import { NudgeActionSheet } from "./NudgeActionSheet";
import { useLocation } from "wouter";
import type { AiNudge } from "@shared/schema";

interface NudgeCardProps {
  maxNudges?: number;
}

export function NudgeCard({ maxNudges = 3 }: NudgeCardProps) {
  const [, navigate] = useLocation();
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: nudges = [], isLoading } = useQuery<AiNudge[]>({
    queryKey: ["/api/ai/nudges"],
    staleTime: 1000 * 60 * 5,
  });

  const activeNudges = nudges.filter((n) => n.status === "active").slice(0, maxNudges);

  const handleNudgeClick = (nudge: AiNudge) => {
    setSelectedNudge(nudge);
    setSheetOpen(true);
  };

  const handleCreateJob = (prefill: any) => {
    const params = new URLSearchParams();
    if (prefill.clientName) params.set("clientName", prefill.clientName);
    if (prefill.clientPhone) params.set("clientPhone", prefill.clientPhone);
    if (prefill.clientEmail) params.set("clientEmail", prefill.clientEmail);
    if (prefill.serviceType) params.set("serviceType", prefill.serviceType);
    if (prefill.description) params.set("description", prefill.description);
    navigate(`/jobs/new?${params.toString()}`);
  };

  const handleCreateInvoice = (prefill: any) => {
    const params = new URLSearchParams();
    if (prefill.jobId) params.set("jobId", prefill.jobId);
    if (prefill.clientName) params.set("clientName", prefill.clientName);
    if (prefill.clientEmail) params.set("clientEmail", prefill.clientEmail);
    if (prefill.clientPhone) params.set("clientPhone", prefill.clientPhone);
    if (prefill.serviceDescription) params.set("serviceDescription", prefill.serviceDescription);
    if (prefill.amount) params.set("amount", String(prefill.amount));
    navigate(`/invoices/new?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm" data-testid="card-nudges-loading">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (activeNudges.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-violet-500/5" data-testid="card-nudges">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Suggestions</p>
                <p className="text-xs text-muted-foreground">
                  {activeNudges.length} action{activeNudges.length !== 1 ? "s" : ""} recommended
                </p>
              </div>
            </div>
            {nudges.length > maxNudges && (
              <Button variant="ghost" size="sm" className="text-xs" data-testid="button-view-all-nudges">
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
                data-testid={`nudge-item-${nudge.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{nudge.explainText}</p>
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
