import type { Plan, Capability } from './plans';
import { PLAN_ORDER } from './plans';
import { CAPABILITY_RULES, type CapabilityRule, CAPABILITY_DISPLAY_NAMES } from './capabilityRules';

export interface CanPerformResult {
  allowed: boolean;
  reason?: string;
  limitReached?: boolean;
  upgradeRequired?: boolean;
  mode?: 'active' | 'read_only' | 'suggest_only' | 'partial';
  limit?: number;
  remaining?: number;
  windowDays?: number;
}

function resolveRulesForPlan(plan: Plan, capability: Capability): CapabilityRule | undefined {
  const planIndex = PLAN_ORDER.indexOf(plan);
  
  for (let i = planIndex; i >= 0; i--) {
    const currentPlan = PLAN_ORDER[i];
    const planRules = CAPABILITY_RULES[currentPlan];
    
    if (planRules['*']?.unlimited) {
      return { unlimited: true };
    }
    
    if (planRules[capability]) {
      return planRules[capability];
    }
  }
  
  return undefined;
}

function getMergedRulesForPlan(plan: Plan, capability: Capability): CapabilityRule {
  const planIndex = PLAN_ORDER.indexOf(plan);
  let mergedRule: CapabilityRule = {};
  
  for (let i = 0; i <= planIndex; i++) {
    const currentPlan = PLAN_ORDER[i];
    const planRules = CAPABILITY_RULES[currentPlan];
    
    if (planRules['*']?.unlimited) {
      return { unlimited: true };
    }
    
    if (planRules[capability]) {
      mergedRule = { ...mergedRule, ...planRules[capability] };
    }
  }
  
  return mergedRule;
}

const BUSINESS_ONLY_CAPABILITIES: Capability[] = ['crew.manage', 'admin.controls'];

export function canPerform(
  plan: Plan,
  capability: Capability,
  usage: number = 0
): CanPerformResult {
  if (BUSINESS_ONLY_CAPABILITIES.includes(capability)) {
    if (plan !== 'business') {
      return {
        allowed: false,
        reason: 'Available on Business plan only.',
        upgradeRequired: true
      };
    }
  }

  const rules = getMergedRulesForPlan(plan, capability);

  if (!rules || Object.keys(rules).length === 0) {
    return {
      allowed: false,
      reason: 'Upgrade required.',
      upgradeRequired: true
    };
  }

  if (rules.unlimited) {
    return { allowed: true };
  }

  if (rules.mode === 'read_only') {
    return {
      allowed: false,
      reason: 'Upgrade to take action.',
      mode: 'read_only',
      upgradeRequired: true
    };
  }

  if (rules.mode === 'suggest_only') {
    return {
      allowed: false,
      reason: 'Available for preview only. Upgrade to send.',
      mode: 'suggest_only',
      upgradeRequired: true
    };
  }

  if (rules.limit !== undefined) {
    if (usage >= rules.limit) {
      const displayName = CAPABILITY_DISPLAY_NAMES[capability] || capability;
      return {
        allowed: false,
        reason: `You've reached the limit for ${displayName} on your plan.`,
        limitReached: true,
        limit: rules.limit,
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      limit: rules.limit,
      remaining: rules.limit - usage,
      mode: rules.mode
    };
  }

  return {
    allowed: true,
    mode: rules.mode,
    windowDays: rules.window_days
  };
}

export function getCapabilityRules(plan: Plan, capability: Capability): CapabilityRule {
  return getMergedRulesForPlan(plan, capability);
}

export function isReadOnly(plan: Plan, capability: Capability): boolean {
  const rules = getMergedRulesForPlan(plan, capability);
  return rules.mode === 'read_only';
}

export function isSuggestOnly(plan: Plan, capability: Capability): boolean {
  const rules = getMergedRulesForPlan(plan, capability);
  return rules.mode === 'suggest_only';
}

export function getLimit(plan: Plan, capability: Capability): number | undefined {
  const rules = getMergedRulesForPlan(plan, capability);
  return rules.unlimited ? undefined : rules.limit;
}

export function getWindowDays(plan: Plan, capability: Capability): number | undefined {
  const rules = getMergedRulesForPlan(plan, capability);
  return rules.window_days;
}

export function isUnlimited(plan: Plan, capability: Capability): boolean {
  const rules = getMergedRulesForPlan(plan, capability);
  return rules.unlimited === true;
}

export function getRemainingUsage(plan: Plan, capability: Capability, currentUsage: number): number | null {
  const rules = getMergedRulesForPlan(plan, capability);
  if (rules.unlimited) return null;
  if (rules.limit === undefined) return null;
  return Math.max(0, rules.limit - currentUsage);
}
