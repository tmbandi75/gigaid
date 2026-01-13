import { Sparkles, Flame, MessageSquare, FileText, Clock, DollarSign, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiNudge } from "@shared/schema";

interface NudgeChipProps {
  nudge: AiNudge;
  onClick?: () => void;
}

const nudgeConfig: Record<string, { icon: typeof Sparkles; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  lead_follow_up: {
    icon: MessageSquare,
    label: "Follow up",
    variant: "default",
  },
  lead_convert_to_job: {
    icon: FileText,
    label: "Create job",
    variant: "secondary",
  },
  lead_silent_rescue: {
    icon: Clock,
    label: "Check in",
    variant: "outline",
  },
  lead_hot_alert: {
    icon: Flame,
    label: "Hot lead",
    variant: "destructive",
  },
  invoice_reminder: {
    icon: DollarSign,
    label: "Send reminder",
    variant: "default",
  },
  invoice_reminder_firm: {
    icon: DollarSign,
    label: "Follow up",
    variant: "secondary",
  },
  invoice_overdue_escalation: {
    icon: AlertTriangle,
    label: "Overdue",
    variant: "destructive",
  },
  invoice_create_from_job_done: {
    icon: FileText,
    label: "Create invoice",
    variant: "secondary",
  },
  invoice_weekly_summary: {
    icon: DollarSign,
    label: "Weekly summary",
    variant: "outline",
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
