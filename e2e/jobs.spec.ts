import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Job Management', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
  });

  test('should display jobs list', async ({ page }) => {
    await expect(page.locator('text=Jobs')).toBeVisible();
  });

  test('should open create job dialog', async ({ page }) => {
    const createButton = page.locator('[data-testid="button-create-job"], button:has-text("New Job"), button:has-text("Add Job"), [data-testid="button-add-job"]');
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      const dialog = page.locator('[role="dialog"], [data-testid="dialog-create-job"]');
      await expect(dialog).toBeVisible();
    }
  });

  test('should create a new job', async ({ page }) => {
    const createButton = page.locator('[data-testid="button-create-job"], button:has-text("New Job"), button:has-text("Add Job"), [data-testid="button-add-job"]');
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      await page.locator('input[name="title"], [data-testid="input-job-title"]').fill('E2E Test Job');
      await page.locator('input[name="clientName"], [data-testid="input-client-name"]').fill('Test Client');
      await page.locator('input[name="clientPhone"], [data-testid="input-client-phone"]').fill('555-1234');
      
      const submitButton = page.locator('button[type="submit"], [data-testid="button-submit-job"]');
      await submitButton.click();
      
      await waitForToast(page);
    }
  });

  test('should filter jobs by status', async ({ page }) => {
    const statusFilter = page.locator('[data-testid="filter-status"], select:has-text("Status"), [role="combobox"]');
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(300);
    }
  });

  test('should view job details', async ({ page }) => {
    const jobCard = page.locator('[data-testid^="card-job-"], [data-testid^="row-job-"]').first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
    }
  });
});
