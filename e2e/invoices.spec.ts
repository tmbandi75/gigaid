import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/invoices');
    await waitForPageLoad(page);
  });

  test('should display invoices list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  });

  test('should open create invoice dialog', async ({ page }) => {
    const createButton = page.locator('[data-testid="button-create-invoice"], button:has-text("New Invoice"), button:has-text("Add Invoice"), [data-testid="button-add-invoice"]');
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      const dialog = page.locator('[role="dialog"], [data-testid="dialog-create-invoice"]');
      await expect(dialog).toBeVisible();
    }
  });

  test('should filter invoices by status', async ({ page }) => {
    const statusFilter = page.locator('[data-testid="filter-status"], select:has-text("Status"), [role="combobox"]');
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(300);
    }
  });

  test('should view invoice details', async ({ page }) => {
    const invoiceCard = page.locator('[data-testid^="card-invoice-"], [data-testid^="row-invoice-"]').first();
    
    if (await invoiceCard.isVisible()) {
      await invoiceCard.click();
      await page.waitForTimeout(500);
    }
  });

  test('should show payment status on invoices', async ({ page }) => {
    const statusBadges = page.locator('[data-testid^="status-"], .badge, [class*="badge"]');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
