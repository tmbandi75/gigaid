import { chromium, type Page, type Browser } from "playwright";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.UAT_BASE_URL || "http://localhost:5000";
const TEST_EMAIL = process.env.UAT_TEST_EMAIL || "uat-test@gigaid.ai";
const TEST_PASSWORD = process.env.UAT_TEST_PASSWORD || "UatTest123!";

const FINAL_WIDTH = 1290;
const FINAL_HEIGHT = 2796;
const VIEWPORT_WIDTH = 430;
const VIEWPORT_HEIGHT = 932;

const DEVICE_SCALE = 3;

const FRAME_PADDING_TOP = 80;
const FRAME_PADDING_SIDES = 40;
const FRAME_PADDING_BOTTOM = 40;
const FRAME_CORNER_RADIUS = 55;
const BEZEL_WIDTH = 8;
const DYNAMIC_ISLAND_WIDTH = 126;
const DYNAMIC_ISLAND_HEIGHT = 37;

const CAPTION_AREA_HEIGHT = 420;
const CAPTION_FONT_SIZE = 52;

const OUTPUT_DIR = path.resolve(__dirname, "../exports/appstore/iphone");

interface ScreenshotConfig {
  id: string;
  filename: string;
  caption: string;
  route: string;
  waitSelector?: string;
  preAction?: (page: Page) => Promise<void>;
  postAction?: (page: Page) => Promise<void>;
}

const SCREENSHOTS: ScreenshotConfig[] = [
  {
    id: "hero",
    filename: "01-hero.png",
    caption: "Book Jobs. Send Invoices. Get Paid.",
    route: "/dashboard",
    waitSelector: '[data-testid="page-game-plan"]',
  },
  {
    id: "booking",
    filename: "02-booking.png",
    caption: "Let Clients Book You in Seconds",
    route: "/book/gig-worker",
    waitSelector: '[data-testid="public-booking-page"], .booking-page, main',
  },
  {
    id: "payments",
    filename: "03-payments.png",
    caption: "Send Invoices & Collect Payments Instantly",
    route: "/invoices",
    waitSelector: '[data-testid="page-invoices"], [data-testid="invoice-list"]',
  },
  {
    id: "jobs",
    filename: "04-jobs.png",
    caption: "Track Jobs in One Place",
    route: "/jobs",
    waitSelector: '[data-testid="page-jobs"], [data-testid="jobs-list"]',
  },
  {
    id: "nudges",
    filename: "05-nudges.png",
    caption: "Never Miss Follow-Ups",
    route: "/ai-tools",
    waitSelector: '[data-testid="page-ai-tools"], main',
  },
  {
    id: "clients",
    filename: "06-clients.png",
    caption: "Manage Clients Effortlessly",
    route: "/leads",
    waitSelector: '[data-testid="page-leads"], [data-testid="leads-list"]',
  },
  {
    id: "overview",
    filename: "07-overview.png",
    caption: "Run Your Business Like a Pro",
    route: "/more",
    waitSelector: '[data-testid="page-more"], main',
  },
];

