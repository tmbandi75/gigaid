import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { serviceCategories } from "@shared/service-categories";

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

export const TOTAL_STEPS = 4;

export function useOnboarding(onComplete: () => void, initialStep?: number) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(initialStep || 1);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [initialized, setInitialized] = useState(false);

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
        const savedStep = onboardingStatus.step;
        if (savedStep <= TOTAL_STEPS) {
          setStep(savedStep);
        } else {
          setStep(2);
        }
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
    queryClient.invalidateQueries({ queryKey: ["/api/user/activation-state"] });
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

  const handleAICardDismiss = async () => {
    await updateProfileMutation.mutateAsync({
      aiExpectationShown: true,
    });

    await updateOnboardingMutation.mutateAsync({
      state: "completed",
      completed: true,
      step: 4,
    });

    onComplete();
    queryClient.invalidateQueries({ queryKey: ["/api/user/activation-state"] });
    navigate("/");
  };

  const progressPercent = step === 1 ? 0 : ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return {
    step,
    setStep,
    showSkipModal,
    setShowSkipModal,
    identity,
    setIdentity,
    pricing,
    setPricing,
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
    handleAICardDismiss,
  };
}
