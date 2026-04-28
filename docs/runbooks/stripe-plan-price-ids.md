# Runbook: Stripe plan price ID env vars

## TL;DR

Admin plan changes (`billing_upgrade` / `billing_downgrade` in
`POST /api/admin/users/:userId/action`) only accept Stripe price IDs that
match one of the env vars listed below. If a given environment doesn't
have these set, every plan-change attempt for that environment fails
with `400 Unknown price ID` and the audit log records nothing useful.

The validator lives in `server/billing/plans.ts`
(`isKnownPlanPriceId`) and is invoked from `server/admin/usersRoutes.ts`
around the `billing_upgrade` / `billing_downgrade` cases.

## The env vars

| Env var                          | Plan        | Cadence  |
| -------------------------------- | ----------- | -------- |
| `STRIPE_PRICE_PRO_MONTHLY`       | Pro         | Monthly  |
| `STRIPE_PRICE_PRO_YEARLY`        | Pro         | Yearly   |
| `STRIPE_PRICE_PRO_PLUS_MONTHLY`  | Pro+        | Monthly  |
| `STRIPE_PRICE_PRO_PLUS_YEARLY`   | Pro+        | Yearly   |
| `STRIPE_PRICE_BUSINESS_MONTHLY`  | Business    | Monthly  |
| `STRIPE_PRICE_BUSINESS_YEARLY`   | Business    | Yearly   |

Each value is a Stripe **price** ID (starts with `price_…`), not a
product ID and not a Payment Link ID.

The `Free` plan has no price ID — admins can't "upgrade to Free" via
this path; use the cancellation flow instead.

## Where to copy the values from in Stripe

1. Open the [Stripe Dashboard](https://dashboard.stripe.com/) and make
   sure you're in the right mode (**Test** for staging/dev, **Live** for
   production — the toggle is in the top-right).
2. Go to **Product catalog → Products**.
3. Pick the product for the plan you're configuring (Pro, Pro+, or
   Business). Each product has one monthly and one yearly price listed
   under **Pricing**.
4. Click the price row, then copy the ID shown next to the price (it
   looks like `price_1Q…`). That's the value for the matching env var
   above.
5. Repeat for every (plan, cadence) pair. All six should be set in any
   environment where admin plan changes need to work.

If a plan is intentionally unavailable in a given environment (e.g. the
yearly cadence isn't sold yet), leave that env var unset — the
validator will simply reject changes targeting that plan/cadence with
`Unknown price ID`, which is the correct safe behavior.

## Setting them per environment

- **Production / staging Replit deployment**: open the deployment's
  **Secrets** tab and add each env var. Restart the deployment so the
  new secrets are picked up by `process.env`.
- **Local dev**: add the test-mode price IDs to your local `.env` (it's
  loaded via `dotenv/config` at server start).
- **CI / tests**: the existing tests in `tests/api/adminUsers.test.ts`
  stub `isKnownPlanPriceId`, so CI does not need real values set.

## Verifying after a rollout

1. Boot the server. In production, if none of the six env vars resolve
   to a value, the startup logs print:

   ```
   [startup] No Stripe plan price IDs configured. Admin plan changes
   (billing_upgrade / billing_downgrade) will fail with "Unknown price
   ID" until the following env vars are set: STRIPE_PRICE_PRO_MONTHLY,
   STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_PRO_PLUS_MONTHLY,
   STRIPE_PRICE_PRO_PLUS_YEARLY, STRIPE_PRICE_BUSINESS_MONTHLY,
   STRIPE_PRICE_BUSINESS_YEARLY.
   ```

   Seeing this in production means the secrets were not propagated —
   fix that before doing any plan-change work.

2. Sanity-check from an admin account by issuing a no-op plan change
   (e.g. switching a test user from monthly Pro to yearly Pro and back).
   A successful response means the price ID was accepted; a `400
   Unknown price ID` means the env var for that cadence is still
   missing or holds the wrong value.

## Rotating the values

1. Create the new price in Stripe (Stripe prices are immutable, so
   "rotation" always means a new price object).
2. Update the matching env var in each environment's secret store with
   the new `price_…` ID.
3. Restart the server / redeploy so `process.env` picks up the change
   (the validator reads `process.env` lazily on every call, but the
   process must already have the new value loaded).
4. Leave existing customers on the old price unless you're explicitly
   migrating them — `isKnownPlanPriceId` only gates **new** plan-change
   actions, not the prices already attached to active subscriptions.
