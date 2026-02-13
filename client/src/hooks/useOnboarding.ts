import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/use-auth";
import { serviceCategories } from "@shared/service-categories";
import confetti from "canvas-confetti";

export interface IdentityData {
  firstName: string;
  lastName: string;
  businessName: string;
  serviceType: string;
}

export interface PricingData {
  serviceName: string;
  typicalPrice: string;
  priceMin: string;
  priceMax: string;
  duration: string;
  pricingType: "fixed" | "range" | "varies";
}

export interface DepositData {
  enabled: boolean;
  percentage: number;
}

export interface OnboardingStatus {
  completed: boolean;
  step: number;
  state: string;
  moneyProtectionReady: boolean;
  defaultServiceType: string | null;
  defaultPrice: number | null;
  depositPolicySet: boolean;
  aiExpectationShown: boolean;
}

export const TOTAL_STEPS = 8;

export function useOnboarding(onComplete: () => void, initialStep?: number) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(initialStep || 1);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const [identity, setIdentity] = useState<IdentityData>({
    firstName: "",
    lastName: "",
    businessName: "",
    serviceType: "",
  });

  const [pricing, setPricing] = useState<PricingData>({
    serviceName: "",
    typicalPrice: "",
    priceMin: "",
    priceMax: "",
    duration: "60",
    pricingType: "fixed",
  });

  const [deposit, setDeposit] = useState<DepositData>({
    enabled: true,
    percentage: 30,
  });

  const { user, isAuthenticated } = useAuth();

  const { data: onboardingStatus } = useQuery<OnboardingStatus>({
    queryKey: QUERY_KEYS.onboarding(),
  });

  useEffect(() => {
    if (initialStep && onboardingStatus) {
      setStep(initialStep);
      if (onboardingStatus.defaultServiceType) {
        setIdentity(prev => ({ ...prev, serviceType: onboardingStatus.defaultServiceType || "" }));
      }
      if (onboardingStatus.defaultPrice) {
        setPricing(prev => ({ ...prev, typicalPrice: (onboardingStatus.defaultPrice! / 100).toString() }));
      }
      setInitialized(true);
    }
  }, [initialStep, onboardingStatus]);

  useEffect(() => {
    if (!initialized && !initialStep && onboardingStatus && user) {
      setInitialized(true);
      if (onboardingStatus.completed || onboardingStatus.state === "completed" || onboardingStatus.state === "skipped_explore") {
        onComplete();
        navigate("/");
        return;
      }
      if (onboardingStatus.state === "in_progress" && onboardingStatus.step > 1) {
        setStep(onboardingStatus.step);
      }
      if (onboardingStatus.defaultServiceType) {
        setIdentity(prev => ({ ...prev, serviceType: onboardingStatus.defaultServiceType || "" }));
      }
      if (onboardingStatus.defaultPrice) {
        setPricing(prev => ({ ...prev, typicalPrice: (onboardingStatus.defaultPrice! / 100).toString() }));
      }
    }
  }, [initialized, onboardingStatus, user, onComplete, navigate, initialStep]);

  useEffect(() => {
    if (user) {
      setIdentity(prev => ({
        ...prev,
        firstName: (user as any).firstName || (user as any).name?.split(" ")[0] || "",
        lastName: (user as any).lastName || "",
        businessName: (user as any).businessName || "",
      }));
    }
  }, [user]);

  const updateOnboardingMutation = useApiMutation(
    (data: { step?: number; state?: string; completed?: boolean }) =>
      apiFetch("/api/onboarding", { method: "PATCH", body: JSON.stringify(data) }),
    [QUERY_KEYS.onboarding()]
  );

  const updateProfileMutation = useApiMutation(
    (data: Record<string, any>) =>
      apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify(data) }),
    [QUERY_KEYS.authUser()]
  );

  const handleSkipClick = () => {
    setShowSkipModal(true);
  };

  const handleConfirmSkip = async () => {
    await updateOnboardingMutation.mutateAsync({
      state: "skipped_explore",
      completed: true,
    });
    setShowSkipModal(false);
    onComplete();
    navigate("/");
  };

  const handleContinueSetup = () => {
    setShowSkipModal(false);
    setStep(2);
  };

  const handleStartSetup = () => {
    updateOnboardingMutation.mutate({ state: "in_progress", step: 2 });
    setStep(2);
  };

  const handleIdentitySubmit = async () => {
    if (!identity.firstName.trim() || !identity.serviceType) {
      toast({ title: "Please fill in required fields" });
      return;
    }

    await updateProfileMutation.mutateAsync({
      firstName: identity.firstName,
      lastName: identity.lastName || null,
      businessName: identity.businessName || null,
      defaultServiceType: identity.serviceType,
    });

    const category = serviceCategories.find(c => c.id === identity.serviceType);
    if (category) {
      setPricing(prev => ({
        ...prev,
        serviceName: category.services[0] || category.name,
      }));
    }

    updateOnboardingMutation.mutate({ step: 3 });
    setStep(3);
  };

  const handlePricingSubmit = async () => {
    if (pricing.pricingType === "fixed" && !pricing.typicalPrice) {
      toast({ title: "Please enter your typical price" });
      return;
    }
    if (pricing.pricingType === "range" && (!pricing.priceMin || !pricing.priceMax)) {
      toast({ title: "Please enter both minimum and maximum prices" });
      return;
    }

    let priceInCents = 0;
    let priceMinCents: number | null = null;
    let priceMaxCents: number | null = null;

    if (pricing.pricingType === "fixed") {
      priceInCents = Math.round(parseFloat(pricing.typicalPrice) * 100);
    } else if (pricing.pricingType === "range") {
      priceMinCents = Math.round(parseFloat(pricing.priceMin) * 100);
      priceMaxCents = Math.round(parseFloat(pricing.priceMax) * 100);
      priceInCents = Math.round((priceMinCents + priceMaxCents) / 2);
    }

    await updateProfileMutation.mutateAsync({
      defaultPrice: pricing.pricingType === "varies" ? null : priceInCents,
      defaultPriceMin: priceMinCents,
      defaultPriceMax: priceMaxCents,
      pricingType: pricing.pricingType,
      slotDuration: parseInt(pricing.duration) || 60,
    });

    updateOnboardingMutation.mutate({ step: 4 });
    setStep(4);
  };

  const handleDepositSubmit = async () => {
    await updateProfileMutation.mutateAsync({
      depositEnabled: deposit.enabled,
      depositValue: deposit.percentage,
      depositPolicySet: true,
      publicProfileEnabled: true,
    });

    updateOnboardingMutation.mutate({ step: 5 });
    setStep(5);
  };

  const handleCopyLink = async () => {
    const slug = (user as any)?.publicProfileSlug || (user as any)?.id;
    const link = `${window.location.origin}/book/${slug}`;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareLink = async () => {
    const slug = (user as any)?.publicProfileSlug || (user as any)?.id;
    const link = `${window.location.origin}/book/${slug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book with me",
          text: "Schedule a service with me",
          url: link,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleBookingLinkContinue = () => {
    updateOnboardingMutation.mutate({ step: 6 });
    setStep(6);
  };

  const handlePaymentsSkip = () => {
    updateOnboardingMutation.mutate({ step: 7 });
    setStep(7);
  };

  const handlePaymentsConnect = () => {
    toast({ title: "Payment setup coming soon" });
    handlePaymentsSkip();
  };

  const handleAICardDismiss = async () => {
    await updateProfileMutation.mutateAsync({
      aiExpectationShown: true,
    });

    await updateOnboardingMutation.mutateAsync({
      state: "completed",
      completed: true,
      step: 8,
    });

    setStep(8);
    setShowCelebration(true);

    setTimeout(() => {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
        });
      }, 500);
    }, 200);
  };

  const handleGoToDashboard = () => {
    onComplete();
    navigate("/");
  };

  const progressPercent = step === 1 ? 0 : ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return {
    step,
    setStep,
    showSkipModal,
    setShowSkipModal,
    linkCopied,
    showCelebration,
    setShowCelebration,
    identity,
    setIdentity,
    pricing,
    setPricing,
    deposit,
    setDeposit,
    user,
    isAuthenticated,
    onboardingStatus,
    updateProfileMutation,
    updateOnboardingMutation,
    progressPercent,
    handleSkipClick,
    handleConfirmSkip,
    handleContinueSetup,
    handleStartSetup,
    handleIdentitySubmit,
    handlePricingSubmit,
    handleDepositSubmit,
    handleCopyLink,
    handleShareLink,
    handleBookingLinkContinue,
    handlePaymentsSkip,
    handlePaymentsConnect,
    handleAICardDismiss,
    handleGoToDashboard,
  };
}
