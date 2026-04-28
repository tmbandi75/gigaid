# Gig Aid

## Overview
Gig Aid is a mobile-first productivity application for gig workers, such as plumbers, cleaners, and electricians. Its primary purpose is to streamline client, job, lead, and invoice management to enhance efficiency and revenue generation. The project focuses on a specialized, touch-optimized mobile interface with voice input, providing a comprehensive business tool that includes an acquisition engine and churn prediction for sustainable growth.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, leveraging shadcn/ui (built on Radix UI) and Tailwind CSS for styling, supporting both light and dark modes. The design adheres to mobile-first principles and Material Design 3, utilizing Roboto typography. The web application is packaged into native iOS and Android apps using Capacitor.

### Desktop/Tablet Layout Pattern
Pages use `isMobile ? <MobileView> : <DesktopView>` or `block md:hidden` / `hidden md:block` CSS to render separate layouts. Mobile is always untouched. Desktop views live in dedicated component files:
- `client/src/components/game-plan/GamePlanDesktopView.tsx` — Game Plan two-column (8+4) dashboard
- `client/src/components/quickbook/QuickBookDesktopView.tsx` — QuickBook two-panel AI workspace
- `client/src/components/voice-notes/VoiceNotesDesktopView.tsx` — Voice Notes two-panel (recorder + history)
- `client/src/components/stats/StatsDesktopView.tsx` — Statistics multi-column dashboard (8+4 grid)
- `client/src/components/money-plan/MoneyPlanDesktopView.tsx` — Money Plan revenue command center (12-col grid: 8+4)
- `client/src/components/booking-requests/BookingRequestsDesktopView.tsx` — Booking Requests desktop layout
- `client/src/components/messages/CustomerContextPanel.tsx` — Messages right-panel customer context
- `client/src/components/lead-detail/LeadSummaryDesktopView.tsx` — Lead/Request Detail 3-column workspace (3+6+3: customer overview, conversation, actions)
- `client/src/components/job-detail/JobDetailDesktopView.tsx` — Job Detail 3-column workspace (4+5+3: job summary, client & location, actions & payment)
- `client/src/components/invoices/InvoiceViewDesktopView.tsx` — Invoice Detail two-column (8+4: invoice details + payment confirmation left, payment summary + status + actions right)
- Invoices list page has inline desktop layout with search bar in `renderDesktopLayout()`

### Backend
The backend is built with Node.js and Express.js, using TypeScript and ESM modules. It exposes a RESTful JSON API. esbuild is used for server builds, while Vite handles client-side builds.

### Data Layer
Drizzle ORM is used with a PostgreSQL dialect. The schema is defined in `shared/schema.ts` with Zod validation. Data is stored in-memory for development and in PostgreSQL for production. Key entities include Users, Jobs, Leads, Invoices, and various growth/tracking-related data.

### Core Features
- **Payment Processing**: Integrates Stripe Connect for secure payments, deposits, and dispute resolution. Stripe credentials are sourced from `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` environment secrets (live mode), falling back to the Replit Stripe connector if not set.
- **Mapping Integration**: Utilizes Google Maps for geocoding, location tracking, and navigation.
- **AI Micro-Nudges System**: Provides contextual AI recommendations for task management.
- **Today's Money Plan**: A global action queue prioritizing revenue-generating tasks.
- **Capability Enforcement Engine**: Manages feature access across Free, Pro, Pro+, and Business tiers, using a centralized configuration and upgrade modals.
- **Authentication**: Dual system with Web (OpenID Connect with Replit) and Mobile (Firebase Authentication) with account linking.
- **Offline Capture Infrastructure**: Uses IndexedDB for offline data and background synchronization.
- **Event-Driven Client Notifications**: Targeted SMS/email notifications with rate limiting.
- **Centralized Upgrade Orchestration**: Manages upgrade prompts with A/B testing and cooldowns.
- **Activation Gating**: Centralized routing logic determines user onboarding paths (dashboard, main onboarding, payday onboarding).
- **Churn Prediction & Retention System**: Rule-based scoring and retention playbooks.
- **First Dollar in 24 Hours Activation System**: A 5-step checklist to guide new users to their first paid booking.
- **Phase 2 Acquisition Engine**: Includes lead capture, UTM attribution, viral referrals, and CRM-lite outreach.
- **Revenue Drift Detection System**: Automated reconciliation to detect discrepancies between the internal database and Stripe.
- **ATT & Analytics Consent System**: Implements Apple's App Tracking Transparency flow with DB-persisted consent.

### Onboarding System
Features dual mobile and desktop layouts with shared logic. It collects user identity, pricing, and AI card information. Monetization steps are part of a separate Payday Onboarding flow.

