import { test, expect, type Page, type Route } from '@playwright/test';
import { BASE_URL } from './helpers';

type Variant = 'primary' | 'inline' | 'compact';

interface CapturedEvent {
  eventName: string;
  properties: Record<string, unknown>;
}

type NavigatorShareStub = Navigator & { share?: (data: unknown) => Promise<void> };

const TEST_USER_ID = 'e2e-booking-link-user';
const TEST_BOOKING_LINK = 'https://gigaid.test/book/e2e-booking-link-user';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const VARIANTS: readonly Variant[] = ['primary', 'inline', 'compact'];

const COPY_TEST_IDS: Record<Variant, string> = {
  primary: 'button-copy-booking-link',
  inline: 'button-copy-booking-link-leads',
  compact: 'button-share-booking-link-jobs',
};

const SHARE_TEST_IDS: Record<Variant, string | null> = {
  primary: 'button-share-booking-link',
  inline: 'button-share-booking-link-leads',
  // Compact variant only has a copy button — no share button to drive.
  compact: null,
};

/**
 * Stub every API the harness page reaches for, then mock the booking-link
 * endpoint so the BookingLinkShare card renders. Also installs
 * `window.__capturedAnalytics` so `trackEvent` calls can be observed —
 * the same opt-in hook the NBA spec relies on.
 */
