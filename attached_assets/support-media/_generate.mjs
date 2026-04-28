import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, "_frames");
if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp);

const W = 360;
const H = 720;
const FRAME_SECS = 3;
const FPS = 12;

const PURPLE = "#7C3AED";
const PURPLE_DARK = "#5B21B6";
const GREEN = "#10B981";
const CARD = "#FFFFFF";
const TEXT = "#0F172A";
const SUBTLE = "#64748B";
const BORDER = "#E2E8F0";

const FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif";

function phoneFrame(inner, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <clipPath id="phoneClip"><rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="36"/></clipPath>
    <linearGradient id="bgGrad" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#EEF2FF"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0B1220"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="42" fill="#111827" stroke="#1F2937" stroke-width="2"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="36" fill="url(#bgGrad)"/>
  <g clip-path="url(#phoneClip)">
    <rect x="12" y="12" width="${W - 24}" height="44" fill="${CARD}"/>
    <circle cx="180" cy="34" r="6" fill="#111827"/>
    ${inner}
    <text x="24" y="${H - 28}" font-family="${FONT}" font-size="11" fill="${SUBTLE}">${String(label).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</text>
  </g>
</svg>`;
}

function header(title) {
  return `
    <text x="24" y="42" font-family="${FONT}" font-size="15" font-weight="700" fill="${TEXT}">${title}</text>
    <text x="${W - 24}" y="42" text-anchor="end" font-family="${FONT}" font-size="13" fill="${PURPLE}">GigAid</text>`;
}

function card(x, y, w, h, fill = CARD) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${BORDER}"/>`;
}

function btn(x, y, w, h, label, fill = PURPLE, textFill = "#fff") {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>
    <text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="${textFill}">${xml(label)}</text>
  </g>`;
}

function xml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function text(x, y, str, opts = {}) {
  const size = opts.size || 13;
  const weight = opts.weight || 400;
  const fill = opts.fill || TEXT;
  const anchor = opts.anchor || "start";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${xml(str)}</text>`;
}

function tap(cx, cy) {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="22" fill="${PURPLE}" fill-opacity="0.25"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="${PURPLE}"/>
  </g>`;
}

function shareIcon(x, y, label, color) {
  return `<g>
    <rect x="${x}" y="${y}" width="60" height="60" rx="14" fill="${color}"/>
    <text x="${x + 30}" y="${y + 84}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${TEXT}">${label}</text>
  </g>`;
}

// ---------- Per-clip frame definitions ----------

const CLIPS = {
  "connect-stripe": [
    {
      label: "1. More \u2192 Settings \u2192 Get Paid",
      content: () =>
        header("Get Paid") +
        card(20, 70, 320, 90) +
        text(36, 100, "Connect Stripe", { weight: 700, size: 16 }) +
        text(36, 122, "Accept card payments and deposits.", { fill: SUBTLE }) +
        text(36, 142, "Free \u2022 Takes ~5 minutes", { fill: SUBTLE, size: 11 }) +
        btn(20, 180, 320, 48, "Connect Stripe") +
        tap(180, 204),
    },
    {
      label: "2. Stripe verifies your identity",
      content: () =>
        `<rect x="20" y="70" width="320" height="500" rx="14" fill="#635BFF"/>` +
        text(W / 2, 110, "stripe", { anchor: "middle", fill: "#fff", weight: 700, size: 22 }) +
        text(36, 160, "Verify your business", { fill: "#fff", weight: 700, size: 16 }) +
        `<rect x="36" y="184" width="288" height="36" rx="8" fill="#fff"/>` +
        text(48, 207, "Legal name", { fill: SUBTLE, size: 12 }) +
        `<rect x="36" y="232" width="288" height="36" rx="8" fill="#fff"/>` +
        text(48, 255, "Date of birth", { fill: SUBTLE, size: 12 }) +
        `<rect x="36" y="280" width="288" height="36" rx="8" fill="#fff"/>` +
        text(48, 303, "Bank routing & account", { fill: SUBTLE, size: 12 }) +
        btn(36, 340, 288, 44, "Continue", "#0F172A"),
    },
    {
      label: "3. Approved (usually instant)",
      content: () =>
        header("Get Paid") +
        card(20, 70, 320, 110) +
        `<circle cx="56" cy="116" r="22" fill="${GREEN}"/>` +
        `<path d="M46 116 L54 124 L68 108" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(92, 110, "Stripe connected", { weight: 700, size: 15 }) +
        text(92, 130, "You're ready to take payments.", { fill: SUBTLE, size: 12 }) +
        text(92, 150, "Payouts to \u2022\u2022\u2022 4421", { fill: SUBTLE, size: 11 }),
    },
    {
      label: "4. Now you can send invoices & require deposits",
      content: () =>
        header("Get Paid") +
        card(20, 70, 320, 60) +
        text(36, 92, "Send invoices", { weight: 600 }) +
        text(36, 112, "Customers pay by card; link sent by SMS.", { fill: SUBTLE, size: 11 }) +
        card(20, 144, 320, 60) +
        text(36, 166, "Require deposits on bookings", { weight: 600 }) +
        text(36, 186, "Reduce no-shows. Flat or % up to 30%.", { fill: SUBTLE, size: 11 }) +
        card(20, 218, 320, 60) +
        text(36, 240, "Risk protection (Pro+)", { weight: 600 }) +
        text(36, 260, "Keep deposits on last-minute cancels.", { fill: SUBTLE, size: 11 }),
    },
  ],

  "create-job-from-template": [
    {
      label: "1. Jobs tab \u2192 tap +",
      content: () =>
        header("Jobs") +
        card(20, 70, 320, 70) +
        text(36, 96, "Kitchen sink repair", { weight: 600 }) +
        text(36, 118, "Tomorrow \u2022 9:00 AM \u2022 $180", { fill: SUBTLE, size: 12 }) +
        card(20, 152, 320, 70) +
        text(36, 178, "Lawn mow \u2014 Henderson", { weight: 600 }) +
        text(36, 200, "Today \u2022 2:00 PM \u2022 $65", { fill: SUBTLE, size: 12 }) +
        `<circle cx="${W - 48}" cy="${H - 80}" r="28" fill="${PURPLE}"/>` +
        text(W - 48, H - 74, "+", { anchor: "middle", fill: "#fff", size: 28, weight: 700 }) +
        tap(W - 48, H - 80),
    },
    {
      label: "2. Pick a template",
      content: () =>
        header("New Job") +
        text(24, 78, "Start from a template", { fill: SUBTLE, size: 12 }) +
        card(20, 92, 152, 80) +
        text(36, 118, "Bathroom", { weight: 600 }) +
        text(36, 138, "Deep Clean", { weight: 600 }) +
        text(36, 158, "$220 \u2022 3h", { fill: SUBTLE, size: 11 }) +
        card(188, 92, 152, 80, "#EDE9FE") +
        text(204, 118, "Lawn Mow", { weight: 600 }) +
        text(204, 138, "Standard yard", { fill: SUBTLE, size: 11 }) +
        text(204, 158, "$65 \u2022 45m", { fill: SUBTLE, size: 11 }) +
        card(20, 184, 152, 80) +
        text(36, 210, "Handyman", { weight: 600 }) +
        text(36, 230, "Hourly", { fill: SUBTLE, size: 11 }) +
        text(36, 250, "$85 \u2022 1h min", { fill: SUBTLE, size: 11 }) +
        card(188, 184, 152, 80) +
        text(204, 210, "Move help", { weight: 600 }) +
        text(204, 230, "2-mover crew", { fill: SUBTLE, size: 11 }) +
        text(204, 250, "$240 \u2022 2h", { fill: SUBTLE, size: 11 }) +
        tap(264, 132),
    },
    {
      label: "3. Fields auto-fill \u2014 just add customer & date",
      content: () =>
        header("New Job") +
        card(20, 70, 320, 44) +
        text(36, 89, "Title", { fill: SUBTLE, size: 11 }) +
        text(36, 106, "Lawn Mow \u2014 Standard yard", { weight: 600 }) +
        card(20, 122, 320, 44) +
        text(36, 141, "Customer", { fill: SUBTLE, size: 11 }) +
        text(36, 158, "Maria Henderson", { weight: 600 }) +
        card(20, 174, 152, 44) +
        text(36, 193, "Date", { fill: SUBTLE, size: 11 }) +
        text(36, 210, "Sat, 10 AM", { weight: 600 }) +
        card(188, 174, 152, 44) +
        text(204, 193, "Price", { fill: SUBTLE, size: 11 }) +
        text(204, 210, "$65", { weight: 600 }) +
        btn(20, 240, 320, 48, "Save Job"),
    },
    {
      label: "4. Scheduled in ~10 seconds",
      content: () =>
        header("Jobs") +
        card(20, 70, 320, 70, "#ECFDF5") +
        `<circle cx="44" cy="105" r="16" fill="${GREEN}"/>` +
        `<path d="M36 105 L42 111 L52 99" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(72, 100, "Lawn Mow \u2014 Henderson", { weight: 600 }) +
        text(72, 122, "Sat 10:00 AM \u2022 $65 \u2022 Scheduled", { fill: SUBTLE, size: 12 }),
    },
  ],

  "share-booking-link": [
    {
      label: "1. Requests tab \u2192 Your Booking Link",
      content: () =>
        header("Requests") +
        card(20, 70, 320, 116, "#F5F3FF") +
        text(36, 96, "Your Booking Link", { weight: 700, size: 15 }) +
        text(36, 118, "gigaid.ai/book/mikes-handyman", { fill: PURPLE_DARK, size: 12 }) +
        btn(36, 134, 132, 36, "Copy", PURPLE) +
        btn(180, 134, 132, 36, "Share", "#fff", PURPLE_DARK) +
        `<rect x="180" y="134" width="132" height="36" rx="18" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>` +
        tap(246, 152),
    },
    {
      label: "2. Share to anywhere",
      content: () =>
        header("Share booking link") +
        card(20, 70, 320, 380) +
        text(36, 100, "gigaid.ai/book/mikes-handyman", { weight: 600, size: 13, fill: PURPLE_DARK }) +
        `<line x1="36" y1="116" x2="324" y2="116" stroke="${BORDER}"/>` +
        shareIcon(50, 150, "Messages", "#22C55E") +
        shareIcon(140, 150, "Mail", "#3B82F6") +
        shareIcon(230, 150, "Facebook", "#1877F2") +
        shareIcon(50, 250, "Instagram", "#E4405F") +
        shareIcon(140, 250, "WhatsApp", "#25D366") +
        shareIcon(230, 250, "Copy Link", "#64748B") +
        tap(140, 270),
    },
    {
      label: "3. Customer opens it on their phone",
      content: () =>
        header("Mike's Handyman") +
        card(20, 70, 320, 80) +
        text(36, 96, "Hi, I'm Mike.", { weight: 700, size: 15 }) +
        text(36, 118, "12 yrs handyman work in Austin.", { fill: SUBTLE, size: 12 }) +
        text(36, 136, "4.9 (137 reviews)", { fill: "#F59E0B", size: 11 }) +
        card(20, 162, 320, 60) +
        text(36, 184, "What do you need?", { fill: SUBTLE, size: 11 }) +
        text(36, 204, "Bathroom faucet replacement", { weight: 600, size: 13 }) +
        card(20, 234, 320, 60) +
        text(36, 256, "When?", { fill: SUBTLE, size: 11 }) +
        text(36, 276, "This Saturday, AM", { weight: 600, size: 13 }) +
        btn(20, 310, 320, 48, "Request Booking"),
    },
    {
      label: "4. New booking request lands in your inbox",
      content: () =>
        header("Booking Requests") +
        card(20, 70, 320, 90, "#ECFDF5") +
        `<circle cx="44" cy="115" r="18" fill="${GREEN}"/>` +
        text(44, 121, "!", { anchor: "middle", fill: "#fff", weight: 700, size: 18 }) +
        text(74, 100, "New request", { weight: 700, size: 14 }) +
        text(74, 120, "Sarah K. \u2022 Faucet replacement", { size: 12 }) +
        text(74, 140, "Saturday AM \u2022 Austin 78704", { fill: SUBTLE, size: 11 }) +
        btn(20, 174, 152, 40, "Accept", GREEN) +
        btn(188, 174, 152, 40, "Message", PURPLE),
    },
  ],

  "send-invoice": [
    {
      label: "1. Open the completed job \u2192 Send Invoice",
      content: () =>
        header("Job \u00b7 Kitchen sink repair") +
        card(20, 70, 320, 100) +
        text(36, 96, "Maria Henderson", { weight: 700, size: 14 }) +
        text(36, 116, "Today \u00b7 Completed", { fill: GREEN, size: 12, weight: 600 }) +
        text(36, 136, "$180 \u00b7 1.5 hours \u00b7 Parts: $24", { fill: SUBTLE, size: 12 }) +
        btn(20, 184, 320, 48, "Send Invoice") +
        tap(180, 208),
    },
    {
      label: "2. Review & send",
      content: () =>
        header("New Invoice") +
        card(20, 70, 320, 44) +
        text(36, 89, "To", { fill: SUBTLE, size: 11 }) +
        text(36, 106, "Maria H. \u00b7 (512) 555-0142", { weight: 600 }) +
        card(20, 122, 320, 80) +
        text(36, 141, "Description", { fill: SUBTLE, size: 11 }) +
        text(36, 158, "Kitchen sink repair", { weight: 600 }) +
        text(36, 176, "Labor 1.5h + parts", { fill: SUBTLE, size: 11 }) +
        card(20, 210, 320, 56) +
        text(36, 230, "Amount due", { fill: SUBTLE, size: 11 }) +
        text(W - 36, 246, "$180.00", { anchor: "end", weight: 700, size: 18 }) +
        btn(20, 286, 152, 48, "SMS + Email", "#fff", PURPLE_DARK) +
        `<rect x="20" y="286" width="152" height="48" rx="24" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>` +
        btn(188, 286, 152, 48, "Send"),
    },
    {
      label: "3. Customer gets a pay-by-card link",
      content: () =>
        `<rect x="20" y="70" width="320" height="500" rx="14" fill="#F1F5F9"/>` +
        `<rect x="36" y="86" width="288" height="80" rx="10" fill="#fff"/>` +
        text(52, 110, "Mike's Handyman", { weight: 600, size: 12 }) +
        text(52, 130, "Invoice #1042 \u2014 $180.00", { size: 12 }) +
        text(52, 150, "Tap to pay: gigaid.ai/pay/x9k2", { fill: PURPLE_DARK, size: 11 }) +
        `<rect x="36" y="180" width="288" height="220" rx="12" fill="#fff"/>` +
        text(180, 210, "Pay $180.00", { anchor: "middle", weight: 700, size: 16 }) +
        `<rect x="56" y="234" width="248" height="36" rx="8" fill="#F1F5F9"/>` +
        text(68, 257, "Card number", { fill: SUBTLE, size: 11 }) +
        `<rect x="56" y="280" width="120" height="36" rx="8" fill="#F1F5F9"/>` +
        `<rect x="184" y="280" width="120" height="36" rx="8" fill="#F1F5F9"/>` +
        btn(56, 332, 248, 44, "Pay $180.00", GREEN),
    },
    {
      label: "4. Paid! Funds land in your Stripe account",
      content: () =>
        header("Get Paid") +
        card(20, 70, 320, 100, "#ECFDF5") +
        `<circle cx="50" cy="120" r="22" fill="${GREEN}"/>` +
        `<path d="M40 120 L48 128 L62 112" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(86, 110, "Maria H. paid $180.00", { weight: 700, size: 14 }) +
        text(86, 130, "Card \u00b7 Just now", { fill: SUBTLE, size: 12 }) +
        text(86, 150, "Payout: Tomorrow", { fill: SUBTLE, size: 11 }),
    },
  ],

  "follow-up-composer": [
    {
      label: "1. Open the quiet lead \u2192 tap Follow Up",
      content: () =>
        header("Lead \u00b7 Sarah K.") +
        card(20, 70, 320, 90) +
        text(36, 96, "Sarah K. \u2014 Fence repair", { weight: 700, size: 15 }) +
        text(36, 118, "(512) 555-0117 \u00b7 Austin 78704", { fill: SUBTLE, size: 12 }) +
        text(36, 138, "Cold \u00b7 quiet for 7 days", { fill: "#DC2626", size: 12, weight: 600 }) +
        btn(20, 184, 100, 40, "Text", "#fff", PURPLE_DARK) +
        `<rect x="20" y="184" width="100" height="40" rx="20" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>` +
        btn(132, 184, 96, 40, "Quote", "#fff", PURPLE_DARK) +
        `<rect x="132" y="184" width="96" height="40" rx="20" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>` +
        btn(240, 184, 100, 40, "Follow Up", PURPLE) +
        tap(290, 204),
    },
    {
      label: "2. Pick a tone",
      content: () =>
        header("Follow-Up Composer") +
        text(24, 78, "How should it sound?", { fill: SUBTLE, size: 12 }) +
        card(20, 92, 320, 64, "#F5F3FF") +
        text(36, 116, "Friendly", { weight: 700, size: 14, fill: PURPLE_DARK }) +
        text(36, 136, "Warm, casual, like a neighbor.", { fill: SUBTLE, size: 11 }) +
        `<rect x="20" y="92" width="320" height="64" rx="14" fill="none" stroke="${PURPLE}" stroke-width="2"/>` +
        card(20, 168, 320, 64) +
        text(36, 192, "Professional", { weight: 700, size: 14 }) +
        text(36, 212, "Polished, business-like.", { fill: SUBTLE, size: 11 }) +
        card(20, 244, 320, 64) +
        text(36, 268, "Casual", { weight: 700, size: 14 }) +
        text(36, 288, "Short and chill, like a text to a friend.", { fill: SUBTLE, size: 11 }) +
        tap(60, 124),
    },
    {
      label: "3. AI drafts the message \u2014 tweak then send",
      content: () =>
        header("Draft message") +
        card(20, 70, 320, 220, "#F5F3FF") +
        text(36, 94, "To: Sarah K.", { fill: SUBTLE, size: 11 }) +
        text(36, 122, "Hey Sarah \u2014 Mike here.", { weight: 600, size: 13 }) +
        text(36, 144, "Just circling back on the fence", { size: 12 }) +
        text(36, 162, "repair. I have an opening Tue", { size: 12 }) +
        text(36, 180, "afternoon if you're still", { size: 12 }) +
        text(36, 198, "interested. Want me to pencil", { size: 12 }) +
        text(36, 216, "you in?", { size: 12 }) +
        text(36, 250, "Tone: Friendly \u00b7 SMS \u00b7 ~25 words", { fill: SUBTLE, size: 11 }) +
        btn(20, 304, 152, 48, "Edit", "#fff", PURPLE_DARK) +
        `<rect x="20" y="304" width="152" height="48" rx="24" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>` +
        btn(188, 304, 152, 48, "Send"),
    },
    {
      label: "4. Sent \u2014 lead bumped from Cold to Warm",
      content: () =>
        header("Lead \u00b7 Sarah K.") +
        card(20, 70, 320, 80, "#ECFDF5") +
        `<circle cx="50" cy="110" r="20" fill="${GREEN}"/>` +
        `<path d="M40 110 L48 118 L62 102" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(82, 102, "Follow-up sent", { weight: 700, size: 14 }) +
        text(82, 122, "Heat: Warm (was Cold)", { fill: SUBTLE, size: 12 }) +
        text(82, 140, "Reply tracked here automatically.", { fill: SUBTLE, size: 11 }) +
        card(20, 164, 320, 80) +
        text(36, 188, "You", { fill: SUBTLE, size: 11 }) +
        text(36, 208, "Hey Sarah \u2014 Mike here. Just", { size: 12 }) +
        text(36, 226, "circling back on the fence repair\u2026", { size: 12 }),
    },
  ],

  "drive-mode": [
    {
      label: "1. Open the job \u2192 tap Drive Mode",
      content: () =>
        header("Job \u00b7 Faucet swap") +
        card(20, 70, 320, 110) +
        text(36, 96, "Maria Henderson", { weight: 700, size: 14 }) +
        text(36, 118, "1124 Maple St, Austin", { fill: SUBTLE, size: 12 }) +
        text(36, 138, "Today \u00b7 10:00 AM \u00b7 $180", { fill: SUBTLE, size: 12 }) +
        text(36, 162, "Bring: basin wrench, plumber's tape", { fill: SUBTLE, size: 11 }) +
        btn(20, 196, 320, 56, "Drive Mode", PURPLE) +
        tap(180, 224),
    },
    {
      label: "2. Big-button view \u2014 safe to glance at",
      content: () =>
        `<rect x="20" y="70" width="320" height="500" rx="18" fill="#0F172A"/>` +
        text(W / 2, 110, "DRIVE MODE", { anchor: "middle", fill: "#94A3B8", size: 11, weight: 700 }) +
        text(W / 2, 152, "Maria H.", { anchor: "middle", fill: "#fff", weight: 700, size: 22 }) +
        text(W / 2, 184, "1124 Maple St", { anchor: "middle", fill: "#E2E8F0", size: 16 }) +
        text(W / 2, 208, "Austin, TX 78704", { anchor: "middle", fill: "#94A3B8", size: 14 }) +
        btn(40, 240, 280, 72, "Navigate", PURPLE) +
        btn(40, 328, 280, 72, "I'm On My Way", "#fff", "#0F172A") +
        tap(180, 364),
    },
    {
      label: "3. One tap texts your ETA to the customer",
      content: () =>
        `<rect x="20" y="70" width="320" height="500" rx="18" fill="#0F172A"/>` +
        text(W / 2, 110, "DRIVE MODE", { anchor: "middle", fill: "#94A3B8", size: 11, weight: 700 }) +
        text(W / 2, 152, "Maria H.", { anchor: "middle", fill: "#fff", weight: 700, size: 22 }) +
        `<rect x="40" y="186" width="280" height="84" rx="14" fill="#064E3B"/>` +
        `<circle cx="72" cy="228" r="16" fill="${GREEN}"/>` +
        `<path d="M62 228 L70 236 L84 220" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(100, 220, "Text sent to Maria", { fill: "#fff", weight: 700, size: 14 }) +
        text(100, 240, "\u201COn my way \u00b7 ETA 10 min\u201D", { fill: "#A7F3D0", size: 12 }) +
        btn(40, 290, 280, 72, "Navigate", PURPLE) +
        btn(40, 378, 280, 72, "Call Maria", "#fff", "#0F172A"),
    },
    {
      label: "4. Arrive \u2014 start the job in one tap",
      content: () =>
        `<rect x="20" y="70" width="320" height="500" rx="18" fill="#0F172A"/>` +
        text(W / 2, 110, "DRIVE MODE", { anchor: "middle", fill: "#94A3B8", size: 11, weight: 700 }) +
        text(W / 2, 152, "Arrived 10:02 AM", { anchor: "middle", fill: "#fff", weight: 700, size: 20 }) +
        text(W / 2, 178, "Maria H. \u00b7 1124 Maple St", { anchor: "middle", fill: "#94A3B8", size: 13 }) +
        btn(40, 220, 280, 72, "Start Job", GREEN) +
        btn(40, 308, 280, 56, "Reschedule", "#fff", "#0F172A") +
        btn(40, 376, 280, 56, "Exit Drive Mode", "#1F2937", "#fff"),
    },
  ],

  "owner-view": [
    {
      label: "1. More \u2192 Owner View",
      content: () =>
        header("Owner View") +
        text(24, 78, "This month", { fill: SUBTLE, size: 12 }) +
        card(20, 92, 320, 96, "#F5F3FF") +
        text(36, 124, "$12,840", { weight: 700, size: 28, fill: PURPLE_DARK }) +
        text(36, 148, "Revenue \u2022 18 jobs \u2022 4.9\u2605", { fill: SUBTLE, size: 12 }) +
        text(36, 170, "+22% vs. last month", { fill: GREEN, size: 12, weight: 600 }) +
        card(20, 200, 152, 76) +
        text(36, 224, "Accept rate", { fill: SUBTLE, size: 11 }) +
        text(36, 248, "92%", { weight: 700, size: 20 }) +
        card(188, 200, 152, 76) +
        text(204, 224, "Avg reply", { fill: SUBTLE, size: 11 }) +
        text(204, 248, "7 min", { weight: 700, size: 20 }),
    },
    {
      label: "2. Where the money came from",
      content: () =>
        header("Top services") +
        card(20, 70, 320, 56) +
        text(36, 92, "Lawn mowing", { weight: 600 }) +
        text(W - 36, 92, "$3,200", { anchor: "end", weight: 700 }) +
        `<rect x="36" y="104" width="240" height="6" rx="3" fill="#E2E8F0"/>` +
        `<rect x="36" y="104" width="180" height="6" rx="3" fill="${PURPLE}"/>` +
        card(20, 138, 320, 56) +
        text(36, 160, "Handyman \u2014 hourly", { weight: 600 }) +
        text(W - 36, 160, "$2,640", { anchor: "end", weight: 700 }) +
        `<rect x="36" y="172" width="240" height="6" rx="3" fill="#E2E8F0"/>` +
        `<rect x="36" y="172" width="148" height="6" rx="3" fill="${PURPLE}"/>` +
        card(20, 206, 320, 56) +
        text(36, 228, "Bathroom deep clean", { weight: 600 }) +
        text(W - 36, 228, "$1,980", { anchor: "end", weight: 700 }) +
        `<rect x="36" y="240" width="240" height="6" rx="3" fill="#E2E8F0"/>` +
        `<rect x="36" y="240" width="112" height="6" rx="3" fill="${PURPLE}"/>` +
        card(20, 274, 320, 56) +
        text(36, 296, "Move help", { weight: 600 }) +
        text(W - 36, 296, "$1,440", { anchor: "end", weight: 700 }) +
        `<rect x="36" y="308" width="240" height="6" rx="3" fill="#E2E8F0"/>` +
        `<rect x="36" y="308" width="80" height="6" rx="3" fill="${PURPLE}"/>`,
    },
    {
      label: "3. Bookings by day of week",
      content: () =>
        header("Booking Insights") +
        text(24, 78, "Bookings by day (last 30 days)", { fill: SUBTLE, size: 12 }) +
        card(20, 92, 320, 200) +
        // bars: M T W T F S S
        `<rect x="48" y="220" width="28" height="50" rx="4" fill="${PURPLE}"/>` +
        `<rect x="92" y="190" width="28" height="80" rx="4" fill="${PURPLE}"/>` +
        `<rect x="136" y="240" width="28" height="30" rx="4" fill="#C7D2FE"/>` +
        `<rect x="180" y="170" width="28" height="100" rx="4" fill="${PURPLE}"/>` +
        `<rect x="224" y="160" width="28" height="110" rx="4" fill="${PURPLE_DARK}"/>` +
        `<rect x="268" y="140" width="28" height="130" rx="4" fill="${PURPLE_DARK}"/>` +
        text(62, 286, "M", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        text(106, 286, "T", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        text(150, 286, "W", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        text(194, 286, "T", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        text(238, 286, "F", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        text(282, 286, "S", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        text(36, 314, "Slowest day: Wednesdays", { fill: SUBTLE, size: 12 }) +
        text(36, 332, "Best day: Saturdays", { fill: SUBTLE, size: 12 }),
    },
    {
      label: "4. AI coaching tip with one-tap action",
      content: () =>
        header("Owner View") +
        card(20, 70, 320, 150, "#FEF3C7") +
        text(36, 96, "Coaching tip", { fill: "#92400E", size: 11, weight: 700 }) +
        text(36, 122, "3 of your last 5 Wednesdays", { weight: 600, size: 13 }) +
        text(36, 140, "had openings. Want to send a", { weight: 600, size: 13 }) +
        text(36, 158, "Wed-only deal to your top 5", { weight: 600, size: 13 }) +
        text(36, 176, "customers?", { weight: 600, size: 13 }) +
        btn(36, 196, 130, 36, "Try It", PURPLE) +
        tap(101, 214),
    },
  ],

  "require-deposit": [
    {
      label: "1. Settings \u2192 Get Paid \u2192 Require Deposit",
      content: () =>
        header("Get Paid") +
        card(20, 70, 320, 100) +
        text(36, 96, "Require deposit on bookings", { weight: 700, size: 14 }) +
        text(36, 118, "Cuts no-shows and ghost bookings.", { fill: SUBTLE, size: 11 }) +
        text(36, 138, "Stripe holds it until job is done.", { fill: SUBTLE, size: 11 }) +
        // toggle
        `<rect x="270" y="92" width="54" height="30" rx="15" fill="${PURPLE}"/>` +
        `<circle cx="309" cy="107" r="11" fill="#fff"/>` +
        tap(297, 107),
    },
    {
      label: "2. Pick a flat amount or a percentage",
      content: () =>
        header("Deposit settings") +
        // tabs
        `<rect x="20" y="78" width="320" height="40" rx="20" fill="#EEF2FF"/>` +
        `<rect x="20" y="78" width="160" height="40" rx="20" fill="${PURPLE}"/>` +
        text(100, 104, "Flat $", { anchor: "middle", weight: 700, fill: "#fff" }) +
        text(260, 104, "Percent %", { anchor: "middle", weight: 600, fill: PURPLE_DARK }) +
        card(20, 134, 320, 70) +
        text(36, 156, "Amount", { fill: SUBTLE, size: 11 }) +
        text(36, 184, "$25.00", { weight: 700, size: 22 }) +
        card(20, 218, 320, 90, "#FEF3C7") +
        text(36, 242, "Cap: 30% of job price", { weight: 600, size: 12, fill: "#92400E" }) +
        text(36, 262, "Customers see this before booking.", { fill: SUBTLE, size: 11 }) +
        text(36, 280, "Pro+ keeps it on last-minute cancels.", { fill: SUBTLE, size: 11 }) +
        btn(20, 326, 320, 48, "Save"),
    },
    {
      label: "3. Customer sees the deposit on the booking page",
      content: () =>
        header("Mike's Handyman") +
        card(20, 70, 320, 80) +
        text(36, 96, "Faucet replacement", { weight: 700, size: 14 }) +
        text(36, 116, "Sat 10:00 AM \u00b7 ~1.5 hrs", { fill: SUBTLE, size: 12 }) +
        text(36, 136, "Estimate: $180", { fill: SUBTLE, size: 12 }) +
        card(20, 162, 320, 90, "#F5F3FF") +
        text(36, 186, "Deposit due now", { weight: 700, size: 13, fill: PURPLE_DARK }) +
        text(W - 36, 210, "$25.00", { anchor: "end", weight: 700, size: 22 }) +
        text(36, 232, "Refunded if you cancel 24h+ early.", { fill: SUBTLE, size: 11 }) +
        btn(20, 270, 320, 48, "Pay $25 & Book", GREEN),
    },
    {
      label: "4. Booking confirmed \u2014 deposit held by Stripe",
      content: () =>
        header("Booking Requests") +
        card(20, 70, 320, 110, "#ECFDF5") +
        `<circle cx="44" cy="115" r="20" fill="${GREEN}"/>` +
        `<path d="M34 115 L42 123 L56 107" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(78, 102, "New paid booking", { weight: 700, size: 14 }) +
        text(78, 122, "Sarah K. \u00b7 Faucet swap", { size: 12 }) +
        text(78, 142, "Sat 10:00 AM \u00b7 Austin 78704", { fill: SUBTLE, size: 11 }) +
        text(78, 162, "$25 deposit held by Stripe", { fill: PURPLE_DARK, size: 12, weight: 600 }),
    },
  ],

  "mark-paid-cash": [
    {
      label: "1. Open the invoice \u2192 tap Mark as Paid",
      content: () =>
        header("Invoice #1042") +
        card(20, 70, 320, 110) +
        text(36, 96, "Maria Henderson", { weight: 700, size: 14 }) +
        text(36, 116, "Kitchen sink repair \u00b7 Today", { fill: SUBTLE, size: 12 }) +
        text(36, 138, "Amount due", { fill: SUBTLE, size: 11 }) +
        text(W - 36, 162, "$180.00", { anchor: "end", weight: 700, size: 20 }) +
        btn(20, 196, 152, 48, "Send Link", "#fff", PURPLE_DARK) +
        `<rect x="20" y="196" width="152" height="48" rx="24" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>` +
        btn(188, 196, 152, 48, "Mark as Paid", PURPLE) +
        tap(264, 220),
    },
    {
      label: "2. Pick how the customer paid",
      content: () =>
        header("How was it paid?") +
        card(20, 80, 152, 86) +
        text(96, 124, "Cash", { anchor: "middle", weight: 700, size: 15 }) +
        text(96, 146, "in-person", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        card(188, 80, 152, 86, "#EDE9FE") +
        text(264, 124, "Zelle", { anchor: "middle", weight: 700, size: 15, fill: PURPLE_DARK }) +
        text(264, 146, "bank transfer", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        `<rect x="188" y="80" width="152" height="86" rx="14" fill="none" stroke="${PURPLE}" stroke-width="2"/>` +
        card(20, 178, 152, 86) +
        text(96, 222, "Venmo", { anchor: "middle", weight: 700, size: 15 }) +
        text(96, 244, "or Cash App", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        card(188, 178, 152, 86) +
        text(264, 222, "Check", { anchor: "middle", weight: 700, size: 15 }) +
        text(264, 244, "paper or eCheck", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        tap(264, 124),
    },
    {
      label: "3. Confirm amount, add a note, save",
      content: () =>
        header("Mark as Paid \u2014 Zelle") +
        card(20, 70, 320, 56) +
        text(36, 90, "Amount received", { fill: SUBTLE, size: 11 }) +
        text(W - 36, 114, "$180.00", { anchor: "end", weight: 700, size: 18 }) +
        card(20, 138, 320, 56) +
        text(36, 158, "Date paid", { fill: SUBTLE, size: 11 }) +
        text(36, 180, "Today \u00b7 Apr 28", { weight: 600 }) +
        card(20, 206, 320, 84) +
        text(36, 226, "Note (optional)", { fill: SUBTLE, size: 11 }) +
        text(36, 250, "Sent via Zelle from Maria's", { size: 12 }) +
        text(36, 268, "checking ending 0142", { size: 12 }) +
        btn(20, 308, 320, 48, "Save Payment", GREEN),
    },
    {
      label: "4. Logged \u2014 shows up in your reports",
      content: () =>
        header("Invoice #1042") +
        card(20, 70, 320, 100, "#ECFDF5") +
        `<circle cx="50" cy="120" r="22" fill="${GREEN}"/>` +
        `<path d="M40 120 L48 128 L62 112" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(86, 110, "Paid \u00b7 Zelle", { weight: 700, size: 15 }) +
        text(86, 130, "$180.00 received today", { fill: SUBTLE, size: 12 }) +
        text(86, 150, "Logged in monthly report", { fill: SUBTLE, size: 11 }) +
        card(20, 184, 320, 64) +
        text(36, 208, "Receipt sent to Maria", { weight: 600, size: 13 }) +
        text(36, 228, "(512) 555-0142 \u00b7 SMS", { fill: SUBTLE, size: 11 }),
    },
  ],

  "quick-capture": [
    {
      label: "1. Tap + in the header (or More \u2192 Quick Capture)",
      content: () =>
        header("Today") +
        card(20, 70, 320, 64) +
        text(36, 92, "Game Plan \u00b7 3 things", { weight: 600 }) +
        text(36, 112, "Send invoice \u00b7 Reply Sarah \u00b7 Drive to Maria", { fill: SUBTLE, size: 11 }) +
        `<circle cx="${W - 48}" cy="34" r="16" fill="${PURPLE}"/>` +
        text(W - 48, 40, "+", { anchor: "middle", fill: "#fff", size: 22, weight: 700 }) +
        tap(W - 48, 34),
    },
    {
      label: "2. Snap a photo, voice memo, or paste a screenshot",
      content: () =>
        header("Quick Capture") +
        card(20, 70, 152, 130, "#F5F3FF") +
        text(96, 145, "Photo", { anchor: "middle", weight: 700, size: 16 }) +
        text(96, 170, "camera", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        card(188, 70, 152, 130, "#FEF3C7") +
        text(264, 145, "Voice Memo", { anchor: "middle", weight: 700, size: 14 }) +
        text(264, 170, "tap to record", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        card(20, 212, 152, 130, "#DBEAFE") +
        text(96, 287, "Note", { anchor: "middle", weight: 700, size: 16 }) +
        text(96, 312, "type a thought", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        card(188, 212, 152, 130, "#FCE7F3") +
        text(264, 287, "Paste", { anchor: "middle", weight: 700, size: 16 }) +
        text(264, 312, "from clipboard", { anchor: "middle", fill: SUBTLE, size: 11 }) +
        tap(264, 130),
    },
    {
      label: "3. AI transcribes & suggests what to do",
      content: () =>
        header("Voice memo") +
        card(20, 70, 320, 110, "#FEF3C7") +
        text(36, 94, "Transcription", { fill: SUBTLE, size: 11, weight: 600 }) +
        text(36, 116, "\u201CSarah on Maple wants a", { weight: 600, size: 13 }) +
        text(36, 134, "fence repair quote, asked", { weight: 600, size: 13 }) +
        text(36, 152, "for next Tuesday afternoon.\u201D", { weight: 600, size: 13 }) +
        text(36, 196, "Suggested actions", { fill: SUBTLE, size: 11, weight: 600 }) +
        card(20, 208, 320, 50, "#F5F3FF") +
        text(36, 238, "Create lead: Sarah \u2014 Fence repair", { fill: PURPLE_DARK, weight: 600, size: 12 }) +
        card(20, 268, 320, 50, "#F5F3FF") +
        text(36, 298, "Schedule job: Tue PM", { fill: PURPLE_DARK, weight: 600, size: 12 }) +
        card(20, 328, 320, 50, "#F5F3FF") +
        text(36, 358, "Draft a reply to Sarah", { fill: PURPLE_DARK, weight: 600, size: 12 }) +
        tap(40, 233),
    },
    {
      label: "4. Lead saved \u2014 ready to follow up",
      content: () =>
        header("Requests") +
        card(20, 70, 320, 90, "#ECFDF5") +
        `<circle cx="44" cy="115" r="18" fill="${GREEN}"/>` +
        `<path d="M34 115 L42 123 L56 107" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(74, 100, "Sarah \u2014 Fence repair", { weight: 700, size: 14 }) +
        text(74, 120, "Just Added \u00b7 From voice memo", { fill: SUBTLE, size: 12 }) +
        text(74, 140, "Suggested: Tue PM", { fill: SUBTLE, size: 11 }),
    },
  ],
};

// Render each frame to PNG and assemble GIF + MP4
for (const [clip, frames] of Object.entries(CLIPS)) {
  const clipDir = join(tmp, clip);
  mkdirSync(clipDir);
  // Each step expanded into N identical PNG frames so ffmpeg/convert can build animation
  let frameIdx = 0;
  for (let i = 0; i < frames.length; i++) {
    const svg = phoneFrame(frames[i].content(), frames[i].label);
    const svgPath = join(clipDir, `step-${i}.svg`);
    writeFileSync(svgPath, svg);
    const pngPath = join(clipDir, `step-${i}.png`);
    execSync(`magick -background none -density 144 "${svgPath}" -resize ${W}x${H} "${pngPath}"`);
    const repeats = FRAME_SECS * FPS;
    for (let r = 0; r < repeats; r++) {
      const f = String(frameIdx++).padStart(4, "0");
      execSync(`cp "${pngPath}" "${join(clipDir, `f-${f}.png`)}"`);
    }
  }
  const gifOut = join(here, `${clip}.gif`);
  const mp4Out = join(here, `${clip}.mp4`);
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${clipDir}/f-%04d.png" -vf "split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" -loop 0 "${gifOut}"`,
    { stdio: "pipe" }
  );
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${clipDir}/f-%04d.png" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Out}"`,
    { stdio: "pipe" }
  );
  console.log("built", clip, "(.gif and .mp4)");
}

rmSync(tmp, { recursive: true, force: true });
console.log("done");
