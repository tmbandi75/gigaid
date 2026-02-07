import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage, setUserPlan, setUsage } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

test.describe('Plan Limits & Upgrade Flow', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
  });

  test.beforeEach(async () => {
    await resetTestData(TEST_USER.id);
    await setUserPlan(TEST_USER.id, 'free');
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
    await setUserPlan(TEST_USER.id, 'free');
  });

  test('free user can create job when under limit', async ({ browser }) => {
    await setUsage(TEST_USER.id, 'jobs.create', 5);

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs/new');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-job-form"]')).toBeVisible({ timeout: 10000 });

    const titleInput = page.locator('[data-testid="input-title"]');
    await titleInput.fill('Under Limit Job');

    const submitBtn = page.locator('[data-testid="button-submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();
    await page.context().close();
  });

  test('free user at limit sees upgrade prompt', async ({ browser }) => {
    await setUsage(TEST_USER.id, 'jobs.create', 10);

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs/new');
    await page.waitForLoadState('networkidle');

    const limitIndicator = page.getByText(/limit|upgrade|maximum|reached/i).first();
    const upgradeBtn = page.getByText(/upgrade|pro|unlock/i).first();
    const blockedForm = page.locator('[data-testid="button-submit"][disabled]');

    const hasLimitMsg = await limitIndicator.isVisible({ timeout: 8000 }).catch(() => false);
    const hasUpgradeBtn = await upgradeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasBlockedForm = await blockedForm.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasLimitMsg || hasUpgradeBtn || hasBlockedForm).toBeTruthy();
    await page.context().close();
  });

  test('pro user bypasses job creation limit', async ({ browser }) => {
    await setUserPlan(TEST_USER.id, 'pro');
    await setUsage(TEST_USER.id, 'jobs.create', 50);

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs/new');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-job-form"]')).toBeVisible({ timeout: 10000 });

    const titleInput = page.locator('[data-testid="input-title"]');
    await titleInput.fill('Pro Unlimited Job');

    const submitBtn = page.locator('[data-testid="button-submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();

    const limitWarning = page.getByText(/limit reached|maximum/i).first();
    const hasLimitWarning = await limitWarning.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasLimitWarning).toBeFalsy();

    await page.context().close();
  });

  test('upgrading from free to pro removes limits', async ({ browser }) => {
    await setUsage(TEST_USER.id, 'jobs.create', 10);

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs/new');
    await page.waitForLoadState('networkidle');

    const limitBefore = page.getByText(/limit|upgrade|maximum|reached/i).first();
    const hadLimit = await limitBefore.isVisible({ timeout: 5000 }).catch(() => false);

    await setUserPlan(TEST_USER.id, 'pro');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-job-form"]')).toBeVisible({ timeout: 10000 });

    const titleInput = page.locator('[data-testid="input-title"]');
    await titleInput.fill('Post Upgrade Job');

    const submitBtn = page.locator('[data-testid="button-submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    await page.context().close();
  });
});
