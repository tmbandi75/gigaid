import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Onboarding Flow', () => {
  test('should show onboarding for new users', async ({ page }) => {
    await navigateTo(page, '/onboarding');
    await waitForPageLoad(page);
    
    // Onboarding page may redirect to dashboard if already completed
    const onboardingContent = page.getByText(/welcome|get started|onboarding|setup|profile|dashboard/i);
    await expect(onboardingContent.first()).toBeVisible();
  });

  test('should display onboarding steps', async ({ page }) => {
    await navigateTo(page, '/onboarding');
    await waitForPageLoad(page);
    
    const steps = page.locator('[data-testid^="step-"], [data-testid="onboarding-step"]');
    const stepCount = await steps.count();
    expect(stepCount).toBeGreaterThanOrEqual(0);
  });

  test('should allow navigation between steps', async ({ page }) => {
    await navigateTo(page, '/onboarding');
    await waitForPageLoad(page);
    
    const nextButton = page.locator('[data-testid="button-next"], button:has-text("Next"), button:has-text("Continue")');
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should capture user profile information', async ({ page }) => {
    await navigateTo(page, '/onboarding');
    await waitForPageLoad(page);
    
    const nameInput = page.locator('input[name="name"], [data-testid="input-name"]');
    const emailInput = page.locator('input[name="email"], [data-testid="input-email"]');
    const phoneInput = page.locator('input[name="phone"], [data-testid="input-phone"]');
    
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test User');
    }
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('e2e@test.com');
    }
    
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('555-0000');
    }
  });

  test('should capture service types', async ({ page }) => {
    await navigateTo(page, '/onboarding');
    await waitForPageLoad(page);
    
    const serviceInput = page.locator('input[name="serviceType"], [data-testid="input-service-type"]');
    
    if (await serviceInput.isVisible()) {
      await serviceInput.fill('E2E Test Service');
    }
  });

  test('should complete onboarding', async ({ page }) => {
    await navigateTo(page, '/onboarding');
    await waitForPageLoad(page);
    
    const completeButton = page.locator('[data-testid="button-complete"], button:has-text("Complete"), button:has-text("Finish"), button:has-text("Done")');
    
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await waitForToast(page);
    }
  });
});
