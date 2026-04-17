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
    <text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="${textFill}">${label}</text>
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
