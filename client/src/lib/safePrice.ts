type SafePriceOpts = { placeholder?: string };

type SafePriceLocaleOpts = SafePriceOpts & {
  locale?: string | string[];
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

const DEFAULT_PLACEHOLDER = "--";

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function safePrice(value: unknown, opts: SafePriceOpts = {}): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  const num = toFiniteNumber(value);
  if (num === null || num <= 0) return placeholder;
  return `$${Math.round(num)}`;
}

export function safePriceCents(cents: unknown, opts: SafePriceOpts = {}): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  const num = toFiniteNumber(cents);
  if (num === null || num <= 0) return placeholder;
  return `$${Math.round(num / 100)}`;
}

export function safePriceRange(
  low: unknown,
  high: unknown,
  opts: SafePriceOpts = {},
): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  const lowNum = toFiniteNumber(low);
  const highNum = toFiniteNumber(high);
  if (lowNum === null || highNum === null) return placeholder;
  if (lowNum <= 0 || highNum <= 0) return placeholder;
  return `$${Math.round(lowNum)} – $${Math.round(highNum)}`;
}

/**
 * Formats a dollar amount with exactly two decimal places (e.g. "$49.00").
 * Use this for surfaces that need two-decimal precision (plan prices,
 * deposit amounts already-in-dollars). Returns the placeholder for any
 * non-finite / non-positive input so "$NaN" can never escape.
 */
export function safePriceExact(value: unknown, opts: SafePriceOpts = {}): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  const num = toFiniteNumber(value);
  if (num === null || num <= 0) return placeholder;
  return `$${num.toFixed(2)}`;
}

/**
 * Cents → "$X.YY" (two decimals). Use for deposit/invoice/referral
 * surfaces that need penny precision.
 */
export function safePriceCentsExact(cents: unknown, opts: SafePriceOpts = {}): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  const num = toFiniteNumber(cents);
  if (num === null || num <= 0) return placeholder;
  return `$${(num / 100).toFixed(2)}`;
}

/**
 * Cents → locale-formatted "$X,XXX[.YY]" using Intl thousands grouping.
 * Defaults to whole dollars (no decimals); pass `minimumFractionDigits`
 * / `maximumFractionDigits` for penny precision (admin billing).
 */
export function safePriceCentsLocale(
  cents: unknown,
  opts: SafePriceLocaleOpts = {},
): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  const num = toFiniteNumber(cents);
  if (num === null || num <= 0) return placeholder;
  const formatted = (num / 100).toLocaleString(opts.locale, {
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  });
  return `$${formatted}`;
}

export function isFinitePositiveNumber(value: unknown): boolean {
  const num = toFiniteNumber(value);
  return num !== null && num > 0;
}

export function isFiniteNumber(value: unknown): boolean {
  return toFiniteNumber(value) !== null;
}

export function safePriceRangeString(value: unknown, opts: SafePriceOpts = {}): string {
  const placeholder = opts.placeholder ?? DEFAULT_PLACEHOLDER;
  if (typeof value !== "string") return placeholder;
  const trimmed = value.trim();
  if (!trimmed) return placeholder;
  if (/\$NaN|undefined|null/i.test(trimmed)) return placeholder;
  const numbers = trimmed.match(/-?\$-?\d+(?:\.\d+)?/g) || [];
  if (numbers.length === 0) return placeholder;
  for (const n of numbers) {
    const cleaned = n.replace(/\$/g, "");
    const parsed = parseFloat(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0) return placeholder;
  }
  return trimmed;
}
