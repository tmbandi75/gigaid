import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef } from "react";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { trackEvent } from "@/components/PostHogProvider";
import { useCanPerform } from "@/hooks/useCapability";

interface StallDetection {
  id: string;
  entityType: string;
  entityId: string;
  stallType: string;
  moneyAtRisk: number;
  confidence: number;
  detectedAt: string;
}

interface StallUpgradePrompt {
  title: string;
  description: string;
  moneyAtRisk: number;
  stallCount: number;
}

const STALL_MESSAGES: Record<string, { title: string; description: (money: number) => string }> = {
  no_response: {
    title: 'Leads going cold',
    description: (money) => `You have ${money > 0 ? `$${(money / 100).toFixed(0)} at risk from` : ''} leads without responses. Auto follow-ups on Pro keep the conversation alive.`,
  },
  overdue: {
    title: 'Overdue invoices piling up',
    description: (money) => `${money > 0 ? `$${(money / 100).toFixed(0)} in` : 'You have'} overdue invoices. Pro sends automatic payment reminders so you don't have to chase.`,
  },
  idle: {
    title: 'Jobs sitting idle',
    description: () => 'Some jobs haven\'t been updated recently. Pro\'s smart notifications help you stay on top of your schedule.',
  },
  draft_aging: {
    title: 'Drafts waiting to be sent',
    description: () => 'You have unsent invoices. Upgrade to streamline your billing with auto-reminders.',
  },
  viewed_unpaid: {
    title: 'Clients viewed but haven\'t paid',
    description: (money) => `${money > 0 ? `$${(money / 100).toFixed(0)} in` : ''} invoices were viewed but unpaid. Pro sends gentle follow-ups automatically.`,
  },
};

export function useStallUpgrade() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState<StallUpgradePrompt | null>(null);
  const trackedRef = useRef(false);
  const autoFollowup = useCanPerform('sms.auto_followups');

  const { data: stalls } = useQuery<StallDetection[]>({
    queryKey: QUERY_KEYS.stallDetections(),
    staleTime: 300000,
    enabled: !autoFollowup.unlimited,
  });

  useEffect(() => {
    if (!stalls || stalls.length === 0 || autoFollowup.unlimited || trackedRef.current) return;

    const stallsByType: Record<string, { count: number; money: number }> = {};
    for (const stall of stalls) {
      if (!stallsByType[stall.stallType]) {
        stallsByType[stall.stallType] = { count: 0, money: 0 };
      }
      stallsByType[stall.stallType].count++;
      stallsByType[stall.stallType].money += stall.moneyAtRisk || 0;
    }

    let topType = '';
    let topCount = 0;
    let topMoney = 0;
    for (const [type, data] of Object.entries(stallsByType)) {
      if (data.count > topCount || (data.count === topCount && data.money > topMoney)) {
        topType = type;
        topCount = data.count;
        topMoney = data.money;
      }
    }

    if (topCount >= 3 && topType) {
      const messages = STALL_MESSAGES[topType] || STALL_MESSAGES.idle;
      setPrompt({
        title: messages.title,
        description: messages.description(topMoney),
        moneyAtRisk: topMoney,
        stallCount: topCount,
      });

      trackedRef.current = true;
      trackEvent('stall_upgrade_prompt', {
        stall_type: topType,
        stall_count: topCount,
        money_at_risk: topMoney,
        total_stalls: stalls.length,
      });
    }
  }, [stalls, autoFollowup.unlimited]);

  const showStallPrompt = useCallback(() => {
    if (prompt) {
      setShowPrompt(true);
    }
  }, [prompt]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  return {
    hasStallPrompt: !!prompt,
    showPrompt,
    prompt,
    showStallPrompt,
    dismissPrompt,
  };
}
