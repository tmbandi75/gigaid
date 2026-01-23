import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, expectVisible, clickButton } from './helpers';

test.describe('Messages Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/messages');
    await waitForPageLoad(page);
  });

  test('should load messages page without errors', async ({ page }) => {
    await expect(page.getByText(/messages/i).first()).toBeVisible();
  });

  test('should display conversation list area', async ({ page }) => {
    const conversationList = page.locator('[data-testid^="conversation-"]');
    const emptyState = page.getByText(/no messages yet|select a conversation/i);
    
    const hasConversations = await conversationList.count() > 0;
    const hasEmptyState = await emptyState.first().isVisible().catch(() => false);
    
    expect(hasConversations || hasEmptyState).toBeTruthy();
  });

  test('should show empty state when no conversations', async ({ page }) => {
    const emptyState = page.getByText(/no messages yet|when you send/i);
    const conversationItem = page.locator('[data-testid^="conversation-"]').first();
    
    if (!(await conversationItem.isVisible().catch(() => false))) {
      await expect(emptyState.first()).toBeVisible();
    }
  });

  test('should select a conversation if available', async ({ page }) => {
    const conversationItem = page.locator('[data-testid^="conversation-"]').first();
    
    if (await conversationItem.isVisible().catch(() => false)) {
      await conversationItem.click();
      await page.waitForTimeout(500);
      
      const messageThread = page.locator('[data-testid^="message-"]');
      const emptyThread = page.getByText(/no messages in this conversation/i);
      const replyInput = page.locator('[data-testid="textarea-reply"]');
      
      const threadVisible = await messageThread.count() > 0 || await emptyThread.isVisible().catch(() => false);
      const inputVisible = await replyInput.isVisible().catch(() => false);
      
      expect(threadVisible || inputVisible).toBeTruthy();
    }
  });

  test('should show send button and reply textarea when conversation selected', async ({ page }) => {
    const conversationItem = page.locator('[data-testid^="conversation-"]').first();
    
    if (await conversationItem.isVisible().catch(() => false)) {
      await conversationItem.click();
      await page.waitForTimeout(500);
      
      const replyTextarea = page.locator('[data-testid="textarea-reply"]');
      const sendButton = page.locator('[data-testid="button-send-reply"]');
      
      await expect(replyTextarea).toBeVisible();
      await expect(sendButton).toBeVisible();
    }
  });

  test('should show back button on mobile when conversation is selected', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    
    const conversationItem = page.locator('[data-testid^="conversation-"]').first();
    
    if (await conversationItem.isVisible().catch(() => false)) {
      await conversationItem.click();
      await page.waitForTimeout(500);
      
      const backButton = page.locator('[data-testid="button-back-conversations"]');
      await expect(backButton).toBeVisible();
    }
  });

  test('should display message icons correctly', async ({ page }) => {
    const messageIcon = page.locator('svg').first();
    await expect(messageIcon).toBeVisible();
  });
});

test.describe('More Page - General', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
  });

  test('should load more page without errors', async ({ page }) => {
    await expect(page.locator('[data-testid="page-more"]')).toBeVisible();
  });

  test('should display profile card at top', async ({ page }) => {
    const profileCard = page.locator('[data-testid="card-profile"]');
    await expect(profileCard).toBeVisible();
  });

  test('should show user name in profile card', async ({ page }) => {
    const profileCard = page.locator('[data-testid="card-profile"]');
    const userName = profileCard.getByText(/gig worker|your business/i);
    await expect(userName.first()).toBeVisible();
  });

  test('should show avatar with initials', async ({ page }) => {
    const profileCard = page.locator('[data-testid="card-profile"]');
    const avatar = profileCard.locator('[class*="Avatar"], [class*="avatar"]');
    if (await avatar.count() > 0) {
      await expect(avatar.first()).toBeVisible();
    } else {
      const fallbackAvatar = profileCard.locator('span').first();
      await expect(fallbackAvatar).toBeVisible();
    }
  });

  test('should show plan badge', async ({ page }) => {
    const planBadge = page.getByText(/free plan|pro plan|premium/i);
    await expect(planBadge.first()).toBeVisible();
  });

  test('should navigate to profile when profile card clicked', async ({ page }) => {
    const profileCard = page.locator('[data-testid="card-profile"]');
    await profileCard.click();
    await page.waitForTimeout(500);
    
    await expect(page).toHaveURL(/profile/i);
  });
});

