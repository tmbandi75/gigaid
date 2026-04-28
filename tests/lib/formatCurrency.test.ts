// Regression coverage for the canonical cents-in currency formatter
// at client/src/lib/formatCurrency.ts (Task #166). Now that 25+ price
// surfaces flow through this single helper, a quiet refactor here would
// re-introduce "$NaN" / "$undefined" displays everywhere at once. The
// matrix below pins down the null/undefined/NaN safety, the placeholder
// override, and the currency / locale / fraction-digit option branches
// so any future change has to update the test on the way through.
import { formatCurrency } from "@/lib/formatCurrency";

describe("formatCurrency — placeholder safety for nullish / non-finite input", () => {
  it("returns the default '--' placeholder for null", () => {
    expect(formatCurrency(null)).toBe("--");
  });

  it("returns the default '--' placeholder for undefined", () => {
    expect(formatCurrency(undefined)).toBe("--");
  });

  it("returns the default '--' placeholder for NaN", () => {
    // The whole reason this helper exists: never let "$NaN" reach the
    // DOM. If this assertion ever flips, the $NaN bug is back.
    expect(formatCurrency(NaN)).toBe("--");
  });

  it("returns the default '--' placeholder for Infinity / -Infinity", () => {
    // Number.isFinite rejects ±Infinity, so they take the placeholder
    // branch alongside NaN. Pinned so a future `Number.isNaN`-only
    // guard wouldn't silently let "$∞" through.
    expect(formatCurrency(Infinity)).toBe("--");
    expect(formatCurrency(-Infinity)).toBe("--");
  });

  it("never returns a string containing 'NaN' / 'undefined' for any guarded input", () => {
    for (const bad of [null, undefined, NaN, Infinity, -Infinity] as const) {
      const out = formatCurrency(bad);
      expect(out).not.toMatch(/NaN/i);
      expect(out).not.toMatch(/undefined/i);
    }
  });
});

describe("formatCurrency — placeholder option", () => {
  it("uses '--' as the default placeholder", () => {
    expect(formatCurrency(null)).toBe("--");
  });

  it("respects a custom non-empty placeholder ('N/A')", () => {
    expect(formatCurrency(null, { placeholder: "N/A" })).toBe("N/A");
    expect(formatCurrency(undefined, { placeholder: "N/A" })).toBe("N/A");
    expect(formatCurrency(NaN, { placeholder: "N/A" })).toBe("N/A");
  });

  it("respects an empty-string placeholder ('')", () => {
    // Empty string is intentionally allowed: some surfaces want to hide
    // the value entirely instead of showing "--". Use `??` semantics so
    // "" is preserved rather than falling back to the default.
    expect(formatCurrency(null, { placeholder: "" })).toBe("");
    expect(formatCurrency(undefined, { placeholder: "" })).toBe("");
    expect(formatCurrency(NaN, { placeholder: "" })).toBe("");
  });

  it("does not apply the placeholder to a finite amount (including 0)", () => {
    // 0 is a legitimate amount here — the placeholder branch must only
    // fire for nullish / non-finite inputs.
    expect(formatCurrency(0, { placeholder: "N/A" })).toBe("$0");
    expect(formatCurrency(100, { placeholder: "N/A" })).toBe("$1");
  });
});

describe("formatCurrency — finite numeric input", () => {
  it("formats 0 cents as '$0' (zero IS a displayable amount)", () => {
    // Default min/max fraction digits are 0 when no currency / digit
    // override is given, so 0 / 100 renders as "$0" not "$0.00".
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats positive integer cent amounts in whole-dollar USD", () => {
    expect(formatCurrency(100)).toBe("$1");
    expect(formatCurrency(1500)).toBe("$15");
    expect(formatCurrency(99950)).toBe("$1,000");
    expect(formatCurrency(123456)).toBe("$1,235");
  });

  it("rounds decimal cent amounts to the nearest whole dollar by default", () => {
    // 149 cents -> $1.49 -> rounds down to $1
    expect(formatCurrency(149)).toBe("$1");
    // 150 cents -> $1.50 -> banker's-rounds up to $2 in en-US
    expect(formatCurrency(150)).toBe("$2");
    // 12345 cents -> $123.45 -> rounds to $123
    expect(formatCurrency(12345)).toBe("$123");
  });

  it("formats negative cent amounts with a leading minus sign", () => {
    // Negatives are finite, so they pass the guard and Intl renders
    // the minus. Pin the observed behaviour so a future "absorb
    // negatives" refactor would have to update the test.
    expect(formatCurrency(-100)).toBe("-$1");
    expect(formatCurrency(-12345)).toBe("-$123");
  });
});

