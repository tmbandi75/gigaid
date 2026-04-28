// Capture real screen recordings of GigAid public pages and assemble them
// into the .mp4 / .gif clips embedded by the support manual.
//
// What this script does
//   1. Seeds a stable demo user + sample invoice via the /api/test/* helpers.
//   2. Drives Playwright (chromium) at a phone-sized viewport against
//      pages that do NOT require Firebase auth (the customer-facing booking
//      page and public invoice page).
//   3. Records each session with Playwright's built-in `recordVideo` and
//      converts the resulting .webm to .mp4 + .gif via ffmpeg.
//
// What this script does NOT cover
//   The Connect Stripe, Create Job from Template, and Quick Capture flows
//   live behind Firebase auth and (for Stripe) external Stripe-hosted
//   pages. They cannot be driven head-lessly without real Firebase
//   credentials and a Stripe Connect test account, so their clips remain
//   the synthetic fallbacks produced by `_generate.mjs`. See README.md for
//   how a teammate with a real test account should record those manually.
//
// Run with the dev server already serving on http://localhost:5000:
//   PLAYWRIGHT_BROWSERS_PATH=/home/runner/workspace/.cache/ms-playwright \
//     node attached_assets/support-media/_capture.mjs

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, rmSync, renameSync, statSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(here, "_captures");
if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir);

const BASE_URL = process.env.GIGAID_BASE_URL || "http://localhost:5000";

// Safety guard: this script seeds demo data via /api/test/* endpoints, which
// are intended for local development only. Refuse to run against anything
// other than localhost unless the operator has explicitly opted in.
{
  const allowRemote = process.env.GIGAID_CAPTURE_ALLOW_REMOTE === "1";
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(BASE_URL);
  if (!isLocal && !allowRemote) {
    throw new Error(
      `Refusing to capture against ${BASE_URL}: this script seeds demo data and ` +
      `should only run against a local dev server. Re-run with ` +
      `GIGAID_CAPTURE_ALLOW_REMOTE=1 if you really mean to point at a non-local host.`,
    );
  }
}
const VIEWPORT = { width: 390, height: 844 }; // iPhone 14-ish
const FPS = 24;

// ---------- Seed demo data via test endpoints ----------

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

const DEMO_USER_ID = "demo-cap-user";
const DEMO_SLUG = "mikes-handyman-demo";
const DEMO_INVOICE_TOKEN = "demo-pub-1042";

await postJson("/api/test/create-user", {
  id: DEMO_USER_ID,
  name: "Mike Reyes",
  email: "demo-cap-user@gigaid.test",
  plan: "pro",
});
await postJson("/api/test/set-slug", { userId: DEMO_USER_ID, slug: DEMO_SLUG });
await postJson("/api/test/seed-invoice", {
  userId: DEMO_USER_ID,
  invoiceNumber: "INV-1042",
  clientName: "Maria Henderson",
  clientEmail: "maria@example.com",
  clientPhone: "+15125550142",
  amount: 18000,
  status: "sent",
  serviceDescription: "Kitchen sink repair \u2014 labor 1.5h + parts",
  publicToken: DEMO_INVOICE_TOKEN,
});

console.log("[capture] seeded demo user, slug, and public invoice");

// ---------- Per-flow capture script ----------

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function recordFlow(name, runner) {
  const flowDir = join(tmpDir, name);
  mkdirSync(flowDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: flowDir, size: VIEWPORT },
    colorScheme: "light",
  });
  // Public pages do not need auth, but make sure the in-app splash is
  // bypassed for any future flows we add that visit /share, /jobs, etc.
  await context.addInitScript(() => {
    localStorage.setItem("gigaid_splash_seen", "true");
    localStorage.setItem("gig-aid-welcome-seen", "true");
    localStorage.setItem("gig-aid-onboarding-complete", "true");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn(`[capture:${name}] page error:`, e.message.slice(0, 120)));
  try {
    await runner(page);
  } finally {
    await context.close();
    await browser.close();
  }
  // The video is whichever .webm the browser context wrote into flowDir.
  const webm = readdirSync(flowDir).find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error(`[capture:${name}] no .webm produced`);
  const webmPath = join(flowDir, webm);
  console.log(
    `[capture:${name}] recorded ${(statSync(webmPath).size / 1024).toFixed(1)} KB webm`,
  );
  return webmPath;
}