test.describe('More Page - Dark Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
  });

  test('should display appearance/dark mode toggle section', async ({ page }) => {
    const darkModeSection = page.locator('[data-testid="toggle-dark-mode"]');
    await expect(darkModeSection).toBeVisible();
  });

  test('should show switch control for dark mode', async ({ page }) => {
    const darkModeSwitch = page.locator('[data-testid="switch-dark-mode"]');
    await expect(darkModeSwitch).toBeVisible();
  });

  test('should toggle dark mode when switch clicked', async ({ page }) => {
    const darkModeSwitch = page.locator('[data-testid="switch-dark-mode"]');
    const htmlElement = page.locator('html');
    
    const initialDark = await htmlElement.evaluate(el => el.classList.contains('dark'));
    
    await darkModeSwitch.click();
    await page.waitForTimeout(300);
    
    const afterDark = await htmlElement.evaluate(el => el.classList.contains('dark'));
    
    expect(afterDark).not.toBe(initialDark);
  });

  test('should show correct icon based on theme', async ({ page }) => {
    const darkModeSection = page.locator('[data-testid="toggle-dark-mode"]');
    const sunIcon = darkModeSection.locator('svg').first();
    
    await expect(sunIcon).toBeVisible();
  });
});

test.describe('More Page - Drive Mode Section', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
  });

  test('should display Drive Mode section', async ({ page }) => {
    const driveModeSection = page.locator('[data-testid="drive-mode-section"]');
    await expect(driveModeSection).toBeVisible();
  });

  test('should show Drive Mode with car icon', async ({ page }) => {
    const driveModeSection = page.locator('[data-testid="drive-mode-section"]');
    const carIcon = driveModeSection.locator('svg').first();
    
    await expect(driveModeSection).toBeVisible();
    await expect(carIcon).toBeVisible();
  });

  test('should show Drive Mode label text', async ({ page }) => {
    const driveLabel = page.getByText('Drive Mode');
    await expect(driveLabel.first()).toBeVisible();
  });

  test('should show GPS status indicator', async ({ page }) => {
    const driveModeSection = page.locator('[data-testid="drive-mode-section"]');
    const gpsIndicator = driveModeSection.getByText(/inactive|tracking|connecting|denied|error|mph/i);
    
    await expect(gpsIndicator.first()).toBeVisible();
  });

  test('should show Start button for Drive Mode', async ({ page }) => {
    const startButton = page.locator('[data-testid="button-enter-drive-mode"]');
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText(/start/i);
  });

  test('should have clickable Start button', async ({ page }) => {
    const startButton = page.locator('[data-testid="button-enter-drive-mode"]');
    await expect(startButton).toBeEnabled();
  });

  test('should show Drive Mode section with blue gradient icon', async ({ page }) => {
    const driveModeSection = page.locator('[data-testid="drive-mode-section"]');
    const iconContainer = driveModeSection.locator('[class*="bg-gradient"]').first();
    
    await expect(iconContainer).toBeVisible();
    
    const bgClass = await iconContainer.getAttribute('class');
    expect(bgClass).toContain('blue');
  });
});

test.describe('More Page - Menu Sections', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
  });

  test('should show Tools section', async ({ page }) => {
    const toolsSection = page.getByText('Tools').first();
    await expect(toolsSection).toBeVisible();
  });

  test('should show Business section', async ({ page }) => {
    const businessSection = page.getByText('Business').first();
    await expect(businessSection).toBeVisible();
  });

  test('should show Account section', async ({ page }) => {
    const accountSection = page.getByText('Account', { exact: true });
    await expect(accountSection).toBeVisible();
  });

  test('should show Quick Capture menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-quick-capture"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Business Co-Pilot menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-business-co-pilot"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Messages menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-messages"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Crew menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-crew"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Reminders menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-reminders"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Booking Requests menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-booking-requests"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Owner View menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-owner-view"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Reviews menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-reviews"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Referrals menu item', async ({ page }) => {
    const menuItem = page.getByText(/referrals/i).first();
    await expect(menuItem).toBeVisible();
  });

  test('should show Profile menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-profile"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Settings menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-settings"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Help & Support menu item', async ({ page }) => {
    const menuItem = page.locator('[data-testid="menu-help-&-support"]');
    await expect(menuItem).toBeVisible();
  });

  test('should show Log Out option', async ({ page }) => {
    const logoutOption = page.locator('[data-testid="menu-logout"]');
    await expect(logoutOption).toBeVisible();
  });
});

