import { Plan, PLAN_PRICES_CENTS } from "@shared/plans";
import { logger } from "../lib/logger";

export type BillingCadence = "monthly" | "yearly";

const PLAN_PRICE_ENV_VARS: Record<Plan, Partial<Record<BillingCadence, string>>> = {
  [Plan.FREE]: {},
  [Plan.PRO]: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
  [Plan.PRO_PLUS]: {
    monthly: "STRIPE_PRICE_PRO_PLUS_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_PLUS_YEARLY",
  },
  [Plan.BUSINESS]: {
    monthly: "STRIPE_PRICE_BUSINESS_MONTHLY",
    yearly: "STRIPE_PRICE_BUSINESS_YEARLY",
  },
};

export function getKnownPlanPriceIds(): Set<string> {
  const ids = new Set<string>();
  for (const cadences of Object.values(PLAN_PRICE_ENV_VARS)) {
    for (const envVar of Object.values(cadences)) {
      if (!envVar) continue;
      const value = process.env[envVar]?.trim();
      if (value) ids.add(value);
    }
  }
  return ids;
}

export function isKnownPlanPriceId(priceId: string): boolean {
  return getKnownPlanPriceIds().has(priceId);
}

export function getPlanPriceEnvVarNames(): string[] {
  const names: string[] = [];
  for (const cadences of Object.values(PLAN_PRICE_ENV_VARS)) {
    for (const envVar of Object.values(cadences)) {
      if (envVar) names.push(envVar);
    }
  }
  return names;
}

export interface PlanPriceConfig {
  plan: Plan;
  cadence: BillingCadence;
  envVar: string;
  priceId: string | null;
  configured: boolean;
  // Monthly base price in cents. Populated for the "monthly" cadence
  // from PLAN_PRICES_CENTS so the admin Change-Plan dropdown can
  // display the price next to each option (e.g. "Pro · Monthly · $19.99/mo").
  // Yearly Stripe prices are not tracked in source, so this is null
  // for the "yearly" cadence and the UI omits the price for those rows.
  priceCents: number | null;
}

export function getConfiguredPlanPrices(): PlanPriceConfig[] {
  const result: PlanPriceConfig[] = [];
  for (const [plan, cadences] of Object.entries(PLAN_PRICE_ENV_VARS) as Array<
    [Plan, Partial<Record<BillingCadence, string>>]
  >) {
    for (const [cadence, envVar] of Object.entries(cadences) as Array<
      [BillingCadence, string]
    >) {
      const value = process.env[envVar]?.trim() || null;
      const monthlyCents = PLAN_PRICES_CENTS[plan];
      result.push({
        plan,
        cadence,
        envVar,
        priceId: value,
        configured: !!value,
        priceCents:
          cadence === "monthly" && typeof monthlyCents === "number" && monthlyCents > 0
            ? monthlyCents
            : null,
      });
    }
  }
  return result;
}

export function warnIfNoPlanPriceIdsConfigured(): void {
  if (getKnownPlanPriceIds().size > 0) return;
  const envVars = getPlanPriceEnvVarNames().join(", ");
  const message =
    `No Stripe plan price IDs configured. Admin plan changes ` +
    `(billing_upgrade / billing_downgrade) will fail with ` +
    `"Unknown price ID" until the following env vars are set: ${envVars}. ` +
    `See docs/runbooks/stripe-plan-price-ids.md.`;
  if (process.env.NODE_ENV === "production") {
    logger.warn(`[startup] ${message}`);
  } else {
    logger.info(`[startup] ${message}`);
  }
}
