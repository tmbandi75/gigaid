export type Plan = 'free' | 'pro' | 'pro_plus' | 'business';

export type Capability =
  | 'jobs.create'
  | 'invoices.send'
  | 'leads.manage'
  | 'clients.manage'
  | 'booking.link'
  | 'deposit.enforce'
  | 'booking.risk_protection'
  | 'price.confirmation'
  | 'ai.micro_nudges'
  | 'ai.money_plan'
  | 'ai.outcome_attribution'
  | 'ai.priority_signals'
  | 'ai.campaign_suggestions'
  | 'sms.two_way'
  | 'sms.auto_followups'
  | 'notifications.event_driven'
  | 'offline.capture'
  | 'offline.photos'
  | 'drive.mode'
  | 'analytics.basic'
  | 'analytics.advanced'
  | 'crew.manage'
  | 'admin.controls';

export const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_plus: 'Pro+',
  business: 'Business'
};

export const PLAN_ORDER: Plan[] = ['free', 'pro', 'pro_plus', 'business'];

export function getPlanLevel(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

export function isHigherPlan(plan: Plan, than: Plan): boolean {
  return getPlanLevel(plan) > getPlanLevel(than);
}
