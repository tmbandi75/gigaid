import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage, seedJob, seedLead, seedInvoice } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = path.join('e2e', 'link-test-screenshots');

const DANGEROUS_PATTERNS = [
  /logout/i,
  /force-logout/i,
  /delete/i,
  /remove/i,
  /cancel/i,
  /checkout/i,
  /pay-deposit/i,
  /stripe/i,
  /webhook/i,
  /reset/i,
  /confirm-price/i,
];

const EXCLUDED_PATH_PREFIXES = [
  '/api/',
  '/auth/',
  '/login',
  '/signup',
  '/admin/',
  '/book/',
  '/booking/',
  '/invoice/',
  '/review/',
  '/crew-portal/',
  '/qb/',
];

const DYNAMIC_ID_PATTERNS = [
  /\/jobs\/[a-zA-Z0-9-]+$/,
  /\/jobs\/[a-zA-Z0-9-]+\/edit$/,
  /\/leads\/[a-zA-Z0-9-]+$/,
  /\/leads\/[a-zA-Z0-9-]+\/edit$/,
  /\/invoices\/[a-zA-Z0-9-]+\/edit$/,
  /\/invoices\/[a-zA-Z0-9-]+\/view$/,
  /\/onboarding\/[a-zA-Z0-9-]+$/,
];

const ERROR_BODY_PATTERNS = [
  'Page Not Found',
  'Something went wrong',
];

const ERROR_URL_PATTERNS = [
  /not-found/i,
  /forbidden/i,
];

function sanitizeForFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
}

function isDangerousLink(href: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(href));
}

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isDynamicIdRoute(pathname: string): boolean {
  return DYNAMIC_ID_PATTERNS.some((p) => p.test(pathname));
}

interface CrawlResult {
  url: string;
  referrer: string;
  status: 'ok' | 'error';
  errorDetail?: string;
}

const AUTHENTICATED_ROUTES = [
  '/dashboard',
  '/dashboard-overview',
  '/jobs',
  '/jobs/new',
  '/leads',
  '/leads/new',
  '/invoices',
  '/invoices/new',
  '/reminders',
  '/crew',
  '/settings',
  '/more',
  '/profile',
  '/reviews',
  '/referrals',
  '/help',
  '/guides',
  '/ai-tools',
  '/follow-up-settings',
  '/auto-quote',
  '/price-optimization',
  '/profit-warnings',
  '/voice-notes',
  '/booking-requests',
  '/share',
  '/quickbook',
  '/money-plan',
  '/messages',
  '/notify-clients',
  '/owner',
  '/pricing',
  '/downloads',
  '/onboarding',
  '/payday-onboarding',
  '/pro-plus-context',
];

test.describe('Authenticated Link Integrity', () => {
  let seededJobId: number | null = null;
  let seededLeadId: number | null = null;
  let seededInvoiceId: number | null = null;

  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
    await resetTestData(TEST_USER.id);

    const [job, lead, invoice] = await Promise.all([
      seedJob({ userId: TEST_USER.id, title: 'Link Test Job', clientName: 'Link Test Client' }),
      seedLead({ userId: TEST_USER.id, clientName: 'Link Test Lead' }),
      seedInvoice({ userId: TEST_USER.id, clientName: 'Link Test Invoice Client', amount: 100 }),
    ]);

    seededJobId = job?.id ?? null;
    seededLeadId = lead?.id ?? null;
    seededInvoiceId = invoice?.id ?? null;

    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('all known authenticated routes resolve without errors', async ({ browser }) => {
    test.setTimeout(300_000);

    const page = await authenticatedPage(browser, TEST_USER.id);
    const origin = BASE_URL;

    const allRoutes = [...AUTHENTICATED_ROUTES];
    if (seededJobId) allRoutes.push(`/jobs/${seededJobId}`);
    if (seededLeadId) allRoutes.push(`/leads/${seededLeadId}`);
    if (seededInvoiceId) allRoutes.push(`/invoices/${seededInvoiceId}/view`);

    const results: CrawlResult[] = [];
    const discoveredLinks = new Set<string>();

    for (const route of allRoutes) {
      try {
        const response = await page.goto(`${origin}${route}`, {
          waitUntil: 'commit',
          timeout: 8_000,
        });

        await page.waitForTimeout(200);

        const status = response?.status() ?? 0;

        if (status >= 400) {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `error-${sanitizeForFilename(route)}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          const htmlPath = path.join(SCREENSHOTS_DIR, `error-${sanitizeForFilename(route)}.html`);
          fs.writeFileSync(htmlPath, await page.content());
          results.push({ url: route, referrer: '(seed)', status: 'error', errorDetail: `HTTP ${status}` });
          console.log(`  FAIL [${status}]: ${route}`);
          continue;
        }

        const currentUrl = new URL(page.url());
        const hasErrorUrl = ERROR_URL_PATTERNS.some((p) => p.test(currentUrl.pathname));

        const bodyText = await page.textContent('body').catch(() => '') ?? '';
        const hasErrorBody = ERROR_BODY_PATTERNS.some((pattern) => bodyText.includes(pattern));

        if (hasErrorUrl || hasErrorBody) {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `error-${sanitizeForFilename(route)}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          const htmlPath = path.join(SCREENSHOTS_DIR, `error-${sanitizeForFilename(route)}.html`);
          fs.writeFileSync(htmlPath, await page.content());
          const detail = hasErrorUrl ? `URL pattern: ${currentUrl.pathname}` : 'Body error text';
          results.push({ url: route, referrer: '(seed)', status: 'error', errorDetail: detail });
          console.log(`  FAIL [content]: ${route} - ${detail}`);
          continue;
        }

        results.push({ url: route, referrer: '(seed)', status: 'ok' });
        console.log(`  OK: ${route}`);

        const links = await page.evaluate(() => {
          const anchors = document.querySelectorAll('a[href]');
          return Array.from(anchors).map((a) => a.getAttribute('href')).filter(Boolean) as string[];
        });

        for (const href of links) {
          if (!href.startsWith('/')) continue;
          const pathname = href.split('?')[0].split('#')[0];
          if (isExcludedPath(pathname) || isDangerousLink(pathname)) continue;
          if (!allRoutes.includes(pathname) && !isDynamicIdRoute(pathname)) {
            discoveredLinks.add(pathname);
          }
        }
      } catch (err: any) {
        const screenshotPath = path.join(SCREENSHOTS_DIR, `timeout-${sanitizeForFilename(route)}.png`);
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        results.push({ url: route, referrer: '(seed)', status: 'error', errorDetail: `Navigation error: ${err.message}` });
        console.log(`  FAIL [timeout]: ${route}`);
      }
    }

    if (discoveredLinks.size > 0) {
      console.log(`\nDiscovered ${discoveredLinks.size} additional internal links (not in seed list):`);
      for (const link of discoveredLinks) {
        console.log(`  ${link}`);
      }
    }

    await page.context().close();

    const errors = results.filter((r) => r.status === 'error');
    console.log(`\nCrawl complete: ${allRoutes.length} routes tested, ${errors.length} errors`);

    if (errors.length > 0) {
      console.log('\nBroken links:');
      errors.forEach((e) => {
        console.log(`  URL: ${e.url}`);
        console.log(`  Error: ${e.errorDetail}`);
        console.log('');
      });
    }

    expect(errors, `Found ${errors.length} broken link(s)`).toHaveLength(0);
  });
});
