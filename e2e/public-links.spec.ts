import { test, expect } from '@playwright/test';
import { BASE_URL } from './test-constants';
import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_PATH_PREFIXES = [
  '/api/',
  '/auth/',
  '/admin/',
];

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

const DYNAMIC_TOKEN_PATTERNS = [
  /\/book\/[a-zA-Z0-9-]+/,
  /\/booking\/[a-zA-Z0-9-]+/,
  /\/invoice\/[a-zA-Z0-9-]+/,
  /\/review\/[a-zA-Z0-9-]+/,
  /\/crew-portal\/[a-zA-Z0-9-]+/,
  /\/qb\/[a-zA-Z0-9-]+/,
  /\/onboarding\/[a-zA-Z0-9-]+/,
];

const AUTHENTICATED_ROUTES = [
  '/dashboard',
  '/jobs',
  '/leads',
  '/invoices',
  '/crew',
  '/settings',
  '/profile',
  '/messages',
  '/more',
  '/reminders',
  '/reviews',
  '/referrals',
  '/help',
  '/guides',
  '/ai-tools',
  '/voice-notes',
  '/booking-requests',
  '/share',
  '/quickbook',
  '/money-plan',
  '/notify-clients',
  '/owner',
  '/follow-up-settings',
  '/auto-quote',
  '/price-optimization',
  '/profit-warnings',
  '/pro-plus-context',
  '/payday-onboarding',
  '/dashboard-overview',
];

const ERROR_BODY_PATTERNS = [
  'Something went wrong',
];

const ERROR_URL_PATTERNS = [
  /error/i,
  /forbidden/i,
];

const MAX_PAGES = 50;
const NAV_DELAY_MS = 200;

const SCREENSHOTS_DIR = path.join('e2e', 'link-test-screenshots');

interface CrawlResult {
  url: string;
  referrer: string;
  status: 'ok' | 'redirect-to-login' | 'error';
  errorDetail?: string;
}

function sanitizeForFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
}

test.describe('Public Link Integrity', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test('all public pages resolve without errors', async ({ page }) => {
    test.setTimeout(120_000);

    const origin = BASE_URL;
    const visited = new Set<string>();
    const queue: Array<{ path: string; referrer: string }> = [];
    const results: CrawlResult[] = [];
    const skippedDynamic: string[] = [];

    const PUBLIC_SEEDS = ['/', '/terms', '/privacy', '/downloads', '/login', '/pricing'];
    for (const p of PUBLIC_SEEDS) {
      queue.push({ path: p, referrer: '(start)' });
    }

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const current = queue.shift()!;
      if (visited.has(current.path)) continue;
      visited.add(current.path);

      try {
        const response = await page.goto(`${origin}${current.path}`, {
          waitUntil: 'networkidle',
          timeout: 15_000,
        });

        await page.waitForTimeout(NAV_DELAY_MS);

        const finalUrl = new URL(page.url());
        const finalPath = finalUrl.pathname;

        if (AUTHENTICATED_ROUTES.includes(current.path) && (finalPath === '/login' || finalPath === '/')) {
          results.push({ url: current.path, referrer: current.referrer, status: 'redirect-to-login' });
          continue;
        }

        const status = response?.status() ?? 0;

        if (status >= 400) {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `public-error-${sanitizeForFilename(current.path)}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          const htmlPath = path.join(SCREENSHOTS_DIR, `public-error-${sanitizeForFilename(current.path)}.html`);
          fs.writeFileSync(htmlPath, await page.content());

          results.push({
            url: current.path,
            referrer: current.referrer,
            status: 'error',
            errorDetail: `HTTP ${status}`,
          });
          continue;
        }

        const hasErrorUrl = ERROR_URL_PATTERNS.some((p) => p.test(finalPath));

        const bodyText = await page.textContent('body').catch(() => '') ?? '';
        const hasErrorBody = ERROR_BODY_PATTERNS.some((pattern) =>
          bodyText.includes(pattern)
        );

        if (hasErrorUrl || hasErrorBody) {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `public-error-${sanitizeForFilename(current.path)}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          const htmlPath = path.join(SCREENSHOTS_DIR, `public-error-${sanitizeForFilename(current.path)}.html`);
          fs.writeFileSync(htmlPath, await page.content());

          results.push({
            url: current.path,
            referrer: current.referrer,
            status: 'error',
            errorDetail: hasErrorUrl ? `URL contains error pattern: ${finalPath}` : `Body contains error text`,
          });
          continue;
        }

        results.push({ url: current.path, referrer: current.referrer, status: 'ok' });

        const links = await page.evaluate(() => {
          const anchors = document.querySelectorAll('a[href]');
          return Array.from(anchors).map((a) => a.getAttribute('href')).filter(Boolean) as string[];
        });

        for (const href of links) {
          let pathname: string;
          if (href.startsWith('/')) {
            pathname = href.split('?')[0].split('#')[0];
          } else {
            try {
              const url = new URL(href);
              if (url.origin !== origin) continue;
              pathname = url.pathname;
            } catch {
              continue;
            }
          }

          if (EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) continue;
          if (DANGEROUS_PATTERNS.some((p) => p.test(pathname))) continue;
          if (DYNAMIC_TOKEN_PATTERNS.some((p) => p.test(pathname))) {
            skippedDynamic.push(pathname);
            continue;
          }
          if (visited.has(pathname)) continue;
          if (AUTHENTICATED_ROUTES.includes(pathname)) continue;

          queue.push({ path: pathname, referrer: current.path });
        }
      } catch (err: any) {
        const screenshotPath = path.join(SCREENSHOTS_DIR, `public-timeout-${sanitizeForFilename(current.path)}.png`);
        await page.screenshot({ path: screenshotPath }).catch(() => {});

        results.push({
          url: current.path,
          referrer: current.referrer,
          status: 'error',
          errorDetail: `Navigation error: ${err.message}`,
        });
      }
    }

    const errors = results.filter((r) => r.status === 'error');

    if (skippedDynamic.length > 0) {
      console.log(`\nSkipped ${skippedDynamic.length} dynamic/token routes:`);
      [...new Set(skippedDynamic)].forEach((p) => console.log(`  - ${p}`));
    }

    console.log(`\nPublic crawl complete: ${visited.size} pages visited, ${errors.length} errors`);
    const okPages = results.filter((r) => r.status === 'ok');
    console.log(`  OK: ${okPages.length}`);
    okPages.forEach((r) => console.log(`    ${r.url}`));

    if (errors.length > 0) {
      console.log('\nBroken public links:');
      errors.forEach((e) => {
        console.log(`  URL: ${e.url}`);
        console.log(`  Referrer: ${e.referrer}`);
        console.log(`  Error: ${e.errorDetail}`);
        console.log('');
      });
    }

    expect(errors, `Found ${errors.length} broken public link(s)`).toHaveLength(0);
  });
});
