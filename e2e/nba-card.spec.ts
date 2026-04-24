import { test, expect, type Page, type Route } from '@playwright/test';
import { BASE_URL } from './helpers';

type NBAState = 'NEW_USER' | 'NO_JOBS_YET' | 'IN_PROGRESS' | 'READY_TO_INVOICE' | 'ACTIVE_USER';

interface NBAExpectation {
  state: NBAState;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  /** When true, the BookingLinkShare primary card must NOT render alongside the NBA card. */
  bookingLinkPrimarySuppressed: boolean;
  /** State name as it appears in the data-testid attribute on the NBA card. */
  testidSuffix: string;
  /** Game-plan dashboardSummary that produces this state from `deriveNBAState`. */
  dashboardSummary: {
    totalJobs: number;
    completedJobs: number;
    totalLeads: number;
    totalInvoices: number;
    sentInvoices: number;
    hasClients?: boolean;
    hasUninvoicedCompletedJobs?: boolean;
    hasLinkShared?: boolean;
  };
}

const NBA_EXPECTATIONS: NBAExpectation[] = [
  {
    state: 'NEW_USER',
    title: 'Get your first client',
    subtitle: 'Share your booking link to start getting jobs.',
    primaryLabel: 'Share Link',
    secondaryLabel: 'Copy Link',
    bookingLinkPrimarySuppressed: true,
    testidSuffix: 'new_user',
    dashboardSummary: {
      totalJobs: 0,
      completedJobs: 0,
      totalLeads: 0,
      totalInvoices: 0,
      sentInvoices: 0,
      hasClients: false,
      hasUninvoicedCompletedJobs: false,
      hasLinkShared: false,
    },
  },
  {
    state: 'NO_JOBS_YET',
    title: 'Share your link to get your first job',
    subtitle: 'Most first jobs come from sharing by text.',
    primaryLabel: 'Share Link',
    secondaryLabel: 'Copy Link',
    bookingLinkPrimarySuppressed: true,
    testidSuffix: 'no_jobs_yet',
    dashboardSummary: {
      totalJobs: 0,
      completedJobs: 0,
      totalLeads: 0,
      totalInvoices: 0,
      sentInvoices: 0,
      hasClients: false,
      hasUninvoicedCompletedJobs: false,
      hasLinkShared: true,
    },
  },
  {
    state: 'IN_PROGRESS',
    title: 'Finish your job to get paid',
    subtitle: "Mark jobs complete when you're done.",
    primaryLabel: 'View Jobs',
    secondaryLabel: 'Update Status',
    bookingLinkPrimarySuppressed: false,
    testidSuffix: 'in_progress',
    dashboardSummary: {
      totalJobs: 1,
      completedJobs: 0,
      totalLeads: 0,
      totalInvoices: 0,
      sentInvoices: 0,
      hasClients: true,
      hasUninvoicedCompletedJobs: false,
      hasLinkShared: true,
    },
  },
  {
    state: 'READY_TO_INVOICE',
    title: "You're 1 step away from getting paid",
    subtitle: 'Send your first invoice to get paid.',
    primaryLabel: 'Create Invoice',
    secondaryLabel: null,
    bookingLinkPrimarySuppressed: true,
    testidSuffix: 'ready_to_invoice',
    dashboardSummary: {
      totalJobs: 1,
      completedJobs: 1,
      totalLeads: 0,
      totalInvoices: 0,
      sentInvoices: 0,
      hasClients: true,
      hasUninvoicedCompletedJobs: true,
      hasLinkShared: true,
    },
  },
  {
    state: 'ACTIVE_USER',
    title: 'Keep the momentum going',
    subtitle: 'Follow up with leads or get your next job.',
    primaryLabel: 'Follow Up',
    secondaryLabel: 'Share Link',
    bookingLinkPrimarySuppressed: false,
    testidSuffix: 'active_user',
    dashboardSummary: {
      totalJobs: 2,
      completedJobs: 2,
      totalLeads: 0,
      totalInvoices: 1,
      sentInvoices: 1,
      hasClients: true,
      hasUninvoicedCompletedJobs: false,
      hasLinkShared: true,
    },
  },
];

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, variant: 'mobile' as const },
  { name: 'desktop', width: 1280, height: 800, variant: 'desktop' as const },
];

