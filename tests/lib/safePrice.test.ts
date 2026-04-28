// Regression coverage for the safePrice helpers (Tasks #138 / #142).
// These helpers underpin every $-formatted surface in the app, so a
// regression here is what would re-introduce "$NaN" / blank prices in
// 20+ user-facing places. The matrix below pins down every "bad input"
// the helpers are meant to absorb (null/undefined/NaN/Infinity/0/neg/
// non-numeric strings) and confirms the placeholder is returned instead
// of a $NaN-style string.
import {
  safePrice,
  safePriceCents,
  safePriceRange,
  safePriceRangeString,
  isFinitePositiveNumber,
  isFiniteNumber,
} from "@/lib/safePrice";

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
];

describe("safePrice", () => {
  it.each(BAD_INPUTS)(
    "returns the default placeholder for %s",
    (_label, value) => {
      const out = safePrice(value);
      expect(out).toBe("--");
      expect(out).not.toMatch(/NaN/i);
      expect(out).not.toMatch(/undefined/i);
    },
  );

  it("returns the placeholder for 0", () => {
    // 0 is treated as "no meaningful price" — surfaces should show "--"
    // rather than "$0", which historically masked missing data.
    expect(safePrice(0)).toBe("--");
  });

  it("returns the placeholder for negative numbers", () => {
    expect(safePrice(-5)).toBe("--");
    expect(safePrice(-0.01)).toBe("--");
  });

  it("formats positive integers with a dollar sign", () => {
    expect(safePrice(1)).toBe("$1");
    expect(safePrice(42)).toBe("$42");
    expect(safePrice(1000)).toBe("$1000");
  });

  it("rounds positive decimals to the nearest whole dollar", () => {
    expect(safePrice(9.49)).toBe("$9");
    expect(safePrice(9.5)).toBe("$10");
    expect(safePrice(99.99)).toBe("$100");
  });

  it("parses numeric strings as numbers", () => {
    expect(safePrice("125")).toBe("$125");
    expect(safePrice("  42.6  ")).toBe("$43");
  });

  it("respects a custom placeholder", () => {
    expect(safePrice(null, { placeholder: "TBD" })).toBe("TBD");
    expect(safePrice(NaN, { placeholder: "" })).toBe("");
  });
});

describe("safePriceCents", () => {
  it.each(BAD_INPUTS)(
    "returns the default placeholder for %s",
    (_label, value) => {
      const out = safePriceCents(value);
      expect(out).toBe("--");
      expect(out).not.toMatch(/NaN/i);
    },
  );

  it("returns the placeholder for 0 and negative cents", () => {
    expect(safePriceCents(0)).toBe("--");
    expect(safePriceCents(-1500)).toBe("--");
  });

  it("formats positive cent amounts in whole dollars", () => {
    expect(safePriceCents(100)).toBe("$1");
    expect(safePriceCents(1500)).toBe("$15");
    expect(safePriceCents(99950)).toBe("$1000");
  });

  it("rounds the dollar conversion to the nearest whole dollar", () => {
    // 149 cents -> $1.49 -> rounds to $1
    expect(safePriceCents(149)).toBe("$1");
    // 150 cents -> $1.50 -> rounds to $2
    expect(safePriceCents(150)).toBe("$2");
  });

  it("parses numeric string cent values", () => {
    expect(safePriceCents("2500")).toBe("$25");
  });

  it("respects a custom placeholder", () => {
    expect(safePriceCents(undefined, { placeholder: "—" })).toBe("—");
  });
});

