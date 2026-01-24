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
  | "admin_controls";

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
    "priority_alerts"
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
    "admin_controls"
  ]
};

export const PLAN_NAMES: Record<Plan, string> = {
  [Plan.FREE]: "Free",
  [Plan.PRO]: "Pro",
  [Plan.PRO_PLUS]: "Pro+",
  [Plan.BUSINESS]: "Business"
};
