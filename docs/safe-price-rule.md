# Safe Price Rule

All currency / price values rendered in the client must go through the helpers
exported from `client/src/lib/safePrice.ts`. This rule prevents bugs like
`$NaN`, `$undefined`, `$Infinity`, or `$0.00` slipping into the UI when the
underlying value is missing or non-finite.

## The Rule

Inside `client/src/**/*.{ts,tsx}` (excluding `client/src/lib/safePrice.ts`),
none of the following patterns are allowed:

1. **Raw `` `$${...}` `` template literals.** Anywhere a price is built into a
   string, use the appropriate helper instead of prefixing `$` yourself.
2. **JSX text that ends in `$` immediately before a `{...}` expression.** Wrap
   the whole formatted price in a single JSX expression returned by the helper.
3. **String concatenation that prefixes `$`** — `"$" + value`,
   `"Price: $" + value`, etc.
4. **Array `join` of a `$` literal** — e.g. `["$", value].join("")`.

A Jest test (`tests/lib/noRawPriceTemplates.test.ts`) walks every client TS/TSX
file with `@typescript-eslint/typescript-estree` and fails CI if any of these
patterns appears.

## Helpers

All helpers return the placeholder (default `"--"`) when the input is missing,
non-finite, or non-positive (so prices like `$0.00` are not surfaced to users
when the input was actually invalid).

| Helper | Input | Output | Use when |
| --- | --- | --- | --- |
| `safePrice(dollars)` | dollars (number / numeric string) | `"$120"` (no decimals if integer, otherwise locale-formatted) | Generic dollar amount |
| `safePriceExact(dollars)` | dollars | `"$120.00"` (always 2 decimals) | Subscription / plan prices that must show cents |
| `safePriceCents(cents)` | cents | `"$120"` (rounded to dollar) | Whole-dollar display from cents |
| `safePriceCentsExact(cents)` | cents | `"$120.00"` (always 2 decimals) | Invoices, deposits, agreed prices from cents |
| `safePriceCentsLocale(cents, opts?)` | cents | `"$1,234"` / `"$1,234.56"` | Large currency values that need grouping (admin dashboards) |
| `safePriceRange(low, high)` | dollars | `"$100 – $200"` or single value | Price ranges |
| `formatCurrency(value, opts?)` | dollars | locale-formatted string | Custom locale / currency code |

`isFinitePositiveNumber(v)` is exported as the underlying validator if you need
to branch before formatting.

### Common patterns

```tsx
// Whole-dollar from cents
<span>{safePriceCents(template.defaultPriceCents)}</span>

// Two-decimal from cents
<span>{safePriceCentsExact(invoice.amount)}</span>

// Plan price in dollars
<span>{safePriceExact(PLAN_PRICES_DOLLARS[Plan.PRO])}/month</span>

// Toast string
toast({ title: `Suggested price: ${safePrice(dollars)}` });

// Locale-formatted (admin)
const formatCurrency = (cents: number | null | undefined) =>
  safePriceCentsLocale(cents, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

### Custom placeholder

If your UI needs a non-default placeholder (e.g. an empty string while a
draft is being edited), pass `placeholder`:

```ts
safePriceCents(cents, { placeholder: "" });
safePriceCents(cents, { placeholder: "N/A" });
```

## How to extend

If you find yourself reaching for a new format, add a new helper to
`client/src/lib/safePrice.ts` (with unit tests in
`tests/lib/safePrice.test.ts`) rather than re-introducing raw `$`
concatenation. The helper should:

1. Validate the input with `isFinitePositiveNumber` (or an explicit reason if
   you intentionally want to allow zero / negative values).
2. Return the placeholder string on invalid input.
3. Always render the `$` prefix itself, so the call site never has to.

## Why

- `(value / 100).toFixed(2)` on `null` / `undefined` / `NaN` produces strings
  like `"NaN"`, `"$NaN"`, `"$undefined"` in the UI.
- Different parts of the app used different formats (`toFixed(0)`,
  `toFixed(2)`, `toLocaleString()`), making it hard to audit price formatting.
- Centralizing the formatting + validation makes it safe to render any
  payment-related number from any source (server, draft form, optimistic
  update) without crashing or showing garbage.

## Enforcement

Run the rule locally:

```sh
npx jest --selectProjects lib --testPathPatterns noRawPriceTemplates --no-cache
```

The test will print every offending file, line, and snippet. Migrate the call
to the appropriate helper, then re-run.
