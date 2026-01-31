import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SubscriptionPlan } from "@/lib/stripeCheckout";

let stripePromise: Promise<any> | null = null;

async function getStripePromise() {
  if (!stripePromise) {
    const response = await fetch("/api/stripe/publishable-key");
    const { publishableKey } = await response.json();
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

const PLAN_DETAILS: Record<SubscriptionPlan, { name: string; price: string }> = {
  pro: { name: "Pro", price: "$19/month" },
  pro_plus: { name: "Pro+", price: "$28/month" },
  business: { name: "Business", price: "$49/month" },
};

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const plan = params.get("plan") as SubscriptionPlan | null;
  
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<any>(null);

  useEffect(() => {
    if (!plan || !["pro", "pro_plus", "business"].includes(plan)) {
      navigate("/pricing");
      return;
    }

    getStripePromise().then(setStripeInstance);

    apiRequest("POST", "/api/subscription/checkout", {
      plan,
      embedded: true,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError("Failed to initialize checkout");
        }
      })
      .catch((err) => {
        console.error("Checkout error:", err);
        setError("Failed to start checkout. Please try again.");
      });
  }, [plan, navigate]);

  const options = { clientSecret: clientSecret || "" };

  const planInfo = plan ? PLAN_DETAILS[plan] : null;

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4" data-testid="page-checkout-error">
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader>
            <CardTitle>Checkout Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/pricing")} data-testid="button-back-to-pricing">
              Back to Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientSecret || !stripeInstance) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="page-checkout-loading">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Preparing checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-checkout">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/pricing")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to plans
          </Button>
        </div>

        {planInfo && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold" data-testid="text-checkout-title">
              Upgrade to {planInfo.name}
            </h1>
            <p className="text-muted-foreground" data-testid="text-checkout-price">
              {planInfo.price}
            </p>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <EmbeddedCheckoutProvider stripe={stripeInstance} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
