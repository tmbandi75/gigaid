/**
 * TEMPORARY STRIPE STUB
 * --------------------
 * This prevents the app from crashing while Stripe
 * is reintroduced incrementally.
 *
 * DO NOT remove this file.
 * DO NOT rename the export.
 */

export type SubscriptionPlan = "pro" | "pro_plus" | "business";

export async function startStripeCheckout(_: any) {
  console.warn('[Stripe Stub] startStripeCheckout called')

  alert(
    'Stripe checkout is temporarily disabled while setup is finalized.'
  )

  return
}
