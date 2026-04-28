type SafePriceOpts = { placeholder?: string };

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
