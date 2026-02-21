import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { ROUTES, type RouteConfig } from "./routes.js";
import type { CaptureResult } from "./capture.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FINAL_WIDTH = 1290;
const FINAL_HEIGHT = 2796;
const VIEWPORT_WIDTH = 430;
const VIEWPORT_HEIGHT = 932;
const DEVICE_SCALE = 3;

const SCREEN_W = VIEWPORT_WIDTH * DEVICE_SCALE;
const SCREEN_H = VIEWPORT_HEIGHT * DEVICE_SCALE;

const OUTPUT_DIR = path.resolve(__dirname, "../../exports/appstore/iphone");

const BG_PRESETS: Record<string, string[]> = {
  bg1: ["#0b1628", "#132847", "#0a1e3d"],
  bg2: ["#0d1f0d", "#183018", "#0d2610"],
  bg3: ["#1a0b2e", "#2d1450", "#1a0b2e"],
  bg4: ["#1c1008", "#2e1a0a", "#1c1008"],
};

const FRAME_BEZEL = 10;
const FRAME_CORNER_RADIUS = 58;
const DYNAMIC_ISLAND_W = 126;
const DYNAMIC_ISLAND_H = 37;
const HEADLINE_AREA_H = 520;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateBackgroundSVG(preset: string): string {
  const s = BG_PRESETS[preset] || BG_PRESETS.bg1;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${FINAL_WIDTH}' height='${FINAL_HEIGHT}'>
  <defs><linearGradient id='bg' x1='0' y1='0' x2='0.3' y2='1'>
  <stop offset='0%' stop-color='${s[0]}'/><stop offset='50%' stop-color='${s[1]}'/><stop offset='100%' stop-color='${s[2]}'/>
  </linearGradient></defs>
  <rect width='${FINAL_WIDTH}' height='${FINAL_HEIGHT}' fill='url(#bg)'/></svg>`;
}

function generateDeviceFrameSVG(w: number, h: number): string {
  const tw = w + FRAME_BEZEL * 2;
  const th = h + FRAME_BEZEL * 2;
  const diX = tw / 2 - DYNAMIC_ISLAND_W / 2;
  const diY = FRAME_BEZEL + 14;

  return `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${th}'>
  <rect x='0' y='0' width='${tw}' height='${th}' rx='${FRAME_CORNER_RADIUS}' fill='#1c1c1e' stroke='#444' stroke-width='1.5'/>
  <rect x='${FRAME_BEZEL}' y='${FRAME_BEZEL}' width='${w}' height='${h}' rx='${FRAME_CORNER_RADIUS - FRAME_BEZEL}' fill='#000'/>
  <rect x='${FRAME_BEZEL - 3}' y='140' width='3' height='35' rx='1.5' fill='#3a3a3e'/>
  <rect x='${FRAME_BEZEL - 3}' y='190' width='3' height='60' rx='1.5' fill='#3a3a3e'/>
  <rect x='${FRAME_BEZEL - 3}' y='260' width='3' height='60' rx='1.5' fill='#3a3a3e'/>
  <rect x='${tw - FRAME_BEZEL}' y='200' width='3' height='80' rx='1.5' fill='#3a3a3e'/>
  <rect x='${diX}' y='${diY}' width='${DYNAMIC_ISLAND_W}' height='${DYNAMIC_ISLAND_H}' rx='${DYNAMIC_ISLAND_H / 2}' fill='#000'/>
  </svg>`;
}

function generateHeadlineSVG(route: RouteConfig, width: number, areaHeight: number): string {
  const fontSize = 72;
  const lineGap = fontSize * 1.15;
  const subFontSize = 32;

  let totalTextH = lineGap * 2;
  if (route.subheadline) totalTextH += subFontSize * 2;

  const startY = (areaHeight - totalTextH) / 2 + fontSize;

  function renderLineWithAccent(line: string, y: number): string {
    const accent = route.accentWord;
    let underline = "";
    if (line.includes(accent)) {
      const parts = line.split(accent);
      const before = parts[0] || "";
      const uw = accent.length * fontSize * 0.58;
      const tlw = line.length * fontSize * 0.58;
      const lsx = width / 2 - tlw / 2;
      const asx = lsx + before.length * fontSize * 0.58;
      underline = `<rect x='${asx}' y='${y + 6}' width='${uw}' height='${fontSize * 0.14}' rx='4' fill='#22c55e' opacity='0.85'/>`;
    }
    return `<text x='${width / 2}' y='${y}' text-anchor='middle' font-family="-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif" font-size='${fontSize}' font-weight='800' fill='white' letter-spacing='2'>${escapeXml(line)}</text>${underline}`;
  }

  const line1SVG = renderLineWithAccent(route.headline[0], startY);
  const line2SVG = renderLineWithAccent(route.headline[1], startY + lineGap);

  let subSVG = "";
  if (route.subheadline) {
    subSVG = `<text x='${width / 2}' y='${startY + lineGap * 2 + subFontSize * 0.5}' text-anchor='middle' font-family="-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif" font-size='${subFontSize}' font-weight='400' fill='rgba(255,255,255,0.65)' letter-spacing='3'>${escapeXml(route.subheadline)}</text>`;
  }

  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${areaHeight}'>${line1SVG}${line2SVG}${subSVG}</svg>`;
}

