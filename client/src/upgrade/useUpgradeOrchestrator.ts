import { useState, useCallback, useRef, useEffect } from "react";
import { useCanPerform, useCapabilities, type NewCapability } from "@/hooks/useCapability";
import { trackEvent } from "@/components/PostHogProvider";
import { THRESHOLDS, MONETIZABLE_MOMENTS } from "./upgradeConfig";
import { canShowPrompt, markPromptShown, getOrAssignVariant } from "./upgradeState";
import { getCopy } from "./upgradeCopy";
import type {
  UpgradeTriggerType,
  UpgradeVariant,
  UpgradeThresholdLevel,
  UpgradeSurface,
  UpgradePromptPayload,
} from "./upgradeTypes";
import type { SubscriptionPlan } from "@/lib/stripeCheckout";

interface OrchestratorInput {
  capabilityKey: NewCapability;
  surface: UpgradeSurface;
  userId?: string;
}

interface OrchestratorState {
  bannerPayload: UpgradePromptPayload | null;
  modalPayload: UpgradePromptPayload | null;
  showModal: boolean;
  variant: UpgradeVariant;
  dismissModal: () => void;
  maybeShowApproachingLimit: () => void;
  maybeShowPostSuccess: () => void;
  maybeShowStallPrompt: (stallType: string, count: number, moneyAtRisk?: number) => void;
  showFeatureLocked: (reason?: string) => void;
}

function getThresholdLevel(percent: number): UpgradeThresholdLevel | null {
  if (percent >= THRESHOLDS.approaching_limit_critical * 100) return "critical";
  if (percent >= THRESHOLDS.approaching_limit_warn * 100) return "warn";
  if (percent >= THRESHOLDS.approaching_limit_info * 100) return "info";
  return null;
}

function getRecommendedPlan(capabilityKey: NewCapability): SubscriptionPlan {
  const moment = MONETIZABLE_MOMENTS[capabilityKey];
  return moment?.recommendedPlan || "pro";
}

