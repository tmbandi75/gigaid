import { chromium, type Page, type Browser, type BrowserContext } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { ROUTES, type RouteConfig } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.UAT_BASE_URL || "http://localhost:5000";
const TEST_EMAIL = process.env.UAT_TEST_EMAIL || "uat-test@gigaid.ai";
const TEST_PASSWORD = process.env.UAT_TEST_PASSWORD || "UatTest123!";
const RAW_DIR = path.resolve(__dirname, "../../exports/appstore/raw");

const VIEWPORT_WIDTH = 430;
const VIEWPORT_HEIGHT = 932;
const DEVICE_SCALE = 3;

async function dismissOverlays(page: Page): Promise<void> {
  const selectors = [
    '[data-testid="button-consent-deny"]',
    '[data-testid="button-consent-allow"]',
    '[data-testid="button-accept-cookies"]',
    '[data-testid="button-dismiss"]',
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    let dismissed = false;
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        dismissed = true;
        break;
      }
    }
    if (!dismissed) break;
  }
}

async function login(page: Page): Promise<void> {
  console.log("  Logging in...");

  await page.goto(`${BASE_URL}/?ss=1`, { waitUntil: "load", timeout: 30000 });

  await new Promise<void>((resolve) => {
    const handler = () => { page.removeListener("load", handler); resolve(); };
    page.on("load", handler);
    setTimeout(() => { page.removeListener("load", handler); resolve(); }, 12000);
  });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  const emailInput = page.locator('[data-testid="input-email"]').first();
  const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);

  if (emailVisible) {
    await emailInput.fill(TEST_EMAIL);
    await page.locator('[data-testid="input-password"]').first().fill(TEST_PASSWORD);
    await dismissOverlays(page);
    await page.locator('[data-testid="button-email-submit"]').first().click({ force: true });
    try {
      await page.waitForURL(/\/(dashboard|jobs|leads|invoices|onboarding|more|settings)/, { timeout: 15000 });
    } catch {
      console.log("  Login navigation timeout — continuing");
    }
  } else {
    try {
      await page.waitForURL(/\/(dashboard|jobs|leads|invoices|onboarding|more|settings)/, { timeout: 10000 });
    } catch {
      console.log("  Not on expected page — continuing");
    }
  }

  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  const hasToken = await page.evaluate(() => !!localStorage.getItem("gigaid_auth_token")).catch(() => false);
  console.log(hasToken ? "  Auth token confirmed" : "  Warning: No auth token");
}

async function captureRoute(
  page: Page,
  context: BrowserContext,
  route: RouteConfig
): Promise<{ buffer: Buffer; bbox: { x: number; y: number; width: number; height: number } | null }> {
  const url = `${BASE_URL}${route.path}?ss=1`;

  if (route.path.startsWith("/book/")) {
    const bookingPage = await context.newPage();
    await bookingPage.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
    await bookingPage.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await bookingPage.waitForTimeout(3000);
    const selectors = route.highlightSelector.split(", ");
    let bbox = null;
    for (const sel of selectors) {
      try {
        await bookingPage.waitForSelector(sel, { state: "visible", timeout: 5000 });
        bbox = await bookingPage.locator(sel).first().boundingBox();
        break;
      } catch {}
    }
    await bookingPage.waitForTimeout(1000);
    const buffer = await bookingPage.screenshot({ type: "png" }) as Buffer;
    await bookingPage.close();
    return { buffer, bbox };
  }

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2500);

  const selectors = route.highlightSelector.split(", ");
  let bbox = null;
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { state: "visible", timeout: 8000 });
      bbox = await page.locator(sel).first().boundingBox();
      break;
    } catch {}
  }

  await dismissOverlays(page);
  await page.waitForTimeout(1500);

  const buffer = await page.screenshot({ type: "png" }) as Buffer;
  return { buffer, bbox };
}

export interface CaptureResult {
  name: string;
  rawPath: string;
  bbox: { x: number; y: number; width: number; height: number } | null;
}

export async function captureAll(): Promise<CaptureResult[]> {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: DEVICE_SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });

  await context.addInitScript(() => {
    localStorage.setItem("gigaid_analytics_consent", "denied");
  });

  const page = await context.newPage();
  await login(page);

  const results: CaptureResult[] = [];

  for (let i = 0; i < ROUTES.length; i++) {
    const route = ROUTES[i];
    console.log(`  [${i + 1}/${ROUTES.length}] Capturing: ${route.name}`);

    try {
      const { buffer, bbox } = await captureRoute(page, context, route);
      const rawPath = path.join(RAW_DIR, `${route.name}.png`);
      fs.writeFileSync(rawPath, buffer);
      console.log(`    Saved raw: ${rawPath} (${buffer.length} bytes)`);
      results.push({ name: route.name, rawPath, bbox });
    } catch (err) {
      console.error(`    ERROR capturing ${route.name}:`, (err as Error).message);
      results.push({ name: route.name, rawPath: "", bbox: null });
    }
  }

  await browser.close();
  return results;
}
