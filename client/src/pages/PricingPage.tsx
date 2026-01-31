import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCapability } from "@/hooks/useCapability";
import { Plan } from "@shared/plans";
import { navigateToCheckout, SubscriptionPlan } from "@/lib/stripeCheckout";
import { useLocation } from "wouter";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanInfo {
  id: Plan;
  name: string;
  price: number;
  priceLabel: string;
  cta: string;
  stripeKey?: SubscriptionPlan;
  features: PlanFeature[];
}

const PLANS: PlanInfo[] = [
  {
    id: Plan.FREE,
    name: "Free",
    price: 0,
    priceLabel: "$0/month",
    cta: "Start Free",
    features: [
      { text: "Up to 5 jobs per month", included: true },
      { text: "Basic invoicing", included: true },
      { text: "Job scheduling", included: true },
      { text: "Lead management", included: true },
    ],
  },
  {
    id: Plan.PRO,
    name: "Pro",
    price: 19,
    priceLabel: "$19/month",
    cta: "Upgrade to Pro",
    stripeKey: "pro",
    features: [
      { text: "Unlimited jobs", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "Two-way SMS", included: true },
      { text: "Owner View dashboard", included: true },
      { text: "Weekly summaries", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    id: Plan.PRO_PLUS,
    name: "Pro+",
    price: 28,
    priceLabel: "$28/month",
    cta: "Protect My Bookings",
    stripeKey: "pro_plus",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Deposit enforcement", included: true },
      { text: "Booking risk protection", included: true },
      { text: "Today's Money Plan", included: true },
      { text: "Offline asset capture", included: true },
      { text: "Priority alerts", included: true },
      { text: "AI campaign suggestions", included: true },
    ],
  },
  {
    id: Plan.BUSINESS,
    name: "Business",
    price: 49,
    priceLabel: "$49/month",
    cta: "Run This as a Business",
    stripeKey: "business",
    features: [
      { text: "Everything in Pro+", included: true },
      { text: "Multi-provider support", included: true },
      { text: "Team management", included: true },
      { text: "Business analytics", included: true },
      { text: "Admin controls", included: true },
      { text: "API access", included: true },
    ],
  },
];

export default function PricingPage() {
  const { isAuthenticated } = useAuth();
  const { getUserPlan } = useCapability();
  const [, navigate] = useLocation();

  const currentPlan = getUserPlan();

  const handlePlanAction = (plan: PlanInfo) => {
    if (plan.id === Plan.FREE) {
      if (isAuthenticated) {
        navigate("/");
      } else {
        navigate("/login");
      }
      return;
    }

    if (!plan.stripeKey) return;

    // Navigate to embedded checkout page
    navigateToCheckout(plan.stripeKey);
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
    <div className="min-h-screen bg-background py-12 px-4" data-testid="page-pricing">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3" data-testid="text-pricing-title">
            Choose the right plan for your business
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
            All plans include core job management features. Upgrade anytime as your business grows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = isCurrentPlan(plan.id);
            const isDisabled = isPlanDisabled(plan.id);

            return (
              <Card
                key={plan.id}
                className={`flex flex-col ${isCurrent ? "border-primary border-2" : ""}`}
                data-testid={`card-plan-${plan.id}`}
              >
                <CardHeader>
                  <CardTitle data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground" data-testid={`text-plan-price-${plan.id}`}>
                      {plan.priceLabel}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isDisabled}
                    onClick={() => handlePlanAction(plan)}
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {isCurrent ? "Current Plan" : plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            All prices in USD. Cancel anytime. Questions? Contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
