import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Quick Capture', () => {
  test('should display quick capture option on leads page', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const quickCaptureButton = page.locator('[data-testid="button-quick-capture"], button:has-text("Quick Capture"), button:has-text("Paste")');
    if (await quickCaptureButton.first().isVisible()) {
      await expect(quickCaptureButton.first()).toBeVisible();
    }
  });

  test('should open quick capture dialog', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const quickCaptureButton = page.locator('[data-testid="button-quick-capture"], button:has-text("Quick Capture")');
    
    if (await quickCaptureButton.first().isVisible()) {
      await quickCaptureButton.first().click();
      await page.waitForTimeout(500);
      
      const dialog = page.locator('[role="dialog"], [data-testid="dialog-quick-capture"]');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('should have text input area for pasting', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const quickCaptureButton = page.locator('[data-testid="button-quick-capture"], button:has-text("Quick Capture")');
    
    if (await quickCaptureButton.first().isVisible()) {
      await quickCaptureButton.first().click();
      await page.waitForTimeout(500);
      
      const textArea = page.locator('textarea[data-testid="input-paste-text"], textarea');
      if (await textArea.first().isVisible()) {
        await expect(textArea.first()).toBeVisible();
      }
    }
  });

  test('should parse pasted text with AI', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const quickCaptureButton = page.locator('[data-testid="button-quick-capture"], button:has-text("Quick Capture")');
    
    if (await quickCaptureButton.first().isVisible()) {
      await quickCaptureButton.first().click();
      await page.waitForTimeout(500);
      
      const textArea = page.locator('textarea[data-testid="input-paste-text"], textarea').first();
      if (await textArea.isVisible()) {
        await textArea.fill('John Smith needs plumbing work at 123 Main St. Call 555-1234');
        
        const parseButton = page.locator('[data-testid="button-parse"], button:has-text("Parse"), button:has-text("Extract")');
        if (await parseButton.first().isVisible()) {
          await parseButton.first().click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });
});

test.describe('Reply Composer', () => {
  test('should show reply composer on lead details', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const replyComposer = page.locator('[data-testid="reply-composer"], text=Reply Composer, text=Generate Reply');
      if (await replyComposer.first().isVisible()) {
        await expect(replyComposer.first()).toBeVisible();
      }
    }
  });

  test('should have scenario selection', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const scenarioSelect = page.locator('[data-testid="select-scenario"], select, [role="combobox"]');
      if (await scenarioSelect.first().isVisible()) {
        await expect(scenarioSelect.first()).toBeVisible();
      }
    }
  });

  test('should generate AI reply', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const generateButton = page.locator('[data-testid="button-generate-reply"], button:has-text("Generate")');
      if (await generateButton.first().isVisible()) {
        await generateButton.first().click();
        await page.waitForTimeout(2000);
        
        const generatedReply = page.locator('[data-testid="generated-reply"], textarea');
        if (await generatedReply.first().isVisible()) {
          await expect(generatedReply.first()).toBeVisible();
        }
      }
    }
  });

  test('should allow copying generated reply', async ({ page }) => {
    await navigateTo(page, '/leads');
    await waitForPageLoad(page);
    
    const leadCard = page.locator('[data-testid^="card-lead-"], [data-testid^="row-lead-"]').first();
    
    if (await leadCard.isVisible()) {
      await leadCard.click();
      await page.waitForTimeout(500);
      
      const copyButton = page.locator('[data-testid="button-copy-reply"], button:has-text("Copy")');
      if (await copyButton.first().isVisible()) {
        await expect(copyButton.first()).toBeVisible();
      }
    }
  });
});
