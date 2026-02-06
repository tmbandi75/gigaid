import { apiFetch } from "./apiFetch";

// Cache bust: 2026-02-03T23:25:00Z
// Single source of truth for Stripe enablement
export const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true';

console.log('[Stripe env check]', {
  VITE_STRIPE_ENABLED: import.meta.env.VITE_STRIPE_ENABLED,
  STRIPE_ENABLED
});

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
  console.log("[Stripe] startStripeCheckout called", { plan, returnTo, STRIPE_ENABLED });

  // Hard guard: fail loudly if Stripe is disabled
  if (!STRIPE_ENABLED) {
    console.error('[Stripe] Checkout disabled — VITE_STRIPE_ENABLED=false');
    
    alert(
      'Payments are disabled in this environment.\n\n' +
      'Set VITE_STRIPE_ENABLED=true in Replit Secrets and restart the app.'
    );
    
    throw new Error('Stripe Checkout attempted while VITE_STRIPE_ENABLED=false');
  }

  try {
    console.log("[Stripe] Creating checkout session");
    const data = await apiFetch<{ url?: string; error?: string }>("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, returnTo }),
    });
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
