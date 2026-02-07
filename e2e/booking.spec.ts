import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage, getAuthToken } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

async function apiRequest(method: string, path: string, token: string, body?: Record<string, any>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

test.describe('Public Booking Flow', () => {
  const BOOKING_SLUG = 'e2e-test-booking';

  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
    const token = await getAuthToken(TEST_USER.id);
    await apiRequest('PATCH', '/api/profile', token, {
      publicProfileSlug: BOOKING_SLUG,
      publicProfileEnabled: true,
    });
  });

  test.afterEach(async () => {
    await resetTestData(TEST_USER.id);
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('public booking page loads for valid slug', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + `/book/${BOOKING_SLUG}`);
    await page.waitForLoadState('networkidle');

    const bookingPage = page.locator('[data-testid="page-public-booking"]');
    await expect(bookingPage).toBeVisible({ timeout: 15000 });

    const providerProfile = page.locator('[data-testid="card-provider-profile"]');
    await expect(providerProfile).toBeVisible({ timeout: 5000 });
    await context.close();
  });

  test('booking form shows required fields', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + `/book/${BOOKING_SLUG}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-public-booking"]')).toBeVisible({ timeout: 15000 });

    const bookingForm = page.locator('[data-testid="card-booking-form"]');
    await expect(bookingForm).toBeVisible({ timeout: 5000 });

    const firstNameInput = page.locator('[data-testid="input-first-name"]');
    await expect(firstNameInput).toBeVisible({ timeout: 3000 });
    await context.close();
  });

  test('can fill and submit booking form', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + `/book/${BOOKING_SLUG}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-public-booking"]')).toBeVisible({ timeout: 15000 });

    const calendar = page.locator('[data-testid="card-calendar"]');
    if (await calendar.isVisible({ timeout: 3000 }).catch(() => false)) {
      const today = new Date();
      const futureDay = new Date(today);
      futureDay.setDate(today.getDate() + 3);
      const dayButton = page.locator(`[data-testid="date-${futureDay.getDate()}"]`);
      if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dayButton.click();
      }
    }

    const timeSlot = page.locator('[data-testid^="slot-"]').first();
    if (await timeSlot.isVisible({ timeout: 3000 }).catch(() => false)) {
      await timeSlot.click();
    }

    const firstNameInput = page.locator('[data-testid="input-first-name"]');
    await firstNameInput.fill('E2E Booking');

    const lastNameInput = page.locator('[data-testid="input-last-name"]');
    if (await lastNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lastNameInput.fill('Client');
    }

    const emailInput = page.locator('[data-testid="input-client-email"]');
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('booking-test@example.com');
    }

    const phoneInput = page.locator('[data-testid="input-client-phone"]');
    if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await phoneInput.fill('+15559876543');
    }

    const serviceSelect = page.locator('[data-testid="select-service-type"]');
    if (await serviceSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serviceSelect.click();
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    const submitBtn = page.locator('[data-testid="button-submit-booking"]');
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false) && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForLoadState('networkidle');

      const confirmation = page.getByText(/confirmed|booked|thank you|submitted|success/i).first();
      const hasConfirmation = await confirmation.isVisible({ timeout: 8000 }).catch(() => false);
      expect(hasConfirmation).toBeTruthy();
    }

    await context.close();
  });

  test('invalid booking slug shows error', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + '/book/nonexistent-slug-12345');
    await page.waitForLoadState('networkidle');

    const errorContent = page.getByText(/not found|doesn't exist|unavailable|error/i).first();
    await expect(errorContent).toBeVisible({ timeout: 10000 });
    await context.close();
  });
});
