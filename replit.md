# Gig Aid

## Overview
Gig Aid is a mobile-first productivity application designed for gig workers (plumbers, cleaners, electricians) to streamline client, job, lead, and invoice management. It aims to enhance efficiency and revenue generation for service professionals through a specialized, touch-optimized interface with voice input capabilities. The project focuses on providing a mobile-centric business tool to address market needs, driving efficiency and revenue for users, while also incorporating advanced features like an acquisition engine and churn prediction for sustainable growth.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS (light/dark mode support)
- **Design System**: Mobile-first, Material Design 3 principles, Roboto typography.
- **Mobile Packaging**: Web application packaged as native iOS and Android apps using Capacitor.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
- **API Style**: RESTful JSON API
- **Build Tool**: esbuild (server), Vite (client)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation
- **Storage**: In-memory for development, PostgreSQL for production
- **Key Entities**: Users, Jobs, Leads, Invoices, Growth Leads, Onboarding Calls, Acquisition Attribution, Growth Referrals, Referral Rewards, Outreach Queue, Revenue Drift Logs.

### Core Features
- **Payment Processing**: Stripe Connect for secure payments, dispute resolution, and reschedule policies. Includes deposit and payment integration on booking pages.
- **Price Confirmation Workflow**: Automates job creation upon client approval.
- **Mapping Integration**: Google Maps integration for geocoding, location tracking, distance calculation, and navigation.
- **Payment Enforcement**: Ensures explicit payment resolution for completed jobs via a three-level enforcement system.
- **AI Micro-Nudges System**: Contextual AI recommendations for managing leads, invoices, and jobs.
- **Today's Money Plan**: Global action queue prioritizing revenue-impactful tasks.
- **Capability Enforcement Engine**: Manages feature access and limits across Free, Pro, Pro+, Business tiers.
- **Authentication**: Dual system with Web (OpenID Connect with Replit) and Mobile (Firebase Authentication), supporting account linking.
- **Offline Capture Infrastructure**: IndexedDB for offline data capture and background sync.
- **Drive Mode**: Hands-free interface for use on the move.
- **Event-Driven Client Notifications**: Targeted SMS/email notifications with rate limiting and quiet hours.
- **Centralized Upgrade Orchestration**: Manages all upgrade prompts with thresholds, A/B testing, and cooldowns.
- **Get Paid Today Product Roadmap**: Features include Payday Onboarding, Job Templates, Money-First Dashboard, Auto Follow-Up Bot, Rebooking Machine, Auto-Quote Generator, Price Optimization Engine, and Profit Warning System.
- **Churn Prediction & Retention System**: Rule-based scoring, retention playbooks, and admin UI.
- **Smart Encouragement Engine**: Context-aware, money-focused messages for user engagement.
- **First Dollar in 24 Hours Activation System**: 5-step setup checklist guiding new users to their first paid booking.
- **Human-Readable Booking Slugs**: Replaces numeric IDs with user-friendly slugs for booking URLs, including validation and collision resolution.
- **Service Area Zip Code Check**: Validates client zip codes against provider's service area.
- **Phase 2 Acquisition Engine**: Full growth pipeline including lead capture, UTM attribution, viral referral loops, free setup funnel, CRM-lite outreach, and admin analytics.
- **Revenue Drift Detection System**: Automated reconciliation system to detect revenue discrepancies between internal database and Stripe.

### UI Policies
- **Emoji Usage Policy**: Restricted to user-facing presentation layers, limited to one per UI element, appearing before text, and from an approved whitelist.

## External Dependencies

- **Database**: PostgreSQL
- **UI Frameworks**: Radix UI, Tailwind CSS, Lucide React
- **Form & Validation**: React Hook Form, Zod
- **Payment Processing**: Stripe Connect
- **Mapping & Geocoding**: Google Maps API (JavaScript API, Geocoding API, Places API)
- **Mobile Packaging**: Capacitor (iOS, Android)
- **Mobile Authentication**: Firebase Admin SDK
- **Communication Services**: Twilio (SMS), SendGrid (Email)
- **AI**: OpenAI (gpt-4o-mini)
- **Analytics**: PostHog
- **Testing**: Jest, Playwright

