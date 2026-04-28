import { safePriceCentsExact } from "./safePrice";

export enum Plan {
  FREE = "free",
  PRO = "pro",
  PRO_PLUS = "pro_plus",
  BUSINESS = "business"
}

export type Capability =
  | "unlimited_jobs"
  | "auto_followups"
  | "two_way_sms"
  | "invoicing"
  | "booking_risk_protection"
  | "deposit_enforcement"
  | "todays_money_plan"
  | "offline_assets"
  | "priority_alerts"
  | "crew_management"
  | "analytics"
  | "admin_controls"
  | "ai_campaign_suggestions";

export const PLAN_CAPABILITIES: Record<Plan, Capability[]> = {
  [Plan.FREE]: [
    "invoicing"
  ],

  [Plan.PRO]: [
    "unlimited_jobs",
    "auto_followups",
    "two_way_sms",
    "invoicing"
  ],

  [Plan.PRO_PLUS]: [
    "unlimited_jobs",
    "auto_followups",
    "two_way_sms",
    "invoicing",
    "booking_risk_protection",
    "deposit_enforcement",
    "todays_money_plan",
    "offline_assets",
    "priority_alerts",
    "ai_campaign_suggestions"
  ],

  [Plan.BUSINESS]: [
    "unlimited_jobs",
    "auto_followups",
    "two_way_sms",
    "invoicing",
    "booking_risk_protection",
    "deposit_enforcement",
    "todays_money_plan",
    "offline_assets",
    "priority_alerts",
    "crew_management",
    "analytics",
    "admin_controls",
    "ai_campaign_suggestions"
  ]
};

export const PLAN_NAMES: Record<Plan, string> = {
  [Plan.FREE]: "Free",
  [Plan.PRO]: "Pro",
  [Plan.PRO_PLUS]: "Pro+",
  [Plan.BUSINESS]: "Business"
};

export const PLAN_PRICES_CENTS: Record<Plan, number> = {
  [Plan.FREE]: 0,
  [Plan.PRO]: 1999,
  [Plan.PRO_PLUS]: 2999,
  [Plan.BUSINESS]: 4999,
};

export const PLAN_PRICES_DOLLARS: Record<Plan, number> = {
  [Plan.FREE]: 0,
  [Plan.PRO]: PLAN_PRICES_CENTS[Plan.PRO] / 100,
  [Plan.PRO_PLUS]: PLAN_PRICES_CENTS[Plan.PRO_PLUS] / 100,
  [Plan.BUSINESS]: PLAN_PRICES_CENTS[Plan.BUSINESS] / 100,
};

/**
 * Builds the user-facing confirmation message rendered when a customer
 * downgrades to another paid plan via `/api/subscription/change-plan`.
 * Uses `safePriceCentsExact` so plan prices with cents (e.g. $19.99)
 * are rendered with cents preserved instead of rounded to whole dollars.
 */
export function formatPlanSwitchedMessage(
  planName: string,
  planPriceCents: number,
): string {
  return `Switched to ${planName}. Your new rate of ${safePriceCentsExact(planPriceCents)}/mo starts next billing cycle.`;
}
