export interface FormatCurrencyOptions {
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  placeholder?: string;
  locale?: string;
}

export function formatCurrency(
  cents: number | null | undefined,
  opts: FormatCurrencyOptions = {},
): string {
  const placeholder = opts.placeholder ?? "--";
  if (cents == null || !Number.isFinite(cents)) return placeholder;

  const intlOpts: Intl.NumberFormatOptions = {
    style: "currency",
    currency: (opts.currency ?? "USD").toUpperCase(),
  };

  const hasDigitOption =
    opts.minimumFractionDigits !== undefined ||
    opts.maximumFractionDigits !== undefined;

  if (hasDigitOption) {
    if (opts.minimumFractionDigits !== undefined) {
      intlOpts.minimumFractionDigits = opts.minimumFractionDigits;
    }
    if (opts.maximumFractionDigits !== undefined) {
      intlOpts.maximumFractionDigits = opts.maximumFractionDigits;
    }
  } else if (opts.currency === undefined) {
    intlOpts.minimumFractionDigits = 0;
    intlOpts.maximumFractionDigits = 0;
  }

  return new Intl.NumberFormat(opts.locale ?? "en-US", intlOpts).format(
    cents / 100,
  );
}
