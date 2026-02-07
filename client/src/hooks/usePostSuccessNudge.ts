import { useState, useCallback } from "react";
import { useCanPerform, type NewCapability } from "@/hooks/useCapability";
import { trackEvent } from "@/components/PostHogProvider";

export interface PostSuccessNudgeState {
  showNudge: boolean;
  title: string;
  description: string;
  current: number;
  limit: number | undefined;
  remaining: number | undefined;
  onDismiss: () => void;
  triggerNudge: () => void;
}

const NUDGE_THRESHOLD = 0.7;

const NUDGE_MESSAGES: Partial<Record<NewCapability, { title: string; description: string }>> = {
  'jobs.create': {
    title: 'Nice work scheduling that job',
    description: 'You\'re getting close to your job limit. Upgrade to Pro for unlimited jobs and auto follow-ups.',
  },
  'invoices.send': {
    title: 'Invoice sent',
    description: 'As your business grows, Pro unlocks auto payment reminders and advanced analytics.',
  },
  'sms.two_way': {
    title: 'Message sent',
    description: 'Running low on messages this month. Upgrade to keep the conversation going with clients.',
  },
  'price.confirmation': {
    title: 'Price confirmation sent',
    description: 'Upgrade to Pro for unlimited price confirmations and deposit enforcement.',
  },
  'deposit.enforce': {
    title: 'Deposit collected',
    description: 'Protect more bookings with unlimited deposit enforcement on Pro+.',
  },
  'notifications.event_driven': {
    title: 'Notification sent',
    description: 'Upgrade to send more event-driven notifications and reach more clients.',
  },
};

export function usePostSuccessNudge(capability: NewCapability): PostSuccessNudgeState {
  const [showNudge, setShowNudge] = useState(false);
  const { current, limit, remaining, unlimited, loading } = useCanPerform(capability);

  const messages = NUDGE_MESSAGES[capability] || {
    title: 'Action completed',
    description: 'Upgrade your plan to unlock more features and higher limits.',
  };

  const triggerNudge = useCallback(() => {
    if (loading || unlimited || limit === undefined || limit === 0) return;

    const percentage = (current / limit) * 100;
    if (percentage >= NUDGE_THRESHOLD * 100) {
      setShowNudge(true);
      trackEvent('post_success_nudge', {
        capability,
        current,
        limit,
        remaining,
        percentage: Math.round(percentage),
      });
    }
  }, [loading, unlimited, limit, current, capability, remaining]);

  const onDismiss = useCallback(() => {
    setShowNudge(false);
  }, []);

  return {
    showNudge,
    title: messages.title,
    description: messages.description,
    current,
    limit,
    remaining,
    onDismiss,
    triggerNudge,
  };
}
