import { apiRequest } from "./queryClient";
import { STRIPE_ENABLED } from "@shared/stripeConfig";

export async function startStripeCheckout({
  plan,
  returnTo
}: {
  plan: "pro_plus";
  returnTo: string;
}): Promise<void> {
  if (!STRIPE_ENABLED) {
    console.warn("[Stripe] Checkout disabled - STRIPE_ENABLED is false");
    return;
  }

  try {
    const response = await apiRequest("POST", "/api/subscription/checkout", {
      plan,
      returnTo
    });
    
    const data = await response.json();
    
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error("[Stripe] No checkout URL returned");
    }
  } catch (error) {
    console.error("[Stripe] Checkout error:", error);
    throw error;
  }
}
