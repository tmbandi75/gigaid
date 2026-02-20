import type { Page } from "playwright";
import type { Step, StepResult } from "../utils/types";
import { getEnv } from "../utils/env";
import { uatLogger } from "../utils/logger";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = getEnv();

async function dismissOverlays(page: Page): Promise<void> {
  const overlaySelectors = [
    '[data-testid="modal-analytics-consent"] button:has-text("Accept")',
    '[data-testid="modal-analytics-consent"] button:has-text("Decline")',
    '[data-testid="modal-analytics-consent"] button:has-text("Continue")',
    '[data-testid="button-accept-cookies"]',
    '[data-testid="button-dismiss"]',
  ];

  for (const sel of overlaySelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(300);
      uatLogger.info("Dismissed overlay/consent modal");
      break;
    }
  }
}

export async function executeStep(
  page: Page,
  step: Step,
  stepNum: number,
  scenarioName: string,
  timeout: number
): Promise<StepResult> {
  const start = Date.now();
  const desc = step.description || `${step.action} ${step.selector || step.url || step.value || ""}`.trim();
  const stepTimeout = step.timeout || timeout;

  uatLogger.step(scenarioName, stepNum, step.action, desc);

  try {
    switch (step.action) {
      case "goto": {
        const target = step.url || step.value || "/";
        const fullUrl = target.startsWith("http") ? target : `${env.UAT_BASE_URL}${target}`;
        await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await dismissOverlays(page);
        break;
      }

      case "click": {
        const sel = step.selector || "";
        await page.waitForSelector(sel, { state: "visible", timeout: stepTimeout });
        await page.click(sel, { timeout: stepTimeout });
        break;
      }

      case "fill": {
        const sel = step.selector || "";
        const val = substituteVars(step.value || "");
        await page.waitForSelector(sel, { state: "visible", timeout: stepTimeout });
        await page.fill(sel, val);
        break;
      }

      case "wait": {
        const waitTime = step.timeout || 2000;
        if (step.selector) {
          await page.waitForSelector(step.selector, { state: "visible", timeout: waitTime });
        } else {
          await page.waitForTimeout(waitTime);
        }
        break;
      }

      case "signup": {
        await page.goto(`${env.UAT_BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1000);
        await dismissOverlays(page);

        const signupTab = page.locator('[data-testid="button-signup-tab"], [data-testid="tab-signup"], button:has-text("Sign Up")').first();
        if (await signupTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await signupTab.click();
          await page.waitForTimeout(500);
        }

        const emailInput = page.locator('[data-testid="input-email"], input[type="email"], input[name="email"]').first();
        await emailInput.fill(env.UAT_TEST_EMAIL);

        const passwordInput = page.locator('[data-testid="input-password"], input[type="password"], input[name="password"]').first();
        await passwordInput.fill(env.UAT_TEST_PASSWORD);

        const submitBtn = page.locator('[data-testid="button-submit"], [data-testid="button-signup"], button[type="submit"]').first();
        await submitBtn.click();
        await page.waitForTimeout(2000);
        break;
      }

      case "login": {
        await page.goto(`${env.UAT_BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1000);
        await dismissOverlays(page);

        const emailInput = page.locator('[data-testid="input-email"], input[type="email"], input[name="email"]').first();
        await emailInput.fill(env.UAT_TEST_EMAIL);

        const passwordInput = page.locator('[data-testid="input-password"], input[type="password"], input[name="password"]').first();
        await passwordInput.fill(env.UAT_TEST_PASSWORD);

        const submitBtn = page.locator('[data-testid="button-submit"], [data-testid="button-login"], button[type="submit"]').first();
        await submitBtn.click();
        await page.waitForTimeout(2000);
        break;
      }

      case "create_job": {
        const jobTitle = step.value || "UAT Test Job";
        await page.goto(`${env.UAT_BASE_URL}/jobs`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1000);

        const addBtn = page.locator('[data-testid="button-add-job"], [data-testid="button-create-job"], button:has-text("Add Job"), button:has-text("New Job")').first();
        if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(500);
        }

        const titleInput = page.locator('[data-testid="input-job-title"], input[name="title"], input[placeholder*="title" i]').first();
        if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await titleInput.fill(jobTitle);
        }

        const saveBtn = page.locator('[data-testid="button-save-job"], [data-testid="button-submit"], button[type="submit"], button:has-text("Save")').first();
        if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }
        break;
      }

      case "send_invoice": {
        await page.goto(`${env.UAT_BASE_URL}/invoices`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1000);

        const createBtn = page.locator('[data-testid="button-create-invoice"], [data-testid="button-add-invoice"], button:has-text("New Invoice"), button:has-text("Create Invoice")').first();
        if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await createBtn.click();
          await page.waitForTimeout(1000);
        }

        const sendBtn = page.locator('[data-testid="button-send-invoice"], [data-testid="button-send"], button:has-text("Send")').first();
        if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await sendBtn.click();
          await page.waitForTimeout(2000);
        }
        break;
      }

      case "pay_invoice": {
        const cardInput = page.locator('input[name="cardNumber"], [data-testid="input-card-number"], iframe[name*="card"]').first();
        if (await cardInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          const tag = await cardInput.evaluate((el) => el.tagName.toLowerCase());
          if (tag === "iframe") {
            const frame = page.frameLocator('iframe[name*="card"]');
            await frame.locator('input[name="cardnumber"]').fill(env.STRIPE_TEST_CARD);
            await frame.locator('input[name="exp-date"]').fill("12/30");
            await frame.locator('input[name="cvc"]').fill("123");
            await frame.locator('input[name="postal"]').fill("10001");
          } else {
            await cardInput.fill(env.STRIPE_TEST_CARD);
          }
        }

        const payBtn = page.locator('[data-testid="button-pay"], [data-testid="button-submit-payment"], button:has-text("Pay")').first();
        if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await payBtn.click();
          await page.waitForTimeout(3000);
        }
        break;
      }

      case "upgrade_plan": {
        await page.goto(`${env.UAT_BASE_URL}/pricing`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1000);

        const upgradeBtn = page.locator('[data-testid="button-upgrade"], [data-testid*="upgrade"], button:has-text("Upgrade"), button:has-text("Get Pro")').first();
        if (await upgradeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await upgradeBtn.click();
          await page.waitForTimeout(2000);
        }
        break;
      }

      case "logout": {
        const menuBtn = page.locator('[data-testid="button-menu"], [data-testid="button-profile"], [data-testid="button-more"]').first();
        if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await menuBtn.click();
          await page.waitForTimeout(500);
        }

        const logoutBtn = page.locator('[data-testid="button-logout"], button:has-text("Log Out"), button:has-text("Logout"), a:has-text("Log Out")').first();
        if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(2000);
        }
        break;
      }

      case "assert": {
        break;
      }

      default:
        return {
          action: step.action,
          description: desc,
          status: "skip",
          duration: Date.now() - start,
          error: `Unknown action: ${step.action}`,
        };
    }

    return {
      action: step.action,
      description: desc,
      status: "pass",
      duration: Date.now() - start,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    uatLogger.fail(`Step #${stepNum} ${step.action}`, errorMsg);

    const screenshotName = `fail-${scenarioName}-step${stepNum}-${Date.now()}.png`;
    const screenshotPath = path.resolve(__dirname, "../reports", screenshotName);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      uatLogger.warn("Failed to capture failure screenshot");
    }

    return {
      action: step.action,
      description: desc,
      status: "fail",
      duration: Date.now() - start,
      error: errorMsg,
      screenshot: screenshotName,
    };
  }
}

function substituteVars(value: string): string {
  return value
    .replace(/\$\{UAT_TEST_EMAIL\}/g, env.UAT_TEST_EMAIL)
    .replace(/\$\{UAT_TEST_PASSWORD\}/g, env.UAT_TEST_PASSWORD)
    .replace(/\$\{STRIPE_TEST_CARD\}/g, env.STRIPE_TEST_CARD)
    .replace(/\$\{UAT_BASE_URL\}/g, env.UAT_BASE_URL);
}
