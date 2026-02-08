import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, setUserSlug, setReferralCode, getGrowthLeads } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

const BOOKING_SLUG = 'e2e-free-setup-test';
const REFERRAL_CODE = 'E2E_REF_TEST';

test.describe('Free Setup Funnel Flow', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
    await setUserSlug(TEST_USER.id, BOOKING_SLUG);
    await setReferralCode(TEST_USER.id, REFERRAL_CODE);
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('full free setup funnel from booking page CTA to lead submission', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/book/${BOOKING_SLUG}`);
    await page.waitForLoadState('networkidle');

    const ctaLink = page.locator('[data-testid="link-powered-by-cta"]');
    await expect(ctaLink).toBeVisible({ timeout: 15000 });

    await ctaLink.click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/free-setup');
    expect(page.url()).toContain(`ref=${REFERRAL_CODE}`);

    const headline = page.locator('[data-testid="text-free-setup-headline"]');
    await expect(headline).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="input-setup-name"]').fill('E2E Free Setup Lead');
    await page.locator('[data-testid="input-setup-email"]').fill('e2e-free-setup@gigaid.test');
    await page.locator('[data-testid="input-setup-phone"]').fill('(555) 987-6543');

    const submitButton = page.locator('[data-testid="button-submit-setup"]');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    const successHeading = page.locator('[data-testid="text-setup-success"]');
    await expect(successHeading).toBeVisible({ timeout: 10000 });
    await expect(successHeading).toHaveText("You're all set!");

    const leads = await getGrowthLeads();
    const matchingLead = leads.find(
      (lead: any) => lead.email === 'e2e-free-setup@gigaid.test' && lead.source === 'free_setup'
    );
    expect(matchingLead).toBeTruthy();
    expect(matchingLead.name).toBe('E2E Free Setup Lead');

    await context.close();
  });
});
