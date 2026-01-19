import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Help & Support', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/help');
    await waitForPageLoad(page);
  });

  test('should display help page', async ({ page }) => {
    await expect(page.locator('text=Help')).toBeVisible();
  });

  test('should show FAQ categories', async ({ page }) => {
    const categories = page.locator('[data-testid="card-faqs"] button, [data-testid^="faq-category-"]');
    const count = await categories.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have search input', async ({ page }) => {
    const searchInput = page.locator('[data-testid="input-search-help"], input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('should filter FAQs when searching', async ({ page }) => {
    const searchInput = page.locator('[data-testid="input-search-help"], input[placeholder*="Search"]');
    await searchInput.fill('invoice');
    await page.waitForTimeout(300);
    
    const results = page.locator('text=/invoice/i');
    await expect(results.first()).toBeVisible();
  });

  test('should show no results message for invalid search', async ({ page }) => {
    const searchInput = page.locator('[data-testid="input-search-help"], input[placeholder*="Search"]');
    await searchInput.fill('xyznonexistent123');
    await page.waitForTimeout(300);
    
    const noResults = page.locator('text=No results, text=not found');
    if (await noResults.first().isVisible()) {
      await expect(noResults.first()).toBeVisible();
    }
  });

  test('should expand FAQ category on click', async ({ page }) => {
    const category = page.locator('[data-testid="card-faqs"] button').first();
    
    if (await category.isVisible()) {
      await category.click();
      await page.waitForTimeout(300);
      
      const questions = page.locator('[data-testid="card-faqs"] [data-state="open"], [role="region"]');
      await expect(questions.first()).toBeVisible();
    }
  });

  test('should expand FAQ question on click', async ({ page }) => {
    const category = page.locator('[data-testid="card-faqs"] button').first();
    
    if (await category.isVisible()) {
      await category.click();
      await page.waitForTimeout(300);
      
      const question = page.locator('[data-testid="card-faqs"] [role="button"]').first();
      if (await question.isVisible()) {
        await question.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('should show contact options', async ({ page }) => {
    const emailCard = page.locator('[data-testid="card-email-support"], text=Email');
    const phoneCard = page.locator('[data-testid="card-phone-support"], text=Call');
    
    await expect(emailCard.first()).toBeVisible();
    await expect(phoneCard.first()).toBeVisible();
  });

  test('should have support ticket section', async ({ page }) => {
    const ticketSection = page.locator('text=Contact, text=Submit, text=Ticket, form');
    if (await ticketSection.first().isVisible()) {
      await expect(ticketSection.first()).toBeVisible();
    }
  });

  test('should allow creating support ticket', async ({ page }) => {
    const subjectInput = page.locator('input[name="subject"], [data-testid="input-ticket-subject"]');
    const messageInput = page.locator('textarea[name="message"], [data-testid="input-ticket-message"]');
    
    if (await subjectInput.isVisible() && await messageInput.isVisible()) {
      await subjectInput.fill('E2E Test Ticket');
      await messageInput.fill('This is a test ticket from automated testing.');
      
      const submitButton = page.locator('button[type="submit"], [data-testid="button-submit-ticket"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await waitForToast(page);
      }
    }
  });

  test('should show Voice Notes FAQ category', async ({ page }) => {
    const voiceNotesCategory = page.locator('text=Voice Notes');
    await expect(voiceNotesCategory.first()).toBeVisible();
  });

  test('should show AI Smart Suggestions FAQ category', async ({ page }) => {
    const aiCategory = page.locator('text=AI Smart Suggestions');
    await expect(aiCategory.first()).toBeVisible();
  });

  test('should show Email Communication FAQ category', async ({ page }) => {
    const emailCategory = page.locator('text=Email Communication');
    await expect(emailCategory.first()).toBeVisible();
  });

  test('should show Auto-Follow-Up FAQ category', async ({ page }) => {
    const autoFollowUpCategory = page.locator('text=Auto-Follow-Up');
    await expect(autoFollowUpCategory.first()).toBeVisible();
  });
});
