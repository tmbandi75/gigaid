import { useCanPerform, type NewCapability } from "@/hooks/useCapability";
import { trackEvent } from "@/components/PostHogProvider";
import { useRef } from "react";

export type ApproachingLimitTier = "warning" | "limit";

export interface ApproachingLimitInfo {
  isApproaching: boolean;
  isAtLimit: boolean;
  tier: ApproachingLimitTier | null;
  current: number;
  limit: number | undefined;
  remaining: number | undefined;
  percentage: number;
  message: string | null;
  loading: boolean;
}

const APPROACHING_THRESHOLD = 0.8;

const CAPABILITY_LABELS: Partial<Record<NewCapability, string>> = {
  'jobs.create': 'jobs',
  'invoices.send': 'invoices',
  'sms.two_way': 'messages',
  'sms.auto_followups': 'auto follow-ups',
  'deposit.enforce': 'deposit enforcements',
  'price.confirmation': 'price confirmations',
  'notifications.event_driven': 'notifications',
  'offline.photos': 'offline photos',
};

export function useApproachingLimit(capability: NewCapability): ApproachingLimitInfo {
  const { current, limit, remaining, unlimited, loading, allowed } = useCanPerform(capability);
  const trackedRef = useRef<ApproachingLimitTier | null>(null);

  const noLimit: ApproachingLimitInfo = {
    isApproaching: false,
    isAtLimit: false,
    tier: null,
    current: 0,
    limit: undefined,
    remaining: undefined,
    percentage: 0,
    message: null,
    loading,
  };

  if (loading || unlimited || limit === undefined || limit === 0) {
    return noLimit;
  }

  const percentage = Math.round((current / limit) * 100);
  const isAtLimit = !allowed && (remaining === 0 || percentage >= 100);
  const isApproaching = !isAtLimit && percentage >= APPROACHING_THRESHOLD * 100;
  const tier: ApproachingLimitTier | null = isAtLimit
    ? "limit"
    : isApproaching
      ? "warning"
      : null;

  let message: string | null = null;
  const label = CAPABILITY_LABELS[capability] || capability;

  if (isAtLimit) {
    message = `You've used all ${limit} ${label} on your plan this month. Upgrade to keep going.`;
  } else if (isApproaching && remaining !== undefined) {
    message = `Heads up — only ${remaining} of ${limit} ${label} left on your plan this month.`;
  }

  if (tier && trackedRef.current !== tier && !loading) {
    trackedRef.current = tier;
    trackEvent('approaching_limit_shown', {
      capability,
      current,
      limit,
      remaining,
      percentage,
      at_limit: isAtLimit,
      tier,
    });
  }

  return {
    isApproaching,
    isAtLimit,
    tier,
    current,
    limit,
    remaining,
    percentage,
    message,
    loading,
  };
}
