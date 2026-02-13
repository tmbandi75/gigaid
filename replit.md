# Gig Aid

## Overview
Gig Aid is a mobile-first productivity application designed for gig workers (plumbers, cleaners, electricians) to streamline client, job, lead, and invoice management. It aims to enhance efficiency and revenue generation for service professionals through a specialized, touch-optimized interface with voice input capabilities. The project focuses on providing a mobile-centric business tool to address market needs, driving efficiency and revenue for users.

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
- **Key Entities**: Users, Jobs, Leads, Invoices

### Recent Changes (Feb 2026)
- **Human-Readable Booking Slugs**: Replaced `user-{id}` booking URLs with human-readable slugs (e.g., `gigaid.ai/book/curtis-plumbing`). Slug utility at `server/lib/bookingSlug.ts` handles generation from businessName/name, reserved word blocking, profanity filter, and collision resolution. Auto-assigns on profile access. Legacy URLs redirect to new slugs. Settings page includes real-time availability checking via `/api/slug/check/:slug`.
- **Booking Page Deposit & Payment Integration**: Public booking page (`PublicBooking.tsx`) now respects provider settings for deposits. Shows deposit info only when `depositEnabled && depositValue > 0`. Stripe payment form (using `@stripe/react-stripe-js` PaymentElement) only appears when the provider has Stripe as an accepted payment method AND has Stripe Connect active. For non-Stripe providers with deposits, shows "provider will collect separately" with payment method badges. PaymentIntent created server-side during booking submission using provider's `defaultPrice` for percent-based deposits (not client-supplied estimates).
- **Service Area Zip Code Check**: `/api/public/validate-zip` now accepts optional `slug` param. When provided, checks client zip against provider's `serviceArea` field (comma-separated zips/prefixes). Returns `inServiceArea` boolean. Frontend shows warning (non-blocking) when outside service area.
- **Public Profile Payment Methods**: `/api/public/profile/:slug` now returns `acceptedPaymentMethods` (enabled methods), `stripeConnected` boolean, and `stripePublishableKey` (when Stripe is active).
- **Phase 2 Acquisition Engine**: Full growth/acquisition pipeline with lead capture, UTM attribution, viral referral loops, free setup funnel, CRM-lite outreach queue, and admin growth analytics. DB tables: `growth_leads`, `onboarding_calls`, `acquisition_attribution`, `growth_referrals`, `referral_rewards`, `outreach_queue`. Server modules in `server/lib/growth/` (leadService, attributionService, referralService, rewardService, outreachService). Routes in `server/growth/routes.ts`. Client: `/free-setup` page, UTM capture (`client/src/lib/utmCapture.ts`, `client/src/hooks/useUtmCapture.ts`), `FreeSetupCta` component in empty states, "Powered by GigAid" viral CTA on booking pages. Admin Growth dashboard at `/admin/growth` with 4 tabs (Overview, Leads, Outreach, Channels). Referral lifecycle: clicked -> signed_up -> activated (via activation engine hook) -> rewarded. PostHog events: `growth_lead_created`, `referral_cta_clicked`, `free_setup_cta_clicked`. API tests: `tests/api/growthPhase2.test.ts` (12 tests).

### Core Features
- **Payment Processing**: Stripe Connect for secure payments, dispute resolution, and reschedule policies.
- **Price Confirmation Workflow**: Automates job creation upon client approval.
- **Google Maps Integration**: Geocoding, location tracking, distance calculation, navigation.
- **No Silent Completion**: Ensures explicit payment resolution for completed jobs via a three-level enforcement system.
- **AI Micro-Nudges System**: Contextual AI recommendations for managing leads, invoices, and jobs.
- **Today's Money Plan**: Global action queue prioritizing revenue-impactful tasks.
- **Capability Enforcement Engine**: Uses limits, caps, and progressive unlocks across Free, Pro, Pro+, Business tiers, without hiding features or UI forking.
- **Authentication**: Dual system with Web (OpenID Connect with Replit) and Mobile (Firebase Authentication), supporting account linking.
- **Offline Capture Infrastructure**: IndexedDB for offline data capture and background sync.
- **Drive Mode**: Hands-free interface for use on the move.
- **Event-Driven Client Notifications**: Targeted SMS/email notifications to past clients with rate limiting and quiet hours.
- **Centralized Upgrade Orchestration**: Manages all upgrade prompts (banners, modals) with thresholds, A/B testing, and cooldowns.
- **Get Paid Today Product Roadmap**: Includes Payday Onboarding, Job Templates, Money-First Dashboard, Auto Follow-Up Bot, Rebooking Machine, Auto-Quote Generator, Price Optimization Engine, and Profit Warning System.
- **Churn Prediction & Retention System**: Rule-based scoring, retention playbooks, scheduler, and admin UI for managing user churn.
- **Smart Encouragement Engine**: Context-aware, money-focused messages shown on dashboard and after key actions (send reminder, send invoice, share booking link, mark job complete). 4 categories: Progress-Based, Effort Recognition, Resilience, Identity. Cooldown system: max 1/session, 3/day, 24h dismiss cooldown, no duplicates within 48h, identity messages max 1/week. Files in `client/src/encouragement/`. Server endpoint: `/api/encouragement/data`.
- **Time-of-Day Greeting**: Game Plan header shows personalized greeting with user's first name and time-appropriate emoji (morning/afternoon/evening).
- **First Dollar in 24 Hours Activation System**: 5-step setup checklist guiding new users to their first paid booking (add service, set price, connect payments, generate booking link, send first quote). Engine at `server/lib/activationEngine.ts` evaluates user state and persists progress to activation columns on users table. `ActivationChecklist` component on Game Plan and Dashboard pages with progress bar and confetti celebration. `FirstDollarBanner` global banner in `ResponsiveLayout` (mobile + desktop). Feature-flagged via `activation_engine_v1` with smart cutoff: ON for new users (created >= 2026-02-08), OFF for existing users until backfill. Admin backfill endpoint: `POST /api/admin/activation-backfill` evaluates all users, updates flags, and enables feature flag globally. PostHog events: `activation_checklist_viewed`, `activation_step_completed`, `activation_step_clicked`, `activation_completed`. Completed banner shows for 7 days then hides.