// Flow 1: Share Booking Link (customer-facing booking page)
async function shareBookingLinkFlow(page) {
  await page.goto(`${BASE_URL}/book/${DEMO_SLUG}`, { waitUntil: "networkidle" });
  // Hold on the hero/profile so viewers can read the business name + bio.
  await sleep(2200);
  // One smooth scroll down to reveal the calendar.
  for (let y = 0; y <= 380; y += 60) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "auto" }), y);
    await sleep(40);
  }
  await sleep(1000);
  // Continue scrolling to reveal the booking form.
  for (let y = 380; y <= 820; y += 60) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "auto" }), y);
    await sleep(40);
  }
  await sleep(900);
  // Type into the first/last name to show interactive feel.
  const firstName = page.locator('input[placeholder="John"]').first();
  if (await firstName.isVisible().catch(() => false)) {
    await firstName.fill("Sarah", { timeout: 1500 }).catch(() => {});
    await sleep(300);
  }
  const lastName = page.locator('input[placeholder="Smith"]').first();
  if (await lastName.isVisible().catch(() => false)) {
    await lastName.fill("Klein", { timeout: 1500 }).catch(() => {});
    await sleep(700);
  }
  await sleep(800);
}

// Flow 2: Send Invoice (customer-facing public invoice)
async function sendInvoiceFlow(page) {
  await page.goto(`${BASE_URL}/invoice/${DEMO_INVOICE_TOKEN}`, { waitUntil: "networkidle" });
  // Hold on the invoice header so viewers can read the invoice number,
  // provider name, and "Awaiting Payment" badge.
  await sleep(3000);
  // Slow scroll through the invoice so viewers see the totals, then how-to-pay,
  // then the contact-provider card.
  for (let y = 0; y <= 700; y += 28) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "auto" }), y);
    await sleep(90);
  }
  // Hold on the contact-provider / payment-methods card.
  await sleep(2000);
  // Scroll back up to the totals to land on the most-important pixel.
  for (let y = 700; y >= 0; y -= 38) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "auto" }), y);
    await sleep(80);
  }
  // Final hold on the totals — what every customer is here to verify.
  await sleep(2200);
}

// ---------- Drive each flow + transcode ----------

const FLOWS = [
  { name: "share-booking-link", runner: shareBookingLinkFlow },
  { name: "send-invoice", runner: sendInvoiceFlow },
];

for (const flow of FLOWS) {
  const webmPath = await recordFlow(flow.name, flow.runner);
  const stagedWebm = join(here, `${flow.name}.webm`);
  renameSync(webmPath, stagedWebm);

  const mp4Out = join(here, `${flow.name}.mp4`);
  const gifOut = join(here, `${flow.name}.gif`);
  const palette = join(tmpDir, `${flow.name}-palette.png`);

  // H.264 MP4 (faststart so it plays inline in Markdown renderers/CDNs).
  execSync(
    `ffmpeg -y -i "${stagedWebm}" -r ${FPS} -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Out}"`,
    { stdio: "pipe" },
  );

  // Palette + paletteuse → much sharper GIF than naive single-pass.
  execSync(
    `ffmpeg -y -i "${stagedWebm}" -vf "fps=12,scale=360:-1:flags=lanczos,palettegen=max_colors=128" "${palette}"`,
    { stdio: "pipe" },
  );
  execSync(
    `ffmpeg -y -i "${stagedWebm}" -i "${palette}" -lavfi "fps=12,scale=360:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4" -loop 0 "${gifOut}"`,
    { stdio: "pipe" },
  );

  console.log(
    `[capture:${flow.name}] wrote ${flow.name}.mp4 (` +
      `${(statSync(mp4Out).size / 1024).toFixed(1)} KB) and ${flow.name}.gif (` +
      `${(statSync(gifOut).size / 1024).toFixed(1)} KB)`,
  );
}

rmSync(tmpDir, { recursive: true, force: true });
// Keep the staged .webm files around so reviewers can see the source recordings;
// they are git-ignored siblings of the .mp4 files.
console.log("[capture] done");
