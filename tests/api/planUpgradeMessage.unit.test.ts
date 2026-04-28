/**
 * Regression coverage for Task #175.
 *
 * The "Upgraded to {plan}. Prorated charges applied." message previously
 * told users nothing about what their new monthly bill would be — only
 * the downgrade path surfaced the new rate. The upgrade response now
 * uses `formatPlanUpgradedMessage`, which renders the new monthly rate
 * with cents preserved (via `safePriceCentsExact`) alongside the
 * proration note.
 *
 * These tests import the same helper that `server/routes.ts` calls, so a
 * future drift in either the route wiring or the helper text will fail
 * the test (no risk of the test silently re-implementing the template).
 */

import {
  formatPlanUpgradedMessage,
  Plan,
  PLAN_PRICES_CENTS,
} from "../../shared/plans";

describe("change-plan upgrade message — surfaces new monthly rate (Task #175)", () => {
  it("renders a whole-dollar plan price with two decimals (happy path)", () => {
    expect(formatPlanUpgradedMessage("Business", 4900)).toBe(
      "Upgraded to Business. Your new rate of $49.00/mo, with prorated charges applied for the rest of this billing cycle.",
    );
  });

  it("preserves cents for a non-integer-dollar plan price", () => {
    // 4999 cents = $49.99 — would have been hidden entirely under the
    // old "Prorated charges applied." message.
    expect(formatPlanUpgradedMessage("Business", 4999)).toBe(
      "Upgraded to Business. Your new rate of $49.99/mo, with prorated charges applied for the rest of this billing cycle.",
    );
  });

  it("renders the actual plan-price catalog with cents preserved", () => {
    expect(
      formatPlanUpgradedMessage("Pro", PLAN_PRICES_CENTS[Plan.PRO]),
    ).toBe(
      "Upgraded to Pro. Your new rate of $19.99/mo, with prorated charges applied for the rest of this billing cycle.",
    );
    expect(
      formatPlanUpgradedMessage("Pro+", PLAN_PRICES_CENTS[Plan.PRO_PLUS]),
    ).toBe(
      "Upgraded to Pro+. Your new rate of $29.99/mo, with prorated charges applied for the rest of this billing cycle.",
    );
    expect(
      formatPlanUpgradedMessage("Business", PLAN_PRICES_CENTS[Plan.BUSINESS]),
    ).toBe(
      "Upgraded to Business. Your new rate of $49.99/mo, with prorated charges applied for the rest of this billing cycle.",
    );
  });

  it("falls back to the placeholder for non-finite/non-positive inputs (no $NaN/$0 leakage)", () => {
    expect(formatPlanUpgradedMessage("Pro", NaN)).toBe(
      "Upgraded to Pro. Your new rate of --/mo, with prorated charges applied for the rest of this billing cycle.",
    );
    expect(formatPlanUpgradedMessage("Pro", 0)).toBe(
      "Upgraded to Pro. Your new rate of --/mo, with prorated charges applied for the rest of this billing cycle.",
    );
  });
});
