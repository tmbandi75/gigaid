import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Shield, Users, ArrowLeft, Loader2, Star, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCapability } from "@/hooks/useCapability";
import { useToast } from "@/hooks/use-toast";
import { Plan } from "@shared/plans";
import { startStripeCheckout, SubscriptionPlan } from "@/lib/stripeCheckout";
import { useLocation } from "wouter";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PlanFeature {
  text: string;
  highlight?: boolean;
}

interface PlanInfo {
  id: Plan;
  name: string;
  price: number;
  priceLabel: string;
  monthlyPrice: string;
  cta: string;
  description: string;
  stripeKey?: SubscriptionPlan;
  features: PlanFeature[];
  icon: React.ReactNode;
  recommended?: boolean;
  color: string;
}

const PLANS: PlanInfo[] = [
  {
    id: Plan.FREE,
    name: "Free",
    price: 0,
    priceLabel: "$0",
    monthlyPrice: "forever",
    cta: "Get Started",
    description: "Perfect for getting started",
    icon: <Zap className="h-5 w-5" />,
    color: "text-slate-600",
    features: [
      { text: "Up to 5 jobs per month" },
      { text: "Basic invoicing" },
      { text: "Job scheduling" },
      { text: "Lead management" },
    ],
  },
  {
    id: Plan.PRO,
    name: "Pro",
    price: 19,
    priceLabel: "$19",
    monthlyPrice: "/month",
    cta: "Start Pro Trial",
    description: "For growing professionals",
    stripeKey: "pro",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "text-blue-600",
    features: [
      { text: "Unlimited jobs", highlight: true },
      { text: "Auto follow-ups" },
      { text: "Two-way SMS" },
      { text: "Owner View dashboard" },
      { text: "Weekly summaries" },
      { text: "Priority support" },
    ],
  },
  {
    id: Plan.PRO_PLUS,
    name: "Pro+",
    price: 28,
    priceLabel: "$28",
    monthlyPrice: "/month",
    cta: "Get Pro+",
    description: "Protect your time and money",
    stripeKey: "pro_plus",
    icon: <Shield className="h-5 w-5" />,
    color: "text-primary",
    recommended: true,
    features: [
      { text: "Everything in Pro", highlight: true },
      { text: "Deposit enforcement", highlight: true },
      { text: "Booking risk protection", highlight: true },
      { text: "Today's Money Plan" },
      { text: "Offline asset capture" },
      { text: "Priority alerts" },
      { text: "AI campaign suggestions" },
    ],
  },
  {
    id: Plan.BUSINESS,
    name: "Business",
    price: 49,
    priceLabel: "$49",
    monthlyPrice: "/month",
    cta: "Go Business",
    description: "Scale your operation",
    stripeKey: "business",
    icon: <Users className="h-5 w-5" />,
    color: "text-purple-600",
    features: [
      { text: "Everything in Pro+", highlight: true },
      { text: "Multi-provider support" },
      { text: "Team management" },
      { text: "Business analytics" },
      { text: "Admin controls" },
      { text: "API access" },
    ],
  },
];

export default function PricingPage() {
  const { isAuthenticated } = useAuth();
  const { getUserPlan } = useCapability();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const isMobile = useIsMobile();

  const currentPlan = getUserPlan();

  const handlePlanAction = async (plan: PlanInfo) => {
    if (plan.id === Plan.FREE) {
      if (isAuthenticated) {
        navigate("/");
      } else {
        navigate("/login");
      }
      return;
    }

    if (!plan.stripeKey) {
      return;
    }

    setLoadingPlan(plan.stripeKey);
    try {
      const result = await startStripeCheckout({
        plan: plan.stripeKey,
        returnTo: "/pricing",
      });
      
      if (!result.success && result.error) {
        toast({
          title: "Payments temporarily unavailable",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: "Please try again in a few minutes.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const isCurrentPlan = (planId: Plan): boolean => {
    return currentPlan === planId;
  };

  const isPlanDisabled = (planId: Plan): boolean => {
    const planOrder = [Plan.FREE, Plan.PRO, Plan.PRO_PLUS, Plan.BUSINESS];
    const currentIndex = planOrder.indexOf(currentPlan);
    const targetIndex = planOrder.indexOf(planId);
    return targetIndex <= currentIndex;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" data-testid="page-pricing">
      {/* Header with back button */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4" data-testid="badge-pricing-hero">
            Simple, transparent pricing
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" data-testid="text-pricing-title">
            Choose the plan that fits your business
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
            Start free, upgrade when you're ready. All plans include core features to manage your jobs effectively.
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-6 mb-12 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span>14-day money back guarantee</span>
          </div>
        </div>

        {/* Plans Grid */}
        <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
          {PLANS.map((plan) => {
            const isCurrent = isCurrentPlan(plan.id);
            const isDisabled = isPlanDisabled(plan.id);
            const isLoading = loadingPlan === plan.stripeKey;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col transition-all duration-200 ${
                  plan.recommended 
                    ? "border-primary border-2 shadow-lg scale-[1.02]" 
                    : isCurrent 
                      ? "border-primary/50 border-2" 
                      : "hover:shadow-md"
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {/* Recommended Badge */}
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary" className="shadow-sm">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4 pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg bg-muted ${plan.color}`}>
                      {plan.icon}
                    </div>
                    <h3 className="text-xl font-semibold" data-testid={`text-plan-name-${plan.id}`}>
                      {plan.name}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold" data-testid={`text-plan-price-${plan.id}`}>
                      {plan.priceLabel}
                    </span>
                    <span className="text-muted-foreground ml-1">{plan.monthlyPrice}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className={`rounded-full p-0.5 ${feature.highlight ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Check className={`h-4 w-4 ${feature.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <span className={`text-sm ${feature.highlight ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className="w-full"
                    size="lg"
                    variant={plan.recommended ? "default" : isCurrent ? "outline" : "secondary"}
                    disabled={isDisabled || isLoading}
                    onClick={() => handlePlanAction(plan)}
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      plan.cta
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Bottom Section */}
        <div className="mt-16 text-center space-y-8">
          {/* FAQ Teaser */}
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-6">
              <h3 className="font-semibold mb-2">Have questions?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our team is here to help you find the right plan for your business.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate("/help")}
                data-testid="button-contact-support"
              >
                Contact Support
              </Button>
            </CardContent>
          </Card>

          {/* Fine Print */}
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            All prices in USD. Subscriptions renew automatically. You can cancel or change your plan anytime from Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
