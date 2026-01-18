import { test, expect } from '@playwright/test';
import { navigateTo, expectVisible, waitForPageLoad } from './helpers';

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    await expect(page).toHaveTitle(/Gig/i);
  });

  test('should navigate to jobs page', async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    await expect(page.locator('text=Jobs')).toBeVisible();
  });

  test('should navigate to leads page', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    await expect(page.locator('text=Leads')).toBeVisible();
  });

  test('should navigate to invoices page', async ({ page }) => {
    await navigateTo(page, '/invoices');
    await waitForPageLoad(page);
    await expect(page.locator('text=Invoices')).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should have working bottom navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const navItems = page.locator('nav a, nav button');
    await expect(navItems.first()).toBeVisible();
  });
});
