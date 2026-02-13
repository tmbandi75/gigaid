process.env.NODE_ENV = "test";

export const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
export const STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || "";
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

const REQUIRED_VARS: { key: string; description: string; fallback?: string }[] = [
  {
    key: "GIGAID_ADMIN_API_KEY",
    description: "Admin API key for test route access",
    fallback: "test-admin-key-local",
  },
];

const OPTIONAL_VARS: { key: string; description: string }[] = [
  { key: "STRIPE_WEBHOOK_SECRET", description: "Platform webhook secret (needed for stripe.platform.webhook tests)" },
  { key: "STRIPE_CONNECT_WEBHOOK_SECRET", description: "Connect webhook secret (needed for stripe.connect.webhook tests)" },
  { key: "STRIPE_SECRET_KEY", description: "Stripe secret key (needed for Stripe webhook signature generation)" },
];

export function validateTestEnv(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let valid = true;

  for (const v of REQUIRED_VARS) {
    if (!process.env[v.key]) {
      if (v.fallback) {
        process.env[v.key] = v.fallback;
        warnings.push(`[env] ${v.key} not set, using fallback`);
      } else {
        warnings.push(`[env] MISSING REQUIRED: ${v.key} — ${v.description}`);
        valid = false;
      }
    }
  }

  for (const v of OPTIONAL_VARS) {
    if (!process.env[v.key]) {
      warnings.push(`[env] OPTIONAL MISSING: ${v.key} — ${v.description}`);
    }
  }

  if (warnings.length > 0) {
    console.warn("\n=== Test Environment Warnings ===");
    warnings.forEach((w) => console.warn(w));
    console.warn("=================================\n");
  }

  return { valid, warnings };
}
