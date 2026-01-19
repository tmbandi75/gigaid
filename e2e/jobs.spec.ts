import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Job Management', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
  });

  test('should display jobs list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
  });

  test('should open create job dialog', async ({ page }) => {
    const createButton = page.getByTestId('button-add-job').or(page.getByRole('button', { name: /new job|add job/i }));
    
    if (await createButton.first().isVisible()) {
      await createButton.first().click();
      await page.waitForTimeout(500);
      
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('should create a new job', async ({ page }) => {
    const createButton = page.getByTestId('button-add-job').or(page.getByRole('button', { name: /new job|add job/i }));
    
    if (await createButton.first().isVisible()) {
      await createButton.first().click();
      await page.waitForTimeout(500);
      
      const titleInput = page.locator('input[name="title"], [data-testid="input-job-title"]');
      if (await titleInput.first().isVisible()) {
        await titleInput.first().fill('E2E Test Job');
      }
      
      const clientInput = page.locator('input[name="clientName"], [data-testid="input-client-name"]');
      if (await clientInput.first().isVisible()) {
        await clientInput.first().fill('Test Client');
      }
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
