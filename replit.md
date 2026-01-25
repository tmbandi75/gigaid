# Gig Aid

## Overview

Gig Aid is a mobile-first productivity application for gig workers (e.g., plumbers, cleaners, electricians). It streamlines client, job, lead, and invoice management through a touch-optimized interface with voice input. The project aims to enhance efficiency and revenue generation for service professionals, addressing market needs for specialized, mobile-centric business tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with CSS variables (light/dark mode)
- **Design System**: Material Design 3 principles, mobile-first
- **Typography**: Roboto from Google Fonts

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Style**: RESTful JSON API (`/api` prefix)
- **Build Tool**: esbuild for server, Vite for client

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation
- **Storage**: In-memory for development, PostgreSQL-ready
- **Key Entities**: Users, Jobs, Leads, Invoices

### Core Features
- **Stripe Connect Integration**: Facilitates deposit-safe payments with automatic fund release, dispute resolution, and reschedule policies to protect both customers and providers.
- **Price Confirmation Workflow**: Allows providers to send price confirmations to clients for approval before converting a lead into a scheduled job, automating job creation upon client confirmation.
- **Google Maps Integration**: Provides geocoding, location tracking, distance calculation, and navigation for job locations and provider positions.
- **No Silent Completion**: A three-level enforcement system (UI modal, API guard, background enforcer) ensures every completed job has an explicit payment resolution, preventing revenue loss.
- **AI Micro-Nudges System**: Contextual, AI-powered recommendations help users manage leads, invoices, and jobs effectively, with dynamic priority boosting, daily caps, and cooldowns.
- **Today's Money Plan**: Global action queue prioritizing leads, jobs, and invoices by revenue impact. Features smart prioritization (urgent/important/normal), snooze functionality, and deduplication. Enable via `today_money_plan` feature flag.
- **Outcome Attribution**: Conservative impact metrics showing time and money saved through GigAid suggestions. Calculates days saved (0.5 per acted nudge) and cash acceleration. Enable via `outcome_attribution` feature flag.
- **iOS App Build (Capacitor)**: The web application is packaged as a native iOS app using Capacitor, enabling native features and App Store distribution.
- **Android App Build (Capacitor)**: The web application is packaged as a native Android app using Capacitor, enabling native features and Play Store distribution.
- **Universal Priority Signals**: AI-inferred priority badges (high, at_risk, time_sensitive, payment_risk) appear on leads, jobs, invoices, and messages to help users focus on what matters most.
- **Progressive Disclosure**: Advanced AI tools (Get More Bookings, Know Who's Serious, Grow My Business, Referral Generator) are gated until user completes their first job or receives first payment, reducing cognitive overload for new users.
- **Verb-Based Status Labels**: All status chips and filters use action-oriented language ("Just Added", "Coming Up", "Awaiting Reply", "Not Sent") instead of technical states for better clarity.
- **Offline Capture Infrastructure**: IndexedDB-based local storage ensures user input is never lost. Offline-safe actions (notes, photos, voice notes, status updates, drafts) are queued locally and synced when connectivity is restored. Assets persist as Blobs in IndexedDB to survive app reloads.
- **Drive Mode**: Hands-free interface with large touch targets for use while on the move. Passive motion detection (speed > 12mph for 45-60s) triggers a polite suggestion prompt. Three actions available: record voice note, mark job complete, add note. All actions work offline with background sync. Users can decline twice to permanently dismiss the prompt.
- **Event-Driven Client Notifications**: Enables providers to send targeted SMS/email notifications to past clients based on event triggers (weather, seasonal, availability, safety). Features category-to-event mapping, rate limiting (1/service/week, 2/account/week), message constraints (320 char SMS, mandatory opt-out), and quiet hours enforcement. Phase 2 includes AI-powered suggestion detection that monitors external signals and creates advisory-only suggestions (never auto-sends). Requires `ai_campaign_suggestions` capability (Pro+ or Business plans). Routes: `/notify-clients` for campaign wizard.

## External Dependencies

- **Database**: PostgreSQL, connect-pg-simple
- **UI Frameworks**: Radix UI, Tailwind CSS, Lucide React, class-variance-authority
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers
- **Development Tools**: Vite, tsx, drizzle-kit
- **Payment Processing**: Stripe Connect (requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CLIENT_ID`, `FRONTEND_URL`)
- **Mapping & Geocoding**: Google Maps API (requires `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`), Google Maps JavaScript API, Geocoding API, Places API
- **Mobile Packaging**: Capacitor (for iOS and Android), PWA for Android (via PWABuilder as alternative)
- **Mobile Authentication**: Firebase Admin SDK for server-side token verification (requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `APP_JWT_SECRET`)

## Authentication Architecture

### Dual Authentication System
The app supports two authentication methods:
1. **Web (Replit Auth)**: Uses OpenID Connect with Replit as the identity provider. Session-based with cookies.
2. **Mobile (Firebase Auth)**: Uses Firebase Authentication with Google, Apple, Email, or Phone sign-in. JWT-based with Bearer tokens.

### Account Linking
Accounts are automatically linked by:
1. Firebase UID (if user has logged in via Firebase before)
2. Normalized email address (lowercase, trimmed)
3. Phone number (E.164 format)
4. Raw email address (fallback)

### Mobile Auth Flow
1. Mobile app authenticates user with Firebase (Google/Apple/Email/Phone)
2. Mobile app receives Firebase ID token
3. App sends ID token to `POST /api/auth/mobile/firebase`
4. Server verifies token with Firebase Admin SDK
5. Server finds or creates user, links accounts if applicable
6. Server issues app-specific JWT (30-day expiry)
7. Mobile app stores JWT and uses it for all API calls via `Authorization: Bearer <token>`

### Database Fields
- `firebaseUid`: Unique Firebase user ID
- `emailNormalized`: Lowercase, trimmed email for matching
- `phoneE164`: Phone number in E.164 format for matching
- `authProvider`: Primary auth provider ('replit' | 'firebase')
- `updatedAt`: Last update timestamp

### API Endpoints
- `POST /api/auth/mobile/firebase`: Exchange Firebase ID token for app JWT
- `GET /api/auth/mobile/status`: Check Firebase configuration status
- `GET /api/auth/user`: Get current user (supports both session and JWT)

### Files
- `server/firebaseAdmin.ts`: Firebase Admin SDK initialization and token verification
- `server/appJwt.ts`: App JWT signing and verification
- `server/mobileAuthRoutes.ts`: Mobile authentication endpoints
- `client/src/lib/auth/mobileAuth.ts`: Frontend mobile auth helpers
- `client/src/components/MobileLogin.tsx`: Mobile login UI component

## UI Policies

### Emoji Usage Policy

**Global Rules:**
- Emojis are allowed ONLY in user-facing presentation layers (React components and email templates)
- Emojis are FORBIDDEN in: JSON schemas, database fields, API requests/responses, enums, constants, AI prompts, logs, analytics

**UI Usage Rules:**
- Limit to ONE emoji per UI element
- Emojis appear BEFORE text labels
- Emojis must NEVER replace text labels
- Allowed only for: status indicators, primary action buttons, success confirmations, onboarding guidance

**Prohibited UI Locations:**
- Error/warning messages
- Legal, billing, payment disclaimers
- Settings, admin, configuration screens
- Data tables with multiple columns
- Marketing/branding copy

**Approved Emoji Whitelist:**
- Status: 🆕 ⏳ 📅 🔧 ✅ 💰 ❌
- Actions: 📤 💬 📍 💳 🔔
- Success: 🎉 💵 ⭐

**Enforcement:**
- All emoji usage must come from the approved whitelist
- UI must remain fully understandable with emojis removed
- Prefer Lucide icons over emojis when possible

## Mobile App Build (Capacitor)

### Directory Structure
- `ios/` - iOS native project (Xcode)
- `android/` - Android native project (Android Studio)
- `capacitor.config.ts` - Capacitor configuration

### Prerequisites
- **For Android**: Android Studio with SDK 24+ installed locally
- **For iOS**: Xcode 15+ installed on macOS

### Building for Android

1. **Build the web app and sync to Android:**
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Add Firebase config (required for authentication):**
   - Download `google-services.json` from Firebase Console
   - Place it in `android/app/google-services.json`

3. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

4. **Build APK/AAB:**
   - In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
   - Or for release: Build > Generate Signed Bundle / APK

### Building for iOS

1. **Build the web app and sync to iOS:**
   ```bash
   npm run build
   npx cap sync ios
   ```

2. **Add Firebase config (required for authentication):**
   - Download `GoogleService-Info.plist` from Firebase Console
   - Add it to the Xcode project via Xcode

3. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

4. **Build and run:**
   - Select target device/simulator
   - Click Run or archive for distribution

### Useful Capacitor Commands
- `npx cap sync` - Build and copy web assets to native projects
- `npx cap copy` - Copy web assets without rebuilding plugins
- `npx cap update` - Update native project dependencies
- `npx cap doctor` - Check project health

### Firebase Configuration Files
- **Android**: `android/app/google-services.json`
- **iOS**: `ios/App/App/GoogleService-Info.plist`

These files are required for Firebase Authentication to work in the native apps.