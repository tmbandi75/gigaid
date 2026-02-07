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
```

### Test Coverage Summary (47 API + 6 E2E suites)
- **Auth**: Token validation, unauthenticated access blocking, profile retrieval
- **Jobs**: CRUD, cross-user isolation, capability usage tracking
- **Leads**: CRUD, archive/unarchive, cross-user isolation
- **Invoices**: CRUD, public invoice view
- **Capabilities**: Free plan limits (jobs=10, SMS=20), pro plan unlimited, usage enforcement
- **Booking**: Public booking creation, invalid slug handling, auth-protected request listing
- **Messaging**: SMS send validation, conversation listing, usage reporting