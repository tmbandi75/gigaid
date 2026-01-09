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