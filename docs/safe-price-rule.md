# Safe Price Rule

All currency / price values rendered in the client **and** all prices
embedded in server-rendered notifications (SMS bodies, email bodies, webhook
payloads, push copy, AI prompts, log messages, etc.) must go through the
helpers exported from `shared/safePrice.ts` (re-exported as
`client/src/lib/safePrice.ts` for the client). This rule prevents bugs like
`$NaN`, `$undefined`, `$Infinity`, or `$0.00` slipping into a customer's UI,
text message, or email when the underlying value is missing or non-finite.

A bug in a UI surface is annoying but visible — a bug in an outbound SMS or
email is much harder to catch (the customer sees `$NaN` and the team only
finds out via a support ticket). The scanner therefore covers both the
client and the server.

## The Rule

Inside `client/src/**/*.{ts,tsx}`, `server/**/*.{ts,tsx}`,
`shared/**/*.{ts,tsx}`, `reports/**/*.{ts,tsx}`, and
`exports/**/*.{ts,tsx}` (excluding the helper sources
`client/src/lib/safePrice.ts` and `shared/safePrice.ts`), none of the
following patterns are allowed:

1. **Raw `` `$${...}` `` template literals.** Anywhere a price is built into a
   string, use the appropriate helper instead of prefixing `$` yourself.
2. **JSX text that ends in `$` immediately before a `{...}` expression.** Wrap
   the whole formatted price in a single JSX expression returned by the helper.
3. **String concatenation that prefixes `$`** — `"$" + value`,
   `"Price: $" + value`, etc.
4. **Array `join` of a `$` literal** — e.g. `["$", value].join("")`.

A Jest test (`tests/lib/noRawPriceTemplates.test.ts`) walks every TS/TSX file
under `client/src`, `server/`, `shared/`, `reports/`, and `exports/` with
`@typescript-eslint/typescript-estree` and fails CI if any of these patterns
appears. There is one separate `it(...)` block per directory so the failure
log clearly identifies which surface (`client/src`, `server/`, `shared/`,
`reports/`, or `exports/`) introduced the violation. `reports/` and
`exports/` may currently hold zero TS/TSX files (they store generated
JSON / PNG artifacts today); the gate tolerates the empty case but still
rejects any future invoice / accountant / printable-document builder added
under those roots — see "Printable documents (PDF / CSV exports)" below.

The scanner is wired into the `safe-price-scan` validation command, which
acts as a pre-merge gate — a failing scan blocks the task from being marked
complete and the offending file/line is printed in the run log.

A complementary ESLint rule (`eslint-rules/no-raw-price-format.cjs`,
registered as `safe-price/no-raw-price-format` in
`eslint.safeprice.config.js`) enforces the same patterns at lint time across
`client/src/**`, `server/**`, `shared/**`, `reports/**`, and `exports/**`,
and is wired into the `safe-price-eslint` validation command for redundant
pre-merge enforcement. The ESLint glob is invoked with
`--no-error-on-unmatched-pattern` so that empty `reports/` / `exports/`
directories do not flap the gate while still gating any TS/TSX file later
added there.

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

### Server-side notification templates

Outbound SMS bodies, email bodies, push notifications, AI prompts, and webhook
payload strings live in `server/` (e.g. `server/routes.ts`,
`server/nudgeGenerator.ts`, `server/postJobMomentum.ts`,
`server/admin/*Routes.ts`). Build their price strings the same way as the
client, importing from `@shared/safePrice`:

```ts
import {
  safePriceCentsExact,
  safePriceRange,
  safePriceLocale,
} from "@shared/safePrice";

// Twilio SMS body
const message =
  `Hi ${clientName}, your invoice for ${serviceType} is ` +
  `${safePriceCentsExact(invoice.amount)}. Pay here: ${invoiceUrl}`;

// SendGrid email body
await sendEmail({
  to: client.email,
  subject: `Estimate from ${businessName}`,
  text: `Estimated total: ${safePriceRange(low, high)}.`,
});
```

Do **not** build these strings as `` `... $${value} ...` `` or
`"$" + value`. Even if upstream code looks safe today, a missing field or a
bad cast can ship `$NaN` directly to a customer's phone, and the scanner is
the only thing standing between that bug and an outbound message.

The scanner enforces the same rules in `server/` as it does in `client/src/`,
and the test suite locks in dedicated regression coverage for SMS / email
template paths (synthetic violations are written into `server/` to confirm
they get caught).

### Printable documents (PDF / CSV exports)

