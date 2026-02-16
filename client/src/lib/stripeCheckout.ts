import { apiFetch } from "./apiFetch";
import { logger } from "@/lib/logger";

// Cache bust: 2026-02-03T23:25:00Z
// Single source of truth for Stripe enablement
export const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true';

logger.debug('[Stripe env check]', {
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
  logger.debug("[Stripe] startStripeCheckout called", { plan, returnTo, STRIPE_ENABLED });

  // Hard guard: fail loudly if Stripe is disabled
  if (!STRIPE_ENABLED) {
    logger.error('[Stripe] Checkout disabled — VITE_STRIPE_ENABLED=false');
    
    alert(
      'Payments are disabled in this environment.\n\n' +
      'Set VITE_STRIPE_ENABLED=true in Replit Secrets and restart the app.'
    );
    
    throw new Error('Stripe Checkout attempted while VITE_STRIPE_ENABLED=false');
  }

  try {
    logger.debug("[Stripe] Creating checkout session");
    const data = await apiFetch<{ url?: string; error?: string }>("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, returnTo }),
    });
    logger.debug("[Stripe] Checkout session data", data);
    
    if (data.url) {
      logger.debug("[Stripe] Redirecting to Stripe Checkout", data.url);
      window.open(data.url, '_blank');
      return { success: true };
    } else {
      logger.error("[Stripe] No checkout URL returned", data);
      return {
        success: false,
        error: data.error || "Could not start checkout. Please try again."
      };
    }
  } catch (error) {
    logger.error("[Stripe] Checkout error:", error);
    return {
      success: false,
      error: "Checkout failed. Please try again."
    };
  }
}
