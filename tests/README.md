# Test Suite — Isolation Strategy

## Problem

All API test suites previously shared two global users (`TEST_USER_A`, `TEST_USER_B`). When Jest ran suites in parallel, one suite's `resetTestData` call would wipe data that another suite was actively using, causing flaky test failures.

## Solution: Namespace Isolation

Each test suite now creates its own uniquely-named users via `createSuiteUsers(suite)`. A namespace prefix (generated once per Jest worker process) ensures IDs never collide across parallel runs.

### How It Works

1. **`tests/utils/testNamespace.ts`** generates a unique namespace per process (e.g., `tmlkdh8cjif7e`).
2. **`ns(value)`** prefixes any string with the namespace: `ns('jobs-user-a')` → `tmlkdh8cjif7e-jobs-user-a`.
3. **`createSuiteUsers(suite)`** in `setup.ts` returns `{ userA, userB }` with namespaced IDs and emails.
4. Each suite calls `createTestUser(userA)` in `beforeAll` and `resetTestData(userA.id)` in `afterAll`, affecting only its own data.

### Suite Mapping

| Suite | User Factory | Notes |
|---|---|---|
| jobs | `createSuiteUsers('jobs')` | Uses userA + userB |
| leads | `createSuiteUsers('leads')` | Uses userA + userB |
| invoices | `createSuiteUsers('invoices')` | Uses userA only |
| messaging | `createSuiteUsers('messaging')` | Uses userA only |
| auth | `createSuiteUsers('auth')` | Uses userA only |
| capabilities | `createSuiteUsers('capabilities')` | Uses userA, mutates plan |
| booking | `createSuiteUsers('booking')` | Uses userA, namespaced slug |
| publicBooking | `createSuiteUsers('pubbook')` | Uses userA, namespaced slug |
| growthPhase2 | `createSuiteUsers('growth')` | Uses userA + userB |
| activation | Own `ACTIVATION_USER` with `ns()` | Namespaced ID + slug |
| revenue.drift | Own `DRIFT_USER` with `ns()` | Namespaced ID |
| revenue.regression | Own `REVENUE_USER` with `ns()` | Namespaced ID + slug |
| stripe.platform.webhook | No users | Stateless webhook tests |
| stripe.connect.webhook | No users | Stateless webhook tests |

### Slugs

Booking slugs are also namespaced via `ns()` to prevent collision. The `ns()` function uses hyphens as separators to satisfy slug validation (`^[a-z0-9]+(-[a-z0-9]+)*$`).

### Environment Variable Override

Set `TEST_RUN_ID` to use a fixed namespace (useful for debugging):

```bash
TEST_RUN_ID=debug-run npx jest --selectProjects api
```

## Running Tests

```bash
# All API tests (parallel by default)
npx jest --selectProjects api --forceExit

# Single suite
npx jest --selectProjects api --testPathPatterns='jobs\.test' --forceExit

# Serial execution (if server connection limits cause socket errors)
npx jest --selectProjects api --runInBand --forceExit
```

## Smoke Test Gate

A minimal smoke test gate runs critical suites first during launch readiness. If any smoke suite fails, subsequent test layers are skipped.

### Smoke Suites

| Suite | Pattern |
|-------|---------|
| auth | `auth.test` |
| activation | `activation.test` |
| revenue.drift | `revenue.drift.test` |
| revenue.regression | `revenue.regression.test` |
| capabilities | `capabilities.test` |

### Running Smoke Tests

```bash
npx tsx scripts/smokeTest.ts
```

### Orchestrator Integration

The smoke gate runs **before** full test layers in the Launch Readiness Agent. If any smoke suite fails, `FAIL FAST` is triggered and remaining layers are skipped. Smoke results are also recorded in suite health history under `smoke:<name>`.

## Environment Variable Hardening

All test environment variables are centralized in `tests/utils/env.ts`.

### Exports

- `TEST_BASE_URL` — Base URL for API requests (default: `http://localhost:5000`)
- `STRIPE_WEBHOOK_SECRET` — Platform webhook signing secret
- `STRIPE_CONNECT_WEBHOOK_SECRET` — Connect webhook signing secret
- `STRIPE_SECRET_KEY` — Stripe secret key
- `validateTestEnv()` — Validates required/optional env vars with warnings