async function composeSingle(route: RouteConfig, rawPath: string, idx: number): Promise<string | null> {
  console.log(`  [${idx + 1}/${ROUTES.length}] Composing: ${route.name}`);

  const raw = fs.readFileSync(rawPath);

  const resized = await sharp(raw).resize(SCREEN_W, SCREEN_H, { fit: "cover" }).png().toBuffer();

  const cornerR = FRAME_CORNER_RADIUS - FRAME_BEZEL;
  const mask = Buffer.from(
    `<svg width='${SCREEN_W}' height='${SCREEN_H}'><rect x='0' y='0' width='${SCREEN_W}' height='${SCREEN_H}' rx='${cornerR}' ry='${cornerR}' fill='white'/></svg>`
  );
  const rounded = await sharp(resized).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

  const fW = SCREEN_W + FRAME_BEZEL * 2;
  const fH = SCREEN_H + FRAME_BEZEL * 2;
  const frame = await sharp(Buffer.from(generateDeviceFrameSVG(SCREEN_W, SCREEN_H))).resize(fW, fH).png().toBuffer();
  const device = await sharp(frame).composite([{ input: rounded, top: FRAME_BEZEL, left: FRAME_BEZEL }]).png().toBuffer();

  const deviceAreaH = FINAL_HEIGHT - HEADLINE_AREA_H;
  const dm = await sharp(device).metadata();
  const fitS = Math.min(
    (FINAL_WIDTH * route.phonePlacement.scale) / dm.width!,
    (deviceAreaH * 0.90) / dm.height!
  );
  const sW = Math.round(dm.width! * fitS);
  const sH = Math.round(dm.height! * fitS);

  let devImg = await sharp(device).resize(sW, sH, { fit: "inside" }).png().toBuffer();
  let dW = sW;
  let dH = sH;

  if (route.phonePlacement.rotation !== 0) {
    devImg = await sharp(devImg)
      .rotate(route.phonePlacement.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const rm = await sharp(devImg).metadata();
    dW = rm.width!;
    dH = rm.height!;
  }

  let dL = Math.round((FINAL_WIDTH - dW) / 2 + route.phonePlacement.offsetX);
  let dT = HEADLINE_AREA_H + Math.round((deviceAreaH - dH) / 2 + route.phonePlacement.offsetY);
  let cL = 0, cT = 0, cW = dW, cH = dH;
  if (dL < 0) { cL = -dL; cW -= cL; dL = 0; }
  if (dT < 0) { cT = -dT; cH -= cT; dT = 0; }
  if (dL + cW > FINAL_WIDTH) cW = FINAL_WIDTH - dL;
  if (dT + cH > FINAL_HEIGHT) cH = FINAL_HEIGHT - dT;
  cW = Math.max(1, Math.min(cW, dW - cL));
  cH = Math.max(1, Math.min(cH, dH - cT));

  if (cL > 0 || cT > 0 || cW < dW || cH < dH) {
    devImg = await sharp(devImg).extract({ left: cL, top: cT, width: cW, height: cH }).png().toBuffer();
  }

  const bg = await sharp(Buffer.from(generateBackgroundSVG(route.backgroundPreset)))
    .resize(FINAL_WIDTH, FINAL_HEIGHT).png().toBuffer();
  const head = await sharp(Buffer.from(generateHeadlineSVG(route, FINAL_WIDTH, HEADLINE_AREA_H)))
    .resize(FINAL_WIDTH, HEADLINE_AREA_H).png().toBuffer();

  const final = await sharp(bg)
    .composite([
      { input: head, top: 0, left: 0 },
      { input: devImg, top: dT, left: dL },
    ])
    .png()
    .toBuffer();

  const out = await sharp(final).resize(FINAL_WIDTH, FINAL_HEIGHT, { fit: "cover" }).png().toBuffer();
  const num = String(idx + 1).padStart(2, "0");
  const filename = `${num}-${route.name}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, out);
  console.log(`    Saved: ${outputPath} (${out.length} bytes)`);
  return outputPath;
}

export async function composeAll(captures: CaptureResult[]): Promise<string[]> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPaths: string[] = [];

  for (let i = 0; i < ROUTES.length; i++) {
    const route = ROUTES[i];
    const capture = captures.find(c => c.name === route.name);
    if (!capture || !capture.rawPath) {
      console.error(`  Skipping ${route.name}: no raw capture`);
      continue;
    }

    try {
      const result = await composeSingle(route, capture.rawPath, i);
      if (result) outputPaths.push(result);
    } catch (err) {
      console.error(`    ERROR composing ${route.name}:`, (err as Error).message);
    }
  }

  return outputPaths;
}