### UI Policies
- **Emoji Usage Policy**: Emojis are restricted to user-facing presentation layers, limited to one per UI element, appearing before text, and must be from an approved whitelist.

## External Dependencies

- **Database**: PostgreSQL
- **UI Frameworks**: Radix UI, Tailwind CSS, Lucide React
- **Form & Validation**: React Hook Form, Zod
- **Payment Processing**: Stripe Connect
- **Mapping & Geocoding**: Google Maps API (JavaScript API, Geocoding API, Places API)
- **Mobile Packaging**: Capacitor (iOS, Android)
- **Mobile Authentication**: Firebase Admin SDK
- **Communication Services**: Twilio (SMS), SendGrid (Email)
- **AI**: OpenAI (gpt-4o-mini for auto-quoting)
- **Analytics**: PostHog
- **Testing**: Jest + ts-jest (API), Playwright (E2E)

## Testing

### Test Architecture
- **API Tests**: Jest + fetch against running server at localhost:5000. Located in `tests/api/`.
- **E2E Tests**: Playwright with Chromium. Located in `e2e/`.
- **Test Infrastructure**: `server/testRoutes.ts` provides test-only endpoints for user creation, data seeding, auth token generation, and data reset.
- **Auth for Tests**: JWT Bearer tokens via `signAppJwt` (requires `APP_JWT_SECRET` env var).

### Test Users
- `api-test-user-a` / `api-test-user-b`: API test isolation users
- `activation-test-user`: Activation engine test user
- `e2e-test-user` (free plan) / `e2e-test-pro` (pro plan): E2E test users

### Running Tests
```bash
# API tests (requires server running on :5000)
npx jest --forceExit --runInBand

# Single API test suite
npx jest --forceExit --runInBand tests/api/jobs.test.ts

# E2E tests (auto-starts server if not running)
npx playwright test

# Single E2E test
npx playwright test e2e/auth.spec.ts

# E2E with UI mode
npx playwright test --ui

# Link integrity tests
npx playwright test e2e/links.spec.ts
npx playwright test e2e/public-links.spec.ts
```

### Link Integrity Tests
- **Authenticated** (`e2e/links.spec.ts`): Visits all 35+ known authenticated routes as a logged-in test user. Seeds a job, lead, and invoice to test dynamic `:id` routes. Validates no HTTP 4xx/5xx, no error URL patterns, no error body text. Screenshots and HTML snapshots saved on failure to `e2e/link-test-screenshots/`.
- **Public** (`e2e/public-links.spec.ts`): Crawls public pages (`/`, `/terms`, `/privacy`, `/downloads`, `/login`, `/pricing`) without authentication. BFS discovers additional links. Validates no server errors or error content.
- **Exclusion rules**: Skips dangerous paths (logout, delete, pay, stripe, webhook, reset), API/auth routes, admin routes, and dynamic token routes without seeded data.
- **Expected runtime**: ~2 minutes (authenticated), ~30 seconds (public)

### Test Coverage Summary (50 API + 6 E2E suites + 2 link integrity)
- **Auth**: Token validation, unauthenticated access blocking, profile retrieval
- **Jobs**: CRUD, cross-user isolation, capability usage tracking
- **Leads**: CRUD, archive/unarchive, cross-user isolation
- **Invoices**: CRUD, public invoice view
- **Capabilities**: Free plan limits (jobs=10, SMS=20), pro plan unlimited, usage enforcement
- **Booking**: Public booking creation, invalid slug handling, auth-protected request listing
- **Booking Validation** (`publicBooking.validation.test.ts`): 404 for missing slugs, 400 for missing required fields, deposit policy acknowledgment enforcement, optional field handling, cross-user isolation (12 tests)
- **Stripe Platform Webhook** (`stripe.platform.webhook.test.ts`): Secret configuration check, missing/malformed/wrong signature rejection, valid-signature end-to-end (accept, replay-attack rejection, deduplication) (7 tests).
- **Stripe Connect Webhook** (`stripe.connect.webhook.test.ts`): Signature enforcement when secret configured (invalid sig rejection, valid sig acceptance); event processing (account.updated, payment_intent.succeeded, charge.dispute.created, customer.subscription.created) via parsed-body fallback when no secret (7 tests).
- **Messaging**: SMS send validation, conversation listing, usage reporting

### Test Seed Routes
- `/api/test/set-deposit-config` — Configure deposit/Stripe Connect settings for test users (depositEnabled, depositValue, depositType, defaultPrice, defaultServiceType, depositPolicySet, stripeConnectAccountId, stripeConnectStatus, noShowProtectionEnabled, reschedulePolicy, cancellationPolicy)