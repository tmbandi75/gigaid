import type { Page } from "playwright";
import type { Assertion, AssertionResult } from "../utils/types";
import { uatLogger } from "../utils/logger";

async function dismissOverlaysForAssertion(page: Page): Promise<void> {
  const selectors = [
    '[data-testid="button-consent-deny"]',
    '[data-testid="button-consent-allow"]',
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

export async function runAssertion(page: Page, assertion: Assertion, timeout: number): Promise<AssertionResult> {
  const start = Date.now();
  const desc = assertion.description || `${assertion.type}: ${assertion.expected || assertion.selector || ""}`;

  try {
    switch (assertion.type) {
      case "url": {
        const currentUrl = page.url();
        const expected = assertion.expected || "";
        if (!currentUrl.includes(expected)) {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            actual: currentUrl,
            error: `URL mismatch: expected to contain "${expected}", got "${currentUrl}"`,
          };
        }
        uatLogger.pass(`URL contains "${expected}"`);
        return { type: assertion.type, description: desc, status: "pass", expected, actual: currentUrl };
      }

      case "text_present": {
        const text = assertion.expected || "";
        try {
          await page.waitForFunction(
            (t: string) => (document.body.textContent || "").includes(t),
            text,
            { timeout: Math.min(timeout, 10000) }
          );
          uatLogger.pass(`Text present: "${text}"`);
          return { type: assertion.type, description: desc, status: "pass", expected: text };
        } catch {
          const bodyText = await page.evaluate(() => (document.body.textContent || "").slice(0, 500));
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected: text,
            actual: bodyText,
            error: `Text "${text}" not found on page`,
          };
        }
      }

      case "element_visible": {
        const sel = assertion.selector || "";
        try {
          await dismissOverlaysForAssertion(page);
          await page.locator(sel).first().waitFor({ state: "visible", timeout: Math.min(timeout, 10000) });
          uatLogger.pass(`Element visible: ${sel}`);
          return { type: assertion.type, description: desc, status: "pass" };
        } catch {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            error: `Element "${sel}" not visible within ${timeout}ms`,
          };
        }
      }

      case "element_hidden": {
        const sel = assertion.selector || "";
        try {
          await page.waitForSelector(sel, { state: "hidden", timeout });
          uatLogger.pass(`Element hidden: ${sel}`);
          return { type: assertion.type, description: desc, status: "pass" };
        } catch {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            error: `Element "${sel}" still visible after ${timeout}ms`,
          };
        }
      }

      case "payment_success": {
        const sel = assertion.selector || '[data-testid*="payment-success"], [data-testid*="status-paid"]';
        try {
          await page.waitForSelector(sel, { state: "visible", timeout });
          uatLogger.pass("Payment success indicator found");
          return { type: assertion.type, description: desc, status: "pass" };
        } catch {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            error: "Payment success indicator not found on page",
          };
        }
      }

      case "job_status": {
        const expected = assertion.expected || "completed";
        const sel = assertion.selector || `[data-testid*="job-status"]`;
        try {
          const el = await page.waitForSelector(sel, { state: "visible", timeout });
          const text = await el?.textContent() || "";
          if (text.toLowerCase().includes(expected.toLowerCase())) {
            uatLogger.pass(`Job status is "${expected}"`);
            return { type: assertion.type, description: desc, status: "pass", expected, actual: text };
          }
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            actual: text,
            error: `Job status expected "${expected}" but got "${text}"`,
          };
        } catch {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            error: `Job status element "${sel}" not found`,
          };
        }
      }

      case "invoice_status": {
        const expected = assertion.expected || "paid";
        const sel = assertion.selector || `[data-testid*="invoice-status"]`;
        try {
          const el = await page.waitForSelector(sel, { state: "visible", timeout });
          const text = await el?.textContent() || "";
          if (text.toLowerCase().includes(expected.toLowerCase())) {
            uatLogger.pass(`Invoice status is "${expected}"`);
            return { type: assertion.type, description: desc, status: "pass", expected, actual: text };
          }
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            actual: text,
            error: `Invoice status expected "${expected}" but got "${text}"`,
          };
        } catch {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            error: `Invoice status element "${sel}" not found`,
          };
        }
      }

      case "subscription_status": {
        const expected = assertion.expected || "active";
        const sel = assertion.selector || `[data-testid*="subscription-status"], [data-testid*="plan-status"]`;
        try {
          const el = await page.waitForSelector(sel, { state: "visible", timeout });
          const text = await el?.textContent() || "";
          if (text.toLowerCase().includes(expected.toLowerCase())) {
            uatLogger.pass(`Subscription status is "${expected}"`);
            return { type: assertion.type, description: desc, status: "pass", expected, actual: text };
          }
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            actual: text,
            error: `Subscription status expected "${expected}" but got "${text}"`,
          };
        } catch {
          return {
            type: assertion.type,
            description: desc,
            status: "fail",
            expected,
            error: `Subscription status element "${sel}" not found`,
          };
        }
      }

      default:
        return {
          type: assertion.type,
          description: desc,
          status: "fail",
          error: `Unknown assertion type: ${assertion.type}`,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    uatLogger.fail(desc, errorMsg);
    return {
      type: assertion.type,
      description: desc,
      status: "fail",
      error: errorMsg,
    };
  }
}
