# App Store Screenshot Generator (Jobber-Style)

Generates 7 marketing screenshots for Apple App Store submission.

## Output

- Resolution: 1290 x 2796 px (iPhone 17 Pro)
- Format: PNG
- Location: `/exports/appstore/iphone/`

## Screenshots

| # | File | Screen |
|---|------|--------|
| 1 | 01-hero.png | Dashboard / Game Plan |
| 2 | 02-booking.png | Public Booking Page |
| 3 | 03-payments.png | Invoices |
| 4 | 04-jobs.png | Jobs List |
| 5 | 05-ai.png | AI Tools / Co-Pilot |
| 6 | 06-clients.png | Leads |
| 7 | 07-overview.png | More / Tools |

## How to Run

```bash
npx tsx scripts/appstore/run.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UAT_BASE_URL` | `http://localhost:5000` | App base URL |
| `UAT_TEST_EMAIL` | `uat-test@gigaid.ai` | Test account email |
| `UAT_TEST_PASSWORD` | `UatTest123!` | Test account password |

## Screenshot Mode

The app supports a `?ss=1` query parameter that hides:
- Activation checklists
- First Dollar banners
- Analytics consent modals

This mode only activates with `?ss=1` and has zero effect on normal users.

## Pipeline

1. **Capture** — Playwright navigates to each route with `?ss=1`, captures at 3x scale
2. **Compose** — Sharp composites each screenshot into a Jobber-style poster with device frame, textured gradient background, headlines with accent underline, and drop shadow
3. **Validate** — Checks resolution, format, and file size