const TEST_USER_ID = 'e2e-nba-user';
const TEST_BOOKING_LINK = 'https://gigaid.test/book/e2e-nba-user';

interface CapturedEvent {
  eventName: string;
  properties: Record<string, unknown>;
}

function buildGamePlanResponse(
  expectation: NBAExpectation,
  options: { moneyWaiting?: number } = {},
) {
  return {
    priorityItem: null,
    upNextItems: [],
    stats: {
      jobsToday: 0,
      moneyCollectedToday: 0,
      moneyWaiting: options.moneyWaiting ?? 0,
      messagesToSend: 0,
    },
    recentlyCompleted: [],
    dashboardSummary: expectation.dashboardSummary,
  };
}

/**
 * Stub every API the harness page reaches for, then mock /api/dashboard/game-plan
 * with the supplied response so the NBA card derives state from real query data.
 * Also installs `window.__capturedAnalytics` so `trackEvent` calls can be observed.
 */
async function installHarnessStubs(page: Page, gamePlanResponse: unknown) {
  await page.addInitScript(() => {
    (window as unknown as { __capturedAnalytics: CapturedEvent[] }).__capturedAnalytics = [];
    // Hide the "Taking longer than usual" overlay that can pop up under heavy
    // dev-server load and intercept pointer events during tests.
    const style = document.createElement('style');
    style.textContent =
      '#loading-fallback{display:none !important;visibility:hidden !important;pointer-events:none !important;}';
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }
  });

  // Playwright matches latest-registered routes first, so register the
  // catch-all FIRST and the specific routes LAST so the specifics win.
  await page.route('**/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/auth/user', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: TEST_USER_ID,
        email: 'e2e-nba@gigaid.test',
        name: 'E2E NBA Worker',
      }),
    }),
  );

  await page.route('**/api/profile', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        analyticsEnabled: false,
        attStatus: 'denied',
        services: ['Lawn Care'],
        servicesCount: 1,
      }),
    }),
  );

  await page.route('**/api/booking/link', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookingLink: TEST_BOOKING_LINK, servicesCount: 1 }),
    }),
  );

  await page.route('**/api/dashboard/game-plan', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gamePlanResponse),
    }),
  );

  await page.route('**/api/track/booking-link-shared', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

async function gotoHarness(page: Page, variant: 'mobile' | 'desktop') {
  const url = `${BASE_URL}/_e2e/nba?variant=${variant}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="page-e2e-nba-harness"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="text-nba-title"]', { timeout: 20000 });
}

async function getCapturedAnalytics(page: Page): Promise<CapturedEvent[]> {
  return page.evaluate(
    () =>
      ((window as unknown as { __capturedAnalytics?: CapturedEvent[] }).__capturedAnalytics) ?? [],
  );
}

async function clearCapturedAnalytics(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __capturedAnalytics: CapturedEvent[] }).__capturedAnalytics = [];
  });
}

test.describe('Next Best Action card UI', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} viewport`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const expectation of NBA_EXPECTATIONS) {
        test(`renders ${expectation.state} with the correct title, subtitle, and CTAs`, async ({ page }) => {
          await installHarnessStubs(page, buildGamePlanResponse(expectation));
          await gotoHarness(page, viewport.variant);

          // Exactly one NBA card, and it's for the expected state.
          const allNbaCards = page.locator('[data-testid^="card-nba-"]');
          await expect(allNbaCards).toHaveCount(1);
          await expect(page.locator(`[data-testid="card-nba-${expectation.testidSuffix}"]`))
            .toBeVisible();

          await expect(page.locator('[data-testid="text-nba-title"]'))
            .toHaveText(expectation.title);
          await expect(page.locator('[data-testid="text-nba-subtitle"]'))
            .toHaveText(expectation.subtitle);

          const primary = page.locator('[data-testid="button-nba-primary"]');
          await expect(primary).toHaveCount(1);
          await expect(primary).toBeVisible();
          await expect(primary).toContainText(expectation.primaryLabel);

          const secondary = page.locator('[data-testid="button-nba-secondary"]');
          if (expectation.secondaryLabel) {
            await expect(secondary).toHaveCount(1);
            await expect(secondary).toBeVisible();
            await expect(secondary).toContainText(expectation.secondaryLabel);
          } else {
            await expect(secondary).toHaveCount(0);
          }
        });

        test(`has the correct booking-link / payment card layout for ${expectation.state} (no money waiting)`, async ({ page }) => {
          await installHarnessStubs(page, buildGamePlanResponse(expectation));
          await gotoHarness(page, viewport.variant);

          // Always exactly one NBA card.
          await expect(page.locator('[data-testid^="card-nba-"]')).toHaveCount(1);

          // No payment card when nothing is waiting.
          await expect(page.locator('[data-testid="card-payment"]')).toHaveCount(0);

          // Booking-link presence depends on whether NBA's primary already covers it.
          const bookingLink = page.locator('[data-testid="card-booking-link"]');
          if (expectation.bookingLinkPrimarySuppressed) {
            // No standalone Share Link primary alongside an NBA whose CTA already shares.
            await expect(bookingLink).toHaveCount(0);
          } else {
            // Standalone share card renders exactly once for IN_PROGRESS / ACTIVE_USER.
            await expect(bookingLink).toHaveCount(1);
            await expect(bookingLink).toBeVisible();
          }
        });

        test(`fires nba_primary_clicked exactly once for ${expectation.state}`, async ({ page }) => {
          await installHarnessStubs(page, buildGamePlanResponse(expectation));
          await gotoHarness(page, viewport.variant);

          // Drop nba_shown so we only assert click events.
          await clearCapturedAnalytics(page);

          await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

          await page.locator('[data-testid="button-nba-primary"]').click();

          // Allow click handler + any wouter navigation to settle.
          await page.waitForTimeout(250);

          const events = await getCapturedAnalytics(page);
          const primaryClicks = events.filter((e) => e.eventName === 'nba_primary_clicked');
          expect(primaryClicks).toHaveLength(1);
          expect(primaryClicks[0].properties).toMatchObject({
            state: expectation.state,
            cta_label: expectation.primaryLabel,
          });
        });

        if (expectation.secondaryLabel) {
          test(`fires nba_secondary_clicked exactly once for ${expectation.state}`, async ({ page }) => {
            await installHarnessStubs(page, buildGamePlanResponse(expectation));
            await gotoHarness(page, viewport.variant);

            await clearCapturedAnalytics(page);

            await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

            await page.locator('[data-testid="button-nba-secondary"]').click();
            await page.waitForTimeout(250);

            const events = await getCapturedAnalytics(page);
            const secondaryClicks = events.filter((e) => e.eventName === 'nba_secondary_clicked');
            expect(secondaryClicks).toHaveLength(1);
            expect(secondaryClicks[0].properties).toMatchObject({
              state: expectation.state,
              cta_label: expectation.secondaryLabel,
            });
          });
        }
      }

      // Payment-card scenario: with money waiting, the standalone payment card
      // appears exactly once alongside (not duplicating) the NBA card.
      test(`renders exactly one NBA card and one payment card when money is waiting (${viewport.name})`, async ({ page }) => {
        const readyToInvoice = NBA_EXPECTATIONS.find((e) => e.state === 'READY_TO_INVOICE')!;
        await installHarnessStubs(
          page,
          buildGamePlanResponse(readyToInvoice, { moneyWaiting: 25000 }),
        );
        await gotoHarness(page, viewport.variant);

        await expect(page.locator('[data-testid^="card-nba-"]')).toHaveCount(1);
        await expect(page.locator('[data-testid="card-nba-ready_to_invoice"]')).toBeVisible();

        const paymentCard = page.locator('[data-testid="card-payment"]');
        await expect(paymentCard).toHaveCount(1);
        await expect(paymentCard).toBeVisible();

        // Booking-link primary stays suppressed in READY_TO_INVOICE.
        await expect(page.locator('[data-testid="card-booking-link"]')).toHaveCount(0);
      });
    });
  }
});