### Usage

```ts
import { TEST_BASE_URL, STRIPE_WEBHOOK_SECRET } from "../utils/env";
```

The Launch Readiness Agent validates required test env vars at startup and fails fast if any are missing.

## Suite Health Enforcement

The suite health system tracks test results over time and blocks releases when any suite becomes flaky.

### How It Works

1. Every time the Launch Readiness Agent runs, each test layer's pass/fail result is recorded to `reports/test-history.json`.
2. A rolling window of the last 20 runs per suite is maintained.
3. **Flaky rate** = failures / total runs for each suite.
4. If any suite exceeds the 5% flaky threshold, the release is blocked with status `NOT_READY`.

### Critical Suites (Fail-Fast)

These suites trigger immediate fail-fast when flaky:
- `revenue` — Payment reconciliation
- `capability` — Plan enforcement
- `billing` — Subscription management
- `auth` — Authentication
- `activation` — First-dollar setup flow

**Stricter enforcement**: Critical suites block release on **any failure in the last 5 runs**, regardless of the overall flaky rate. Non-critical suites use the standard 5% threshold over the full 20-run window.

### Configuration

In `scripts/suiteHealth.ts`:
```ts
const FLAKY_THRESHOLD = 0.05;  // 5% failure rate
const HISTORY_LIMIT = 20;      // Rolling window size
```

### Viewing Suite Health

```bash
# View current suite health table
npx tsx scripts/suiteHealth.ts

# Full launch readiness check (includes suite health)
npx tsx scripts/launchReadiness.ts
```

### Console Output

The health check prints a table during launch readiness:

```
Suite Name                      Runs  Fails  Flaky %  Status
------------------------------------------------------------
test:core                          8      0     0.0%  OK
test:revenue                       8      0     0.0%  OK
test:capability                    8      1    12.5%  CRITICAL
```

### Report Integration

Suite health results are included in:
- `reports/launch-readiness.json` — under the `suite_health` key
- `reports/test-history.json` — raw run history

### Resetting History

To clear history (e.g., after fixing a known flaky suite):
```bash
echo '{"version":1,"suites":{}}' > reports/test-history.json
```

## SMS opt-out suite runtime requirements

`tests/api/smsOptOut.test.ts` (the STOP/START webhook + `/api/profile/sms/resume`
regression net from Task #51) is an **integration** suite, not a pure unit
suite. It requires:

1. **`DATABASE_URL`** — must point at a Postgres instance the suite can read
   and write (it mutates the `users` table to set phone numbers and
   `smsOptOut` flags).
2. **A running dev server reachable at `TEST_BASE_URL`** (defaults to
   `http://localhost:5000`) — the suite POSTs to `/api/twilio/inbound` and
   `/api/profile/sms/resume`. Start the `Start application` workflow
   (`npm run dev`) before invoking jest.

**CI must provide both.** The suite previously used `describe.skip` when
`DATABASE_URL` was unset, which silently turned a misconfigured CI run into
a green "0 tests" result. As of Task #63 the suite asserts both
prerequisites in `beforeAll` and **fails loudly** with an actionable error
message if either is missing — so a misconfigured pipeline shows up as a
red build instead of a missing regression net.

To run it locally:

```bash
# 1. Start the app (provides DATABASE_URL via .env and serves :5000)
npm run dev

# 2. In a second shell, run only the smsOptOut suite
npx jest --selectProjects api --testPathPatterns='smsOptOut\.test' --forceExit
```

If you see `[smsOptOut] DATABASE_URL is not set` or
`[smsOptOut] Dev server not reachable`, fix the environment before re-running
— do not edit the suite to skip the check.

## Known Considerations

- **Socket errors under heavy parallel load**: The dev server may drop connections when many suites run simultaneously. Use `--runInBand` if needed. This is a server connection limit, not a test isolation issue.
- **growthPhase2 admin route 401s**: Pre-existing issue — admin routes expect JWT auth but tests send API key as Bearer token.
