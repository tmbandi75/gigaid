import { STRIPE_ENABLED } from "@shared/stripeConfig";

export type SubscriptionPlan = "pro" | "pro_plus" | "business";

export function navigateToCheckout(plan: SubscriptionPlan): void {
  if (!STRIPE_ENABLED) {
    console.warn("[Stripe] Checkout disabled - STRIPE_ENABLED is false");
    return;
  }

  // Navigate to embedded checkout page
  window.location.href = `/checkout?plan=${plan}`;
}
