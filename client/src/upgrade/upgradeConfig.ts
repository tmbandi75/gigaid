import type { NewCapability } from "@/hooks/useCapability";
import type { UpgradeTriggerType } from "./upgradeTypes";

export const THRESHOLDS = {
  approaching_limit_info: 0.60,
  approaching_limit_warn: 0.80,
  approaching_limit_critical: 0.95,
  post_success_min: 0.70,
} as const;

export const COOLDOWNS = {
  perTriggerMs: 24 * 60 * 60 * 1000,
  globalMaxPerDay: 2,
} as const;

export interface MonetizableMoment {
  offer: string;
  recommendedPlan: "pro" | "pro_plus" | "business";
}

export const MONETIZABLE_MOMENTS: Partial<Record<NewCapability, MonetizableMoment>> = {
  "jobs.create": {
    offer: "Unlimited jobs + automation",
    recommendedPlan: "pro",
  },
  "sms.two_way": {
    offer: "Unlimited texts + auto follow-up",
    recommendedPlan: "pro",
  },
  "sms.auto_followups": {
    offer: "Automated follow-ups that close deals",
    recommendedPlan: "pro",
  },
  "deposit.enforce": {
    offer: "Secure bookings with deposits",
    recommendedPlan: "pro_plus",
  },
  "invoices.send": {
    offer: "Get paid faster with auto reminders",
    recommendedPlan: "pro",
  },
  "price.confirmation": {
    offer: "Unlimited price confirmations",
    recommendedPlan: "pro",
  },
  "notifications.event_driven": {
    offer: "Reach more clients with smart notifications",
    recommendedPlan: "pro_plus",
  },
  "booking.risk_protection": {
    offer: "Protect every booking from no-shows",
    recommendedPlan: "pro_plus",
  },
  "analytics.advanced": {
    offer: "Deep business analytics & export",
    recommendedPlan: "business",
  },
  "offline.photos": {
    offer: "Unlimited offline photo capture",
    recommendedPlan: "pro",
  },
  "crew.manage": {
    offer: "Manage your whole crew",
    recommendedPlan: "business",
  },
};

export const STALL_THRESHOLDS: Record<string, number> = {
  manual_followup_repeat: 3,
  missed_deposit: 2,
  unpaid_invoice: 2,
  message_thread_overflow: 5,
};

export const TRIGGER_COOLDOWN_KEYS: Record<UpgradeTriggerType, string> = {
  approaching_limit: "al",
  hit_limit: "hl",
  post_success: "ps",
  stall_detected: "sd",
  feature_locked: "fl",
};
