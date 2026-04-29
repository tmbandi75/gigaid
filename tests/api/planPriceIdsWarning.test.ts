/**
 * Coverage for the startup warning that fires when no Stripe plan price IDs
 * are configured. The helper is invoked from server/index.ts on boot via
 * `warnIfNoPlanPriceIdsConfigured()` and is responsible for telling on-call
 * admins that `billing_upgrade` / `billing_downgrade` will fail until the
 * STRIPE_PRICE_* env vars are set. Without this test a refactor of either
 * server/index.ts or server/billing/plans.ts could silently drop the warning.
 */

process.env.NODE_ENV = "test";

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../../server/lib/logger", () => ({
  logger: mockLogger,
}));

import {
  getPlanPriceEnvVarNames,
  warnIfNoPlanPriceIdsConfigured,
} from "../../server/billing/plans";

const PLAN_PRICE_ENV_VARS = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_PRO_PLUS_MONTHLY",
  "STRIPE_PRICE_PRO_PLUS_YEARLY",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_YEARLY",
];

describe("warnIfNoPlanPriceIdsConfigured", () => {
  const savedEnv: Record<string, string | undefined> = {};
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
    for (const key of PLAN_PRICE_ENV_VARS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
    for (const key of PLAN_PRICE_ENV_VARS) {
      const previous = savedEnv[key];
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  });

  it("getPlanPriceEnvVarNames returns the canonical six STRIPE_PRICE_* env vars", () => {
    // Sanity check so the message-content assertions below are meaningful: if
    // the canonical list ever changes, the warning helper test should be
    // updated alongside it.
    expect(getPlanPriceEnvVarNames().sort()).toEqual([...PLAN_PRICE_ENV_VARS].sort());
  });

  it("logs a startup warning naming every env var and the runbook when none are configured", () => {
    warnIfNoPlanPriceIdsConfigured();

    // In non-production environments the helper logs at info level; warn is
    // reserved for production. Either way "no warning" must hold for the
    // configured-case test below, so we check both channels.
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledTimes(1);

    const message = String(mockLogger.info.mock.calls[0][0]);
    for (const envVar of PLAN_PRICE_ENV_VARS) {
      expect(message).toContain(envVar);
    }
    expect(message).toContain("docs/runbooks/stripe-plan-price-ids.md");
    expect(message).toMatch(/billing_upgrade/);
    expect(message).toMatch(/billing_downgrade/);
  });

  it("emits the warning at warn level (not info) in production", () => {
    process.env.NODE_ENV = "production";

    warnIfNoPlanPriceIdsConfigured();

    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const message = String(mockLogger.warn.mock.calls[0][0]);
    for (const envVar of PLAN_PRICE_ENV_VARS) {
      expect(message).toContain(envVar);
    }
    expect(message).toContain("docs/runbooks/stripe-plan-price-ids.md");
  });

  it("does not log anything when at least one plan price env var is set", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_test_pro_monthly";

    warnIfNoPlanPriceIdsConfigured();

    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
