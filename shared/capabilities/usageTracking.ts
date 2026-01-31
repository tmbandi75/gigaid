import type { Plan, Capability } from './plans';
import { canPerform, getWindowDays } from './canPerform';

export interface UsageRecord {
  capability: Capability;
  usageCount: number;
  windowStart?: string;
  lastUsedAt?: string;
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit?: number;
  remaining?: number;
  limitReached?: boolean;
  upgradeRequired?: boolean;
}

export function checkUsage(
  plan: Plan,
  capability: Capability,
  currentUsage: number
): UsageCheckResult {
  const result = canPerform(plan, capability, currentUsage);
  
  return {
    allowed: result.allowed,
    reason: result.reason,
    current: currentUsage,
    limit: result.limit,
    remaining: result.remaining,
    limitReached: result.limitReached,
    upgradeRequired: result.upgradeRequired
  };
}

export function shouldResetWindow(
  plan: Plan,
  capability: Capability,
  windowStart?: string
): boolean {
  const windowDays = getWindowDays(plan, capability);
  if (!windowDays || !windowStart) return false;
  
  const startDate = new Date(windowStart);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysDiff >= windowDays;
}

export function getWindowStartDate(plan: Plan, capability: Capability): string {
  return new Date().toISOString();
}

export function getAllCapabilities(): Capability[] {
  return [
    'jobs.create',
    'invoices.send',
    'leads.manage',
    'clients.manage',
    'booking.link',
    'deposit.enforce',
    'booking.risk_protection',
    'price.confirmation',
    'ai.micro_nudges',
    'ai.money_plan',
    'ai.outcome_attribution',
    'ai.priority_signals',
    'ai.campaign_suggestions',
    'sms.two_way',
    'sms.auto_followups',
    'notifications.event_driven',
    'offline.capture',
    'offline.photos',
    'drive.mode',
    'analytics.basic',
    'analytics.advanced',
    'crew.manage',
    'admin.controls'
  ];
}

export const CAPABILITY_TO_TRACKER: Record<string, Capability> = {
  'job_created': 'jobs.create',
  'invoice_sent': 'invoices.send',
  'deposit_enforced': 'deposit.enforce',
  'price_confirmation_sent': 'price.confirmation',
  'sms_sent': 'sms.two_way',
  'followup_created': 'sms.auto_followups',
  'notification_sent': 'notifications.event_driven',
  'offline_photo_uploaded': 'offline.photos'
};
