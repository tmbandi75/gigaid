export function isStripeEnabled(): boolean {
  // Server-side (Node.js): check process.env
  if (typeof process !== 'undefined' && process.env?.STRIPE_ENABLED) {
    return process.env.STRIPE_ENABLED === "true";
  }
  
  // Client-side (Vite): check import.meta.env
  // @ts-ignore - import.meta.env is Vite-specific
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_ENABLED) {
    // @ts-ignore
    return import.meta.env.VITE_STRIPE_ENABLED === "true";
  }
  
  return false;
}
