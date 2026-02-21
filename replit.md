# Gig Aid

## Overview
Gig Aid is a mobile-first productivity application for gig workers, such as plumbers, cleaners, and electricians. Its primary purpose is to streamline client, job, lead, and invoice management to enhance efficiency and revenue generation. The project focuses on a specialized, touch-optimized mobile interface with voice input, providing a comprehensive business tool that includes an acquisition engine and churn prediction for sustainable growth.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, leveraging shadcn/ui (built on Radix UI) and Tailwind CSS for styling, supporting both light and dark modes. The design adheres to mobile-first principles and Material Design 3, utilizing Roboto typography. The web application is packaged into native iOS and Android apps using Capacitor.

### Backend
The backend is built with Node.js and Express.js, using TypeScript and ESM modules. It exposes a RESTful JSON API. esbuild is used for server builds, while Vite handles client-side builds.

### Data Layer
Drizzle ORM is used with a PostgreSQL dialect. The schema is defined in `shared/schema.ts` with Zod validation. Data is stored in-memory for development and in PostgreSQL for production. Key entities include Users, Jobs, Leads, Invoices, and various growth/tracking-related data.

### Core Features
- **Payment Processing**: Integrates Stripe Connect for secure payments, deposits, and dispute resolution.
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