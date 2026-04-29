// Regression coverage for the customer-facing notification price helper
// (Task #184). The default `safePrice*` placeholder `"--"` is fine in
// dense admin tables, but reads as broken inside an SMS / email body
// (e.g. "Your invoice for water heater repair is --."). These tests pin
// the friendlier copy and prove that no missing / zero / non-finite
// input ever escapes as `"--"` inside an outbound message body.
import {
  NOTIFICATION_PRICE_MISSING_COPY,
  notificationPrice,
  notificationPriceCents,
  notificationPriceCentsExact,
  notificationPriceExact,
  notificationPriceRange,
} from "@shared/notificationPrice";

const BAD_INPUTS: ReadonlyArray<[string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["NaN", NaN],
  ["positive Infinity", Infinity],
  ["negative Infinity", -Infinity],
  ["empty string", ""],
  ["whitespace string", "   "],
  ["non-numeric string", "abc"],
  ["object", {}],
  ["array", []],
  ["boolean true", true],
  ["boolean false", false],
  ["zero", 0],
  ["negative number", -25],
];

const SCALAR_HELPERS = [
  ["notificationPrice", notificationPrice],
  ["notificationPriceCents", notificationPriceCents],
  ["notificationPriceCentsExact", notificationPriceCentsExact],
  ["notificationPriceExact", notificationPriceExact],
] as const;

describe("notificationPrice helpers", () => {
  it("exposes the locked customer-facing fallback copy", () => {
    // Pin the exact string so a future refactor cannot silently regress
    // back to the dense admin-table placeholder inside an SMS body.
    expect(NOTIFICATION_PRICE_MISSING_COPY).toBe("amount to be confirmed");
    expect(NOTIFICATION_PRICE_MISSING_COPY).not.toMatch(/--/);
  });

  describe.each(SCALAR_HELPERS)("%s", (_label, helper) => {
    it.each(BAD_INPUTS)(
      "returns the friendly fallback (never `--`) for %s",
      (_inputLabel, value) => {
        const out = helper(value);
        expect(out).toBe(NOTIFICATION_PRICE_MISSING_COPY);
        // The whole point of this helper: `--` must never escape into an
        // outbound message body.
        expect(out).not.toBe("--");
        expect(out).not.toMatch(/--/);
        expect(out).not.toMatch(/NaN/i);
        expect(out).not.toMatch(/undefined/i);
      },
    );

    it("respects a custom placeholder override", () => {
      expect(helper(null, { placeholder: "TBD" })).toBe("TBD");
    });
  });

  describe("notificationPriceRange", () => {
    it.each(BAD_INPUTS)(
      "returns the friendly fallback (never `--`) when the low bound is %s",
      (_label, value) => {
        const out = notificationPriceRange(value, 100);
        expect(out).toBe(NOTIFICATION_PRICE_MISSING_COPY);
        expect(out).not.toMatch(/--/);
        expect(out).not.toMatch(/NaN/i);
      },
    );

    it.each(BAD_INPUTS)(
      "returns the friendly fallback (never `--`) when the high bound is %s",
      (_label, value) => {
        const out = notificationPriceRange(50, value);
        expect(out).toBe(NOTIFICATION_PRICE_MISSING_COPY);
        expect(out).not.toMatch(/--/);
        expect(out).not.toMatch(/NaN/i);
      },
    );

    it("respects a custom placeholder override", () => {
      expect(notificationPriceRange(null, 100, { placeholder: "TBD" })).toBe("TBD");
    });
  });

  describe("happy-path formatting parity with safePrice", () => {
    // Valid inputs must round-trip through the wrapper unchanged so the
    // notification helper is a drop-in replacement at every call site —
    // only the missing-value branch differs.
    it("formats a positive whole-dollar value", () => {
      expect(notificationPrice(42)).toBe("$42");
    });

    it("formats a positive cent amount in whole dollars", () => {
      expect(notificationPriceCents(2500)).toBe("$25");
    });

    it("formats a positive cent amount with two decimals", () => {
      expect(notificationPriceCentsExact(149)).toBe("$1.49");
      expect(notificationPriceCentsExact(99950)).toBe("$999.50");
    });

    it("formats positive dollars with two decimals", () => {
      expect(notificationPriceExact(49)).toBe("$49.00");
    });

    it("formats a positive range with the en-dash separator", () => {
      expect(notificationPriceRange(50, 100)).toBe("$50 – $100");
    });
  });

  describe("composed inside an outbound message body", () => {
    // End-to-end style: build the same shape of string that
    // server/routes.ts and server/nudgeGenerator.ts produce and prove
    // the body never contains `"--"` for any missing input.
    const bodyForInvoice = (cents: unknown) =>
      `Your invoice for water heater repair is ${notificationPriceCentsExact(cents)}.`;

    const bodyForEstimate = (low: unknown, high: unknown) =>
      `Your provider has prepared an estimate of ${notificationPriceRange(low, high)}.`;

    const bodyForReminder = (dollars: unknown) =>
      `Just a friendly reminder about invoice #42 for ${notificationPriceExact(dollars)}.`;

    it.each(BAD_INPUTS)(
      "invoice body never contains `--` when cents is %s",
      (_label, value) => {
        const body = bodyForInvoice(value);
        expect(body).not.toMatch(/--/);
        expect(body).not.toMatch(/\$NaN/i);
        expect(body).not.toMatch(/undefined/i);
        expect(body).toContain(NOTIFICATION_PRICE_MISSING_COPY);
      },
    );

    it.each(BAD_INPUTS)(
      "estimate body never contains `--` when low bound is %s",
      (_label, value) => {
        const body = bodyForEstimate(value, 250);
        expect(body).not.toMatch(/--/);
        expect(body).toContain(NOTIFICATION_PRICE_MISSING_COPY);
      },
    );

    it.each(BAD_INPUTS)(
      "reminder body never contains `--` when amount is %s",
      (_label, value) => {
        const body = bodyForReminder(value);
        expect(body).not.toMatch(/--/);
        expect(body).not.toMatch(/\$NaN/i);
        expect(body).toContain(NOTIFICATION_PRICE_MISSING_COPY);
      },
    );

    it("renders cleanly for a valid cent amount inside the body", () => {
      // Sanity: the helper still produces a valid `$X.YY` for a
      // positive value, so a happy-path body reads the way the spec
      // describes ("...is $74.99.") rather than the fallback copy.
      expect(bodyForInvoice(7499)).toBe(
        "Your invoice for water heater repair is $74.99.",
      );
      expect(bodyForInvoice(7499)).not.toContain(NOTIFICATION_PRICE_MISSING_COPY);
    });
  });
});
