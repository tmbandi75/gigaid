import {
  DollarSign,
  Briefcase,
  MessageSquare,
  CheckCircle2,
  FileText,
  Send,
  Share2,
} from "lucide-react";
import type { NBAState } from "./nbaState";
import { formatCurrency } from "./formatCurrency";

export { formatCurrency } from "./formatCurrency";

export interface ActionItem {
  id: string;
  type: "invoice" | "job" | "lead" | "reminder";
  priority: number;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionRoute: string;
  urgency: "critical" | "high" | "normal";
  amount?: number;
}

export interface GamePlanStats {
  jobsToday: number;
  moneyCollectedToday: number;
  moneyWaiting: number;
  messagesToSend: number;
}

export type StickyCtaIcon = typeof DollarSign;

export interface StickyCtaInfo {
  label: string;
  route: string;
  icon: StickyCtaIcon;
}

export function getIconForType(type: string): StickyCtaIcon {
  switch (type) {
    case "invoice":
      return DollarSign;
    case "job":
      return Briefcase;
    case "lead":
      return MessageSquare;
    case "reminder":
      return MessageSquare;
    case "invoice_paid":
      return DollarSign;
    case "job_completed":
      return CheckCircle2;
    default:
      return FileText;
  }
}

export function getNBAStickyCta(state: NBAState): StickyCtaInfo | null {
  switch (state) {
    case "NEW_USER":
    case "NO_JOBS_YET":
      return { label: "Share Booking Link", route: "/profile", icon: Share2 };
    case "IN_PROGRESS":
      return { label: "View Jobs", route: "/jobs", icon: Briefcase };
    case "READY_TO_INVOICE":
      return { label: "Create Invoice", route: "/invoices/new", icon: Send };
    case "ACTIVE_USER":
      return null;
  }
}

export function getStickyCtaInfo(
  stats: GamePlanStats,
  priorityItem: ActionItem | null,
  nbaState: NBAState,
): StickyCtaInfo | null {
  if (stats.moneyWaiting > 0) {
    return {
      label: `Collect ${formatCurrency(stats.moneyWaiting)}`,
      route: "/invoices",
      icon: DollarSign,
    };
  }
  if (priorityItem?.type === "invoice") {
    return {
      label: priorityItem.actionLabel,
      route: priorityItem.actionRoute,
      icon: DollarSign,
    };
  }
  if (nbaState !== "ACTIVE_USER") {
    const nbaSticky = getNBAStickyCta(nbaState);
    if (nbaSticky) return nbaSticky;
  }
  if (priorityItem) {
    const Icon = getIconForType(priorityItem.type);
    return {
      label: priorityItem.actionLabel,
      route: priorityItem.actionRoute,
      icon: Icon,
    };
  }
  return null;
}