describe("safePriceRange", () => {
  it("returns the placeholder when either bound is missing", () => {
    expect(safePriceRange(null, 100)).toBe("--");
    expect(safePriceRange(50, undefined)).toBe("--");
    expect(safePriceRange(null, null)).toBe("--");
  });

  it("returns the placeholder when either bound is non-finite", () => {
    expect(safePriceRange(NaN, 100)).toBe("--");
    expect(safePriceRange(50, Infinity)).toBe("--");
    expect(safePriceRange(-Infinity, 100)).toBe("--");
  });

  it("returns the placeholder when either bound is non-positive", () => {
    expect(safePriceRange(0, 100)).toBe("--");
    expect(safePriceRange(50, 0)).toBe("--");
    expect(safePriceRange(-10, 100)).toBe("--");
    expect(safePriceRange(50, -10)).toBe("--");
  });

  it("formats both bounds with rounded dollars and an en-dash separator", () => {
    expect(safePriceRange(50, 100)).toBe("$50 – $100");
    expect(safePriceRange(50.4, 100.6)).toBe("$50 – $101");
  });

  it("accepts numeric string bounds", () => {
    expect(safePriceRange("75", "150")).toBe("$75 – $150");
  });

  it("respects a custom placeholder", () => {
    expect(safePriceRange(null, 100, { placeholder: "n/a" })).toBe("n/a");
  });
});

describe("safePriceRangeString", () => {
  it("returns the placeholder for non-string input", () => {
    expect(safePriceRangeString(null)).toBe("--");
    expect(safePriceRangeString(undefined)).toBe("--");
    expect(safePriceRangeString(123)).toBe("--");
  });

  it("returns the placeholder for empty / whitespace strings", () => {
    expect(safePriceRangeString("")).toBe("--");
    expect(safePriceRangeString("   ")).toBe("--");
  });

  it("returns the placeholder when the string contains $NaN/undefined/null", () => {
    expect(safePriceRangeString("$NaN")).toBe("--");
    expect(safePriceRangeString("$50 – $NaN")).toBe("--");
    expect(safePriceRangeString("$undefined")).toBe("--");
    expect(safePriceRangeString("$null")).toBe("--");
  });

  it("returns the placeholder when no $-numbers can be parsed", () => {
    expect(safePriceRangeString("call for pricing")).toBe("--");
  });

  it("returns the placeholder when any parsed amount is non-positive", () => {
    expect(safePriceRangeString("$0 – $100")).toBe("--");
    expect(safePriceRangeString("$-5 – $100")).toBe("--");
  });

  it("preserves a valid pre-formatted price range string", () => {
    expect(safePriceRangeString("$50 – $100")).toBe("$50 – $100");
    expect(safePriceRangeString("starting at $99")).toBe("starting at $99");
  });
});

describe("isFinitePositiveNumber", () => {
  it.each(BAD_INPUTS)("returns false for %s", (_label, value) => {
    expect(isFinitePositiveNumber(value)).toBe(false);
  });

  it("returns false for 0 and negative values", () => {
    expect(isFinitePositiveNumber(0)).toBe(false);
    expect(isFinitePositiveNumber(-1)).toBe(false);
    expect(isFinitePositiveNumber("-5")).toBe(false);
  });

  it("returns true for positive finite numbers", () => {
    expect(isFinitePositiveNumber(0.0001)).toBe(true);
    expect(isFinitePositiveNumber(1)).toBe(true);
    expect(isFinitePositiveNumber(1_000_000)).toBe(true);
  });

  it("returns true for positive numeric strings", () => {
    expect(isFinitePositiveNumber("42")).toBe(true);
    expect(isFinitePositiveNumber(" 7.5 ")).toBe(true);
  });
});

describe("isFiniteNumber", () => {
  it.each(BAD_INPUTS)("returns false for %s", (_label, value) => {
    expect(isFiniteNumber(value)).toBe(false);
  });

  it("returns true for 0 and negative finite numbers (zero/negative IS finite)", () => {
    // Distinct from isFinitePositiveNumber: this guard only checks
    // finiteness, not sign.
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-100)).toBe(true);
    expect(isFiniteNumber("-3.14")).toBe(true);
  });

  it("returns true for positive finite numbers", () => {
    expect(isFiniteNumber(123.456)).toBe(true);
    expect(isFiniteNumber("42")).toBe(true);
  });
});
