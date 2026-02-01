import { apiRequest } from "./queryClient";
import { isStripeEnabled } from "@shared/stripeEnabled";

export type SubscriptionPlan = "pro" | "pro_plus" | "business";

export interface CheckoutResult {
  success: boolean;
  error?: string;
}

export async function startStripeCheckout({
  plan,
  returnTo
}: {
  plan: SubscriptionPlan;
  returnTo: string;
}): Promise<CheckoutResult> {
  if (!isStripeEnabled()) {
    console.warn("[Stripe] Checkout blocked: Stripe disabled");
    return {
      success: false,
      error: "Payments temporarily unavailable. Please try again in a few minutes."
    };
  }

  try {
    const response = await apiRequest("POST", "/api/subscription/checkout", {
      plan,
      returnTo
    });
    
    const data = await response.json();
    
    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    } else {
      console.error("[Stripe] No checkout URL returned");
      return {
        success: false,
        error: "Could not start checkout. Please try again."
      };
    }
  } catch (error) {
    console.error("[Stripe] Checkout error:", error);
    return {
      success: false,
      error: "Checkout failed. Please try again."
    };
  }
}
