import { chromium } from "playwright";
import * as fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ScenarioSchema } from "../utils/types";
import type { Scenario, ScenarioResult, UATReport } from "../utils/types";
import { getEnv } from "../utils/env";
import { uatLogger } from "../utils/logger";
import { runScenario } from "./scenarioRunner";
import { generateReports } from "./reporter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCENARIOS_DIR = path.resolve(__dirname, "../scenarios");
const REPORTS_DIR = path.resolve(__dirname, "../reports");

function generateRunId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `uat-${ts}`;
}

async function loadScenarios(): Promise<Scenario[]> {
  const files = await fs.readdir(SCENARIOS_DIR);
  const jsonFiles = files.filter((f: string) => f.endsWith(".json")).sort();

  const scenarios: Scenario[] = [];
  for (const file of jsonFiles) {
    const filePath = path.join(SCENARIOS_DIR, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const raw = JSON.parse(content);
      const parsed = ScenarioSchema.parse(raw);
      scenarios.push(parsed);
      uatLogger.info(`Loaded scenario: ${parsed.name} (${file})`);
    } catch (err) {
      uatLogger.error(`Failed to load scenario ${file}`, err);
    }
  }

  return scenarios;
}

async function main(): Promise<void> {
  const env = getEnv();
  const runId = generateRunId();

  uatLogger.banner(`GigAid UAT Agent — Run ${runId}`);
  uatLogger.info(`Base URL: ${env.UAT_BASE_URL}`);
  uatLogger.info(`Headless: ${env.UAT_HEADLESS}`);
  uatLogger.info(`Timeout: ${env.UAT_TIMEOUT}ms`);
  uatLogger.divider();

  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }

  let scenarios = await loadScenarios();
  if (scenarios.length === 0) {
    uatLogger.error("No scenarios found. Exiting.");
    process.exit(1);
  }

  const filterArg = process.argv[2];
  if (filterArg) {
    const names = filterArg.split(",").map((n) => n.trim().toLowerCase());
    scenarios = scenarios.filter((s) =>
      names.some((n) => s.name.toLowerCase().includes(n))
    );
    uatLogger.info(`Filter: "${filterArg}" → ${scenarios.length} scenario(s) matched`);
    if (scenarios.length === 0) {
      uatLogger.error("No scenarios matched the filter. Exiting.");
      process.exit(1);
    }
  }

  uatLogger.info(`Found ${scenarios.length} scenarios to run`);

  const headless = env.UAT_HEADLESS === "true";
  const slowMo = parseInt(env.UAT_SLOW_MO, 10);

  let browser = await chromium.launch({ headless, slowMo });
  uatLogger.info(`Browser launched (headless: ${headless})`);

  const startTime = Date.now();
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    try {
      if (!browser.isConnected()) {
        uatLogger.warn("Browser disconnected, relaunching...");
        browser = await chromium.launch({ headless, slowMo });
      }
      const result = await runScenario(scenario, browser);
      results.push(result);
    } catch (err) {
      uatLogger.error(`Fatal error in scenario "${scenario.name}"`, err);
      results.push({
        name: scenario.name,
        description: scenario.description,
        viewport: scenario.viewport,
        status: "error",
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        steps: [],
        assertions: [],
        consoleErrors: [],
        networkErrors: [],
        screenshots: [],
      });
      if (!browser.isConnected()) {
        uatLogger.warn("Browser crashed, relaunching for remaining scenarios...");
        try {
          browser = await chromium.launch({ headless, slowMo });
        } catch (launchErr) {
          uatLogger.error("Failed to relaunch browser, aborting remaining scenarios", launchErr);
          break;
        }
      }
    }
  }

  if (browser.isConnected()) {
    await browser.close();
  }

  const endTime = Date.now();
  const report: UATReport = {
    runId,
    startTime,
    endTime,
    duration: endTime - startTime,
    totalScenarios: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    errored: results.filter((r) => r.status === "error").length,
    scenarios: results,
  };

  await generateReports(report);

  uatLogger.divider();
  uatLogger.banner("UAT Run Complete");
  uatLogger.info(`Total: ${report.totalScenarios} | Passed: ${report.passed} | Failed: ${report.failed} | Errors: ${report.errored}`);
  uatLogger.info(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
  uatLogger.info(`Reports: ${REPORTS_DIR}`);

  if (report.failed > 0 || report.errored > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  uatLogger.error("UAT Agent crashed", err);
  process.exit(2);
});
