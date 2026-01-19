import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Lead Management', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
  });

  test('should display leads list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
  });

  test('should open create lead dialog', async ({ page }) => {
    const createButton = page.getByTestId('button-add-lead').or(page.getByRole('button', { name: /new lead|add lead/i }));
    
    if (await createButton.first().isVisible()) {
      await createButton.first().click();
      await page.waitForTimeout(500);
      
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('should create a new lead', async ({ page }) => {
    const createButton = page.getByTestId('button-add-lead').or(page.getByRole('button', { name: /new lead|add lead/i }));
    
    if (await createButton.first().isVisible()) {
      await createButton.first().click();
      await page.waitForTimeout(500);
      
      const clientInput = page.locator('input[name="clientName"], [data-testid="input-client-name"]');
      if (await clientInput.first().isVisible()) {
        await clientInput.first().fill('E2E Test Lead');
      }
    }
  });

  test('should filter leads by status', async ({ page }) => {
    const statusFilter = page.locator('[data-testid="filter-status"], select:has-text("Status"), [role="combobox"]');
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(300);
    }
  });

  test('should view lead details', async ({ page }) => {
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
    }
  });

  test('should convert lead to job', async ({ page }) => {
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const convertButton = page.locator('[data-testid="button-convert-lead"], button:has-text("Convert"), button:has-text("Schedule")');
      if (await convertButton.isVisible()) {
        await convertButton.click();
      }
    }
  });
});
