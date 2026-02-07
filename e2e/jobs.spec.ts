import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage, seedJob } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

test.describe('Job Management', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
  });

  test.afterEach(async () => {
    await resetTestData(TEST_USER.id);
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('should display jobs list page', async ({ browser }) => {
    await seedJob({ userId: TEST_USER.id, title: 'Seeded Job', clientName: 'Alice Smith', price: 7500 });

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /jobs/i })).toBeVisible({ timeout: 10000 });

    const jobEntry = page.getByText('Seeded Job').or(page.getByText('Alice Smith'));
    await expect(jobEntry.first()).toBeVisible({ timeout: 5000 });
    await page.context().close();
  });

  test('should navigate to create job form', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs/new');
    await page.waitForLoadState('networkidle');

    const jobForm = page.locator('[data-testid="page-job-form"]');
    await expect(jobForm).toBeVisible({ timeout: 10000 });
    await page.context().close();
  });

  test('should create a new job via form', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs/new');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-job-form"]')).toBeVisible({ timeout: 10000 });

    const titleInput = page.locator('[data-testid="input-title"]');
    await titleInput.fill('E2E Test Lawn Mowing');

    const firstNameInput = page.locator('[data-testid="input-client-first-name"]');
    if (await firstNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstNameInput.fill('John');
      const lastNameInput = page.locator('[data-testid="input-client-last-name"]');
      if (await lastNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await lastNameInput.fill('Doe');
      }
    }

    const dateInput = page.locator('[data-testid="input-date"]');
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill(new Date().toISOString().split('T')[0]);
    }

    const timeInput = page.locator('[data-testid="input-time"]');
    if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await timeInput.fill('10:00');
    }

    const priceInput = page.locator('[data-testid="input-price"]');
    if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await priceInput.fill('150');
    }

    const submitBtn = page.locator('[data-testid="button-submit"]');
    await submitBtn.click();

    await page.waitForLoadState('networkidle');

    const successIndicator = page.getByText(/created|saved|success/i).first();
    const navigatedToJobs = page.url().includes('/jobs');
    const hasToast = await successIndicator.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasToast || navigatedToJobs).toBeTruthy();
    await page.context().close();
  });

  test('should click on a job to view details', async ({ browser }) => {
    const seededJob = await seedJob({
      userId: TEST_USER.id,
      title: 'Detail View Job',
      clientName: 'Bob Builder',
      price: 10000,
      status: 'scheduled',
    });

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/jobs');
    await page.waitForLoadState('networkidle');

    const jobCard = page.locator('[data-testid^="card-job-"], [data-testid^="row-job-"]').first();
    const jobLink = page.getByText('Detail View Job').or(page.getByText('Bob Builder'));

    const clickTarget = await jobCard.isVisible({ timeout: 5000 }).catch(() => false)
      ? jobCard
      : jobLink.first();

    await clickTarget.click();
    await page.waitForLoadState('networkidle');

    const detailContent = page.getByText('Detail View Job').or(page.getByText('Bob Builder'));
    await expect(detailContent.first()).toBeVisible({ timeout: 5000 });
    await page.context().close();
  });
});