export function useUpgradeOrchestrator({
  capabilityKey,
  surface,
  userId = "default",
}: OrchestratorInput): OrchestratorState {
  const { current, limit, remaining, unlimited, loading, mode } = useCanPerform(capabilityKey);
  const { data: capData } = useCapabilities();
  const plan = capData?.plan || "free";
  const variant = getOrAssignVariant(userId);
  const recommendedPlan = getRecommendedPlan(capabilityKey);

  const [bannerPayload, setBannerPayload] = useState<UpgradePromptPayload | null>(null);
  const [modalPayload, setModalPayload] = useState<UpgradePromptPayload | null>(null);
  const [showModal, setShowModal] = useState(false);
  const bannerTrackedRef = useRef(false);

  const percentUsed = limit && limit > 0 ? Math.round((current / limit) * 100) : 0;

  const buildPayload = useCallback(
    (triggerType: UpgradeTriggerType, overrides?: Partial<UpgradePromptPayload>): UpgradePromptPayload => {
      const copy = getCopy(capabilityKey, variant, triggerType);
      return {
        triggerType,
        capabilityKey,
        variant,
        surface,
        plan,
        remaining,
        limit,
        current,
        percentUsed,
        recommendedPlan,
        title: copy.title,
        subtitle: copy.subtitle,
        bullets: copy.bullets,
        primaryCta: copy.primaryCta,
        secondaryCta: copy.secondaryCta,
        ...overrides,
      };
    },
    [capabilityKey, variant, surface, plan, remaining, limit, current, percentUsed, recommendedPlan]
  );

  useEffect(() => {
    if (loading || unlimited || limit === undefined || limit === 0 || bannerTrackedRef.current) return;

    const thresholdLevel = getThresholdLevel(percentUsed);
    if (!thresholdLevel) {
      setBannerPayload(null);
      return;
    }

    if (thresholdLevel === "critical") {
      if (canShowPrompt(userId, "approaching_limit", capabilityKey)) {
        const payload = buildPayload("approaching_limit", { thresholdLevel });
        setModalPayload(payload);
        setShowModal(true);
        markPromptShown(userId, "approaching_limit", capabilityKey);
        bannerTrackedRef.current = true;
        trackEvent("upgrade_prompt_shown", {
          triggerType: "approaching_limit",
          capabilityKey,
          variant,
          surface,
          plan,
          remaining,
          limit,
          percentUsed,
          thresholdLevel,
          recommendedPlan,
        });
      }
    } else {
      const payload = buildPayload("approaching_limit", { thresholdLevel });
      setBannerPayload(payload);
      if (!bannerTrackedRef.current) {
        bannerTrackedRef.current = true;
        trackEvent("upgrade_prompt_shown", {
          triggerType: "approaching_limit",
          capabilityKey,
          variant,
          surface,
          plan,
          remaining,
          limit,
          percentUsed,
          thresholdLevel,
          recommendedPlan,
        });
      }
    }
  }, [loading, unlimited, limit, percentUsed, userId, capabilityKey, variant, surface, plan, remaining, buildPayload, recommendedPlan]);

  const maybeShowApproachingLimit = useCallback(() => {
    if (loading || unlimited || limit === undefined || limit === 0) return;
    const thresholdLevel = getThresholdLevel(percentUsed);
    if (!thresholdLevel) return;

    if (thresholdLevel === "critical" && canShowPrompt(userId, "approaching_limit", capabilityKey)) {
      const payload = buildPayload("approaching_limit", { thresholdLevel });
      setModalPayload(payload);
      setShowModal(true);
      markPromptShown(userId, "approaching_limit", capabilityKey);
      trackEvent("upgrade_prompt_shown", {
        triggerType: "approaching_limit",
        capabilityKey,
        variant,
        surface,
        plan,
        remaining,
        limit,
        percentUsed,
        thresholdLevel,
        recommendedPlan,
      });
    } else if (thresholdLevel !== "critical") {
      setBannerPayload(buildPayload("approaching_limit", { thresholdLevel }));
    }
  }, [loading, unlimited, limit, percentUsed, userId, capabilityKey, variant, surface, plan, remaining, buildPayload, recommendedPlan]);

  const maybeShowPostSuccess = useCallback(() => {
    if (loading || unlimited || limit === undefined || limit === 0) return;
    if (percentUsed < THRESHOLDS.post_success_min * 100) return;
    if (mode === "read_only" || mode === "suggest_only") return;
    if (!canShowPrompt(userId, "post_success", capabilityKey)) return;

    const payload = buildPayload("post_success");
    setModalPayload(payload);
    setShowModal(true);
    markPromptShown(userId, "post_success", capabilityKey);
    trackEvent("upgrade_prompt_shown", {
      triggerType: "post_success",
      capabilityKey,
      variant,
      surface,
      plan,
      remaining,
      limit,
      percentUsed,
      recommendedPlan,
    });
  }, [loading, unlimited, limit, percentUsed, mode, userId, capabilityKey, variant, surface, plan, remaining, buildPayload, recommendedPlan]);

  const maybeShowStallPrompt = useCallback(
    (stallType: string, count: number, moneyAtRisk?: number) => {
      if (!canShowPrompt(userId, "stall_detected", capabilityKey)) return;

      const copy = getCopy(capabilityKey, variant, "stall_detected");
      const stallTitle = moneyAtRisk && moneyAtRisk > 0
        ? `$${(moneyAtRisk / 100).toFixed(0)} at risk`
        : copy.title;

      const payload = buildPayload("stall_detected", {
        stallType,
        stallCount: count,
        moneyAtRisk,
        title: stallTitle,
      });
      setModalPayload(payload);
      setShowModal(true);
      markPromptShown(userId, "stall_detected", capabilityKey);
      trackEvent("upgrade_prompt_shown", {
        triggerType: "stall_detected",
        capabilityKey,
        variant,
        surface,
        plan,
        stallType,
        stallCount: count,
        moneyAtRisk,
        recommendedPlan,
      });
    },
    [userId, capabilityKey, variant, buildPayload, surface, plan, recommendedPlan]
  );

  const showFeatureLocked = useCallback(
    (reason?: string) => {
      if (!canShowPrompt(userId, "feature_locked", capabilityKey)) return;

      const payload = buildPayload("feature_locked", {
        title: reason || getCopy(capabilityKey, variant, "feature_locked").title,
      });
      setModalPayload(payload);
      setShowModal(true);
      markPromptShown(userId, "feature_locked", capabilityKey);
      trackEvent("upgrade_prompt_shown", {
        triggerType: "feature_locked",
        capabilityKey,
        variant,
        surface,
        plan,
        remaining,
        limit,
        percentUsed,
        recommendedPlan,
        reason,
      });
    },
    [userId, capabilityKey, variant, buildPayload, surface, plan, remaining, limit, percentUsed, recommendedPlan]
  );

  const dismissModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    bannerPayload,
    modalPayload,
    showModal,
    variant,
    dismissModal,
    maybeShowApproachingLimit,
    maybeShowPostSuccess,
    maybeShowStallPrompt,
    showFeatureLocked,
  };
}
