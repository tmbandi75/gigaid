import { apiRequest } from "./queryClient";

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
  console.log("[Stripe] GUARDED CODE REMOVED — entering checkout", { plan, returnTo });

  try {
    console.log("[Stripe] Creating checkout session");
    const response = await apiRequest("POST", "/api/subscription/checkout", {
      plan,
      returnTo
    });
    console.log("[Stripe] Checkout session response received", response.status);
    
    const data = await response.json();
    console.log("[Stripe] Checkout session data", data);
    
    if (data.url) {
      console.log("[Stripe] Redirecting to Stripe Checkout", data.url);
      window.location.href = data.url;
      return { success: true };
    } else {
      console.error("[Stripe] No checkout URL returned", data);
      return {
        success: false,
        error: data.error || "Could not start checkout. Please try again."
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
