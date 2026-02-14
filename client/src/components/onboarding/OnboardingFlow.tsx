import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wrench,
  Droplets,
  Zap,
  Sparkles,
  LayoutGrid,
  TreePine,
  PanelTop,
  Layers,
  Hammer,
  Thermometer,
  Package,
  Car,
  Lock,
  Scissors,
  Baby,
  Dog,
  Home,
  Heart,
  Camera,
  PartyPopper,
  GraduationCap,
  ShowerHead,
  Shield,
  Monitor,
  Briefcase,
  ClipboardCheck,
  Snowflake,
  MoreHorizontal,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Sparkle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { serviceCategories, type ServiceIconName } from "@shared/service-categories";

interface OnboardingFlowProps {
  onComplete: () => void;
  initialStep?: number;
}

const iconMap: Record<ServiceIconName, LucideIcon> = {
  Wrench,
  Droplets,
  Zap,
  Sparkles,
  LayoutGrid,
  TreePine,
  PanelTop,
  Layers,
  Hammer,
  Thermometer,
  Package,
  Car,
  Lock,
  Scissors,
  Baby,
  Dog,
  Home,
  Heart,
  Camera,
  PartyPopper,
  GraduationCap,
  ShowerHead,
  Shield,
  Monitor,
  Briefcase,
  ClipboardCheck,
  Snowflake,
  MoreHorizontal,
};

const getIconForCategory = (iconName: ServiceIconName): LucideIcon => {
  return iconMap[iconName] || MoreHorizontal;
};

const TOTAL_STEPS = 4;