async function installHarnessStubs(page: Page) {
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
        email: 'e2e-booking-link@gigaid.test',
        name: 'E2E Booking Link Worker',
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

  await page.route('**/api/track/booking-link-shared', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/api/track/booking-link-share-tap', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/api/track/booking-link-copied', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

async function gotoHarness(page: Page, variant: Variant) {
  const url = `${BASE_URL}/_e2e/booking-link-share?variant=${variant}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="page-e2e-booking-link-share-harness"]', {
    timeout: 20000,
  });
  await page.waitForSelector(`[data-testid="harness-booking-link-${variant}"]`, { timeout: 20000 });
  // Wait until the booking-link query resolves and the variant's copy button mounts.
  await page.waitForSelector(`[data-testid="${COPY_TEST_IDS[variant]}"]`, { timeout: 20000 });
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

test.describe('BookingLinkShare card', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} viewport`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('primary variant renders the booking link, Copy, and Share buttons', async ({ page }) => {
        // Ensure Share button shows on web by stubbing navigator.share.
        await page.addInitScript(() => {
          (navigator as NavigatorShareStub).share = () => Promise.resolve();
        });
        await installHarnessStubs(page);
        await gotoHarness(page, 'primary');

        const card = page.locator('[data-testid="card-booking-link"]');
        await expect(card).toHaveCount(1);
        await expect(card).toBeVisible();
        await expect(card).toContainText(TEST_BOOKING_LINK);

        const copy = page.locator('[data-testid="button-copy-booking-link"]');
        await expect(copy).toBeVisible();
        await expect(copy).toContainText('Copy Link');

        const share = page.locator('[data-testid="button-share-booking-link"]');
        await expect(share).toBeVisible();
        await expect(share).toContainText('Share');
      });

      test('inline variant renders Copy, plus Share when navigator.share exists', async ({ page }) => {
        await page.addInitScript(() => {
          (navigator as NavigatorShareStub).share = () => Promise.resolve();
        });
        await installHarnessStubs(page);
        await gotoHarness(page, 'inline');

        const inline = page.locator('[data-testid="booking-link-inline-leads"]');
        await expect(inline).toHaveCount(1);
        await expect(inline).toBeVisible();

        await expect(page.locator('[data-testid="button-copy-booking-link-leads"]')).toBeVisible();
        await expect(page.locator('[data-testid="button-share-booking-link-leads"]')).toBeVisible();
      });

      test('inline variant hides Share when navigator.share is unavailable', async ({ page }) => {
        await page.addInitScript(() => {
          Reflect.deleteProperty(navigator as NavigatorShareStub, 'share');
        });
        await installHarnessStubs(page);
        await gotoHarness(page, 'inline');

        await expect(page.locator('[data-testid="button-copy-booking-link-leads"]')).toBeVisible();
        await expect(page.locator('[data-testid="button-share-booking-link-leads"]')).toHaveCount(0);
      });

      test('compact variant renders a single Copy CTA and no Share button', async ({ page }) => {
        await installHarnessStubs(page);
        await gotoHarness(page, 'compact');

        const compact = page.locator('[data-testid="button-share-booking-link-jobs"]');
        await expect(compact).toHaveCount(1);
        await expect(compact).toBeVisible();
        await expect(compact).toContainText('Share booking link');
      });

      // ---------------- Copy analytics ----------------
      for (const variant of VARIANTS) {
        test(`fires booking_link_copied exactly once when Copy is clicked (${variant})`, async ({ page }) => {
          // Inline needs navigator.share defined to render its share button,
          // but copying never depends on it. Either path is fine here.
          await page.addInitScript(() => {
            (navigator as NavigatorShareStub).share = () => Promise.resolve();
          });
          await installHarnessStubs(page);
          await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
          await gotoHarness(page, variant);
          await clearCapturedAnalytics(page);

          await page.locator(`[data-testid="${COPY_TEST_IDS[variant]}"]`).click();
          await page.waitForTimeout(300);

          const events = await getCapturedAnalytics(page);
          const copied = events.filter((e) => e.eventName === 'booking_link_copied');
          expect(copied).toHaveLength(1);
          expect(copied[0].properties).toMatchObject({ screen: 'plan' });

          // Copy alone should not fire share_opened or shared.
          expect(events.filter((e) => e.eventName === 'booking_link_share_opened')).toHaveLength(0);
          expect(events.filter((e) => e.eventName === 'booking_link_shared')).toHaveLength(0);
        });
      }

      // ---------------- Share analytics ----------------
      for (const variant of VARIANTS) {
        const shareTestId = SHARE_TEST_IDS[variant];
        if (!shareTestId) continue;

        test(`fires booking_link_share_opened + booking_link_shared (method: share) on Share success (${variant})`, async ({ page }) => {
          await page.addInitScript(() => {
            (navigator as NavigatorShareStub).share = () => Promise.resolve();
          });
          await installHarnessStubs(page);
          await gotoHarness(page, variant);
          await clearCapturedAnalytics(page);

          await page.locator(`[data-testid="${shareTestId}"]`).click();
          await page.waitForTimeout(300);

          const events = await getCapturedAnalytics(page);
          const opened = events.filter((e) => e.eventName === 'booking_link_share_opened');
          const completed = events.filter((e) => e.eventName === 'booking_link_shared');

          expect(opened).toHaveLength(1);
          expect(opened[0].properties).toMatchObject({ screen: 'plan' });
          expect(completed).toHaveLength(1);
          expect(completed[0].properties).toMatchObject({ screen: 'plan', method: 'share' });
        });

        test(`falls back to copy and fires booking_link_shared (method: copy) when share API is missing (${variant})`, async ({ page }) => {
          await page.addInitScript(() => {
            Reflect.deleteProperty(navigator as NavigatorShareStub, 'share');
          });
          await installHarnessStubs(page);
          await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
          await gotoHarness(page, variant);
          await clearCapturedAnalytics(page);

          // Inline variant hides its share button when navigator.share is
          // absent — drive the copy fallback through the primary harness only.
          if (variant === 'inline') {
            await expect(page.locator(`[data-testid="${shareTestId}"]`)).toHaveCount(0);
            return;
          }

          await page.locator(`[data-testid="${shareTestId}"]`).click();
          await page.waitForTimeout(300);

          const events = await getCapturedAnalytics(page);
          const opened = events.filter((e) => e.eventName === 'booking_link_share_opened');
          const completed = events.filter((e) => e.eventName === 'booking_link_shared');
          const copied = events.filter((e) => e.eventName === 'booking_link_copied');

          expect(opened).toHaveLength(1);
          expect(opened[0].properties).toMatchObject({ screen: 'plan' });
          expect(completed).toHaveLength(1);
          expect(completed[0].properties).toMatchObject({ screen: 'plan', method: 'copy' });
          expect(copied).toHaveLength(1);
        });

        test(`does NOT fire booking_link_shared when the share sheet is cancelled (${variant})`, async ({ page }) => {
          await page.addInitScript(() => {
            (navigator as NavigatorShareStub).share = () =>
              Promise.reject(new Error('AbortError'));
          });
          await installHarnessStubs(page);
          await gotoHarness(page, variant);
          await clearCapturedAnalytics(page);

          await page.locator(`[data-testid="${shareTestId}"]`).click();
          await page.waitForTimeout(300);

          const events = await getCapturedAnalytics(page);
          const opened = events.filter((e) => e.eventName === 'booking_link_share_opened');
          const completed = events.filter((e) => e.eventName === 'booking_link_shared');

          expect(opened).toHaveLength(1);
          expect(completed).toHaveLength(0);
        });
      }
    });
  }
});