### UI Policies
Emoji usage is restricted to user-facing presentation layers, limited to one per UI element, preceding text, and from an approved whitelist.

## External Dependencies

- **Database**: PostgreSQL
- **UI Frameworks**: Radix UI, Tailwind CSS, Lucide React
- **Form & Validation**: React Hook Form, Zod
- **Payment Processing**: Stripe Connect
- **Mapping & Geocoding**: Google Maps API
- **Mobile Packaging**: Capacitor
- **Mobile Authentication**: Firebase Admin SDK
- **Communication Services**: Twilio (SMS), SendGrid (Email)
- **AI**: OpenAI (gpt-4o-mini)
- **Analytics**: PostHog
- **Security**: Firebase App Check (reCAPTCHA v3 for web)

## Booking Link Share Funnel (Admin Analytics)

The Admin Analytics page (`/admin/analytics`) includes a "Booking Link Share Funnel" card sourced from `events_canonical`. Three event names back the report:

- `booking_link_share_tap` — emitted when the Share button is pressed (server: `POST /api/track/booking-link-share-tap`, mirrored on the client by the PostHog `booking_link_share_opened` event). Fires on tap regardless of whether the share sheet is confirmed or cancelled.
- `booking_link_share_completed` — emitted on every successful share-sheet send or copy (server: `POST /api/track/booking-link-shared`). The client mirrors completions with the PostHog `booking_link_shared` event, which (per Task #98) only fires after the OS share sheet returns success — or after a successful copy when share isn't available. The legacy once-per-user `booking_link_shared` milestone event still flips `users.booking_link_shared_at`, but the funnel report uses `booking_link_share_completed` so the conversion rate is not skewed.
- `booking_link_copied` — emitted on every booking-link copy (server: `POST /api/track/booking-link-copied`, also mirrored as the PostHog `booking_link_copied` event).

All three carry a `screen` field (`plan`, `leads`, `leads_empty`, `jobs`, `bookings`, `nba`, `other`, `unknown`) so the admin page can break down the funnel by surface. The aggregation endpoint is `GET /api/admin/analytics/share-funnel?days=N`.

The admin card itself (`client/src/pages/AdminAnalytics.tsx`) renders an in-page banner above the funnel stats explaining the post-Task-#98 completion semantics, calls out that historical raw `booking_link_shared` totals in PostHog before April 2026 are inflated, and recommends migrating top-of-funnel PostHog dashboards/insights/alerts to `booking_link_share_opened`. The same explainer is also delivered from the server as `notes.historical` in the `/share-funnel` response so it stays in sync between the API and the UI.

`booking_link_share_completed` and `booking_link_copied` events also carry a `target` field (Task #108) sourced from the OS share sheet's `activityType` hint via `normalizeShareTarget()` in `client/src/lib/share.ts`. Currently only iOS surfaces a real activity type — Android and most desktop browsers fall back to `unknown`. Copy fallbacks are bucketed under `copy`. The admin endpoint exposes a `targets[]` array with `{ target, completions, copies, shareOfCompletions }`, rendered as the "Breakdown by share destination" table on `AdminAnalytics.tsx`.

## Help Support URL

The `HelpLink` component (`client/src/components/HelpLink.tsx`) builds support article URLs from a configurable base. By default it points at `https://support.gigaid.ai`, but you can override it per environment by setting `VITE_SUPPORT_BASE_URL` (e.g. a staging domain or `http://localhost:4000` during development). The variable must be prefixed with `VITE_` so Vite exposes it to the client bundle.

## Firebase App Check Setup

### Web (Already Implemented)
- Module: `client/src/lib/security/initAppCheck.ts`
- Initialized in `client/src/lib/firebase.ts` right after `initializeApp()`
- Uses `ReCaptchaV3Provider` with `VITE_RECAPTCHA_SITE_KEY`
- Debug tokens auto-enabled in development
- Fails safely if key not set

### iOS — App Attest / DeviceCheck (Firebase Console + Xcode)
1. In Firebase Console → App Check → select the iOS app → register with **App Attest** provider
2. In Xcode, enable the **App Attest** capability under Signing & Capabilities
3. Add `FirebaseAppCheck` pod to `ios/App/Podfile` (included in Firebase iOS SDK 10+)
4. In native Swift code (`AppDelegate.swift`), before `FirebaseApp.configure()`:
   ```swift
   let providerFactory = AppCheckDebugProviderFactory() // debug
   // let providerFactory = AppAttestProviderFactory() // production
   AppCheck.setAppCheckProviderFactory(providerFactory)
   ```

### Android — Play Integrity API (Firebase Console + Gradle)
1. In Firebase Console → App Check → select Android app → register with **Play Integrity** provider
2. Add `com.google.firebase:firebase-appcheck-playintegrity` to `android/app/build.gradle`
3. Initialize in `MainActivity.java` or `Application` class before `FirebaseApp.initializeApp()`:
   ```java
   FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
       PlayIntegrityAppCheckProviderFactory.getInstance()
   );
   ```

### Enforcement (Firebase Console)
To enforce App Check (block requests without valid tokens):
- Firebase Console → App Check → select each service (Auth, Firestore, etc.) → click **Enforce**
- Recommendation: Monitor unverified traffic for 1-2 weeks before enforcing

### Versioning (App Store)
- File: `ios/App/App.xcodeproj/project.pbxproj`
- `MARKETING_VERSION`: User-facing version (e.g., 1.0.0). Update for new App Store versions.
- `CURRENT_PROJECT_VERSION`: Build number (e.g., 1). Increment for every App Store upload.

## UAT Automation

### Architecture
- Runner: `uat-agent/runner/` (Playwright-based, headless Chromium)
- Scenarios: `uat-agent/scenarios/*.json` (5 scenarios: book_and_pay, upgrade_plan, churn_recovery, new_user_onboarding, mobile_pwa_flow)
- Reports: `uat-agent/reports/` (JSON + HTML)
- Run: `npx tsx uat-agent/runner/index.ts` (all) or `npx tsx uat-agent/runner/index.ts "Scenario Name"` (filtered)

### Key Technical Details
- **Service Worker Reload**: Fresh browser contexts trigger SW install which reloads the page ~3-5s after initial load. Login/signup steps wait for the second `load` event before interacting.
- **Analytics Consent Modal**: Pre-set via `addInitScript` to localStorage before navigation to prevent modal from rendering at z-[9999].
- **Optional Steps**: Steps with `"optional": true` in JSON don't fail the scenario. Used for conditional UI elements (e.g., restore-access button in churn recovery).
- **Test User**: `uat-test@gigaid.ai` / `UatTest123!` — needs `onboarding_completed=true`, `payday_onboarding_completed=true`, and `default_price` set in DB to avoid ActivationGate redirects.

## Apple App Store Compliance

### Sign in with Apple (Guideline 4)
- Apple sign-in flow is **silent post-login**: no UI prompts the user for name or email after Apple authentication.
- The server (`server/mobileAuthRoutes.ts` `/api/auth/web/firebase`) auto-creates the user from whatever Firebase returns. `name` is optional and falls back to an email-derived username when Apple withholds it (relay email + suppressed name on second login).
- `[AppleSignIn]` logs report `nameReceived` / `emailReceived` booleans on every success path. Tokens, nonces, and raw credentials are never logged.

### Subscriptions (Guideline 3.1.2)
- The Pricing page (`/pricing`) and Upgrade Intercept modal both expose clickable **Privacy Policy** (`/privacy`) and **Terms of Use** (`/terms`) links before checkout.
- Each plan card shows title, duration label, and price.
- Auto-renewal disclosure is rendered in the bottom fine print on the Pricing page.
- App Store Connect TODO (manual, outside this codebase): set the Privacy Policy URL, and either fill the EULA field or link to Apple’s standard EULA (https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) in the App Description.

### Free plan job limit
- Backend enforces **10 jobs/month** for Free (`shared/planLimits.ts` `maxJobs: 10`, `shared/capabilities/capabilityRules.ts` `jobs.create.limit: 10`).
- Pricing page and Subscription settings copy were updated from "Up to 5 jobs" to "Up to 10 jobs" to match enforcement (Task #15). Decision: keep the more generous backend limit rather than tightening to 5, so existing Free users are not downgraded.

## First Booking Acquisition Flow (Task #19)

For visitors landing on **pre-generated, unclaimed** booking pages from the Growth Engine. Existing claimed `/book/:slug` UX for current GigAid providers is unchanged.

- New tables `booking_pages` and `booking_page_events` (`shared/schema.ts`).
- `outbound_messages.job_id` was made nullable, and a new `booking_page_id` column was added so first-booking nudges can live in the same scheduler/queue as job-bound messages while still being cancelable as a group.
- `GET /api/public/profile/:slug` first checks `booking_pages` for UUID-shaped slugs:
  - **unclaimed** → returns `{ kind: "unclaimed_page", page }` and the React client renders `UnclaimedBookingPage`.
  - **claimed** → resolves to `claimedByUserId` and falls through to the existing public profile flow.
  - else → existing `users.publicProfileSlug` lookup unchanged.
- Claim flow: `POST /api/claim-page` finds-or-creates a lightweight user (no password / email up front), claims the page, schedules two nudge SMS (10 min, 24 h) via `outbound_messages`, signs an app JWT, and redirects to `/first-booking/:pageId`.
- `/first-booking/:pageId` is a standalone route (no sidebar, no app nav) with Copy Link + Send via Text. Both actions hit `POST /api/booking-pages/:pageId/events`, which also cancels pending nudge messages.
- Files: `server/firstBookingRoutes.ts`, `client/src/pages/UnclaimedBookingPage.tsx`, `client/src/pages/FirstBookingPage.tsx`.

### Apple Review Mode flag
- Set `VITE_APPLE_REVIEW_MODE=true` in deployment env to enable review-mode UI gating. Read via `import { isAppleReviewMode } from "@/lib/env"`. When on, the SplashPage decorative background shapes and the Pricing FAQ "Contact Support" teaser card are hidden so reviewers see a focused login + checkout flow. Default is off; auth, paywall, and checkout behavior are unchanged.

### Admin access (Task #136)
- The canonical way to grant admin access is the `ADMIN_EMAILS` **encrypted Replit Secret**: a comma-separated list of email addresses that should receive `super_admin` privileges. **It must be stored as a Secret (Tools → Secrets), never committed via `.replit` shared env vars** — committing it would leak the admin allow-list into version control and was the explicit reason the original Task #136 patch was rejected by code review. Anyone whose login email matches is treated as admin via the bootstrap path in `server/copilot/adminMiddleware.ts` (`BOOTSTRAP_ADMIN_EMAILS`), which short-circuits the check before any DB lookup. This is what makes the Admin Cockpit link appear in the sidebar (`AppSidebar.tsx` reads `/api/admin/status`).
- Email matching is case-insensitive and whitespace-tolerant — both the env var entries and the incoming user email are normalized via `trim().toLowerCase()` before comparison, so casing differences between Replit Auth and Firebase don't silently lock the right person out.
- A separate `ADMIN_USER_IDS` env var supports the same bootstrap path keyed by user id (defaults to `demo-user`).
- The `admins` database table is the secondary mechanism, intended for finer per-user role assignments later. It is checked only when the bootstrap envs do not match. Do not rely on it for the primary owners — keep their emails in `ADMIN_EMAILS`. An orphan row that pointed `thierry.mbandi@outlook.com` at `demo-user` was removed during Task #136 because no real login uses that combination.
- After changing `ADMIN_EMAILS`, the dev workflow must be restarted so the server reads the new value at module load. For production, the change ships with the next deploy.

### Booking link host (Task #128)
- Every public booking link the app generates uses the `account.gigaid.ai` host so customers see a consistent URL (e.g. `https://account.gigaid.ai/book/<slug>`) across email, SMS, follow-ups, the campaign engine, and the in-app share UI — never the request's Host header, never localhost, never the legacy `gigaid.ai/book/...` URL.
- The host is sourced from the shared helper `server/lib/bookingLinkUrl.ts` (`buildBookingLink(slug)`), which reads `FRONTEND_URL` and falls back to `https://account.gigaid.ai`. The default already covers production, so `FRONTEND_URL` only needs to be overridden for staging/dev environments.
- Client-side surfaces that need the link without an API round-trip (Settings slug-edit preview, FirstBookingPage, OnboardingChecklist) use `client/src/lib/bookingBaseUrl.ts` (`buildBookingLink`/`BOOKING_LINK_HOST_DISPLAY`), which mirrors the same default and supports a `VITE_BOOKING_BASE_URL` override. Anything that already has the link from `/api/profile` or `/api/booking/link` should use that value directly.


## Safe Price Helper Rule (Task #164)
- All price/currency rendering in `client/src/**` must go through helpers in `client/src/lib/safePrice.ts` (`safePrice`, `safePriceExact`, `safePriceCents`, `safePriceCentsExact`, `safePriceCentsLocale`, `safePriceRange`, `formatCurrency`). Helpers validate input and return `"--"` (or a custom placeholder) for missing / non-finite / non-positive values, preventing `$NaN`, `$undefined`, or `$0.00` from leaking into the UI.
- Four patterns are forbidden outside `safePrice.ts`: raw `` `$${...}` `` template literal interpolation; JSX text ending in `$` immediately before a `{...}` expression; string concatenation that prefixes `$` (e.g. `"$" + value`); and array `join` of a `$` literal. Enforced by `tests/lib/noRawPriceTemplates.test.ts` (AST scan via `@typescript-eslint/typescript-estree`).
- Full guide and helper picker: `docs/safe-price-rule.md`. Run the check with `npx jest --selectProjects lib --testPathPatterns noRawPriceTemplates --no-cache`.
