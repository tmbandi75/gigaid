import { test, expect } from '@playwright/test';
import { setupTestUser, resetTestData, authenticatedPage, seedInvoice } from './test-setup';
import { TEST_USER, BASE_URL } from './test-constants';

test.describe('Invoice Management', () => {
  test.beforeAll(async () => {
    await setupTestUser(TEST_USER);
  });

  test.afterEach(async () => {
    await resetTestData(TEST_USER.id);
  });

  test.afterAll(async () => {
    await resetTestData(TEST_USER.id);
  });

  test('should display invoices list with seeded data', async ({ browser }) => {
    await seedInvoice({
      userId: TEST_USER.id,
      clientName: 'Invoice Client',
      amount: 15000,
      serviceDescription: 'Plumbing repair',
      status: 'sent',
    });

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/invoices');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /invoices/i })).toBeVisible({ timeout: 10000 });

    const clientText = page.getByText('Invoice Client');
    await expect(clientText.first()).toBeVisible({ timeout: 5000 });
    await page.context().close();
  });

  test('should create a new invoice via form', async ({ browser }) => {
    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/invoices/new');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="page-invoice-form"]')).toBeVisible({ timeout: 10000 });

    const firstNameInput = page.locator('[data-testid="input-first-name"]');
    await firstNameInput.fill('Jane');

    const lastNameInput = page.locator('[data-testid="input-last-name"]');
    await lastNameInput.fill('Smith');

    const serviceInput = page.locator('[data-testid="input-service-description"]');
    await serviceInput.fill('House cleaning service');

    const amountInput = page.locator('[data-testid="input-amount"]');
    await amountInput.fill('200');

    const submitBtn = page.locator('[data-testid="button-submit"]');
    await submitBtn.click();

    await page.waitForLoadState('networkidle');

    const successIndicator = page.getByText(/created|saved|success/i).first();
    const hasToast = await successIndicator.isVisible({ timeout: 5000 }).catch(() => false);
    const navigatedAway = !page.url().includes('/invoices/new');

    expect(hasToast || navigatedAway).toBeTruthy();
    await page.context().close();
  });

  test('should view invoice details', async ({ browser }) => {
    await seedInvoice({
      userId: TEST_USER.id,
      clientName: 'Detail Invoice Client',
      amount: 25000,
      serviceDescription: 'Window washing',
      status: 'draft',
    });

    const page = await authenticatedPage(browser, TEST_USER.id);
    await page.goto(BASE_URL + '/invoices');
    await page.waitForLoadState('networkidle');

    const invoiceEntry = page.locator('[data-testid^="card-invoice-"], [data-testid^="row-invoice-"]').first();
    const invoiceLink = page.getByText('Detail Invoice Client');

    const clickTarget = await invoiceEntry.isVisible({ timeout: 5000 }).catch(() => false)
      ? invoiceEntry
      : invoiceLink.first();

    await clickTarget.click();
    await page.waitForLoadState('networkidle');

    const detailContent = page.getByText('Detail Invoice Client').or(page.getByText('Window washing'));
    await expect(detailContent.first()).toBeVisible({ timeout: 5000 });
    await page.context().close();
  });

  test('should display public invoice view without auth', async ({ browser }) => {
    const publicToken = `pub_e2e_${Date.now()}`;
    await seedInvoice({
      userId: TEST_USER.id,
      clientName: 'Public Invoice Client',
      amount: 5000,
      serviceDescription: 'Gutter cleaning',
      status: 'sent',
      publicToken,
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + `/invoice/${publicToken}`);
    await page.waitForLoadState('networkidle');

    const invoiceContent = page.getByText('Public Invoice Client')
      .or(page.getByText('Gutter cleaning'))
      .or(page.locator('[data-testid="badge-invoice-status"]'));

    await expect(invoiceContent.first()).toBeVisible({ timeout: 10000 });
    await context.close();
  });
});
