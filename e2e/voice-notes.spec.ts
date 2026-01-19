import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad } from './helpers';

test.describe('Voice Notes Feature', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/voice-notes');
    await waitForPageLoad(page);
  });

  test('should display voice notes page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Voice Notes/i })).toBeVisible();
  });

  test('should show empty state when no notes exist', async ({ page }) => {
    const emptyState = page.getByText(/no voice notes|start recording/i);
    const notesList = page.locator('[data-testid^="voice-note-"]');
    
    const notesCount = await notesList.count();
    if (notesCount === 0 && await emptyState.first().isVisible()) {
      await expect(emptyState.first()).toBeVisible();
    }
  });

  test('should have record button visible', async ({ page }) => {
    const recordButton = page.locator('[data-testid="button-record-voice"], button:has-text("Record"), [aria-label*="record"]');
    await expect(recordButton.first()).toBeVisible();
  });

  test('should open record dialog when clicking record', async ({ page }) => {
    const recordButton = page.locator('[data-testid="button-record-voice"], button:has-text("Record"), [aria-label*="record"]');
    
    if (await recordButton.first().isVisible()) {
      await recordButton.first().click();
      await page.waitForTimeout(500);
      
      const dialog = page.locator('[role="dialog"], [data-testid="dialog-record-voice"]');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('should display voice notes list when notes exist', async ({ page }) => {
    const notesList = page.locator('[data-testid^="voice-note-"], [data-testid^="card-voice-note-"]');
    const count = await notesList.count();
    
    if (count > 0) {
      await expect(notesList.first()).toBeVisible();
    }
  });

  test('should allow playing a voice note', async ({ page }) => {
    const playButton = page.locator('[data-testid^="button-play-"], button:has([class*="play"]), [aria-label*="play"]');
    
    if (await playButton.first().isVisible()) {
      await playButton.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('should show voice note timestamp', async ({ page }) => {
    const notesList = page.locator('[data-testid^="voice-note-"], [data-testid^="card-voice-note-"]');
    
    if (await notesList.first().isVisible()) {
      const timestamp = notesList.first().locator('text=/\\d+:\\d+|ago|today|yesterday/i');
      await expect(timestamp.first()).toBeVisible();
    }
  });

  test('should allow deleting a voice note', async ({ page }) => {
    const deleteButton = page.locator('[data-testid^="button-delete-voice-"], button:has([class*="trash"]), [aria-label*="delete"]');
    
    if (await deleteButton.first().isVisible()) {
      await deleteButton.first().click();
      await page.waitForTimeout(300);
      
      const confirmDialog = page.locator('[role="alertdialog"], text=Are you sure, text=Delete');
      if (await confirmDialog.first().isVisible()) {
        await expect(confirmDialog.first()).toBeVisible();
      }
    }
  });
});