### Revenue Drift Detection System
Automated reconciliation system that detects revenue discrepancies between internal DB state and expected Stripe outcomes. Files in `server/revenue/`:
- **reconciliationService.ts**: 6 calculation functions — `calculateExpectedDeposits`, `calculateStripeCharges`, `calculateExpectedTransfers`, `calculateStripeTransfers`, `calculateActiveSubscriptions`, `calculateEntitledPaidUsers`. All query DB directly using Drizzle ORM.
- **driftDetector.ts**: `runRevenueDriftCheck(startDate, endDate, triggeredBy)` — runs all 6 reconciliation queries in parallel, computes deltas, classifies status (ok/warning/critical based on 1% threshold), persists results to `revenue_drift_logs` table, logs critical alerts. Includes scheduled job stub comment.
- **Admin endpoint**: `POST /api/admin/revenue/reconcile` — requires admin auth via `adminMiddleware`. Runs drift check, returns JSON result.
- **Test endpoint**: `POST /api/test/revenue/run-drift-check` — test/dev gated. Runs drift check for specified or default (last 24h) window.
- **DB table**: `revenue_drift_logs` — stores every drift check run with expected/actual/delta for deposits, transfers, subscriptions.
- **Classification**: delta === 0 → ok, |delta| < 1% → warning, |delta| >= 1% → critical.
- **Alert hooks**: Structured console.error for critical, console.warn for warnings. Slack/Email stubs in comments (TODO).

### Test Coverage Summary (78 API tests)
- **Revenue Drift Detection** (`revenue.drift.test.ts`): No drift clean state, deposit drift, transfer drift, subscription drift, drift classification and persistence (5 tests).
- **Revenue Regression** (`revenue.regression.test.ts`): Lost deposit guard, failed retries guard, missed transfers guard, subscription leakage guard, downgrade bug guard (5 tests).
- **Stripe Platform Webhook** (`stripe.platform.webhook.test.ts`): Secret check, signature validation, valid-signature e2e (7 tests).
- **Stripe Connect Webhook** (`stripe.connect.webhook.test.ts`): Signature enforcement, event processing (7 tests).
- **Booking Validation** (`publicBooking.validation.test.ts`): Missing slugs, required fields, deposit policy, optional fields, cross-user isolation (12 tests).
- **Activation Engine** (`activation.test.ts`): Activation status, step tracking (services, pricing, link, quote), refresh, percentage calculations, feature flag, admin backfill (18 tests).

### Test Seed Routes
- `/api/test/revenue/run-drift-check` — Run drift detection check (accepts startDate/endDate)
- `/api/test/stripe/insert-failed-webhook` — Insert a failed webhook event for retry testing
- `/api/test/stripe/run-retry` — Trigger the webhook retry processor immediately
- `/api/test/stripe/webhook-status/:eventId` — Get webhook event status
- `/api/test/stripe/seed-connect-payment` — Seed connect payment scenario
- `/api/test/stripe/seed-subscription-user` — Seed user with subscription mapping
- `/api/test/revenue/booking/:id` — Reconciliation surface for booking state
- `/api/test/revenue/user/:userId/entitlements` — User plan/entitlements truth

### Test Namespace Isolation
Each API test suite uses namespaced user IDs and data via `tests/utils/testNamespace.ts` to prevent parallel test interference. Key files:
- **testNamespace.ts**: Generates unique run-scoped prefix via `ns(value)`.
- **setup.ts**: `createSuiteUsers(suite)` factory creates per-suite users with namespaced IDs/emails.
- **tests/README.md**: Full documentation of the isolation strategy and suite mapping.
- Override namespace: `TEST_RUN_ID=debug npx jest --selectProjects api`

