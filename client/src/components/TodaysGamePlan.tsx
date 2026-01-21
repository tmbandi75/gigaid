import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  MessageSquare, 
  FileText, 
  DollarSign, 
  Clock, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Flame
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiNudge } from "@shared/schema";

const nudgeConfig: Record<string, { 
  icon: typeof Sparkles; 
  actionLabel: string; 
  getRoute: (nudge: AiNudge) => string;
  color: string;
  bg: string;
}> = {
  lead_follow_up: {
    icon: MessageSquare,
    actionLabel: "Follow Up",
    getRoute: (n) => `/leads/${n.entityId}`,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
  },
  lead_convert_to_job: {
    icon: FileText,
    actionLabel: "Create Job",
    getRoute: (n) => `/leads/${n.entityId}`,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
  },
  lead_silent_rescue: {
    icon: Clock,
    actionLabel: "Check In",
    getRoute: (n) => `/leads/${n.entityId}`,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
  },
  invoice_reminder: {
    icon: DollarSign,
    actionLabel: "Send Reminder",
    getRoute: (n) => `/invoices/${n.entityId}`,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
  },
  invoice_overdue_escalation: {
    icon: AlertTriangle,
    actionLabel: "Follow Up",
    getRoute: (n) => `/invoices/${n.entityId}`,
    color: "text-red-600",
    bg: "bg-red-500/10",
  },
  invoice_create_from_job_done: {
    icon: FileText,
    actionLabel: "Create Invoice",
    getRoute: (n) => `/jobs/${n.entityId}`,
    color: "text-teal-600",
    bg: "bg-teal-500/10",
  },
  invoice_reminder_firm: {
    icon: DollarSign,
    actionLabel: "Follow Up",
    getRoute: (n) => `/invoices/${n.entityId}`,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
  },
  lead_hot_alert: {
    icon: Flame,
    actionLabel: "Respond Now",
    getRoute: (n) => `/leads/${n.entityId}`,
    color: "text-red-600",
    bg: "bg-red-500/10",
  },
  job_stuck: {
    icon: AlertCircle,
    actionLabel: "Update Job",
    getRoute: (n) => `/jobs/${n.entityId}`,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
  },
};

function getActionText(nudge: AiNudge): string {
  const payload = nudge.actionPayload ? JSON.parse(nudge.actionPayload) : {};
  
  switch (nudge.nudgeType) {
    case "lead_follow_up":
      return `Follow up on ${payload.jobPrefill?.clientName || "lead"}`;
    case "lead_convert_to_job":
      return "Ready to book this job?";
    case "lead_silent_rescue":
      return "Customer went quiet — check in";
    case "lead_hot_alert":
      return nudge.explainText || "Hot lead! Respond quickly";
    case "invoice_reminder":
      return nudge.explainText || "Send payment reminder";
    case "invoice_reminder_firm":
      return nudge.explainText || "Follow up on payment";
    case "invoice_overdue_escalation":
      return "Invoice overdue — nudge needed";
    case "invoice_create_from_job_done":
      return nudge.explainText || "Invoice this completed job";
    case "job_stuck":
      return nudge.explainText || "Scheduled job needs update";
    default:
      return nudge.explainText || "Take action";
  }
}

interface GamePlanCardProps {
  nudge: AiNudge;
  onNavigate: () => void;
  onSnooze: () => void;
  isSnoozing: boolean;
}