function generateDeviceFrameSVG(
  screenWidth: number,
  screenHeight: number
): string {
  const totalW = screenWidth + FRAME_PADDING_SIDES * 2 + BEZEL_WIDTH * 2;
  const totalH =
    screenHeight + FRAME_PADDING_TOP + FRAME_PADDING_BOTTOM + BEZEL_WIDTH * 2;
  const frameX = FRAME_PADDING_SIDES;
  const frameY = FRAME_PADDING_TOP;
  const frameW = screenWidth + BEZEL_WIDTH * 2;
  const frameH = screenHeight + BEZEL_WIDTH * 2;
  const screenX = frameX + BEZEL_WIDTH;
  const screenY = frameY + BEZEL_WIDTH;

  const diX = frameX + frameW / 2 - DYNAMIC_ISLAND_WIDTH / 2;
  const diY = frameY + BEZEL_WIDTH + 12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <defs>
    <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a2a2e"/>
      <stop offset="50%" stop-color="#1a1a1e"/>
      <stop offset="100%" stop-color="#2a2a2e"/>
    </linearGradient>
    <linearGradient id="edgeHighlight" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4a4a4e" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#3a3a3e" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#4a4a4e" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <!-- Phone body -->
  <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" rx="${FRAME_CORNER_RADIUS}" ry="${FRAME_CORNER_RADIUS}" fill="url(#frameGrad)" stroke="url(#edgeHighlight)" stroke-width="1.5"/>
  <!-- Side buttons -->
  <rect x="${frameX - 3}" y="${frameY + 130}" width="3" height="35" rx="1.5" fill="#3a3a3e"/>
  <rect x="${frameX - 3}" y="${frameY + 180}" width="3" height="60" rx="1.5" fill="#3a3a3e"/>
  <rect x="${frameX - 3}" y="${frameY + 250}" width="3" height="60" rx="1.5" fill="#3a3a3e"/>
  <rect x="${frameX + frameW}" y="${frameY + 190}" width="3" height="80" rx="1.5" fill="#3a3a3e"/>
  <!-- Screen cutout (black background) -->
  <rect x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" rx="${FRAME_CORNER_RADIUS - BEZEL_WIDTH}" ry="${FRAME_CORNER_RADIUS - BEZEL_WIDTH}" fill="#000"/>
  <!-- Dynamic Island -->
  <rect x="${diX}" y="${diY}" width="${DYNAMIC_ISLAND_WIDTH}" height="${DYNAMIC_ISLAND_HEIGHT}" rx="${DYNAMIC_ISLAND_HEIGHT / 2}" ry="${DYNAMIC_ISLAND_HEIGHT / 2}" fill="#000"/>
</svg>`;
}

function generateCaptionSVG(
  width: number,
  caption: string,
  areaHeight: number
): string {
  const textY = areaHeight / 2 + CAPTION_FONT_SIZE / 3;

  const words = caption.split(" ");
  let lines: string[] = [];
  let currentLine = "";
  const maxCharsPerLine = 22;
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + " " + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const lineHeight = CAPTION_FONT_SIZE * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (areaHeight - totalTextHeight) / 2 + CAPTION_FONT_SIZE;

  const textElements = lines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${startY + i * lineHeight}" text-anchor="middle" font-family="-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" font-size="${CAPTION_FONT_SIZE}" font-weight="700" fill="white" letter-spacing="-0.5">${escapeXml(line)}</text>`
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${areaHeight}" viewBox="0 0 ${width} ${areaHeight}">
  <defs>
    <linearGradient id="captionBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A0A0A"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${areaHeight}" fill="url(#captionBg)"/>
  ${textElements}
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function login(page: Page): Promise<void> {
  console.log("  Logging in...");

  await page.context().addInitScript(() => {
    localStorage.setItem("gigaid_analytics_consent", "denied");
  });

  await page.goto(`${BASE_URL}/`, {
    waitUntil: "load",
    timeout: 30000,
  });

  await new Promise<void>((resolve) => {
    const handler = () => {
      page.removeListener("load", handler);
      resolve();
    };
    page.on("load", handler);
    setTimeout(() => {
      page.removeListener("load", handler);
      resolve();
    }, 12000);
  });
  await page.waitForTimeout(2000);

  await dismissOverlays(page);

  const emailInput = page.locator('[data-testid="input-email"]').first();
  const emailVisible = await emailInput
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (emailVisible) {
    await emailInput.fill(TEST_EMAIL);
    await page
      .locator('[data-testid="input-password"]')
      .first()
      .fill(TEST_PASSWORD);
    await dismissOverlays(page);
    await page
      .locator('[data-testid="button-email-submit"]')
      .first()
      .click({ force: true });
    try {
      await page.waitForURL(
        /\/(dashboard|jobs|leads|invoices|onboarding|more|settings)/,
        { timeout: 15000 }
      );
    } catch {
      console.log("  Login navigation timeout — continuing anyway");
    }
  } else {
    try {
      await page.waitForURL(
        /\/(dashboard|jobs|leads|invoices|onboarding|more|settings)/,
        { timeout: 10000 }
      );
    } catch {
      console.log("  Not on expected page — continuing anyway");
    }
  }

  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  const hasToken = await page
    .evaluate(() => !!localStorage.getItem("gigaid_auth_token"))
    .catch(() => false);
  console.log(hasToken ? "  Auth token confirmed" : "  Warning: No auth token");
}

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

async function captureScreen(
  page: Page,
  config: ScreenshotConfig
): Promise<Buffer> {
  console.log(`  Navigating to ${config.route}...`);

  if (config.route.startsWith("/book/")) {
    const bookingPage = await page.context().newPage();
    await bookingPage.setViewportSize({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });
    await bookingPage.goto(`${BASE_URL}${config.route}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await bookingPage.waitForTimeout(3000);
    if (config.waitSelector) {
      const selectors = config.waitSelector.split(", ");
      for (const sel of selectors) {
        try {
          await bookingPage.waitForSelector(sel, {
            state: "visible",
            timeout: 5000,
          });
          break;
        } catch {}
      }
    }
    await bookingPage.waitForTimeout(1000);
    const buf = await bookingPage.screenshot({ type: "png" });
    await bookingPage.close();
    return buf as Buffer;
  }

  await page.goto(`${BASE_URL}${config.route}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(2000);

  if (config.waitSelector) {
    const selectors = config.waitSelector.split(", ");
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { state: "visible", timeout: 8000 });
        break;
      } catch {}
    }
  }

  await dismissOverlays(page);

  if (config.preAction) await config.preAction(page);

  await page.waitForTimeout(1500);

  if (config.postAction) await config.postAction(page);

  return (await page.screenshot({ type: "png" })) as Buffer;
}

async function composeScreenshot(
  screenshotBuffer: Buffer,
  config: ScreenshotConfig
): Promise<Buffer> {
  const screenW = VIEWPORT_WIDTH * DEVICE_SCALE;
  const screenH = VIEWPORT_HEIGHT * DEVICE_SCALE;

  const resizedScreen = await sharp(screenshotBuffer)
    .resize(screenW, screenH, { fit: "cover" })
    .png()
    .toBuffer();

  const cornerRadius = (FRAME_CORNER_RADIUS - BEZEL_WIDTH) * DEVICE_SCALE;
  const roundedMask = Buffer.from(
    `<svg width="${screenW}" height="${screenH}">
      <rect x="0" y="0" width="${screenW}" height="${screenH}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
    </svg>`
  );

  const roundedScreen = await sharp(resizedScreen)
    .composite([{ input: roundedMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const frameSvg = generateDeviceFrameSVG(screenW, screenH);
  const framePng = await sharp(Buffer.from(frameSvg))
    .resize(
      screenW + (FRAME_PADDING_SIDES + BEZEL_WIDTH) * 2 * DEVICE_SCALE,
      screenH +
        (FRAME_PADDING_TOP + FRAME_PADDING_BOTTOM + BEZEL_WIDTH * 2) *
          DEVICE_SCALE
    )
    .png()
    .toBuffer();

  const frameW = screenW + (FRAME_PADDING_SIDES + BEZEL_WIDTH) * 2 * DEVICE_SCALE;
  const frameH =
    screenH +
    (FRAME_PADDING_TOP + FRAME_PADDING_BOTTOM + BEZEL_WIDTH * 2) *
      DEVICE_SCALE;

  const deviceWithScreen = await sharp(framePng)
    .composite([
      {
        input: roundedScreen,
        top: (FRAME_PADDING_TOP + BEZEL_WIDTH) * DEVICE_SCALE,
        left: (FRAME_PADDING_SIDES + BEZEL_WIDTH) * DEVICE_SCALE,
      },
    ])
    .png()
    .toBuffer();

  const captionH = CAPTION_AREA_HEIGHT;
  const captionSvg = generateCaptionSVG(FINAL_WIDTH, config.caption, captionH);
  const captionPng = await sharp(Buffer.from(captionSvg))
    .resize(FINAL_WIDTH, captionH)
    .png()
    .toBuffer();

  const deviceAreaHeight = FINAL_HEIGHT - captionH;

  const deviceMeta = await sharp(deviceWithScreen).metadata();
  const deviceActualW = deviceMeta.width!;
  const deviceActualH = deviceMeta.height!;

  const scaleToFit = Math.min(
    (FINAL_WIDTH * 0.88) / deviceActualW,
    (deviceAreaHeight * 0.92) / deviceActualH
  );
  const scaledDeviceW = Math.round(deviceActualW * scaleToFit);
  const scaledDeviceH = Math.round(deviceActualH * scaleToFit);

  const scaledDevice = await sharp(deviceWithScreen)
    .resize(scaledDeviceW, scaledDeviceH, { fit: "inside" })
    .png()
    .toBuffer();

  const deviceLeft = Math.round((FINAL_WIDTH - scaledDeviceW) / 2);
  const deviceTop = captionH + Math.round((deviceAreaHeight - scaledDeviceH) / 2);

  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0A0A0A"/>
        <stop offset="40%" stop-color="#0f0f1e"/>
        <stop offset="100%" stop-color="#151528"/>
      </linearGradient>
    </defs>
    <rect width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}" fill="url(#bg)"/>
  </svg>`;

  const bgPng = await sharp(Buffer.from(bgSvg))
    .resize(FINAL_WIDTH, FINAL_HEIGHT)
    .png()
    .toBuffer();

  const final = await sharp(bgPng)
    .composite([
      { input: captionPng, top: 0, left: 0 },
      { input: scaledDevice, top: deviceTop, left: deviceLeft },
    ])
    .png({ quality: 100 })
    .toBuffer();

  return final;
}

async function validateImage(
  filepath: string,
  config: ScreenshotConfig
): Promise<{ pass: boolean; issues: string[] }> {
  const issues: string[] = [];
  const meta = await sharp(filepath).metadata();

  if (meta.width !== FINAL_WIDTH)
    issues.push(`Width is ${meta.width}, expected ${FINAL_WIDTH}`);
  if (meta.height !== FINAL_HEIGHT)
    issues.push(`Height is ${meta.height}, expected ${FINAL_HEIGHT}`);
  if (meta.format !== "png") issues.push(`Format is ${meta.format}, expected png`);

  const stats = fs.statSync(filepath);
  if (stats.size < 100000) issues.push(`File too small: ${stats.size} bytes`);

  return { pass: issues.length === 0, issues };
}

async function main() {
  console.log("=== GigAid App Store Screenshot Generator ===\n");
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Target resolution: ${FINAL_WIDTH}x${FINAL_HEIGHT}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: DEVICE_SCALE,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });

    await context.addInitScript(() => {
      localStorage.setItem("gigaid_analytics_consent", "denied");
    });

    const page = await context.newPage();

    await login(page);

    const validationResults: {
      file: string;
      caption: string;
      pass: boolean;
      issues: string[];
    }[] = [];

    for (let i = 0; i < SCREENSHOTS.length; i++) {
      const config = SCREENSHOTS[i];
      console.log(
        `\n[${i + 1}/${SCREENSHOTS.length}] Capturing: ${config.id} — "${config.caption}"`
      );

      try {
        const rawScreenshot = await captureScreen(page, config);
        console.log(`  Raw screenshot captured (${rawScreenshot.length} bytes)`);

        const composed = await composeScreenshot(rawScreenshot, config);
        console.log(`  Composed image created (${composed.length} bytes)`);

        const outputPath = path.join(OUTPUT_DIR, config.filename);
        fs.writeFileSync(outputPath, composed);
        console.log(`  Saved: ${outputPath}`);

        const validation = await validateImage(outputPath, config);
        validationResults.push({
          file: config.filename,
          caption: config.caption,
          ...validation,
        });

        if (validation.pass) {
          console.log(`  PASS`);
        } else {
          console.log(`  ISSUES: ${validation.issues.join(", ")}`);
        }
      } catch (err) {
        console.error(`  ERROR capturing ${config.id}:`, err);
        validationResults.push({
          file: config.filename,
          caption: config.caption,
          pass: false,
          issues: [`Capture failed: ${(err as Error).message}`],
        });
      }
    }

    console.log("\n\n=== VALIDATION REPORT ===\n");
    console.log(`Resolution target: ${FINAL_WIDTH} x ${FINAL_HEIGHT}`);
    console.log(`Format: PNG`);
    console.log(`Total screenshots: ${SCREENSHOTS.length}`);
    console.log("");

    let allPass = true;
    for (const result of validationResults) {
      const status = result.pass ? "PASS" : "FAIL";
      console.log(`  [${status}] ${result.file} — "${result.caption}"`);
      if (!result.pass) {
        allPass = false;
        for (const issue of result.issues) {
          console.log(`         ${issue}`);
        }
      }
    }

    console.log(
      `\nOverall: ${allPass ? "ALL PASSED" : "SOME ISSUES DETECTED"}`
    );
    console.log(`\nFiles saved to: ${OUTPUT_DIR}`);

    const reportPath = path.join(OUTPUT_DIR, "validation-report.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          resolution: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
          format: "PNG",
          results: validationResults,
          allPass,
        },
        null,
        2
      )
    );
    console.log(`Validation report: ${reportPath}`);
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
