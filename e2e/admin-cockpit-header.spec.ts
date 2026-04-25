import { test, expect, type Page, type Route } from '@playwright/test';
import { BASE_URL } from './helpers';

const HARNESS_URL = `${BASE_URL}/_e2e/admin-cockpit`;

interface HeaderLink {
  testid: string;
  expectedPath: string;
  label: string;
}

const HEADER_LINKS: HeaderLink[] = [
  { testid: 'link-view-analytics', expectedPath: '/admin/analytics', label: 'View Analytics' },
  { testid: 'link-growth-engine', expectedPath: '/admin/growth', label: 'Growth Engine' },
  { testid: 'link-sms-health', expectedPath: '/admin/sms', label: 'SMS Health' },
];

function buildSummary() {
  const metric = (value: number) => ({
    value,
    deltaWoW: 0,
    deltaMoM: 0,
    health: 'green' as const,
  });
  return {
    totalUsers: metric(120),
    activeUsers7d: metric(40),
    activeUsers30d: metric(80),
    payingCustomers: metric(20),
    mrr: metric(50000),
    arr: metric(600000),
    netChurnPct: metric(2),
  };
}

function buildFocus() {
  return {
    healthState: 'green' as const,
    primaryBottleneck: 'Activation',
    biggestFunnelLeak: null,
    recommendation: 'Keep shipping',
    rationale: 'Metrics are healthy.',
    urgencyScore: 25,
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  };
}

async function installHarnessStubs(page: Page) {
  // Hide any global "Taking longer than usual" overlay that can intercept clicks.
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent =
      '#loading-fallback{display:none !important;visibility:hidden !important;pointer-events:none !important;}';
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }
  });

  // Catch-all first; specific routes registered after take precedence in Playwright.
  await page.route('**/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/auth/user', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-admin-user',
        email: 'admin@gigaid.test',
        name: 'E2E Admin',
        isAdmin: true,
      }),
    }),
  );

  await page.route('**/api/admin/cockpit/summary', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSummary()),
    }),
  );

  await page.route('**/api/admin/cockpit/focus', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildFocus()),
    }),
  );

  await page.route('**/api/admin/cockpit/alerts', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ alerts: [] }),
    }),
  );

  await page.route('**/api/admin/cockpit/risk-leakage', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );

  await page.route('**/api/admin/cockpit/revenue-payments', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );

  await page.route('**/api/admin/cockpit/activation-funnel', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );

  await page.route('**/api/admin/test-summary', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reportAvailable: false,
        lastRun: null,
        summary: { total: 0, passed: 0, failed: 0, passRate: '0' },
      }),
    }),
  );
}

async function gotoHarness(page: Page) {
  await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="page-admin-cockpit"]', { timeout: 20000 });
}

test.describe('Admin Cockpit header navigation', () => {
  test('renders all four header controls', async ({ page }) => {
    await installHarnessStubs(page);
    await gotoHarness(page);

    for (const link of HEADER_LINKS) {
      const locator = page.locator(`[data-testid="${link.testid}"]`);
      await expect(locator).toBeVisible();
      await expect(locator).toContainText(link.label);
    }

    const refresh = page.locator('[data-testid="button-refresh"]');
    await expect(refresh).toBeVisible();
    await expect(refresh).toContainText('Refresh');
  });

  for (const link of HEADER_LINKS) {
    test(`${link.testid} navigates to ${link.expectedPath} without a full page reload`, async ({ page }) => {
      await installHarnessStubs(page);
      await gotoHarness(page);

      // Marker survives wouter (client-side) navigation but is wiped by a real
      // browser navigation/page reload. If it's still set after the click, we
      // know the click did not trigger a full document reload.
      await page.evaluate(() => {
        (window as unknown as { __noReloadMarker: boolean }).__noReloadMarker = true;
      });

      await page.locator(`[data-testid="${link.testid}"]`).click();

      await expect(page).toHaveURL(new RegExp(`${link.expectedPath}$`));

      const markerStillSet = await page.evaluate(
        () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true,
      );
      expect(markerStillSet).toBe(true);
    });
  }
});
