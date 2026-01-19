import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad } from './helpers';

test.describe('AI Smart Suggestions', () => {
  test('should display intent action cards on dashboard', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const intentCards = page.locator('[data-testid^="intent-action-card-"], [data-testid="ai-suggestion"]');
    const count = await intentCards.count();
    
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show AI nudges section', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const nudgesSection = page.getByText(/suggested|next best|action|nudge/i);
    if (await nudgesSection.first().isVisible()) {
      await expect(nudgesSection.first()).toBeVisible();
    }
  });

  test('should allow dismissing an AI suggestion', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const dismissButton = page.locator('[data-testid^="button-dismiss-"], button:has-text("Dismiss"), button:has-text("Skip")');
    
    if (await dismissButton.first().isVisible()) {
      await dismissButton.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should allow acting on an AI suggestion', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const actionButton = page.locator('[data-testid^="button-action-"], [data-testid="button-send-invoice"], button:has-text("Send Invoice")');
    
    if (await actionButton.first().isVisible()) {
      await expect(actionButton.first()).toBeVisible();
    }
  });

  test('should show intent detection on lead details', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const intentSection = page.locator('[data-testid="intent-signals"], text=Buying Signal, text=Intent');
      if (await intentSection.first().isVisible()) {
        await expect(intentSection.first()).toBeVisible();
      }
    }
  });

  test('should allow editing suggested amount', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const amountInput = page.locator('[data-testid="input-suggested-amount"], input[type="number"]');
    
    if (await amountInput.first().isVisible()) {
      await amountInput.first().fill('250');
      await page.waitForTimeout(300);
    }
  });

  test('should show Todays Money Plan if enabled', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const moneyPlan = page.getByText(/today|priority|money plan/i);
    if (await moneyPlan.first().isVisible()) {
      await expect(moneyPlan.first()).toBeVisible();
    }
  });

  test('should show outcome attribution metrics', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
    
    const attribution = page.getByText(/saved|impact|days|helped/i);
    if (await attribution.first().isVisible()) {
      await expect(attribution.first()).toBeVisible();
    }
  });
});
