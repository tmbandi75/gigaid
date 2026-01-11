# Gig Aid

## Overview

Gig Aid is a mobile-first productivity application designed for gig workers like plumbers, cleaners, and electricians. The app helps users manage clients, jobs, leads, and invoices through an efficient, touch-optimized interface with voice input capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Design System**: Material Design 3 principles with mobile-first optimization
- **Typography**: Roboto font family from Google Fonts

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Style**: RESTful JSON API with `/api` prefix
- **Build Tool**: Custom build script using esbuild for server bundling and Vite for client

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation via drizzle-zod
- **Current Storage**: In-memory storage implementation (`MemStorage` class) for development
- **Database Ready**: PostgreSQL configuration prepared in `drizzle.config.ts`

### Key Entities
- **Users**: Basic authentication with username/password
- **Jobs**: Scheduled work with status tracking (scheduled, in_progress, completed, cancelled)
- **Leads**: Potential clients with contact info and conversion status
- **Invoices**: Billing records with payment status tracking

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # UI components (layout, dashboard, ui library)
│       ├── pages/        # Route page components
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage abstraction
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client and server
│   └── schema.ts     # Database schema and types
└── migrations/       # Drizzle database migrations
```

### Path Aliases
- `@/*` maps to `client/src/*`
- `@shared/*` maps to `shared/*`

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **connect-pg-simple**: PostgreSQL session storage for Express

### UI Framework
- **Radix UI**: Headless component primitives (dialogs, dropdowns, tabs, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Zod integration for React Hook Form

### Development
- **Vite**: Frontend build tool with HMR
- **tsx**: TypeScript execution for Node.js
- **drizzle-kit**: Database migration tooling

## Stripe Connect Configuration

GigAid uses Stripe Connect (Express) for deposit-safe payments. This system allows:
- Collecting deposits from customers that are held securely by the platform
- Automatic release of funds to providers after job completion
- Protection for customers against no-shows with refund capabilities

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Your Stripe secret key (starts with `sk_`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret for verifying Stripe events |
| `STRIPE_CLIENT_ID` | Your platform's Stripe Connect client ID (found in Connect settings) |
| `FRONTEND_URL` | Your application's public URL (e.g., `https://your-app.replit.app`) for redirect URLs |

### Stripe Dashboard Setup

1. **Enable Connect**: Go to Stripe Dashboard > Connect > Get started
2. **Configure Express Accounts**: Enable Express account onboarding
3. **Set Platform Settings**: Configure your platform's branding and policies
4. **Create Webhook Endpoint**: 
   - Endpoint URL: `https://your-domain.com/api/stripe/connect/webhook`
   - Events to listen for:
     - `account.updated` - Provider account status changes
     - `payment_intent.succeeded` - Deposit payments completed
     - `charge.refunded` - Refunds processed
     - `transfer.created` - Funds transferred to providers
     - `charge.dispute.created` - Customer disputes (auto-holds funds)

### Deposit Flow

1. **Booking Created**: Customer books a service, deposit amount calculated
2. **Payment Collected**: Customer pays deposit via Stripe PaymentIntent
3. **Funds Held**: Deposit held in platform's Stripe account (not transferred)
4. **Job Completion**: After service is marked complete:
   - Customer confirms completion → Deposit transferred immediately
   - No response after 36 hours → Auto-release to provider
   - Customer flags issue → Deposit held for dispute resolution

### Reschedule Policy

Late reschedules (within 24h of appointment) incur retention fees:
- 1st late reschedule: 40% retained
- 2nd late reschedule: 60% retained  
- Maximum retention: 75%

Providers can waive reschedule fees for specific bookings.

### Testing

Run deposit flow tests:
```bash
npx tsx server/tests/deposit.test.ts
```

### Key Files

- `server/stripeClient.ts` - Stripe client initialization
- `server/depositAutoRelease.ts` - Background scheduler for auto-release
- `shared/schema.ts` - Deposit-related database fields
- `client/src/components/settings/StripeConnectSettings.tsx` - Provider onboarding UI
- `client/src/pages/CustomerBookingDetail.tsx` - Customer deposit/confirmation UI
- `client/src/pages/BookingRequests.tsx` - Provider booking management with deposit info

## Google Maps Configuration

GigAid uses Google Maps for job location tracking and geocoding.

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_MAPS_API_KEY` | Server-side API key for geocoding |
| `VITE_GOOGLE_MAPS_API_KEY` | Client-side API key for map display |

### Required Google APIs

Enable the following APIs in the Google Cloud Console:
- **Maps JavaScript API** - For embedded map display
- **Geocoding API** - For address-to-coordinates conversion
- **Places API** - For address autocomplete (optional)

### Location Features

- **Customer Location**: Automatically geocoded when booking is created from the address field
- **Provider Location**: Captured via browser geolocation when provider taps "Update My Location"
- **Distance Calculation**: Haversine formula for straight-line distance in miles
- **Directions**: Deep links to Google Maps and Apple Maps for navigation

### Key Files

- `server/geocode.ts` - Geocoding utility using Google Maps API
- `client/src/components/JobLocationMap.tsx` - Map display with dual pins and distance
- `client/src/pages/JobForm.tsx` - Job detail page with location tracking integration

## iOS App Build (Capacitor)

GigAid uses Capacitor to package the web app as a native iOS application.

### Prerequisites

- **macOS** with Xcode 14+ installed
- **Apple Developer Account** ($99/year) for App Store submission
- **CocoaPods** installed (`sudo gem install cocoapods`)

### Building for iOS

1. **Build the web app**:
   ```bash
   npm run build
   ```

2. **Sync with Capacitor**:
   ```bash
   npx cap sync ios
   ```

3. **Install CocoaPods dependencies** (first time only):
   ```bash
   cd ios/App && pod install && cd ../..
   ```

4. **Open in Xcode**:
   ```bash
   npx cap open ios
   ```

5. **In Xcode**:
   - Select your team under Signing & Capabilities
   - Set the Bundle Identifier to match your Apple Developer account (change `com.gigaid.app` to your own)
   - Add your app icon in Assets.xcassets
   - Choose a target device or "Any iOS Device"
   - Product → Archive for App Store submission

### App Configuration

The Capacitor config is in `capacitor.config.ts`:
- **Bundle ID**: `com.gigaid.app` (change to match your Apple Developer account)
- **App Name**: Gig Aid
- **Web Directory**: `dist/public`

### Key Files

- `capacitor.config.ts` - Capacitor configuration
- `ios/` - Native iOS Xcode project
- `client/src/index.css` - iOS safe area insets for notch handling

### Updating the App

After making changes to the web app:
```bash
npm run build && npx cap sync ios
```

Then rebuild in Xcode.