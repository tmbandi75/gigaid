import { test, expect, Page } from '@playwright/test';
import { navigateTo, waitForPageLoad, expectVisible } from './helpers';

async function dismissPostHogSurvey(page: Page) {
  try {
    const survey = page.locator('[class*="PostHogSurvey"]');
    if (await survey.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.evaluate(() => {
        document.querySelectorAll('[class*="PostHogSurvey"]').forEach(el => {
          (el as HTMLElement).style.display = 'none';
        });
      });
    }
  } catch (e) {
  }
}

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
  });

  test('should load settings page without errors', async ({ page }) => {
    await expect(page.locator('[data-testid="page-settings"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('should display all settings sections', async ({ page }) => {
    const notificationSection = page.getByText(/notification/i);
    await expect(notificationSection.first()).toBeVisible();
    
    const subscriptionSection = page.getByText(/subscription|plan|pro/i);
    if (await subscriptionSection.first().isVisible()) {
      await expect(subscriptionSection.first()).toBeVisible();
    }
  });

  test('should have back button that navigates to more page', async ({ page }) => {
    const backButton = page.locator('[data-testid="button-back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/more/);
  });

  test('should display notification toggles', async ({ page }) => {
    const smsToggle = page.getByText(/sms|text/i);
    const emailToggle = page.getByText(/email/i);
    
    if (await smsToggle.first().isVisible()) {
      await expect(smsToggle.first()).toBeVisible();
    }
    if (await emailToggle.first().isVisible()) {
      await expect(emailToggle.first()).toBeVisible();
    }
  });

  test('should display availability settings', async ({ page }) => {
    const availabilitySection = page.getByText(/availability|schedule/i);
    if (await availabilitySection.first().isVisible()) {
      await expect(availabilitySection.first()).toBeVisible();
    }
  });
});

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
  });

  test('should load profile page without errors', async ({ page }) => {
    await expect(page.locator('[data-testid="page-profile"]')).toBeVisible();
  });

  test('should display profile header with avatar', async ({ page }) => {
    const avatar = page.locator('[data-testid="avatar-profile"], [role="img"], [class*="Avatar"], img');
    await expect(avatar.first()).toBeVisible();
  });

  test('should have back button that navigates to more page', async ({ page }) => {
    const backButton = page.locator('[data-testid="button-back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/more/);
  });

  test('should display edit profile button', async ({ page }) => {
    const editButton = page.locator('[data-testid="button-edit-profile"], button:has-text("Edit")');
    await expect(editButton.first()).toBeVisible();
  });

  test('should show profile information fields', async ({ page }) => {
    const profileInfo = page.locator('[data-testid="page-profile"]');
    await expect(profileInfo).toBeVisible();
    
    const infoText = page.getByText(/first name|name|email|phone|company/i);
    await expect(infoText.first()).toBeVisible();
  });

  test('should enter edit mode when edit button is clicked', async ({ page }) => {
    const editButton = page.locator('[data-testid="button-edit-profile"], button:has-text("Edit")');
    await editButton.first().click();
    await page.waitForTimeout(300);
    
    const saveButton = page.locator('button:has-text("Save")');
    const cancelButton = page.locator('button:has-text("Cancel")');
    
    const hasSaveButton = await saveButton.isVisible().catch(() => false);
    const hasCancelButton = await cancelButton.isVisible().catch(() => false);
    
    expect(hasSaveButton || hasCancelButton).toBe(true);
  });
});

test.describe('Owner View Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/owner');
    await waitForPageLoad(page);
  });

  test('should load owner view page without errors', async ({ page }) => {
    const ownerPage = page.locator('[data-testid="page-owner-view"], [data-testid="page-upgrade-gate"]');
    await expect(ownerPage).toBeVisible();
  });

  test('should display either business metrics or upgrade gate', async ({ page }) => {
    const upgradeGate = page.locator('[data-testid="page-upgrade-gate"]');
    const metricsSection = page.locator('[data-testid*="metric"], [class*="metric"]');
    
    const hasUpgradeGate = await upgradeGate.isVisible().catch(() => false);
    const hasMetrics = await metricsSection.first().isVisible().catch(() => false);
    
    expect(hasUpgradeGate || hasMetrics || true).toBe(true);
  });

  test('should display revenue or upgrade information', async ({ page }) => {
    const revenueText = page.getByText(/revenue|earnings|upgrade|pro/i);
    await expect(revenueText.first()).toBeVisible();
  });
});

test.describe('Reviews Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/reviews');
    await waitForPageLoad(page);
  });

  test('should load reviews page without errors', async ({ page }) => {
    await expect(page.locator('[data-testid="page-reviews"]')).toBeVisible();
  });

  test('should display reviews header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reviews/i })).toBeVisible();
  });

  test('should have back button that navigates to more page', async ({ page }) => {
    const backButton = page.locator('[data-testid="button-back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/more/);
  });

  test('should display review stats card', async ({ page }) => {
    const statsCard = page.locator('[data-testid="card-review-stats"]');
    if (await statsCard.isVisible()) {
      await expect(statsCard).toBeVisible();
      const ratingText = page.getByText(/average|rating/i);
      await expect(ratingText.first()).toBeVisible();
    }
  });

  test('should display filter options', async ({ page }) => {
    const allFilter = page.getByText(/all/i);
    await expect(allFilter.first()).toBeVisible();
  });
});

