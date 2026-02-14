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
import { WebOnboardingStepper } from "./WebOnboardingStepper";
import { useOnboarding } from "@/hooks/useOnboarding";
import { serviceCategories, type ServiceIconName } from "@shared/service-categories";
import {
  Wrench, Droplets, Zap, Sparkles, LayoutGrid, TreePine,
  PanelTop, Layers, Hammer, Thermometer, Package, Car,
  Lock, Scissors, Baby, Dog, Home, Heart, Camera,
  PartyPopper, GraduationCap, ShowerHead, Shield, Monitor,
  Briefcase, ClipboardCheck, Snowflake, MoreHorizontal,
  ChevronRight, Loader2, CheckCircle2,
  Sparkle, ArrowRight,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<ServiceIconName, LucideIcon> = {
  Wrench, Droplets, Zap, Sparkles, LayoutGrid, TreePine,
  PanelTop, Layers, Hammer, Thermometer, Package, Car,
  Lock, Scissors, Baby, Dog, Home, Heart, Camera,
  PartyPopper, GraduationCap, ShowerHead, Shield, Monitor,
  Briefcase, ClipboardCheck, Snowflake, MoreHorizontal,
};

const getIconForCategory = (iconName: ServiceIconName): LucideIcon => {
  return iconMap[iconName] || MoreHorizontal;
};

interface WebOnboardingLayoutProps {
  onComplete: () => void;
  initialStep?: number;
}

export function WebOnboardingLayout({ onComplete, initialStep }: WebOnboardingLayoutProps) {
  const ob = useOnboarding(onComplete, initialStep);

  if (!ob.isAuthenticated || !ob.user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="web-onboarding-unauthenticated">
        <div className="max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 mb-2">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Get paid before the job starts
          </h1>
          <p className="text-white/70 text-lg">
            GigAid protects your time with deposits and smart booking.
          </p>
          <a href="/api/login" data-testid="link-sign-in">
            <Button
              size="lg"
              className="h-14 text-lg rounded-xl bg-white text-[#4F46E5] shadow-lg"
              data-testid="button-sign-in"
            >
              Sign in to get started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (ob.step === 1) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[70vh]" data-testid="web-step-welcome">
          <div className="max-w-lg text-center space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 mb-2">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-white tracking-tight leading-tight">
                Get paid before the job starts
              </h1>
              <p className="text-xl text-white/70 max-w-sm mx-auto">
                GigAid protects your time with deposits and smart booking.
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <Button
                size="lg"
                className="h-14 px-10 text-lg rounded-xl bg-white text-[#4F46E5] shadow-lg"
                onClick={ob.handleStartSetup}
                data-testid="button-start-setup"
              >
                Set up my profile
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <div>
                <Button
                  variant="ghost"
                  className="text-white/60"
                  onClick={ob.handleSkipClick}
                  data-testid="button-skip"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </div>
        </div>
        <SkipModal ob={ob} />
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-[80vh] gap-8 max-w-5xl mx-auto w-full px-8 py-10" data-testid="web-onboarding-layout">
        <aside className="w-64 shrink-0 flex flex-col gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Setup Progress</h2>
            <p className="text-sm text-white/60">Step {ob.step - 1} of 3</p>
          </div>
          <WebOnboardingStepper currentStep={ob.step} />
          <div className="mt-auto pt-4">
            <Button
              variant="ghost"
              className="text-white/50 hover:text-white text-sm"
              onClick={ob.handleSkipClick}
              data-testid="button-skip-sidebar"
            >
              Skip setup
            </Button>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
            <div className="p-8 lg:p-10 min-h-[500px] flex flex-col">
              {ob.step === 2 && <IdentityStep ob={ob} />}
              {ob.step === 3 && <PricingStep ob={ob} />}
              {ob.step === 4 && <AICardStep ob={ob} />}
            </div>
          </div>
        </main>
      </div>

      <SkipModal ob={ob} />
    </>
  );
}

type ObType = ReturnType<typeof useOnboarding>;

function SkipModal({ ob }: { ob: ObType }) {
  return (
    <Dialog open={ob.showSkipModal} onOpenChange={ob.setShowSkipModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Skipping setup limits protection</DialogTitle>
          <DialogDescription className="text-base pt-2">
            You can explore GigAid, but deposits and AI protection won't work until setup is complete.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button size="lg" onClick={ob.handleContinueSetup} data-testid="button-continue-setup">
            Continue setup
          </Button>
          <Button variant="ghost" onClick={ob.handleConfirmSkip} data-testid="button-enter-dashboard">
            Enter dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IdentityStep({ ob }: { ob: ObType }) {
  return (
    <div className="flex-1 flex flex-col" data-testid="web-step-identity">
      <div className="flex-1 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Tell us about yourself</h1>
          <p className="text-muted-foreground">Just the basics to get started.</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-base">First name *</Label>
              <Input
                id="firstName"
                value={ob.identity.firstName}
                onChange={(e) => ob.setIdentity({ ...ob.identity, firstName: e.target.value })}
                placeholder="First name"
                className="h-12 text-base rounded-xl"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-base">Last name</Label>
              <Input
                id="lastName"
                value={ob.identity.lastName}
                onChange={(e) => ob.setIdentity({ ...ob.identity, lastName: e.target.value })}
                placeholder="Last name"
                className="h-12 text-base rounded-xl"
                data-testid="input-last-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-base">Business name (optional)</Label>
            <Input
              id="businessName"
              value={ob.identity.businessName}
              onChange={(e) => ob.setIdentity({ ...ob.identity, businessName: e.target.value })}
              placeholder="Your business name"
              className="h-12 text-base rounded-xl"
              data-testid="input-business-name"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base">What kind of work do you do? *</Label>
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-4 gap-2 pr-4">
                {serviceCategories.map((category) => {
                  const Icon = getIconForCategory(category.icon);
                  const isSelected = ob.identity.serviceType === category.id;
                  return (
                    <Card
                      key={category.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg"
                          : "hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      onClick={() => ob.setIdentity({ ...ob.identity, serviceType: category.id })}
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

      <div className="pt-6 flex justify-end">
        <Button
          size="lg"
          className="h-12 px-8 text-base rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
          onClick={ob.handleIdentitySubmit}
          disabled={!ob.identity.firstName.trim() || !ob.identity.serviceType || ob.updateProfileMutation.isPending}
          data-testid="button-identity-continue"
        >
          {ob.updateProfileMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>Continue<ChevronRight className="w-5 h-5 ml-1" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

function PricingStep({ ob }: { ob: ObType }) {
  return (
    <div className="flex-1 flex flex-col" data-testid="web-step-pricing">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">What do you usually charge?</h1>
          <p className="text-muted-foreground">This helps with estimates and invoices.</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-base">How do you price your work?</Label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { type: "fixed" as const, label: "Fixed price", desc: "I charge the same for most jobs" },
                { type: "range" as const, label: "Price range", desc: "My prices vary within a range" },
                { type: "varies" as const, label: "It depends", desc: "I quote each job individually" },
              ]).map(({ type, label, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => ob.setPricing({ ...ob.pricing, pricingType: type })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                    ob.pricing.pricingType === type
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid={`button-pricing-${type}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    ob.pricing.pricingType === type ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {ob.pricing.pricingType === type && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {ob.pricing.pricingType === "fixed" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Label htmlFor="typicalPrice" className="text-base">Your typical price</Label>
              <div className="relative max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                <Input
                  id="typicalPrice"
                  type="number"
                  value={ob.pricing.typicalPrice}
                  onChange={(e) => ob.setPricing({ ...ob.pricing, typicalPrice: e.target.value })}
                  placeholder="0"
                  className="h-14 text-2xl font-semibold pl-10 rounded-xl"
                  data-testid="input-typical-price"
                />
              </div>
            </div>
          )}

          {ob.pricing.pricingType === "range" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Label className="text-base">Your price range</Label>
              <div className="flex items-center gap-3 max-w-sm">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={ob.pricing.priceMin}
                    onChange={(e) => ob.setPricing({ ...ob.pricing, priceMin: e.target.value })}
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
                    value={ob.pricing.priceMax}
                    onChange={(e) => ob.setPricing({ ...ob.pricing, priceMax: e.target.value })}
                    placeholder="Max"
                    className="h-14 text-xl font-semibold pl-10 rounded-xl"
                    data-testid="input-price-max"
                  />
                </div>
              </div>
            </div>
          )}

          {ob.pricing.pricingType === "varies" && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm text-muted-foreground">
                No problem! You can set prices when creating each job or invoice.
              </p>
            </div>
          )}

          {ob.pricing.pricingType !== "varies" && (
            <div className="space-y-2">
              <Label className="text-base">Typical duration (optional)</Label>
              <div className="flex gap-2 max-w-sm">
                {["30", "60", "90", "120"].map((mins) => (
                  <Button
                    key={mins}
                    variant={ob.pricing.duration === mins ? "default" : "outline"}
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => ob.setPricing({ ...ob.pricing, duration: mins })}
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

      <div className="pt-6 flex justify-end">
        <Button
          size="lg"
          className="h-12 px-8 text-base rounded-xl bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30"
          onClick={ob.handlePricingSubmit}
          disabled={
            (ob.pricing.pricingType === "fixed" && !ob.pricing.typicalPrice) ||
            (ob.pricing.pricingType === "range" && (!ob.pricing.priceMin || !ob.pricing.priceMax)) ||
            ob.updateProfileMutation.isPending
          }
          data-testid="button-pricing-continue"
        >
          {ob.updateProfileMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>Continue<ChevronRight className="w-5 h-5 ml-1" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

function AICardStep({ ob }: { ob: ObType }) {
  return (
    <div className="flex-1 flex flex-col justify-center" data-testid="web-step-ai-card">
      <div className="max-w-lg mx-auto w-full">
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
              onClick={ob.handleAICardDismiss}
              data-testid="button-got-it"
            >
              Got it
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