### Launch Readiness Agent
Modular pre-launch validation script at `scripts/launchReadiness.ts`. Run with `npx tsx scripts/launchReadiness.ts`.
- **Test layers**: core, e2e, revenue, capability, offline, upgrade, downgrade (commands defined inline, extensible via TEST_LAYERS array)
- **Smoke Test Gate**: Runs critical suites (auth, activation, revenue.drift, revenue.regression, capabilities) first. Fail-fast if any smoke suite fails. Run standalone: `npx tsx scripts/smokeTest.ts`.
- **Config checks**: Required env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET), legal routes, rate limiting, backups
- **Test Env Validation**: Validates required test env vars (GIGAID_ADMIN_API_KEY) at startup; fails fast if missing. Optional vars (STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET, STRIPE_SECRET_KEY) logged as warnings.
- **Monitoring checks**: Sentry DSN, error handler middleware
- **Code checks**: Stripe webhook signature verification (constructEvent)
- **Suite Health Enforcement**: Tracks pass/fail per suite over last 20 runs in `reports/test-history.json`. Blocks release if any suite's flaky rate exceeds 5%. Critical suites (revenue, capability, billing, auth, activation) block on any failure in last 5 runs. View health: `npx tsx scripts/suiteHealth.ts`.
- **Fail-fast**: Exits early on smoke failures, test failures, missing critical env vars, missing Stripe verification, or flaky suite detection
- **Report output**: `reports/launch-readiness.json` with AUTOMATED_CHECKS, CONFIG_CHECKS, MANUAL_CHECKS_REQUIRED sections, plus `suite_health` summary
- **Extension**: Add new checkers as functions returning `CheckResult`, register in `main()`

### Test Environment Hardening
All test env access centralized in `tests/utils/env.ts`. Exports: `TEST_BASE_URL`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `validateTestEnv()`. Admin key access via `tests/utils/adminKey.ts`. Test namespace via `tests/utils/testNamespace.ts`.

### Automated Database Backup & Restore
Production-safe backup and restore scripts using `pg_dump`/`psql` with the Replit-provided `DATABASE_URL`.
- **Backup** (`scripts/backup.ts`): Run with `npx tsx scripts/backup.ts`. Creates `/backups/backup_YYYYMMDD_HHmmss.sql`, auto-creates directory, 7-file retention policy with automatic cleanup, validates `DATABASE_URL` at startup, logs start/filename/size/duration/retention.
- **Restore** (`scripts/restore.ts`): Run with `npx tsx scripts/restore.ts [--file=<path>] [--yes]`. Defaults to latest backup if no `--file` specified. Includes interactive confirmation prompt (skip with `--yes`), warns when `NODE_ENV=production`. Validates `DATABASE_URL` at startup.
- **Safety**: No credentials exposed in logs, connection strings redacted in error output, 5-minute timeout on both operations.

### Security & Error Monitoring
Production-grade security hardening and centralized error tracking.
- **Sentry Integration** (`server/sentry.ts`): Initializes `@sentry/node` with tracing, strips auth headers from events, gracefully skips in dev if `SENTRY_DSN` not set, required in production.
- **Central Error Handler** (`server/errorHandler.ts`): Express error middleware, captures to Sentry, returns sanitized JSON (`{ error: "Internal server error" }`) for 500s, never exposes stack traces.
- **Process Handlers**: `unhandledRejection` and `uncaughtException` handlers registered at startup, log and report to Sentry, flush before exit on uncaught exceptions.
- **Security Headers**: `helmet` middleware with CSP baseline (production only), `x-powered-by` disabled, COEP relaxed for Stripe/Maps embeds.
- **Env Validation**: Startup validates `DATABASE_URL` and `APP_JWT_SECRET` (always required), `SENTRY_DSN` (required in production). Fails startup in production if missing, warns in development.