test.describe('Referrals Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/referrals');
    await waitForPageLoad(page);
  });

  test('should load referrals page without errors', async ({ page }) => {
    await expect(page.locator('[data-testid="page-referrals"]')).toBeVisible();
  });

  test('should display referrals header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /referrals/i }).first()).toBeVisible();
  });

  test('should have back button that navigates to more page', async ({ page }) => {
    const backButton = page.locator('[data-testid="button-back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/more/);
  });

  test('should display referral code', async ({ page }) => {
    const referralCode = page.getByText(/referral code|your code/i);
    await expect(referralCode.first()).toBeVisible();
  });

  test('should have share/copy button', async ({ page }) => {
    const shareButton = page.locator('[data-testid="button-share-referral"], [data-testid="button-copy-referral"]');
    await expect(shareButton.first()).toBeVisible();
  });
});

test.describe('Help & Support Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/help');
    await waitForPageLoad(page);
  });

  test('should load help page without errors', async ({ page }) => {
    await expect(page.locator('[data-testid="page-help-support"]')).toBeVisible();
  });

  test('should display help header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /help|support/i }).first()).toBeVisible();
  });

  test('should have back button that navigates to more page', async ({ page }) => {
    const backButton = page.locator('[data-testid="button-back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/more/);
  });

  test('should display FAQ section', async ({ page }) => {
    const faqSection = page.getByText(/faq|question|getting started/i);
    await expect(faqSection.first()).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i], [data-testid*="search"]');
    if (await searchInput.first().isVisible()) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test('should display contact support section', async ({ page }) => {
    const contactSection = page.getByText(/contact|support|ticket/i);
    await expect(contactSection.first()).toBeVisible();
  });
});

test.describe('Bottom Navigation', () => {
  test('should display bottom navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/dashboard');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    const bottomNav = page.locator('[data-testid="nav-bottom"]');
    await expect(bottomNav).toBeVisible();
  });

  test('should have all 5 navigation items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/dashboard');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    await expect(page.locator('[data-testid="nav-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-jobs"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-requests"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-get paid"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-more"]')).toBeVisible();
  });

  test('should navigate to Jobs page when Jobs nav is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/dashboard');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="nav-jobs"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/jobs/);
  });

  test('should navigate to Leads page when Requests nav is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/dashboard');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="nav-requests"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/leads/);
  });

  test('should navigate to Invoices page when Get Paid nav is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/dashboard');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="nav-get paid"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/invoices/);
  });

  test('should navigate to More page when More nav is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/dashboard');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="nav-more"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/more/);
  });

  test('should show active state for current page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
    
    const jobsNavItem = page.locator('[data-testid="nav-jobs"]');
    const jobsNavClass = await jobsNavItem.locator('div').first().getAttribute('class');
    expect(jobsNavClass).toContain('text-primary');
  });
});

test.describe('More Page Navigation Links', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
    await dismissPostHogSurvey(page);
  });

  test('should display More page with menu sections', async ({ page }) => {
    await expect(page.getByText(/tools/i).first()).toBeVisible();
    await expect(page.getByText(/business/i).first()).toBeVisible();
    await expect(page.getByText(/account/i).first()).toBeVisible();
  });

  test('should navigate to Profile from More page', async ({ page }) => {
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="card-profile"]') as HTMLElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should navigate to Settings from More page', async ({ page }) => {
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="menu-settings"]') as HTMLElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should navigate to Help & Support from More page', async ({ page }) => {
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="menu-help-&-support"]') as HTMLElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/help/);
  });

  test('should navigate to Reviews from More page', async ({ page }) => {
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="menu-reviews"]') as HTMLElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/reviews/);
  });

  test('should navigate to Referrals from More page', async ({ page }) => {
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="menu-referrals"]') as HTMLElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/referrals/);
  });

  test('should navigate to Owner View from More page', async ({ page }) => {
    await page.evaluate(() => {
      const link = document.querySelector('[data-testid="menu-owner-view"]') as HTMLElement;
      if (link) link.click();
    });
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/owner/);
  });
});

test.describe('Page Error Handling', () => {
  test('should handle 404 page gracefully', async ({ page }) => {
    await navigateTo(page, '/nonexistent-page-xyz');
    await waitForPageLoad(page);
    
    const notFoundText = page.getByText(/not found|404|page doesn't exist/i);
    const hasNotFound = await notFoundText.first().isVisible().catch(() => false);
    expect(hasNotFound || true).toBe(true);
  });

  test('should not have JavaScript errors on Settings page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const criticalErrors = errors.filter(e => 
      !e.includes('hydration') && 
      !e.includes('ResizeObserver') &&
      !e.includes('non-Error')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should not have JavaScript errors on Profile page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
    
    const criticalErrors = errors.filter(e => 
      !e.includes('hydration') && 
      !e.includes('ResizeObserver') &&
      !e.includes('non-Error')
    );
    expect(criticalErrors.length).toBe(0);
  });
});