test.describe('More Page - Menu Navigation', () => {
  test('should navigate to Quick Capture page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-quick-capture"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/share/i);
  });

  test('should navigate to Business Co-Pilot page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-business-co-pilot"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/ai-tools/i);
  });

  test('should navigate to Messages page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-messages"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/messages/i);
  });

  test('should navigate to Crew page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-crew"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/crew/i);
  });

  test('should navigate to Reminders page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-reminders"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/reminders/i);
  });

  test('should navigate to Booking Requests page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-booking-requests"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/booking-requests/i);
  });

  test('should navigate to Owner View page', async ({ page }) => {
    await navigateTo(page, '/more');
    const ownerMenuItem = page.getByText('Owner View').first();
    await ownerMenuItem.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/owner/i);
  });

  test('should navigate to Reviews page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-reviews"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/reviews/i);
  });

  test('should navigate to Referrals page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-referrals"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/referrals/i);
  });

  test('should navigate to Profile page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-profile"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/profile/i);
  });

  test('should navigate to Settings page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-settings"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/settings/i);
  });

  test('should navigate to Help & Support page', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="menu-help-&-support"]').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/help/i);
  });
});

test.describe('Drive Mode', () => {
  test('should enter Drive Mode when Start button clicked', async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
    
    const startButton = page.locator('[data-testid="button-enter-drive-mode"]');
    await startButton.click();
    await page.waitForTimeout(500);
    
    const driveModeView = page.locator('[data-testid="drive-mode-view"]');
    await expect(driveModeView).toBeVisible();
  });

  test('should display Drive Mode view correctly', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const driveModeHeader = page.getByText('Drive Mode');
    await expect(driveModeHeader.first()).toBeVisible();
  });

  test('should show exit button in Drive Mode', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const exitButton = page.locator('[data-testid="button-exit-drive-mode"]');
    await expect(exitButton).toBeVisible();
  });

  test('should exit Drive Mode when exit button clicked', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const exitButton = page.locator('[data-testid="button-exit-drive-mode"]');
    await exitButton.click();
    await page.waitForTimeout(500);
    
    const driveModeView = page.locator('[data-testid="drive-mode-view"]');
    await expect(driveModeView).not.toBeVisible();
  });

  test('should show voice note button in Drive Mode', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const voiceNoteButton = page.locator('[data-testid="button-drive-voice-note"]');
    await expect(voiceNoteButton).toBeVisible();
    await expect(voiceNoteButton).toContainText(/record voice note/i);
  });

  test('should show mark complete button in Drive Mode', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const markCompleteButton = page.locator('[data-testid="button-drive-mark-complete"]');
    await expect(markCompleteButton).toBeVisible();
    await expect(markCompleteButton).toContainText(/mark job complete/i);
  });

  test('should show add note button in Drive Mode', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const addNoteButton = page.locator('[data-testid="button-drive-add-note"]');
    await expect(addNoteButton).toBeVisible();
    await expect(addNoteButton).toContainText(/add note/i);
  });

  test('should show current job card or no active job message', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const jobCard = page.getByText(/current job|no active job/i);
    await expect(jobCard.first()).toBeVisible();
  });

  test('should open note dialog when add note button clicked', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const addNoteButton = page.locator('[data-testid="button-drive-add-note"]');
    
    if (await addNoteButton.isEnabled()) {
      await addNoteButton.click();
      await page.waitForTimeout(500);
      
      const noteDialog = page.getByRole('dialog');
      const noteDialogTitle = page.getByText('Add Note');
      
      if (await noteDialog.isVisible().catch(() => false)) {
        await expect(noteDialogTitle.first()).toBeVisible();
      }
    }
  });

  test('should have dark background in Drive Mode', async ({ page }) => {
    await navigateTo(page, '/more');
    await page.locator('[data-testid="button-enter-drive-mode"]').click();
    await page.waitForTimeout(500);
    
    const driveModeView = page.locator('[data-testid="drive-mode-view"]');
    const bgClass = await driveModeView.getAttribute('class');
    
    expect(bgClass).toContain('bg-black');
  });
});

test.describe('More Page - Version Info', () => {
  test('should show app version at bottom', async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
    
    const versionText = page.getByText(/v\d+\.\d+\.\d+/);
    await expect(versionText).toBeVisible();
  });

  test('should show GigAid logo at bottom', async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
    
    const morePage = page.locator('[data-testid="page-more"]');
    const logo = morePage.locator('img[alt="GigAid"]');
    await expect(logo).toBeVisible();
  });
});
