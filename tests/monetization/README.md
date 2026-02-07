# Monetization Smoke Test Suite

## Quick Start

Run once:
```bash
npx tsx tests/monetization/run.ts
```

Run 3 consecutive times (validates consistency):
```bash
npx tsx tests/monetization/run.ts 3
```

## Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Limits | 22 | Capability enforcement per plan (free/pro/business) |
| Thresholds | 6 | 60/80/95% upgrade prompt triggers |
| Escalation | 12 | Usage 0-11/10 allow/block progression |
| Mode | 4 | read_only, suggest_only restrictions |
| API | 4 | Test user creation, plan changes, validation |
| Stripe | 2 | Webhook rejection, Connect status |
| Failure | 7 | Missing signatures, expired tokens, malformed JSON, concurrency |

## Reports

Reports are saved to `tests/monetization/reports/`:
- `latest.json` — most recent run
- `smoke-YYYY-MM-DDTHH-MM-SS.json` — timestamped reports

## Server Endpoint

GET `/api/test/smoke-report` — returns latest report JSON (requires admin API key in production)

## Environment Variables

- `TEST_BASE_URL` — Override server URL (default: `http://localhost:5000`)
- `GIGAID_ADMIN_API_KEY` — Required in production for test endpoints
