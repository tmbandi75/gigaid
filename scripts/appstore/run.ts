import sharp from "sharp";
import * as fs from "fs";
import { captureAll } from "./capture.js";
import { composeAll } from "./compose.js";

const EXPECTED_WIDTH = 1290;
const EXPECTED_HEIGHT = 2796;

async function validate(paths: string[]): Promise<boolean> {
  console.log("\n=== VALIDATION REPORT ===\n");
  console.log(`Target: ${EXPECTED_WIDTH} x ${EXPECTED_HEIGHT} PNG`);
  console.log(`Files: ${paths.length}\n`);

  let allPass = true;

  for (const p of paths) {
    const filename = p.split("/").pop() || p;
    const issues: string[] = [];

    if (!fs.existsSync(p)) {
      issues.push("File not found");
    } else {
      const meta = await sharp(p).metadata();
      if (meta.width !== EXPECTED_WIDTH) issues.push(`Width ${meta.width} != ${EXPECTED_WIDTH}`);
      if (meta.height !== EXPECTED_HEIGHT) issues.push(`Height ${meta.height} != ${EXPECTED_HEIGHT}`);
      if (meta.format !== "png") issues.push(`Format ${meta.format} != png`);

      const stats = fs.statSync(p);
      if (stats.size < 50000) issues.push(`File too small: ${stats.size} bytes`);
    }

    const status = issues.length === 0 ? "PASS" : "FAIL";
    if (issues.length > 0) allPass = false;

    console.log(`  [${status}] ${filename}`);
    for (const issue of issues) {
      console.log(`         ${issue}`);
    }
  }

  console.log(`\nOverall: ${allPass ? "ALL PASSED" : "SOME ISSUES"}\n`);
  return allPass;
}

async function main() {
  console.log("=== GigAid App Store Screenshot Pipeline (Jobber-Style) ===\n");

  console.log("STEP 1: Capturing raw screenshots...\n");
  const captures = await captureAll();
  const successfulCaptures = captures.filter(c => c.rawPath);
  console.log(`\n  Captured: ${successfulCaptures.length}/${captures.length}\n`);

  console.log("STEP 2: Composing Jobber-style posters...\n");
  const outputPaths = await composeAll(captures);
  console.log(`\n  Composed: ${outputPaths.length} images\n`);

  console.log("STEP 3: Validating...");
  const allPass = await validate(outputPaths);

  if (allPass) {
    console.log("All screenshots generated and validated successfully!");
  } else {
    console.log("Some screenshots had issues — check report above.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
