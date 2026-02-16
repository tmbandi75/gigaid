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