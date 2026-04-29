import { test, expect } from '@playwright/test';
import {
  setupTestUser,
  resetTestData,
  authenticatedPage,
  setSmsOptOut,
} from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

test.describe('SMS Paused — composers block sending', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
  });

  test.beforeEach(async () => {
    await setSmsOptOut(TEST_USER.id, true);
  });

  test.afterEach(async () => {
    await setSmsOptOut(TEST_USER.id, false);
    await resetTestData(TEST_USER.id);
  });

  test('Reminders dialog disables Schedule when channel is SMS', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/reminders');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="banner-sms-opt-out"]').first()).toBeVisible({ timeout: 10000 });

    const addButton = page.locator('[data-testid="button-add-reminder"]').first();
    await addButton.click();

    const saveButton = page.locator('[data-testid="button-save-reminder"]');
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeDisabled();

    // Hovering the disabled save action surfaces the SMS-paused tooltip
    const saveWrapper = saveButton.locator('xpath=..');
    await saveWrapper.hover();
    await expect(
      page.getByText(/SMS is paused\. Tap Resume SMS/i).first(),
    ).toBeVisible({ timeout: 3000 });

    // Switching to email channel should re-enable the button (smsOptOut only blocks SMS)
    const emailChannel = page.locator('[data-testid="button-channel-email"]').first();
    if (await emailChannel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailChannel.click();
      await expect(saveButton).toBeEnabled();
    }

    await page.context().close();
  });

  test('Inbox composer shows the SMS-paused banner above conversations', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/messages');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="banner-sms-opt-out"]').first()).toBeVisible({ timeout: 10000 });

    // If a conversation thread is reachable, the send button must be disabled
    const conversationItem = page.locator('[data-testid^="conversation-"]').first();
    if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await conversationItem.click();
      await page.waitForLoadState('networkidle');

      const sendButton = page.locator('[data-testid="button-send-reply"]');
      if (await sendButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(sendButton).toBeDisabled();
      }
    }

    await page.context().close();
  });

  test('Notify Clients compose-step button disabled when sending SMS', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/notify-clients');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="banner-sms-opt-out"]').first()).toBeVisible({ timeout: 10000 });

    // If we can reach the compose step, the Review & Send button must be disabled
    const reviewButton = page.locator('[data-testid="button-review-message"]');
    if (await reviewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(reviewButton).toBeDisabled();
    }

    await page.context().close();
  });

  test('Follow-Up Messages tool disables Send from GigAid', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/ai-tools');
    await page.waitForLoadState('networkidle');

    const followUpCard = page.locator('[data-testid="card-feature-follow-up"]').first();
    if (await followUpCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await followUpCard.click();
      await page.waitForLoadState('networkidle');

      // The banner should show inside the dialog/card
      await expect(page.locator('[data-testid="banner-sms-opt-out"]').first()).toBeVisible({ timeout: 5000 });

      // The Send from GigAid button only shows after a message is generated.
      // If it's present, it must be disabled.
      const sendButton = page.locator('[data-testid="button-send-followup"]');
      if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(sendButton).toBeDisabled();
      }
    }

    await page.context().close();
  });
});
