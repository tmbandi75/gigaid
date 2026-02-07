import type { NewCapability } from "@/hooks/useCapability";

export type UpgradeTriggerType =
  | "approaching_limit"
  | "hit_limit"
  | "post_success"
  | "stall_detected"
  | "feature_locked";

export type UpgradeVariant = "roi" | "time" | "social";

export type UpgradeThresholdLevel = "info" | "warn" | "critical";

export type UpgradeSurface =
  | "jobs"
  | "messages"
  | "booking"
  | "invoicing"
  | "leads"
  | "notifications"
  | "game_plan";

export interface UpgradePromptPayload {
  triggerType: UpgradeTriggerType;
  capabilityKey: NewCapability;
  variant: UpgradeVariant;
  surface: UpgradeSurface;
  plan: string;
  remaining: number | undefined;
  limit: number | undefined;
  current: number;
  percentUsed: number;
  thresholdLevel?: UpgradeThresholdLevel;
  stallType?: string;
  stallCount?: number;
  moneyAtRisk?: number;
  title: string;
  subtitle: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  recommendedPlan: "pro" | "pro_plus" | "business";
}

export interface CooldownState {
  lastShownAt: Record<string, number>;
  dailyPromptCount: number;
  dailyWindowStart: number;
  userVariant: UpgradeVariant | null;
}

export interface StallEvent {
  stallType: string;
  entityType: string;
  entityId: string;
  moneyAtRisk?: number;
  confidence?: number;
}

export interface StallSummary {
  stallType: string;
  count: number;
  totalMoneyAtRisk: number;
}
