import { test, expect, type Page, type Route } from '@playwright/test';
import { BASE_URL } from './helpers';

/**
 * Lock the centered tablet column shared by Settings, OwnerView,
 * LeadForm, and InvoiceForm.
 *
 * Each page wraps its body in a single Tailwind container that uses
 * `md:max-w-2xl md:mx-auto md:px-8 lg:max-w-7xl` so the iPad-portrait
 * layout reads as a centered column instead of an edge-to-edge slab.
 * Without this spec, a future styling tweak — especially anyone
 * re-adding an `isMobile`-only ternary on the body container — could
 * silently regress the tablet layout to full-bleed and nothing would
 * fail in CI.
 *
 * The spec mounts a small dev-only harness (`/_e2e/centered-tablet-
 * layout?page=<variant>`) that imports and renders each *real* page
 * component (Settings, OwnerView, LeadForm, InvoiceForm). API calls
 * those pages make are caught by a broad stub so nothing hangs on
 * loading. The assertions then run against the real body container
 * each page renders (queried via `data-testid="page-body-..."`) —
 * not a mirrored class string. That means a regression like
 * `className={isMobile ? "" : "md:max-w-2xl ..."}` is caught at
 * runtime: the class assertion sees the empty branch and the
 * geometry assertion sees the full-bleed width.
 *
 * Viewports tested:
 *   - 768px  (iPad portrait): width ≤ 672 (max-w-2xl), centered, x>0.
 *   - 1023px (just below `lg`): same tablet rules.
 *   - 1440px (wide desktop):   width capped near 1280 (max-w-7xl),
 *                              still centered, NOT full-bleed.
 *
 * The 1440px case is what proves `lg:max-w-7xl` actually engaged —
 * a missing/broken cap would let the container go to ~1440 and the
 * "≤ 1280 + tolerance" assertion would fail.
 */

type Variant = 'settings' | 'ownerView' | 'leadForm' | 'invoiceForm';

const VARIANTS: readonly Variant[] = [
  'settings',
  'ownerView',
  'leadForm',
  'invoiceForm',
];

// Tailwind container caps:
//   max-w-2xl = 42rem = 672px (the tablet cap)
//   max-w-7xl = 80rem = 1280px (the desktop cap)
const MAX_W_2XL_PX = 672;
const MAX_W_7XL_PX = 1280;

// data-testid each variant's page component renders on the centered
// body container.
const PAGE_BODY_TEST_ID: Record<Variant, string> = {
  settings: 'page-body-settings',
  ownerView: 'page-body-owner-view',
  leadForm: 'page-body-lead-form',
  invoiceForm: 'page-body-invoice-form',
};

const TABLET_VIEWPORTS = [
  { label: 'iPad portrait (768px)', width: 768, height: 1024 },
  { label: 'just below lg (1023px)', width: 1023, height: 800 },
] as const;

const DESKTOP_VIEWPORT = {
  label: 'wide desktop (1440px)',
  width: 1440,
  height: 900,
} as const;

/**
 * Stub every API the real pages reach for so the harness mounts
 * cleanly. The assertions only care about the body container's
 * geometry and class list, so empty/200 responses are fine — we
 * just need the page to get past its loading guards and render.
 */
async function installHarnessStubs(page: Page) {
  await page.addInitScript(() => {
    // Suppress the "Taking longer than usual" overlay that can
    // intercept pointer events under heavy dev-server load.
    const style = document.createElement('style');
    style.textContent =
      '#loading-fallback{display:none !important;visibility:hidden !important;pointer-events:none !important;}';
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () =>
        document.head.appendChild(style),
      );
    }
  });

  // Catch-all comes first so route-specific stubs registered below
  // win (Playwright matches latest-registered routes first).
  await page.route('**/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.route('**/api/auth/user', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-centered-tablet-user',
        email: 'e2e-centered-tablet@gigaid.test',
        name: 'E2E Centered Tablet Worker',
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

  // LeadForm and InvoiceForm both call useUpgradeOrchestrator,
  // which reads `capabilities.capabilities[<key>]`. The default
  // catch-all returns `[]` for GETs which is truthy but missing
  // the inner `.capabilities` field — that crashes the page.
  // Return a real shape so the orchestrator just sees the
  // capability as missing/blocked, which is fine for layout.
  await page.route('**/api/capabilities', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ capabilities: {} }),
    }),
  );

  // OwnerView reads metrics.outstandingInvoices.count, metrics
  // .upcomingJobs.length, etc. directly without optional-chaining,
  // so we need a fully-shaped OwnerMetrics response — empty
  // values are fine; the layout container we're measuring sits
  // around all of this and doesn't care about the numbers.
  await page.route('**/api/owner/metrics', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        isPro: false,
        weeklyRevenue: 0,
        monthlyRevenue: 0,
        revenueChange: 0,
        jobsCompletedThisWeek: 0,
        jobsCompletedLastWeek: 0,
        newLeadsThisWeek: 0,
        newLeadsLastWeek: 0,
        outstandingInvoices: { count: 0, totalCents: 0 },
        upcomingJobs: [],
        recentCompletedJobs: [],
        jobsWithDepositThisWeek: 0,
        depositsCollectedThisWeek: 0,
      }),
    }),
  );
}

