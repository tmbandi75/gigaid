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
- **Universal Priority Signals**: AI-inferred priority badges (high, at_risk, time_sensitive, payment_risk) appear on leads, jobs, invoices, and messages to help users focus on what matters most.
- **Progressive Disclosure**: Advanced AI tools (Get More Bookings, Know Who's Serious, Grow My Business, Referral Generator) are gated until user completes their first job or receives first payment, reducing cognitive overload for new users.
- **Verb-Based Status Labels**: All status chips and filters use action-oriented language ("Just Added", "Coming Up", "Awaiting Reply", "Not Sent") instead of technical states for better clarity.

## External Dependencies

- **Database**: PostgreSQL, connect-pg-simple
- **UI Frameworks**: Radix UI, Tailwind CSS, Lucide React, class-variance-authority
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers
- **Development Tools**: Vite, tsx, drizzle-kit
- **Payment Processing**: Stripe Connect (requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CLIENT_ID`, `FRONTEND_URL`)
- **Mapping & Geocoding**: Google Maps API (requires `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`), Google Maps JavaScript API, Geocoding API, Places API
- **Mobile Packaging**: Capacitor (for iOS), PWA for Android (via PWABuilder)

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