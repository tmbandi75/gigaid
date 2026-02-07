import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

test.describe('Authentication & Dashboard Access', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('unauthenticated user sees splash/login page', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + '/dashboard');
    await page.waitForLoadState('networkidle');

    const splashPage = page.locator('[data-testid="splash-page"]');
    const loginInput = page.locator('[data-testid="input-email"]');
    const loadingText = page.getByText(/loading/i);

    const hasSplash = await splashPage.isVisible({ timeout: 10000 }).catch(() => false);
    const hasLogin = await loginInput.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSplash || hasLogin).toBeTruthy();
    await context.close();
  });

  test('authenticated user can access dashboard', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/dashboard');
    await page.waitForLoadState('networkidle');

    const gamePlan = page.locator('[data-testid="page-game-plan"]');
    await expect(gamePlan).toBeVisible({ timeout: 15000 });
    await page.context().close();
  });

  test('dashboard shows key stat cards', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-game-plan"]')).toBeVisible({ timeout: 15000 });

    const jobsStat = page.locator('[data-testid="stat-jobs-today"]');
    const moneyStat = page.locator('[data-testid="stat-money-collected"]');

    const hasJobsStat = await jobsStat.isVisible({ timeout: 5000 }).catch(() => false);
    const hasMoneyStat = await moneyStat.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasJobsStat || hasMoneyStat).toBeTruthy();
    await page.context().close();
  });

  test('dashboard shows quick action buttons', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-game-plan"]')).toBeVisible({ timeout: 15000 });

    const addJobBtn = page.locator('[data-testid="button-add-job"]');
    await expect(addJobBtn).toBeVisible({ timeout: 5000 });
    await page.context().close();
  });
});