Invoices, receipts, accountant exports, and any other downloadable artifact
(PDF rows, CSV cells, printable HTML, etc.) follow the same rule as outbound
SMS / email: build every price string through the safePrice helpers from
`@shared/safePrice`. A `$NaN` baked into a downloaded invoice ships out the
door without anyone noticing until a customer escalates, so the gate covers
PDF / CSV builders specifically:

- The Jest scanner walks `server/**`, `reports/**`, and `exports/**` (the
  three directories where printable-document builders live or could live)
  and rejects raw-`$` template literals, `"$" + value` concatenation, and
  array-`join` `$` patterns inside any `.ts` / `.tsx` builder it finds.
- Dedicated regression tests in `tests/lib/noRawPriceTemplates.test.ts`
  write synthetic PDF / CSV builders (template-literal, string concat, and
  array-`join` shapes) into `server/`, `reports/`, and `exports/` and
  assert the scanner picks them up. A negative case proves a builder that
  uses `safePriceCentsExact(...)` is **not** flagged.
- The ESLint rule applies to the same set of paths so the redundant
  pre-merge enforcement catches the same shapes at lint time.

Build PDF / CSV cells the same way you would build a Twilio SMS body:

```ts
import { safePriceCentsExact } from "@shared/safePrice";

// PDF row
doc.text(`Total due: ${safePriceCentsExact(invoice.amountCents)}`);

// CSV amount cell
const cell = safePriceCentsExact(invoice.amountCents);
res.write([invoice.id, customerName, cell].map(csvEscape).join(",") + "\n");
```

Do **not** write `` `Total due: $${(amountCents / 100).toFixed(2)}` `` or
`"$" + amount` inside a PDF / CSV builder. Even if the upstream value looks
safe today, a missing field or a bad cast can ship `$NaN` straight into a
customer's downloaded invoice.

### Custom placeholder

If your UI needs a non-default placeholder (e.g. an empty string while a
draft is being edited), pass `placeholder`:

```ts
safePriceCents(cents, { placeholder: "" });
safePriceCents(cents, { placeholder: "N/A" });
```

## How to extend

If you find yourself reaching for a new format, add a new helper to
`shared/safePrice.ts` (with unit tests in `tests/lib/safePrice.test.ts`) so
that both the client and the server pick it up automatically — never
re-introduce raw `$` concatenation in either surface. The helper should:

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

## Pre-merge enforcement

The same scanner is registered as the `safe-price-scan` validation command,
and the matching ESLint rule is registered as the `safe-price-eslint`
validation command. Both run automatically before a task can be merged and
cover `client/src/**`, `server/**`, `shared/**`, `reports/**`, and
`exports/**`. If any file (UI component, SMS template, email body, AI
prompt, log line, PDF row, CSV cell, etc.) introduces a raw `$` price
pattern the scan fails, the merge is blocked, and the offending
file/line/snippet appears in the validation log.

## Pre-push and CI enforcement (Task #172)

The validation workflows only fire inside the editor / agent. To catch a
regression no matter who pushes, both gates also run:

1. **Pre-push git hook** — `scripts/git-hooks/pre-push` calls
   `scripts/safe-price-checks.sh`, which runs the standalone ESLint config
   (`eslint.safeprice.config.js`) and the Jest scanner
   (`noRawPriceTemplates`) back-to-back. The hook is wired up by
   `scripts/install-git-hooks.sh`, which sets
   `git config core.hooksPath scripts/git-hooks`. The post-merge script
   (`scripts/post-merge.sh`) runs the installer after every task merge so
   contributors don't have to remember.

   To install manually after a fresh clone:

   ```sh
   ./scripts/install-git-hooks.sh
   ```

2. **GitHub Actions** — `.github/workflows/safe-price.yml` runs the same
   `scripts/safe-price-checks.sh` on every `push` and `pull_request`. The
   PR cannot be merged if either gate fails.

### Bypassing the hook (emergencies only)

Both bypass mechanisms exist for genuine emergencies (e.g. shipping a hotfix
when the scan tripped on a known false positive that's already being fixed
in another PR). Don't use them to ship real raw-`$` patterns — CI will
still block the PR.

```sh
# Skip the hook for one push:
SKIP_SAFE_PRICE=1 git push

# Or, equivalently (skips ALL local hooks):
git push --no-verify
```

There is no way to bypass the GitHub Actions check without re-running it
green — that is intentional, since the hook is the developer's safety net
and CI is the team's.