describe("formatCurrency — currency option", () => {
  it("defaults to USD when no currency is provided", () => {
    expect(formatCurrency(100)).toBe("$1");
  });

  it("upper-cases lowercase currency codes before passing to Intl", () => {
    // Intl.NumberFormat throws on lowercase currency codes in older
    // engines; the helper normalises to uppercase to stay safe.
    expect(formatCurrency(100, { currency: "usd" })).toBe("$1.00");
    expect(formatCurrency(100, { currency: "eur" })).toBe("€1.00");
  });

  it("uses Intl's natural fraction digits when currency is set explicitly", () => {
    // Important asymmetry: passing `currency` (even "USD") opts out of
    // the implicit "whole-dollar" formatting and lets Intl pick the
    // currency's natural fraction-digit count. USD/EUR -> 2, JPY -> 0.
    expect(formatCurrency(100, { currency: "USD" })).toBe("$1.00");
    expect(formatCurrency(100, { currency: "EUR" })).toBe("€1.00");
    expect(formatCurrency(100, { currency: "JPY" })).toBe("¥1");
  });

  it("formats GBP with the £ symbol", () => {
    expect(formatCurrency(100, { currency: "GBP", locale: "en-GB" })).toBe(
      "£1.00",
    );
  });
});

describe("formatCurrency — locale option", () => {
  it("defaults to en-US when no locale is provided", () => {
    // en-US uses "$" as the symbol and "," as the thousands separator.
    expect(formatCurrency(123456)).toBe("$1,235");
  });

  it("renders the EUR amount using de-DE conventions", () => {
    // de-DE puts the symbol after the amount and uses "," as the
    // decimal separator. The non-breaking space between number and
    // symbol is what Intl emits, so we match it via a regex on the
    // currency portion to stay robust to ICU whitespace changes.
    const out = formatCurrency(100, { locale: "de-DE", currency: "EUR" });
    expect(out).toMatch(/^1,00\s?€$/);
  });

  it("renders the EUR amount using fr-FR conventions", () => {
    const out = formatCurrency(100, { locale: "fr-FR", currency: "EUR" });
    expect(out).toMatch(/^1,00\s?€$/);
  });
});

describe("formatCurrency — fraction-digit options", () => {
  it("honors minimumFractionDigits + maximumFractionDigits = 2 (penny precision)", () => {
    expect(
      formatCurrency(149, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ).toBe("$1.49");
    expect(
      formatCurrency(12345, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ).toBe("$123.45");
  });

  it("honors maximumFractionDigits in isolation (rounding cap, no padding)", () => {
    // Only maximum is set: no zero-padding, but Intl rounds to the cap.
    expect(formatCurrency(149, { maximumFractionDigits: 0 })).toBe("$1");
    expect(formatCurrency(149, { maximumFractionDigits: 1 })).toBe("$1.5");
    expect(formatCurrency(12345, { maximumFractionDigits: 2 })).toBe("$123.45");
  });

  it("honors minimumFractionDigits in isolation (zero-padding, no cap)", () => {
    // Only minimum is set: Intl pads up to the floor and keeps any
    // additional precision the value carries.
    expect(formatCurrency(100, { minimumFractionDigits: 2 })).toBe("$1.00");
    expect(formatCurrency(12345, { minimumFractionDigits: 2 })).toBe("$123.45");
  });

  it("falls back to whole-dollar formatting only when no digit option AND no currency override is given", () => {
    // The helper's "whole dollars by default" branch only fires when
    // BOTH the digit options AND the currency option are unset. Pin
    // each combination so the precedence rules can't drift.
    expect(formatCurrency(149)).toBe("$1");
    expect(formatCurrency(149, { currency: "USD" })).toBe("$1.49");
    expect(formatCurrency(149, { maximumFractionDigits: 2 })).toBe("$1.49");
    expect(
      formatCurrency(149, {
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    ).toBe("$1");
  });

  it("combines locale + currency + fraction-digit overrides", () => {
    // Sanity-check that all three options compose: de-DE locale, EUR
    // currency, explicit 2-digit precision.
    const out = formatCurrency(12345, {
      locale: "de-DE",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(out).toMatch(/^123,45\s?€$/);
  });
});
