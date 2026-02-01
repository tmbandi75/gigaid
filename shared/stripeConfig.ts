import { isStripeEnabled } from "./stripeEnabled";

export const STRIPE_ENABLED = isStripeEnabled();

if (
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV === "development" &&
  !isStripeEnabled()
) {
  console.error(
    "❌ STRIPE_ENABLED is not set to 'true' — checkout will be blocked"
  );
}
