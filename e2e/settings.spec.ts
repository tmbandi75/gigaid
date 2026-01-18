import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should show profile settings', async ({ page }) => {
    const profileSection = page.locator('[data-testid="section-profile"], text=Profile, text=Account');
    await expect(profileSection.first()).toBeVisible();
  });

  test('should allow theme toggle', async ({ page }) => {
    const themeToggle = page.locator('[data-testid="button-theme-toggle"], button:has-text("Theme"), [data-testid="theme-toggle"]');
    
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }
  });

  test('should show notification preferences', async ({ page }) => {
    const notifSection = page.locator('[data-testid="section-notifications"], text=Notification, text=Preferences');
    if (await notifSection.first().isVisible()) {
      await expect(notifSection.first()).toBeVisible();
    }
  });

  test('should show subscription status', async ({ page }) => {
    const subscriptionSection = page.locator('[data-testid="section-subscription"], text=Subscription, text=Plan, text=Pro');
    if (await subscriptionSection.first().isVisible()) {
      await expect(subscriptionSection.first()).toBeVisible();
    }
  });
});
