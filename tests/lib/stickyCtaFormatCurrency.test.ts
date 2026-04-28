// formatCurrency is the cents-in / "$X" formatter used by the sticky
// CTA bar. Without this guard, "$NaN" would land on the most prominent
// CTA on the home screen the moment the moneyWaiting query returned a
// nullish value — exactly the bug Tasks #138 / #142 were chartered to
// kill. This file pins the null/undefined/NaN/Infinity branches.
import { formatCurrency } from "@/lib/stickyCta";

describe("formatCurrency", () => {
  it("returns the placeholder for null", () => {
    expect(formatCurrency(null)).toBe("--");
  });

  it("returns the placeholder for undefined", () => {
    expect(formatCurrency(undefined)).toBe("--");
  });

  it("returns the placeholder for NaN", () => {
    expect(formatCurrency(NaN)).toBe("--");
  });

  it("returns the placeholder for Infinity", () => {
    expect(formatCurrency(Infinity)).toBe("--");
    expect(formatCurrency(-Infinity)).toBe("--");
  });

  it("formats 0 cents as $0 (zero IS a finite, displayable amount here)", () => {
    // Note: unlike safePriceCents, formatCurrency renders $0 because
    // the sticky CTA only invokes it once moneyWaiting > 0. Pin the
    // observed behaviour so future refactors can't quietly switch it.
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats positive cent amounts as whole-dollar USD with no decimals", () => {
    expect(formatCurrency(100)).toBe("$1");
    expect(formatCurrency(1500)).toBe("$15");
    expect(formatCurrency(123456)).toBe("$1,235");
  });

  it("formats negative cent amounts with a leading minus sign", () => {
    // Negatives are finite — they pass the guard and Intl renders the
    // minus. This is observed behaviour worth pinning so any future
    // "absorb negatives" refactor would have to update the test.
    expect(formatCurrency(-100)).toBe("-$1");
  });

  it("never returns a string containing 'NaN' for any guarded input", () => {
    for (const bad of [null, undefined, NaN, Infinity, -Infinity] as const) {
      expect(formatCurrency(bad)).not.toMatch(/NaN/i);
    }
  });
});
