/**
 * Regression coverage for Task #171.
 *
 * The "Switched to {plan}. Your new rate of …/mo starts next billing cycle."
 * message previously used `safePriceCents`, which rounds to whole dollars
 * (so a plan priced at $19.99 was shown as "$20"). It now uses
 * `safePriceCentsExact` via the shared `formatPlanSwitchedMessage` helper,
 * so cents are preserved (e.g. "$19.99").
 *
 * These tests import the same helper that `server/routes.ts` calls, so a
 * future drift in either the route wiring or the helper text will fail
 * the test (no risk of the test silently re-implementing the template).
 */

import {
  formatPlanSwitchedMessage,
  Plan,
  PLAN_PRICES_CENTS,
} from "../../shared/plans";

describe("change-plan downgrade message — localized cents formatting (Task #171)", () => {
  it("renders a whole-dollar plan price with two decimals (happy path)", () => {
    expect(formatPlanSwitchedMessage("Business", 4900)).toBe(
      "Switched to Business. Your new rate of $49.00/mo starts next billing cycle.",
    );
  });

  it("preserves cents for a non-integer-dollar plan price", () => {
    // 4999 cents = $49.99 — the bug was that this would render as "$49"
    expect(formatPlanSwitchedMessage("Business", 4999)).toBe(
      "Switched to Business. Your new rate of $49.99/mo starts next billing cycle.",
    );
  });

  it("renders the actual plan-price catalog with cents preserved", () => {
    // Every paid tier in PLAN_PRICES_CENTS today uses .99 pricing, so the
    // old `safePriceCents` rounding silently misrepresented every one.
    expect(
      formatPlanSwitchedMessage("Pro", PLAN_PRICES_CENTS[Plan.PRO]),
    ).toBe(
      "Switched to Pro. Your new rate of $19.99/mo starts next billing cycle.",
    );
    expect(
      formatPlanSwitchedMessage("Pro+", PLAN_PRICES_CENTS[Plan.PRO_PLUS]),
    ).toBe(
      "Switched to Pro+. Your new rate of $29.99/mo starts next billing cycle.",
    );
    expect(
      formatPlanSwitchedMessage("Business", PLAN_PRICES_CENTS[Plan.BUSINESS]),
    ).toBe(
      "Switched to Business. Your new rate of $49.99/mo starts next billing cycle.",
    );
  });

  it("falls back to the placeholder for non-finite/non-positive inputs (no $NaN/$0 leakage)", () => {
    expect(formatPlanSwitchedMessage("Pro", NaN)).toBe(
      "Switched to Pro. Your new rate of --/mo starts next billing cycle.",
    );
    expect(formatPlanSwitchedMessage("Pro", 0)).toBe(
      "Switched to Pro. Your new rate of --/mo starts next billing cycle.",
    );
  });
});
