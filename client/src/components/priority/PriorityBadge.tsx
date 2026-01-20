import { Flame, AlertTriangle, Clock, DollarSign } from "lucide-react";

export type PriorityLevel = "high" | "at_risk" | "time_sensitive" | "payment_risk" | null;

interface PriorityConfig {
  icon: typeof Flame;
  label: string;
  color: string;
  bg: string;
}

const priorityConfig: Record<Exclude<PriorityLevel, null>, PriorityConfig> = {
  high: {
    icon: Flame,
    label: "High Priority",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  at_risk: {
    icon: AlertTriangle,
    label: "At Risk",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/40",
  },
  time_sensitive: {
    icon: Clock,
    label: "Time Sensitive",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/40",
  },
  payment_risk: {
    icon: DollarSign,
    label: "Payment Risk",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/40",
  },
};

interface PriorityBadgeProps {
  priority: PriorityLevel;
  compact?: boolean;
}

export function PriorityBadge({ priority, compact = false }: PriorityBadgeProps) {
  if (!priority) return null;
  
  const config = priorityConfig[priority];
  const Icon = config.icon;
  
  if (compact) {
    return (
      <div 
        className={`inline-flex items-center justify-center h-5 w-5 rounded ${config.bg}`}
        title={config.label}
        data-testid={`priority-badge-${priority}`}
      >
        <Icon className={`h-3 w-3 ${config.color}`} />
      </div>
    );
  }
  
  return (
    <div 
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.color}`}
      data-testid={`priority-badge-${priority}`}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  );
}

// Priority inference utilities

interface LeadData {
  status: string;
  createdAt: string;
  score?: number | null;
  lastContactedAt?: string | null;
}

export function inferLeadPriority(lead: LeadData): PriorityLevel {
  const daysSinceCreated = getDaysSince(lead.createdAt);
  const daysSinceContact = lead.lastContactedAt ? getDaysSince(lead.lastContactedAt) : daysSinceCreated;
  
  // High priority: high score (>=80) or new leads with engagement
  if (lead.score && lead.score >= 80) {
    return "high";
  }
  
  // At risk: no response for 5+ days on active leads
  if (["new", "response_sent", "engaged"].includes(lead.status) && daysSinceContact >= 5) {
    return "at_risk";
  }
  
  // Time sensitive: new leads within 2 days (best to respond quickly)
  if (lead.status === "new" && daysSinceCreated <= 2) {
    return "time_sensitive";
  }
  
  return null;
}

interface JobData {
  status: string;
  date: string;
  time?: string | null;
}

export function inferJobPriority(job: JobData): PriorityLevel {
  const jobDate = new Date(job.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Time sensitive: job is today or tomorrow
  if (job.status === "scheduled") {
    if (jobDate <= tomorrow) {
      return "time_sensitive";
    }
  }
  
  // High priority: job in progress
  if (job.status === "in_progress") {
    return "high";
  }
  
  return null;
}

interface InvoiceData {
  status: string;
  createdAt: string;
  amount: number;
}

export function inferInvoicePriority(invoice: InvoiceData): PriorityLevel {
  const daysSinceCreated = getDaysSince(invoice.createdAt);
  
  // Payment risk: sent invoice overdue (7+ days unpaid)
  if (invoice.status === "sent" && daysSinceCreated >= 7) {
    return "payment_risk";
  }
  
  // High priority: recently sent, likely to get paid soon
  if (invoice.status === "sent" && daysSinceCreated <= 3) {
    return "high";
  }
  
  // At risk: draft sitting for too long
  if (invoice.status === "draft" && daysSinceCreated >= 3) {
    return "at_risk";
  }
  
  return null;
}

interface ConversationData {
  unreadCount: number;
  lastMessageAt: string;
}

export function inferMessagePriority(conversation: ConversationData): PriorityLevel {
  const daysSinceMessage = getDaysSince(conversation.lastMessageAt);
  
  // High priority: unread messages
  if (conversation.unreadCount > 0) {
    return "high";
  }
  
  // At risk: no reply in 2+ days
  if (daysSinceMessage >= 2) {
    return "at_risk";
  }
  
  return null;
}

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
