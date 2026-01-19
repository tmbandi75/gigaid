import { Page, expect } from '@playwright/test';

export const BASE_URL = 'http://localhost:5000';

export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForPageLoad(page);
}

export async function clickButton(page: Page, testId: string) {
  await page.locator(`[data-testid="${testId}"]`).click();
}

export async function fillInput(page: Page, testId: string, value: string) {
  await page.locator(`[data-testid="${testId}"]`).fill(value);
}

export async function expectVisible(page: Page, testId: string) {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
}

export async function expectText(page: Page, testId: string, text: string) {
  await expect(page.locator(`[data-testid="${testId}"]`)).toContainText(text);
}

export async function expectUrl(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(path));
}

export async function waitForToast(page: Page) {
  await page.waitForSelector('[role="status"]', { timeout: 5000 }).catch(() => {});
}

export async function dismissDialog(page: Page) {
  const closeButton = page.locator('[data-testid="button-close-dialog"], [aria-label="Close"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}
