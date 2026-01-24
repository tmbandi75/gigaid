import { Plan } from "./plans";

export interface PlanLimits {
  maxJobs: number;
  outboundSms: boolean;
  autoFollowups: boolean;
  offlinePhotos: boolean;
  analytics: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.FREE]: {
    maxJobs: 10,
    outboundSms: false,
    autoFollowups: false,
    offlinePhotos: false,
    analytics: false
  },

  [Plan.PRO]: {
    maxJobs: Infinity,
    outboundSms: true,
    autoFollowups: true,
    offlinePhotos: false,
    analytics: true
  },

  [Plan.PRO_PLUS]: {
    maxJobs: Infinity,
    outboundSms: true,
    autoFollowups: true,
    offlinePhotos: true,
    analytics: true
  },

  [Plan.BUSINESS]: {
    maxJobs: Infinity,
    outboundSms: true,
    autoFollowups: true,
    offlinePhotos: true,
    analytics: true
  }
};

export function canCreateJob({
  plan,
  currentJobCount
}: {
  plan: Plan;
  currentJobCount: number;
}): boolean {
  const limit = PLAN_LIMITS[plan]?.maxJobs ?? 10;
  return currentJobCount < limit;
}

export function canSendSms(plan: Plan): boolean {
  return PLAN_LIMITS[plan]?.outboundSms ?? false;
}

export function canUseAutoFollowups(plan: Plan): boolean {
  return PLAN_LIMITS[plan]?.autoFollowups ?? false;
}

export function canUseOfflinePhotos(plan: Plan): boolean {
  return PLAN_LIMITS[plan]?.offlinePhotos ?? false;
}

export function canUseAnalytics(plan: Plan): boolean {
  return PLAN_LIMITS[plan]?.analytics ?? false;
}

export function getPlanLimit(plan: Plan, feature: keyof PlanLimits): boolean | number {
  return PLAN_LIMITS[plan]?.[feature] ?? PLAN_LIMITS[Plan.FREE][feature];
}