async function gotoHarness(page: Page, variant: Variant) {
  const url = `${BASE_URL}/_e2e/centered-tablet-layout?page=${variant}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(
    '[data-testid="page-e2e-centered-tablet-layout-harness"]',
    { timeout: 30000 },
  );
  // Wait for the actual page component's body container to mount —
  // this is the runtime-truth element the assertions run against.
  await page.waitForSelector(
    `[data-testid="${PAGE_BODY_TEST_ID[variant]}"]`,
    { timeout: 30000 },
  );
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getBodyBox(page: Page, variant: Variant): Promise<Box> {
  const handle = page.locator(`[data-testid="${PAGE_BODY_TEST_ID[variant]}"]`);
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error(
      `Missing bounding box for ${PAGE_BODY_TEST_ID[variant]}`,
    );
  }
  return box;
}

async function getViewportInnerWidth(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth);
}

test.describe('Centered tablet column layout (Task #321)', () => {
  for (const viewport of TABLET_VIEWPORTS) {
    test.describe(`${viewport.label} viewport`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const variant of VARIANTS) {
        test(`${variant} body container is capped at max-w-2xl, centered, and carries the responsive classes`, async ({
          page,
        }) => {
          await installHarnessStubs(page);
          await gotoHarness(page, variant);

          const body = page.locator(
            `[data-testid="${PAGE_BODY_TEST_ID[variant]}"]`,
          );

          // Runtime class assertions: the body element actually
          // carries the responsive Tailwind classes. This catches
          // an `isMobile`-ternary regression where the class string
          // still appears in source but resolves to the empty
          // branch at runtime.
          await expect(body).toHaveClass(/(?:^| )md:max-w-2xl(?: |$)/);
          await expect(body).toHaveClass(/(?:^| )md:mx-auto(?: |$)/);
          await expect(body).toHaveClass(/(?:^| )lg:max-w-7xl(?: |$)/);

          const innerWidth = await getViewportInnerWidth(page);
          const box = await getBodyBox(page, variant);

          // 1) The container must NOT be full-bleed on the tablet
          //    breakpoints — it must sit inside the max-w-2xl cap.
          expect(box.width).toBeLessThanOrEqual(MAX_W_2XL_PX + 0.5);

          // 2) mx-auto must actually center it: left margin equals
          //    right margin within sub-pixel rounding.
          const rightMargin = innerWidth - box.x - box.width;
          expect(Math.abs(rightMargin - box.x)).toBeLessThanOrEqual(1);

          // 3) Sanity: the cap has actually engaged (there is some
          //    left margin), not collapsed to zero from a missing
          //    intrinsic content width.
          expect(box.x).toBeGreaterThan(0);
        });
      }
    });
  }

  test.describe(`${DESKTOP_VIEWPORT.label} viewport`, () => {
    test.use({
      viewport: {
        width: DESKTOP_VIEWPORT.width,
        height: DESKTOP_VIEWPORT.height,
      },
    });

    for (const variant of VARIANTS) {
      test(`${variant} body container engages lg:max-w-7xl and stays centered, NOT full-bleed`, async ({
        page,
      }) => {
        await installHarnessStubs(page);
        await gotoHarness(page, variant);

        const body = page.locator(
          `[data-testid="${PAGE_BODY_TEST_ID[variant]}"]`,
        );
        await expect(body).toHaveClass(/(?:^| )lg:max-w-7xl(?: |$)/);

        const innerWidth = await getViewportInnerWidth(page);
        const box = await getBodyBox(page, variant);

        // 1) Tablet cap is gone — width has widened past max-w-2xl.
        expect(box.width).toBeGreaterThan(MAX_W_2XL_PX);

        // 2) Critically: width is capped at max-w-7xl (1280px) and
        //    NOT spilling to the full 1440px viewport. This is the
        //    proof that `lg:max-w-7xl` actually engaged — without
        //    it, the container would measure ~1440 and this would
        //    fail.
        expect(box.width).toBeLessThanOrEqual(MAX_W_7XL_PX + 0.5);

        // 3) The container is still strictly narrower than the
        //    viewport (proves it's not full-bleed).
        expect(box.width).toBeLessThan(innerWidth);

        // 4) mx-auto keeps it centered.
        const rightMargin = innerWidth - box.x - box.width;
        expect(Math.abs(rightMargin - box.x)).toBeLessThanOrEqual(1);
      });
    }
  });
});
