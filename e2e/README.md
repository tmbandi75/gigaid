# GigAid E2E Testing

## Overview

This directory contains end-to-end tests for the GigAid application using Playwright.

## Test Structure

```
e2e/
├── helpers.ts          # Common test utilities
├── api.spec.ts         # API endpoint tests (works in all environments)
├── navigation.spec.ts  # Page navigation tests
├── jobs.spec.ts        # Job management tests
├── leads.spec.ts       # Lead management tests
├── invoices.spec.ts    # Invoice management tests
├── admin.spec.ts       # Admin panel tests
├── settings.spec.ts    # Settings page tests
├── onboarding.spec.ts  # Onboarding flow tests
└── README.md           # This file
```

## Running Tests

### API Tests (Works Everywhere)

API tests don't require a browser and work in all environments:

```bash
# Run all API tests
npx playwright test e2e/api.spec.ts

# Run with verbose output
npx playwright test e2e/api.spec.ts --reporter=list
```

### Browser Tests (Local/CI Environment)

Browser tests require system dependencies and work best locally or in CI:

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run headed (visible browser)
npx playwright test --headed

# Run specific test file
npx playwright test e2e/navigation.spec.ts
```

### View Test Report

```bash
npx playwright show-report
```

## Test Coverage

### API Tests (11 tests)
- ✅ Jobs API - GET /api/jobs
- ✅ Leads API - GET /api/leads
- ✅ Invoices API - GET /api/invoices
- ✅ Admin search API - GET /api/admin/users/search
- ✅ Admin views API - GET /api/admin/users/views
- ✅ Admin user detail - GET /api/admin/users/:id
- ✅ Admin actions validation (reason required)
- ✅ Admin actions validation (invalid keys rejected)
- ✅ Admin tests API - POST /api/test/admin-users
- ✅ Copilot metrics API
- ✅ Copilot focus API

### Browser Tests (when available)
- Navigation (6 tests)
- Jobs management (5 tests)
- Leads management (6 tests)
- Invoices management (5 tests)
- Admin panel (12 tests)
- Settings (5 tests)
- Onboarding (6 tests)

## Configuration

The Playwright configuration is in `playwright.config.ts`:

- Test directory: `./e2e`
- Base URL: `http://localhost:5000`
- Browser: Chromium
- Screenshots: On failure
- Traces: On first retry

## Backend Tests

In addition to Playwright tests, the app has backend API tests:

```bash
# Run admin panel tests
curl -X POST http://localhost:5000/api/test/admin-users

# Run no-silent-completion tests
curl -X POST http://localhost:5000/api/test/no-silent-completion
```

## CI/CD Integration

For GitHub Actions or other CI environments, add this to your workflow:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E Tests
  run: npx playwright test
```

## Troubleshooting

### Browser tests failing with missing libraries

If browser tests fail with errors like "cannot open shared object file", you need to install Playwright's dependencies:

```bash
npx playwright install-deps
```

Or run tests in a Docker container with the Playwright image.

### API tests work but browser tests don't

API tests use HTTP requests directly and don't need a browser. If browser tests fail, the API tests still provide comprehensive backend coverage.
