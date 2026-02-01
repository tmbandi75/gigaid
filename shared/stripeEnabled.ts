export function isStripeEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.STRIPE_ENABLED === "true";
  }
  return false;
}
