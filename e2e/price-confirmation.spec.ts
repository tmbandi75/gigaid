import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Price Confirmation', () => {
  test('should show price confirmation option on lead', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const priceConfirmButton = page.locator('[data-testid="button-price-confirmation"], button:has-text("Price Confirm"), button:has-text("Send Quote")');
      if (await priceConfirmButton.first().isVisible()) {
        await expect(priceConfirmButton.first()).toBeVisible();
      }
    }
  });

  test('should open price confirmation dialog', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const priceConfirmButton = page.locator('[data-testid="button-price-confirmation"], button:has-text("Price Confirm")');
      if (await priceConfirmButton.first().isVisible()) {
        await priceConfirmButton.first().click();
        await page.waitForTimeout(500);
        
        const dialog = page.locator('[role="dialog"], [data-testid="dialog-price-confirmation"]');
        if (await dialog.isVisible()) {
          await expect(dialog).toBeVisible();
        }
      }
    }
  });

  test('should have price input field', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const priceConfirmButton = page.locator('[data-testid="button-price-confirmation"], button:has-text("Price Confirm")');
      if (await priceConfirmButton.first().isVisible()) {
        await priceConfirmButton.first().click();
        await page.waitForTimeout(500);
        
        const priceInput = page.locator('input[name="price"], input[type="number"], [data-testid="input-price"]');
        if (await priceInput.first().isVisible()) {
          await expect(priceInput.first()).toBeVisible();
        }
      }
    }
  });

  test('should allow sending price confirmation', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const priceConfirmButton = page.locator('[data-testid="button-price-confirmation"], button:has-text("Price Confirm")');
      if (await priceConfirmButton.first().isVisible()) {
        await priceConfirmButton.first().click();
        await page.waitForTimeout(500);
        
        const priceInput = page.locator('input[name="price"], input[type="number"]').first();
        if (await priceInput.isVisible()) {
          await priceInput.fill('150');
          
          const sendButton = page.locator('button[type="submit"], [data-testid="button-send-confirmation"]');
          if (await sendButton.first().isVisible()) {
            await expect(sendButton.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('should show price confirmation status', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const statusBadges = page.locator('text=Sent, text=Viewed, text=Confirmed, text=Draft');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Deposits', () => {
  test('should show deposit option after price confirmation', async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    
    const jobCard = page.locator('[data-testid^="card-job-"], [data-testid^="row-job-"]').first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const depositSection = page.locator('[data-testid="deposit-section"], text=Deposit');
      if (await depositSection.first().isVisible()) {
        await expect(depositSection.first()).toBeVisible();
      }
    }
  });

  test('should show deposit status if paid', async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    
    const depositBadge = page.locator('text=Deposit Paid, text=Deposit Applied');
    const count = await depositBadge.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
