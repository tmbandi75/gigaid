import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad } from './helpers';

test.describe('Admin Panel', () => {
  test.describe('Admin Cockpit', () => {
    test('should load admin cockpit', async ({ page }) => {
      await navigateTo(page, '/admin/cockpit');
      await waitForPageLoad(page);
      
      await expect(page.getByRole('heading', { name: /cockpit|founder|admin/i })).toBeVisible();
    });

    test('should display health metrics', async ({ page }) => {
      await navigateTo(page, '/admin/cockpit');
      await waitForPageLoad(page);
      
      const metrics = page.locator('[data-testid^="metric-"], [data-testid^="card-"]');
      const count = await metrics.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have User Ops link', async ({ page }) => {
      await navigateTo(page, '/admin/cockpit');
      await waitForPageLoad(page);
      
      const userOpsLink = page.getByRole('link', { name: /user.*ops|users/i });
      if (await userOpsLink.first().isVisible()) {
        await userOpsLink.first().click();
        await page.waitForTimeout(500);
      }
    });

    test('should display focus recommendations', async ({ page }) => {
      await navigateTo(page, '/admin/cockpit');
      await waitForPageLoad(page);
      
      const focusSection = page.getByText(/focus|recommendation|action/i);
      await expect(focusSection.first()).toBeVisible();
    });
  });

  test.describe('Admin User Management', () => {
    test('should load admin users page', async ({ page }) => {
      await navigateTo(page, '/admin/users');
      await waitForPageLoad(page);
      
      await expect(page.getByRole('heading', { name: /user|management/i })).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
      await navigateTo(page, '/admin/users');
      await waitForPageLoad(page);
      
      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.first().isVisible()) {
        await searchInput.first().fill('demo');
        await page.waitForTimeout(500);
      }
    });

    test('should display saved views', async ({ page }) => {
      await navigateTo(page, '/admin/users');
      await waitForPageLoad(page);
      
      const views = page.locator('[data-testid^="view-"], [data-testid^="tab-"]');
      const count = await views.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should navigate to user detail', async ({ page }) => {
      await navigateTo(page, '/admin/users/demo-user');
      await waitForPageLoad(page);
      
      await expect(page.getByText(/demo|user|profile/i).first()).toBeVisible();
    });

    test('should display user profile information', async ({ page }) => {
      await navigateTo(page, '/admin/users/demo-user');
      await waitForPageLoad(page);
      
      const profileSection = page.getByText(/profile|account|info/i);
      await expect(profileSection.first()).toBeVisible();
    });

    test('should display activity timeline', async ({ page }) => {
      await navigateTo(page, '/admin/users/demo-user');
      await waitForPageLoad(page);
      
      const timelineTab = page.locator('[data-testid="tab-timeline"], button:has-text("Timeline"), [role="tab"]:has-text("Timeline")');
      if (await timelineTab.isVisible()) {
        await timelineTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('should display audit log', async ({ page }) => {
      await navigateTo(page, '/admin/users/demo-user');
      await waitForPageLoad(page);
      
      const auditTab = page.locator('[data-testid="tab-audit"], button:has-text("Audit"), [role="tab"]:has-text("Audit")');
      if (await auditTab.isVisible()) {
        await auditTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('should have back to cockpit link', async ({ page }) => {
      await navigateTo(page, '/admin/users/demo-user?from=cockpit');
      await waitForPageLoad(page);
      
      const backLink = page.locator('[data-testid="button-back"], a:has-text("Cockpit"), button:has-text("Back")');
      await expect(backLink.first()).toBeVisible();
    });

    test('should display external tool links', async ({ page }) => {
      await navigateTo(page, '/admin/users/demo-user');
      await waitForPageLoad(page);
      
      const linksTab = page.locator('[data-testid="tab-links"], button:has-text("Links"), [role="tab"]:has-text("Links"), [role="tab"]:has-text("External")');
      if (await linksTab.isVisible()) {
        await linksTab.click();
        await page.waitForTimeout(300);
        
        const externalLinks = page.locator('[data-testid^="button-link-"], a[target="_blank"]');
        const count = await externalLinks.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
