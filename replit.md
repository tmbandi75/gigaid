# Gig Aid

## Overview
Gig Aid is a mobile-first productivity application designed for gig workers such as plumbers, cleaners, and electricians. Its primary purpose is to streamline client, job, lead, and invoice management through a touch-optimized interface with voice input capabilities. The project's vision is to enhance efficiency and revenue generation for service professionals by providing a specialized, mobile-centric business tool that addresses current market needs.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with CSS variables (light/dark mode)
- **Design System**: Material Design 3 principles, mobile-first design, Roboto typography.

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
- **Payment Processing**: Stripe Connect for deposit-safe payments, dispute resolution, and reschedule policies.
- **Price Confirmation Workflow**: Automates job creation upon client approval of price confirmations.
- **Google Maps Integration**: Provides geocoding, location tracking, distance calculation, and navigation.
- **No Silent Completion**: A three-level enforcement system (UI, API, background) ensures explicit payment resolution for completed jobs.
- **AI Micro-Nudges System**: Contextual, AI-powered recommendations for managing leads, invoices, and jobs.
- **Today's Money Plan**: Global action queue prioritizing leads, jobs, and invoices by revenue impact.
- **Outcome Attribution**: Measures time and money saved through GigAid suggestions.
- **Mobile App Builds**: Web application packaged as native iOS and Android apps using Capacitor.
- **Universal Priority Signals**: AI-inferred priority badges for leads, jobs, invoices, and messages.
- **Progressive Disclosure**: Advanced AI tools are gated until initial user milestones are met.
- **Verb-Based Status Labels**: Action-oriented language for all status chips and filters.
- **Offline Capture Infrastructure**: IndexedDB-based local storage for offline data capture and background sync.
- **Drive Mode**: Hands-free interface with large touch targets for use while on the move, triggered by passive motion detection.
- **Event-Driven Client Notifications**: Targeted SMS/email notifications to past clients based on event triggers, with rate limiting and quiet hours enforcement.

### Authentication Architecture
- **Dual Authentication**: Supports Web (OpenID Connect with Replit) and Mobile (Firebase Authentication with Google, Apple, Email, Phone).
- **Account Linking**: Accounts linked by Firebase UID, normalized email, E.164 phone number, or raw email.
- **Mobile Auth Flow**: Firebase ID token exchange for app-specific JWT.

### Capability Enforcement Engine
- **Overview**: Uses limits, caps, and progressive unlocks instead of hard feature locks, preserving a unified product experience.
- **Plans**: Free, Pro, Pro+, Business tiers with varying limits and capabilities.
- **Design Principles**: No feature hiding, no UI forking by plan, no navigation blocking, no pricing modals, inline human-readable limit messages, centralized and declarative enforcement.

### UI Policies
- **Emoji Usage Policy**: Emojis allowed only in user-facing presentation layers (React components, email templates) and forbidden in data layers. Limited to one emoji per UI element, appearing before text labels, and must never replace text. An approved whitelist of emojis is enforced.

## External Dependencies

- **Database**: PostgreSQL
- **UI Frameworks**: Radix UI, Tailwind CSS, Lucide React
- **Form & Validation**: React Hook Form, Zod
- **Payment Processing**: Stripe Connect
- **Mapping & Geocoding**: Google Maps API (JavaScript API, Geocoding API, Places API)
- **Mobile Packaging**: Capacitor (iOS, Android)
- **Mobile Authentication**: Firebase Admin SDK

## Day-1 User Bug & Surprise Audit (February 2026)

### Audit Summary
Systematic review across 9 categories to identify and fix Day-1 user experience issues.

### Findings

| Category | Status | Notes |
|----------|--------|-------|
| Silent Failures | Fixed | IntentActionCard now shows specific error messages |
| Navigation Sync | Pass | Bottom nav syncs with location via useLocation() |
| Empty States | Pass | Jobs, Invoices, Leads have proper empty states with CoachingRenderer |
| Permission Gating | Pass | CapabilityGate shows inline human-readable reasons |
| Mobile UX | Pass | SwipeableCard renders only on mobile, responsive design |
| Error Handling | Pass | All mutations use toast feedback with destructive variant |
| External Flows | Pass | Stripe opens in new tab with auto-refresh on return |
| Performance | Pass | Critical queries have appropriate refetch intervals |
| Archive/Delete | Pass | Business rules enforced with 403 and human-readable errors |

### Archive/Delete Action Rules
- **Jobs**: Cancel (scheduled), Archive (completed/cancelled), Delete (drafts only)
- **Invoices**: Archive (always), Delete (drafts only)
- **Leads**: Archive/Delete (always with confirmation)

### Billing Management UI
- **Settings Page Structure**: Tabbed navigation with "General" (profile/automation settings) and "Billing" (subscription/invoices) tabs
- **Invoice History**: Fetched from Stripe via GET /api/billing/invoices, displays invoice number, date, amount, status with view/download buttons
- **Invoice Amounts**: Uses amount_paid for paid invoices, amount_due for open/void invoices

### Data Layer Architecture (February 2026 Refactor)
- **Migration Status**: Complete — all 80+ files migrated, `apiRequest` removed, zero legacy patterns remaining, zero inline query key strings remaining
- **QueryClient**: staleTime: 0, gcTime: 5min, refetchOnMount: "always", refetchOnWindowFocus: true, retry: 1
- **Central API Fetcher**: `client/src/lib/apiFetch.ts` — typed fetcher with auth token injection and token-readiness guard for mutations
- **Query Keys**: `client/src/lib/queryKeys.ts` — centralized QUERY_KEYS constant for all domains (145+ keys covering every endpoint)
- **Mutation Hook**: `client/src/hooks/useApiMutation.ts` — standardized mutation with automatic cache invalidation via query keys
- **Offline Sync**: `client/src/lib/offlineSync.ts` uses apiFetch for background sync operations
- **Public Endpoints**: PayDeposit.tsx, ConfirmPrice.tsx, PublicReview.tsx use raw useMutation with fetch (no auth tokens required)
- **Crew Duplicate Prevention**: POST /api/crew checks for existing members by normalized email/phone before creating
- **Crew Welcome Notifications**: SMS (Twilio) and email (SendGrid) sent automatically when a crew member is created

### Booking Link Sharing
- **Unified Component**: `BookingLinkShare` component with three variants (primary/inline/compact) consolidates all booking link sharing UI
- **API Endpoint**: GET `/api/booking/link` returns the user's booking link
- **Usage Locations**: Plan page (primary card), Leads page (inline banner), Jobs page (compact button), Booking Requests page (inline)
- **Native Share Support**: Uses `navigator.share` when available, falls back to clipboard copy on unsupported devices
- **Empty State**: `BookingLinkEmptyState` component for Leads empty state with copy functionality
- **Components**: Located in `client/src/components/booking-link/` (BookingLinkShare.tsx, BookingLinkEmptyState.tsx, index.ts)