export function OnboardingFlow({ onComplete, initialStep }: OnboardingFlowProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState(initialStep || 1);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  const [identity, setIdentity] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
    serviceType: "",
  });
  
  const [pricing, setPricing] = useState({
    serviceName: "",
    typicalPrice: "",
    priceMin: "",
    priceMax: "",
    duration: "60",
    pricingType: "fixed" as "fixed" | "range" | "varies",
  });

  const { user, isAuthenticated } = useAuth();

  const { data: onboardingStatus } = useQuery<{
    completed: boolean;
    step: number;
    state: string;
    moneyProtectionReady: boolean;
    defaultServiceType: string | null;
    defaultPrice: number | null;
    depositPolicySet: boolean;
    aiExpectationShown: boolean;
  }>({
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
        queryClient.invalidateQueries({ queryKey: ["/api/user/activation-state"] });
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
      completed: true 
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
      step: 4 
    });
    
    onComplete();
    queryClient.invalidateQueries({ queryKey: ["/api/user/activation-state"] });
    navigate("/");
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col min-h-[70vh]" data-testid="onboarding-flow-unauthenticated">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-6 py-8 min-h-full flex flex-col">
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-8 text-center">
                <div className="space-y-2">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
                    <Shield className="w-10 h-10 text-primary" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    Get paid before the job starts
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-sm mx-auto">
                    GigAid protects your time with deposits and smart booking.
                  </p>
                </div>
                
                <div className="space-y-3 pt-4">
                  <a href="/api/login" className="block">
                    <Button 
                      size="lg" 
                      className="w-full h-14 text-lg rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
                      data-testid="button-sign-in"
                    >
                      Sign in to get started
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </a>
                  <p className="text-sm text-muted-foreground">
                    New to GigAid? Sign in to create your account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = step === 1 ? 0 : ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="flex flex-col min-h-[70vh]" data-testid="onboarding-flow">
      <Dialog open={showSkipModal} onOpenChange={setShowSkipModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Skipping setup limits protection</DialogTitle>
            <DialogDescription className="text-base pt-2">
              You can explore GigAid, but deposits and AI protection won't work until setup is complete.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button size="lg" onClick={handleContinueSetup} data-testid="button-continue-setup">
              Continue setup
            </Button>
            <Button variant="ghost" onClick={handleConfirmSkip} data-testid="button-enter-dashboard">
              Enter dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {step > 1 && step < 5 && (
        <div className="h-1.5 bg-muted rounded-t-2xl overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#6366F1] to-[#4F46E5] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-8 min-h-full flex flex-col">
          
          {step === 1 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="step-welcome">
              <div className="space-y-8 text-center">
                <div className="space-y-2">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
                    <Shield className="w-10 h-10 text-primary" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    Get paid before the job starts
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-sm mx-auto">
                    GigAid protects your time with deposits and smart booking.
                  </p>
                </div>
                
                <div className="space-y-3 pt-4">
                  <Button 
                    size="lg" 
                    className="w-full h-14 text-lg rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
                    onClick={handleStartSetup}
                    data-testid="button-start-setup"
                  >
                    Set up my profile
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={handleSkipClick}
                    data-testid="button-skip"
                  >
                    Skip for now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500" data-testid="step-identity">
              <div className="flex-1 space-y-8">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#6366F1]">Step 1 of 3</p>
                  <h1 className="text-3xl font-bold tracking-tight">Tell us about yourself</h1>
                  <p className="text-muted-foreground">Just the basics to get started.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-base">First name *</Label>
                    <Input
                      id="firstName"
                      value={identity.firstName}
                      onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })}
                      placeholder="Your first name"
                      className="h-12 text-lg rounded-xl"
                      data-testid="input-first-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-base">Last name</Label>
                    <Input
                      id="lastName"
                      value={identity.lastName}
                      onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })}
                      placeholder="Your last name"
                      className="h-12 text-lg rounded-xl"
                      data-testid="input-last-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessName" className="text-base">Business name (optional)</Label>
                    <Input
                      id="businessName"
                      value={identity.businessName}
                      onChange={(e) => setIdentity({ ...identity, businessName: e.target.value })}
                      placeholder="Your business name"
                      className="h-12 text-lg rounded-xl"
                      data-testid="input-business-name"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base">What kind of work do you do? *</Label>
                    <ScrollArea className="h-[280px]">
                      <div className="grid grid-cols-3 gap-2 pr-4">
                        {serviceCategories.map((category) => {
                          const Icon = getIconForCategory(category.icon);
                          const isSelected = identity.serviceType === category.id;
                          return (
                            <Card
                              key={category.id}
                              className={`cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg"
                                  : "hover:border-primary/50 hover:bg-muted/50"
                              }`}
                              onClick={() => setIdentity({ ...identity, serviceType: category.id })}
                              data-testid={`service-${category.id}`}
                            >
                              <CardContent className="p-3 flex flex-col items-center gap-2">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                                  isSelected ? "bg-primary/10" : "bg-muted"
                                }`}>
                                  <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                </div>
                                <span className={`font-medium text-xs text-center leading-tight ${
                                  isSelected ? "text-primary" : "text-foreground"
                                }`}>
                                  {category.name}
                                </span>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
              
              <div className="pt-6">
                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
                  onClick={handleIdentitySubmit}
                  disabled={!identity.firstName.trim() || !identity.serviceType || updateProfileMutation.isPending}
                  data-testid="button-identity-continue"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Continue<ChevronRight className="w-5 h-5 ml-1" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500" data-testid="step-pricing">
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#6366F1]">Step 2 of 3</p>
                  <h1 className="text-3xl font-bold tracking-tight">What do you usually charge?</h1>
                  <p className="text-muted-foreground">This helps with estimates and invoices.</p>
                </div>
                
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-base">How do you price your work?</Label>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => setPricing({ ...pricing, pricingType: "fixed" })}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          pricing.pricingType === "fixed" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid="button-pricing-fixed"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          pricing.pricingType === "fixed" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {pricing.pricingType === "fixed" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="font-medium">Fixed price</p>
                          <p className="text-sm text-muted-foreground">I charge the same for most jobs</p>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setPricing({ ...pricing, pricingType: "range" })}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          pricing.pricingType === "range" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid="button-pricing-range"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          pricing.pricingType === "range" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {pricing.pricingType === "range" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="font-medium">Price range</p>
                          <p className="text-sm text-muted-foreground">My prices vary within a range</p>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setPricing({ ...pricing, pricingType: "varies" })}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          pricing.pricingType === "varies" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid="button-pricing-varies"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          pricing.pricingType === "varies" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {pricing.pricingType === "varies" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="font-medium">It depends</p>
                          <p className="text-sm text-muted-foreground">I quote each job individually</p>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {pricing.pricingType === "fixed" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <Label htmlFor="typicalPrice" className="text-base">Your typical price</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                        <Input
                          id="typicalPrice"
                          type="number"
                          value={pricing.typicalPrice}
                          onChange={(e) => setPricing({ ...pricing, typicalPrice: e.target.value })}
                          placeholder="0"
                          className="h-14 text-2xl font-semibold pl-10 rounded-xl"
                          data-testid="input-typical-price"
                        />
                      </div>
                    </div>
                  )}
                  
                  {pricing.pricingType === "range" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <Label className="text-base">Your price range</Label>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={pricing.priceMin}
                            onChange={(e) => setPricing({ ...pricing, priceMin: e.target.value })}
                            placeholder="Min"
                            className="h-14 text-xl font-semibold pl-10 rounded-xl"
                            data-testid="input-price-min"
                          />
                        </div>
                        <span className="text-muted-foreground font-medium">to</span>
                        <div className="relative flex-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={pricing.priceMax}
                            onChange={(e) => setPricing({ ...pricing, priceMax: e.target.value })}
                            placeholder="Max"
                            className="h-14 text-xl font-semibold pl-10 rounded-xl"
                            data-testid="input-price-max"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {pricing.pricingType === "varies" && (
                    <div className="p-4 rounded-xl bg-muted/50 border border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <p className="text-sm text-muted-foreground">
                        No problem! You can set prices when creating each job or invoice.
                      </p>
                    </div>
                  )}
                  
                  {pricing.pricingType !== "varies" && (
                    <div className="space-y-2">
                      <Label className="text-base">Typical duration (optional)</Label>
                      <div className="flex gap-2">
                        {["30", "60", "90", "120"].map((mins) => (
                          <Button
                            key={mins}
                            variant={pricing.duration === mins ? "default" : "outline"}
                            className="flex-1 h-12 rounded-xl"
                            onClick={() => setPricing({ ...pricing, duration: mins })}
                            data-testid={`button-duration-${mins}`}
                          >
                            {parseInt(mins) < 60 ? `${mins}m` : `${parseInt(mins) / 60}h`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-6">
                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
                  onClick={handlePricingSubmit}
                  disabled={
                    (pricing.pricingType === "fixed" && !pricing.typicalPrice) ||
                    (pricing.pricingType === "range" && (!pricing.priceMin || !pricing.priceMax)) ||
                    updateProfileMutation.isPending
                  }
                  data-testid="button-pricing-continue"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Continue<ChevronRight className="w-5 h-5 ml-1" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-500" data-testid="step-ai-card">
              <Card className="border-2 border-primary/20 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-primary via-violet-500 to-blue-500" />
                <CardContent className="p-8 space-y-6 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mx-auto">
                    <Sparkle className="w-10 h-10 text-primary" />
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">GigAid only speaks up when money is at risk</h2>
                    <p className="text-muted-foreground text-lg">
                      You'll get at most one suggestion per day — and only when it matters.
                    </p>
                  </div>
                  
                  <Button 
                    size="lg" 
                    className="w-full h-14 text-lg rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
                    onClick={handleAICardDismiss}
                    data-testid="button-got-it"
                  >
                    Got it
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
