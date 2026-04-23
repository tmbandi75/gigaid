import type { Plan, Capability } from './plans';

export interface CapabilityRule {
  unlimited?: boolean;
  limit?: number;
  mode?: 'active' | 'read_only' | 'suggest_only' | 'partial';
  window_days?: number;
  reply_only?: boolean;
}

export type PlanCapabilityRules = {
  [key in Capability]?: CapabilityRule;
} & {
  '*'?: CapabilityRule;
};

export const CAPABILITY_RULES: Record<Plan, PlanCapabilityRules> = {
  free: {
    'jobs.create': { limit: 10, window_days: 30 },
    'invoices.send': { unlimited: true },
    'leads.manage': { unlimited: true },
    'clients.manage': { unlimited: true },
    'booking.link': { unlimited: true },
    'deposit.enforce': { limit: 1 },
    'booking.risk_protection': { mode: 'read_only' },
    'price.confirmation': { limit: 3 },
    'ai.micro_nudges': { unlimited: true },
    'ai.money_plan': { mode: 'read_only' },
    'ai.outcome_attribution': { window_days: 7 },
    'ai.priority_signals': { unlimited: true },
    'ai.campaign_suggestions': { mode: 'read_only' },
    'sms.two_way': { limit: 20, reply_only: true },
    'sms.auto_followups': { limit: 1 },
    'sms.rate_limit_per_24h': { limit: 3 },
    'notifications.event_driven': { mode: 'suggest_only' },
    'offline.capture': { unlimited: true },
    'offline.photos': { limit: 3 },
    'drive.mode': { unlimited: true },
    'analytics.basic': { window_days: 7 },
    'analytics.advanced': { mode: 'read_only' },
    'crew.manage': { mode: 'read_only' },
    'admin.controls': { mode: 'read_only' }
  },

  pro: {
    'jobs.create': { unlimited: true },
    'deposit.enforce': { mode: 'partial' },
    'booking.risk_protection': { mode: 'partial' },
    'price.confirmation': { unlimited: true },
    'ai.money_plan': { mode: 'active' },
    'ai.outcome_attribution': { window_days: 30 },
    'sms.two_way': { unlimited: true },
    'sms.auto_followups': { unlimited: true },
    'sms.rate_limit_per_24h': { limit: 50 },
    'notifications.event_driven': { limit: 10 },
    'offline.photos': { limit: 10 },
    'analytics.basic': { unlimited: true }
  },

  pro_plus: {
    'deposit.enforce': { unlimited: true },
    'booking.risk_protection': { unlimited: true },
    'ai.outcome_attribution': { unlimited: true },
    'ai.campaign_suggestions': { unlimited: true },
    'notifications.event_driven': { unlimited: true },
    'offline.photos': { unlimited: true },
    'analytics.advanced': { mode: 'active' },
    'sms.two_way': { limit: 300 },
    'sms.rate_limit_per_24h': { limit: 200 }
  },

  business: {
    '*': { unlimited: true },
    'crew.manage': { unlimited: true },
    'admin.controls': { unlimited: true },
    'analytics.advanced': { unlimited: true },
    'sms.two_way': { limit: 1500 },
    'sms.rate_limit_per_24h': { unlimited: true }
  }
};

export const CAPABILITY_DISPLAY_NAMES: Record<Capability, string> = {
  'jobs.create': 'Job Creation',
  'invoices.send': 'Invoice Sending',
  'leads.manage': 'Lead Management',
  'clients.manage': 'Client Management',
  'booking.link': 'Booking Link',
  'deposit.enforce': 'Deposit Protection',
  'booking.risk_protection': 'Booking Risk Protection',
  'price.confirmation': 'Price Confirmation',
  'ai.micro_nudges': 'AI Nudges',
  'ai.money_plan': "Today's Money Plan",
  'ai.outcome_attribution': 'Outcome Attribution',
  'ai.priority_signals': 'Priority Signals',
  'ai.campaign_suggestions': 'AI Campaign Suggestions',
  'sms.two_way': 'Two-Way SMS',
  'sms.auto_followups': 'Auto Follow-ups',
  'sms.rate_limit_per_24h': 'SMS Send Cap (24h)',
  'notifications.event_driven': 'Event-Driven Notifications',
  'offline.capture': 'Offline Capture',
  'offline.photos': 'Offline Photos',
  'drive.mode': 'Drive Mode',
  'analytics.basic': 'Basic Analytics',
  'analytics.advanced': 'Advanced Analytics',
  'crew.manage': 'Crew Management',
  'admin.controls': 'Admin Controls'
};
