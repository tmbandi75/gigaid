# Churn Prediction & Retention System V1

## Overview
A production-ready churn prediction engine that computes nightly risk scores for every user, assigns them to tiers, and triggers automated retention actions with full admin visibility.

## Architecture

### Data Flow
```
DB Tables → Signal Extraction → Scoring → Tier Assignment → Retention Actions → Notifications
     ↓                                          ↓
Admin Dashboard ← API Endpoints ← Churn Metrics DB
```

### Components
| Component | File | Purpose |
|-----------|------|---------|
| Schema | `shared/schema.ts` | churn_metrics, retention_actions, retention_playbooks, plan_overrides |
| Scorer | `server/churn/churnScorer.ts` | Signal extraction + scoring rules |
| Retention | `server/churn/retentionEngine.ts` | Playbook execution + action dispatch |
| Scheduler | `server/churn/churnScheduler.ts` | Nightly cron (6h interval) |
| Admin API | `server/churn/adminChurnRoutes.ts` | REST endpoints for admin dashboard |
| Admin UI | `client/src/pages/AdminChurnRetention.tsx` | 4-tab admin dashboard |
| Events | `client/src/lib/churnEvents.ts` | Frontend event instrumentation |
| Tests | `tests/churn/run.ts` | 40 tests across 4 categories |

## Scoring System

### Signal Categories

**Activity (max 50 points)**
| Signal | Range | Points |
|--------|-------|--------|
| Last login days | 0-1d | 0 |
| | 2-3d | 5 |
| | 4-6d | 12 |
| | 7-10d | 18 |
| | 11-14d | 22 |
| | 15+d | 25 |
| Jobs (7d) | 3+ | 0 |
| | 2 | 5 |
| | 1 | 10 |
| | 0 | 15 |
| Messages (7d) | 10+ | 0 |
| | 5-9 | 3 |
| | 1-4 | 7 |
| | 0 | 10 |

**Revenue (max 30 points)**
| Signal | Range | Points |
|--------|-------|--------|
| Revenue delta | >=0 | 0 |
| | -1 to -50 | 5 |
| | -51 to -200 | 10 |
| | -201+ | 15 |
| No payment 14d | false | 0 |
| | true | 10 |
| Failed payments | 0 | 0 |
| | 1 | 2 |
| | 2 | 4 |
| | 3+ | 5 |

**Friction (max 20 points)**
| Signal | Range | Points |
|--------|-------|--------|
| Errors (7d) | 0 | 0 |
| | 1-2 | 3 |
| | 3-5 | 6 |
| | 6+ | 8 |
| Blocks (7d) | 0 | 0 |
| | 1 | 2 |
| | 2-3 | 4 |
| | 4+ | 6 |

**Intent (max 10 points)**
| Signal | Range | Points |
|--------|-------|--------|
| 95% limit hits | 0 | 0 |
| | 1 | 2 |
| | 2+ | 4 |
| Downgrade views | 0 | 0 |
| | 1 | 2 |
| | 2+ | 3 |
| Cancel hover | 0 | 0 |
| | 1 | 2 |
| | 2+ | 3 |

### Tier Mapping
| Score | Tier |
|-------|------|
| 0-30 | Healthy |
| 31-50 | Drifting |
| 51-70 | AtRisk |
| 71+ | Critical |

## Retention Playbooks

### Default Playbooks
| Tier | Action | Channel | Template | Offer |
|------|--------|---------|----------|-------|
| Drifting | Nudge | InApp | payday_flow_nudge | Get Paid Today flow CTA |
| AtRisk | Trial | InApp | pro_trial_7day | 7-day Pro trial |
| AtRisk | Trial | Email | pro_trial_7day_email | 7-day Pro trial |
| Critical | FounderSave | Email | founder_save_offer | Free month credit |
| Critical | FounderSave | InApp | founder_save_inapp | Special offer |

### Idempotency
- Key format: `{userId}:{tier}:{actionType}:{YYYY-MM-DD}`
- Max 1 action per user per day
- Same action for same tier not repeated on same day

## Admin API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/churn/overview | Risk distribution, trends, top drivers |
| GET | /api/admin/churn/users | Paginated at-risk user list with filters |
| GET | /api/admin/churn/user/:id | Full user churn profile |
| POST | /api/admin/churn/action | Trigger manual retention action |
| GET | /api/admin/churn/report.json | Daily audit report |
| GET | /api/admin/churn/playbooks | List all playbooks |
| PUT | /api/admin/churn/playbooks/:id | Update playbook |
| POST | /api/admin/churn/playbooks | Create playbook |
| DELETE | /api/admin/churn/playbooks/:id | Delete playbook |

All endpoints require admin authentication via adminMiddleware.

## Event Instrumentation

Frontend events emitted to `POST /api/events/churn-signal`:
- `downgrade_view` — user visits pricing/plans page
- `cancel_hover` — user opens cancel subscription dialog
- `limit_95_hit` — 95% upgrade modal shown
- `paywall_block` — capability gate blocks access

## Scheduler

- Runs every 6 hours via setInterval
- Initial run 30 seconds after server startup
- Seeds default playbooks on first run
- Processes all active users per cycle
- Per-user error isolation (one failure doesn't stop batch)

## Tests

Run tests:
```bash
npx tsx tests/churn/run.ts      # Single run
npx tsx tests/churn/run.ts 3    # 3 consecutive runs
```

40 tests across 4 categories:
- Scoring Matrix (24 tests)
- Tier Assignment (6 tests)
- API Integration (6 tests)
- Idempotency Logic (4 tests)

Reports saved to `tests/churn/reports/`.

## Database Tables

### churn_metrics
Stores computed signals and scores per user. Upserted nightly.

### retention_actions
Logs every retention action attempt with status tracking and idempotency.

### retention_playbooks
Configurable playbook rules per tier with enable/disable and priority.

### plan_overrides
Temporary entitlement grants (pro trials, free months) with expiry dates.