function GamePlanCard({ nudge, onNavigate, onSnooze, isSnoozing }: GamePlanCardProps) {
  const config = nudgeConfig[nudge.nudgeType] || {
    icon: Sparkles,
    actionLabel: "View",
    getRoute: () => "/",
    color: "text-primary",
    bg: "bg-primary/10",
  };
  
  const Icon = config.icon;

  return (
    <Card className="border-0 shadow-sm overflow-hidden" data-testid={`gameplan-card-${nudge.id}`}>
      <CardContent className="p-0">
        <div className="flex">
          <div className={`w-1 ${config.bg.replace("/10", "")}`} />
          <div className="flex-1 p-3">
            <div className="flex items-start gap-3">
              <div className={`h-9 w-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm mb-1">
                  {getActionText(nudge)}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {nudge.explainText}
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={onNavigate}
                    data-testid={`button-gameplan-action-${nudge.id}`}
                  >
                    {config.actionLabel}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={onSnooze}
                    disabled={isSnoozing}
                    className="text-muted-foreground"
                    data-testid={`button-gameplan-snooze-${nudge.id}`}
                  >
                    {isSnoozing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        Later
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TodaysGamePlan() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [snoozingId, setSnoozingId] = useState<string | null>(null);

  const { data: nudges = [], isLoading } = useQuery<AiNudge[]>({
    queryKey: ["/api/ai/nudges", "daily"],
    queryFn: async () => {
      const res = await fetch("/api/ai/nudges?mode=daily");
      if (!res.ok) throw new Error("Failed to fetch daily nudges");
      return res.json();
    },
    staleTime: 30000,
  });

  const snoozeMutation = useMutation({
    mutationFn: async (nudgeId: string) => {
      setSnoozingId(nudgeId);
      await apiRequest("POST", `/api/ai/nudges/${nudgeId}/snooze`, { hours: 24 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/nudges"] });
      toast({ title: "Snoozed for today", description: "We'll remind you tomorrow" });
      setSnoozingId(null);
    },
    onError: () => {
      toast({ title: "Failed to snooze", variant: "destructive" });
      setSnoozingId(null);
    },
  });

  const handleNavigate = (nudge: AiNudge) => {
    const config = nudgeConfig[nudge.nudgeType];
    if (config) {
      navigate(config.getRoute(nudge));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Today's Game Plan</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (nudges.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Today's Game Plan</h2>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-6 text-center">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="font-medium text-foreground mb-1">Quiet day</p>
            <p className="text-sm text-muted-foreground">
              Great time to follow up or send invoices.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Deduplicate nudges - group by nudgeType and show count
  const groupedNudges = nudges.reduce((acc, nudge) => {
    const existing = acc.find(g => g.nudgeType === nudge.nudgeType);
    if (existing) {
      existing.nudges.push(nudge);
    } else {
      acc.push({ nudgeType: nudge.nudgeType, nudges: [nudge] });
    }
    return acc;
  }, [] as { nudgeType: string; nudges: AiNudge[] }[]);

  return (
    <div className="space-y-2" data-testid="todays-game-plan">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Today's Game Plan</h2>
      </div>
      
      {groupedNudges.map((group) => {
        const firstNudge = group.nudges[0];
        const count = group.nudges.length;
        
        if (count === 1) {
          return (
            <GamePlanCard
              key={firstNudge.id}
              nudge={firstNudge}
              onNavigate={() => handleNavigate(firstNudge)}
              onSnooze={() => snoozeMutation.mutate(firstNudge.id)}
              isSnoozing={snoozingId === firstNudge.id}
            />
          );
        }

        // Grouped card for multiple items of same type
        const config = nudgeConfig[group.nudgeType] || {
          icon: Sparkles,
          actionLabel: "View",
          getRoute: () => "/",
          color: "text-primary",
          bg: "bg-primary/10",
        };
        const Icon = config.icon;
        const groupLabel = getGroupedLabel(group.nudgeType, count);

        return (
          <Card key={group.nudgeType} className="border-0 shadow-sm overflow-hidden" data-testid={`gameplan-group-${group.nudgeType}`}>
            <CardContent className="p-0">
              <div className="flex">
                <div className={`w-1 ${config.bg.replace("/10", "")}`} />
                <div className="flex-1 p-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm mb-2">
                        {groupLabel}
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => handleNavigate(firstNudge)}
                        data-testid={`button-gameplan-group-${group.nudgeType}`}
                      >
                        {config.actionLabel}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getGroupedLabel(nudgeType: string, count: number): string {
  switch (nudgeType) {
    case "lead_follow_up":
      return `${count} leads need follow-up`;
    case "lead_convert_to_job":
      return `${count} leads ready to book`;
    case "lead_silent_rescue":
      return `${count} leads went quiet`;
    case "lead_hot_alert":
      return `${count} hot leads to respond to`;
    case "invoice_reminder":
      return `${count} invoices need reminders`;
    case "invoice_overdue_escalation":
      return `${count} invoices overdue`;
    case "invoice_create_from_job_done":
      return `${count} jobs need invoicing`;
    case "invoice_reminder_firm":
      return `${count} invoices need follow-up`;
    case "job_stuck":
      return `${count} jobs need status updates`;
    default:
      return `${count} actions needed`;
  }
}
