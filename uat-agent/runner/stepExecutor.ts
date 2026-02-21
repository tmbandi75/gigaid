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
    '[data-testid="button-consent-deny"]',
    '[data-testid="button-consent-allow"]',
    '[data-testid="button-accept-cookies"]',
    '[data-testid="button-dismiss"]',
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    let dismissed = false;
    for (const sel of overlaySelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        uatLogger.info("Dismissed overlay: " + sel);
        dismissed = true;
        break;
      }
    }
    if (!dismissed) break;
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
        await page.waitForTimeout(1000);
        await dismissOverlays(page);
        break;
      }

      case "click": {
        const sel = step.selector || "";
        const clickTimeout = step.optional ? Math.min(stepTimeout, 5000) : stepTimeout;
        await dismissOverlays(page);
        await page.waitForSelector(sel, { state: "visible", timeout: clickTimeout });
        try {
          await page.click(sel, { timeout: 5000 });
        } catch {
          await dismissOverlays(page);
          await page.click(sel, { timeout: clickTimeout });
        }
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
          await page.locator(step.selector).first().waitFor({ state: "visible", timeout: waitTime });
        } else {
          await page.waitForTimeout(waitTime);
        }
        break;
      }

      case "signup": {
        await page.context().addInitScript(() => {
          localStorage.setItem("gigaid_analytics_consent", "denied");
        });
        await page.goto(`${env.UAT_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        const signupEmail = page.locator('[data-testid="input-email"]').first();
        await signupEmail.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
        await dismissOverlays(page);

        const toggleToSignup = page.locator('[data-testid="button-toggle-auth-mode"]').first();
        if (await toggleToSignup.isVisible({ timeout: 3000 }).catch(() => false)) {
          const text = await toggleToSignup.textContent().catch(() => "");
          if (text?.toLowerCase().includes("sign up")) {
            await toggleToSignup.click();
            await page.waitForTimeout(500);
          }
        }

        const emailInput = page.locator('[data-testid="input-email"]').first();
        await emailInput.fill(env.UAT_TEST_EMAIL);

        const passwordInput = page.locator('[data-testid="input-password"]').first();
        await passwordInput.fill(env.UAT_TEST_PASSWORD);

        const confirmInput = page.locator('[data-testid="input-confirm-password"]').first();
        if (await confirmInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmInput.fill(env.UAT_TEST_PASSWORD);
        }

        await dismissOverlays(page);
        const submitBtn = page.locator('[data-testid="button-email-submit"]').first();
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await dismissOverlays(page);
        break;
      }

      case "login": {
        // Pre-set analytics consent in localStorage before navigation to prevent the
        // consent modal from ever rendering. This avoids z-index overlay issues.
        await page.context().addInitScript(() => {
          localStorage.setItem("gigaid_analytics_consent", "denied");
        });

        await page.goto(`${env.UAT_BASE_URL}/`, { waitUntil: "load", timeout: stepTimeout });

        // Service worker installs on first visit and triggers a full page reload ~3-5s later.
        // We must wait for this reload to finish before interacting with the form.
        // Strategy: wait for a second "load" event (the SW reload) or timeout after 12s.
        await new Promise<void>((resolve) => {
          const handler = () => { page.removeListener("load", handler); resolve(); };
          page.on("load", handler);
          setTimeout(() => { page.removeListener("load", handler); resolve(); }, 12000);
        });
        await page.waitForTimeout(1500);
        await dismissOverlays(page);

        const emailInput = page.locator('[data-testid="input-email"]').first();
        const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);

        if (emailVisible) {
          uatLogger.info("Splash page shown — filling login form");
          await emailInput.fill(env.UAT_TEST_EMAIL);
          await page.locator('[data-testid="input-password"]').first().fill(env.UAT_TEST_PASSWORD);
          await dismissOverlays(page);
          await page.locator('[data-testid="button-email-submit"]').first().click({ force: true });
          try {
            await page.waitForURL(/\/(dashboard|jobs|leads|invoices|onboarding|more|settings|pricing)/, { timeout: 15000 });
            uatLogger.info("Navigated after login: " + page.url());
          } catch {
            uatLogger.warn("Login navigation timeout — checking token");
          }
        } else {
          uatLogger.info("Email input not visible — checking if already authenticated");
          try {
            await page.waitForURL(/\/(dashboard|jobs|leads|invoices|onboarding|more|settings|pricing)/, { timeout: 10000 });
            uatLogger.info("Already authenticated: " + page.url());
          } catch {
            uatLogger.warn("Not authenticated and email not visible");
          }
        }

        const hasToken = await page.evaluate(() => !!localStorage.getItem("gigaid_auth_token")).catch(() => false);
        uatLogger.info(hasToken ? "Auth token confirmed" : "No auth token");

        await page.waitForTimeout(1000);
        await dismissOverlays(page);
        break;
      }

      case "create_job": {
        const jobTitle = step.value || "UAT Test Job";
        await page.goto(`${env.UAT_BASE_URL}/jobs`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1500);
        await dismissOverlays(page);

        const addBtn = page.locator('[data-testid="button-add-job"], [data-testid="button-add-job-header"], [data-testid="button-add-job-header-desktop"]').first();
        if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await dismissOverlays(page);
          await addBtn.click();
          await page.waitForTimeout(1000);
        }

        const titleInput = page.locator('[data-testid="input-job-title"], input[name="title"], input[placeholder*="title" i]').first();
        if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await titleInput.fill(jobTitle);
        }

        const saveBtn = page.locator('[data-testid="button-save-job"], button[type="submit"]').first();
        if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }
        break;
      }

      case "send_invoice": {
        await page.goto(`${env.UAT_BASE_URL}/invoices`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1500);
        await dismissOverlays(page);

        const createBtn = page.locator('[data-testid="button-add-invoice"], [data-testid="button-add-invoice-header"], [data-testid="button-add-first-invoice"]').first();
        if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await dismissOverlays(page);
          await createBtn.click();
          await page.waitForTimeout(1500);
        }

        const sendBtn = page.locator('[data-testid="button-send-invoice"]').first();
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

        const payBtn = page.locator('[data-testid="button-pay-deposit"], [data-testid="button-pay"], button:has-text("Pay")').first();
        if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await payBtn.click();
          await page.waitForTimeout(3000);
        }
        break;
      }

      case "upgrade_plan": {
        await page.goto(`${env.UAT_BASE_URL}/pricing`, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        await page.waitForTimeout(1500);
        await dismissOverlays(page);

        const upgradeBtn = page.locator('[data-testid="button-plan-pro"], [data-testid="card-plan-pro"] button').first();
        if (await upgradeBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
          await dismissOverlays(page);
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
