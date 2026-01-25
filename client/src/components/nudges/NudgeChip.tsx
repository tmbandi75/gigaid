import { Sparkles, Flame, MessageSquare, FileText, Clock, DollarSign, AlertTriangle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiNudge } from "@shared/schema";

interface NudgeChipProps {
  nudge: AiNudge;
  onClick?: () => void;
}

const nudgeConfig: Record<string, { icon: typeof Sparkles; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  lead_follow_up: {
    icon: MessageSquare,
    label: "Don't lose this",
    variant: "default",
  },
  lead_convert_to_job: {
    icon: FileText,
    label: "Lock it in",
    variant: "secondary",
  },
  lead_silent_rescue: {
    icon: Clock,
    label: "Going cold",
    variant: "outline",
  },
  lead_hot_alert: {
    icon: Flame,
    label: "Act now",
    variant: "destructive",
  },
  lead_conversion_required: {
    icon: AlertCircle,
    label: "Protect this",
    variant: "destructive",
  },
  invoice_reminder: {
    icon: DollarSign,
    label: "Secure payment",
    variant: "default",
  },
  invoice_reminder_firm: {
    icon: DollarSign,
    label: "Money waiting",
    variant: "secondary",
  },
  invoice_overdue_escalation: {
    icon: AlertTriangle,
    label: "At risk",
    variant: "destructive",
  },
  invoice_create_from_job_done: {
    icon: FileText,
    label: "Get paid",
    variant: "secondary",
  },
  invoice_weekly_summary: {
    icon: DollarSign,
    label: "Weekly summary",
    variant: "outline",
  },
  job_stuck: {
    icon: AlertCircle,
    label: "Needs attention",
    variant: "secondary",
  },
  job_invoice_escalation: {
    icon: AlertTriangle,
    label: "Unpaid work",
    variant: "destructive",
  },
};

export function NudgeChip({ nudge, onClick }: NudgeChipProps) {
  const config = nudgeConfig[nudge.nudgeType] || {
    icon: Sparkles,
    label: "AI suggests",
    variant: "default" as const,
  };
  
  const Icon = config.icon;
  
  return (
    <Badge
      variant={config.variant}
      className="cursor-pointer gap-1 text-xs hover-elevate"
      onClick={onClick}
      data-testid={`nudge-chip-${nudge.nudgeType}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

interface NudgeChipsProps {
  nudges: AiNudge[];
  onNudgeClick?: (nudge: AiNudge) => void;
}

export function NudgeChips({ nudges, onNudgeClick }: NudgeChipsProps) {
  if (!nudges.length) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="nudge-chips-container">
      {nudges.slice(0, 2).map((nudge) => (
        <NudgeChip 
          key={nudge.id} 
          nudge={nudge} 
          onClick={() => onNudgeClick?.(nudge)}
        />
      ))}
    </div>
  );
}
