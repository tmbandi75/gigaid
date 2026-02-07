import { useCanPerform, type NewCapability } from "@/hooks/useCapability";
import { trackEvent } from "@/components/PostHogProvider";
import { useRef } from "react";

export interface ApproachingLimitInfo {
  isApproaching: boolean;
  isAtLimit: boolean;
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
  const trackedRef = useRef(false);

  const noLimit: ApproachingLimitInfo = {
    isApproaching: false,
    isAtLimit: false,
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
  const isApproaching = percentage >= APPROACHING_THRESHOLD * 100 && allowed;
  const isAtLimit = !allowed && (remaining === 0 || percentage >= 100);

  let message: string | null = null;
  const label = CAPABILITY_LABELS[capability] || capability;

  if (isAtLimit) {
    message = `You've used all ${limit} ${label} on your plan. Upgrade for more.`;
  } else if (isApproaching && remaining !== undefined) {
    message = `${remaining} ${label} remaining on your plan.`;
  }

  if ((isApproaching || isAtLimit) && !trackedRef.current && !loading) {
    trackedRef.current = true;
    trackEvent('approaching_limit_shown', {
      capability,
      current,
      limit,
      remaining,
      percentage,
      at_limit: isAtLimit,
    });
  }

  return {
    isApproaching,
    isAtLimit,
    current,
    limit,
    remaining,
    percentage,
    message,
    loading,
  };
}
