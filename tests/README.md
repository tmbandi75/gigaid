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

All other suites also block release when flaky, but don't trigger fail-fast.

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

## Known Considerations

- **Socket errors under heavy parallel load**: The dev server may drop connections when many suites run simultaneously. Use `--runInBand` if needed. This is a server connection limit, not a test isolation issue.
- **growthPhase2 admin route 401s**: Pre-existing issue — admin routes expect JWT auth but tests send API key as Bearer token.
