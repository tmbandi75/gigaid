import { z } from "zod";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EnvSchema = z.object({
  UAT_BASE_URL: z.string().url().default("http://localhost:5000"),
  UAT_TEST_EMAIL: z.string().email().default("uat-test@gigaid.ai"),
  UAT_TEST_PASSWORD: z.string().min(1).default("UatTest123!"),
  STRIPE_TEST_CARD: z.string().default("4242424242424242"),
  UAT_HEADLESS: z.string().default("true"),
  UAT_SLOW_MO: z.string().default("0"),
  UAT_TIMEOUT: z.string().default("30000"),
});

export type UATEnv = z.infer<typeof EnvSchema>;

function loadDotenv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../.env");
  const vars: Record<string, string> = {};

  if (!fs.existsSync(envPath)) {
    return vars;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

let cachedEnv: UATEnv | null = null;

export function getEnv(): UATEnv {
  if (cachedEnv) return cachedEnv;

  const fileVars = loadDotenv();
  const merged = { ...fileVars, ...process.env };

  cachedEnv = EnvSchema.parse({
    UAT_BASE_URL: merged.UAT_BASE_URL,
    UAT_TEST_EMAIL: merged.UAT_TEST_EMAIL,
    UAT_TEST_PASSWORD: merged.UAT_TEST_PASSWORD,
    STRIPE_TEST_CARD: merged.STRIPE_TEST_CARD,
    UAT_HEADLESS: merged.UAT_HEADLESS,
    UAT_TIMEOUT: merged.UAT_TIMEOUT,
    UAT_SLOW_MO: merged.UAT_SLOW_MO,
  });

  return cachedEnv;
}
