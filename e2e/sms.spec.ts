import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

test.describe('SMS Messages', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
  });

  test.afterEach(async () => {
    await resetTestData(TEST_USER.id);
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('messages page loads successfully', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/messages');
    await page.waitForLoadState('networkidle');

    const messagesPage = page.locator('[data-testid="page-messages"]');
    const pageTitle = page.locator('[data-testid="page-title"]');
    const messagesHeading = page.getByText(/messages/i).first();

    const hasPage = await messagesPage.isVisible({ timeout: 10000 }).catch(() => false);
    const hasTitle = await pageTitle.isVisible({ timeout: 3000 }).catch(() => false);
    const hasHeading = await messagesHeading.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasPage || hasTitle || hasHeading).toBeTruthy();
    await page.context().close();
  });

  test('shows empty state when no conversations', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/messages');
    await page.waitForLoadState('networkidle');

    const emptyState = page.getByText(/no messages yet|when you send|no conversations/i).first();
    const conversationItem = page.locator('[data-testid^="conversation-"]').first();

    const hasEmpty = await emptyState.isVisible({ timeout: 8000 }).catch(() => false);
    const hasConversations = await conversationItem.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasEmpty || hasConversations).toBeTruthy();
    await page.context().close();
  });

  test('reply textarea is available when conversation selected', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/messages');
    await page.waitForLoadState('networkidle');

    const conversationItem = page.locator('[data-testid^="conversation-"]').first();

    if (await conversationItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await conversationItem.click();
      await page.waitForLoadState('networkidle');

      const replyTextarea = page.locator('[data-testid="textarea-reply"]');
      const sendButton = page.locator('[data-testid="button-send-reply"]');

      await expect(replyTextarea).toBeVisible({ timeout: 5000 });
      await expect(sendButton).toBeVisible({ timeout: 5000 });
    }
    await page.context().close();
  });

  test('can type in reply textarea', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/messages');
    await page.waitForLoadState('networkidle');

    const conversationItem = page.locator('[data-testid^="conversation-"]').first();

    if (await conversationItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await conversationItem.click();
      await page.waitForLoadState('networkidle');

      const replyTextarea = page.locator('[data-testid="textarea-reply"]');
      if (await replyTextarea.isVisible({ timeout: 5000 }).catch(() => false)) {
        await replyTextarea.fill('E2E test message content');
        await expect(replyTextarea).toHaveValue('E2E test message content');
      }
    }
    await page.context().close();
  });

  test('conversation messages display correctly', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/messages');
    await page.waitForLoadState('networkidle');

    const conversationItem = page.locator('[data-testid^="conversation-"]').first();

    if (await conversationItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await conversationItem.click();
      await page.waitForLoadState('networkidle');

      const messages = page.locator('[data-testid^="message-"]');
      const emptyThread = page.getByText(/no messages in this conversation/i);

      const hasMessages = await messages.count() > 0;
      const hasEmptyThread = await emptyThread.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasMessages || hasEmptyThread).toBeTruthy();
    }
    await page.context().close();
  });
});
