import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Scenario, ScenarioResult, StepResult, AssertionResult, ConsoleEntry, NetworkError } from "../utils/types";
import { executeStep } from "./stepExecutor";
import { runAssertion } from "./assertions";
import { getEnv } from "../utils/env";
import { uatLogger } from "../utils/logger";

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export async function runScenario(scenario: Scenario, browser: Browser): Promise<ScenarioResult> {
  const env = getEnv();
  const timeout = parseInt(env.UAT_TIMEOUT, 10);
  const startTime = Date.now();

  const consoleErrors: ConsoleEntry[] = [];
  const networkErrors: NetworkError[] = [];
  const screenshots: string[] = [];

  uatLogger.divider();
  uatLogger.info(`Running scenario: ${scenario.name} [${scenario.viewport}]`);
  uatLogger.info(`Description: ${scenario.description}`);

  const viewport = VIEWPORTS[scenario.viewport];
  const contextOptions: any = {
    viewport,
    ignoreHTTPSErrors: true,
  };

  if (scenario.viewport === "mobile") {
    contextOptions.userAgent = MOBILE_UA;
    contextOptions.isMobile = true;
    contextOptions.hasTouch = true;
  }

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext(contextOptions);
    page = await context.newPage();

    page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        consoleErrors.push({
          type,
          text: msg.text(),
          timestamp: Date.now(),
        });
      }
    });

    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) {
        networkErrors.push({
          url: response.url(),
          status,
          statusText: response.statusText(),
          method: response.request().method(),
          timestamp: Date.now(),
        });
      }
    });

    const stepResults: StepResult[] = [];
    let hasFailed = false;

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const result = await executeStep(page, step, i + 1, scenario.name, timeout);
      stepResults.push(result);

      if (result.screenshot) {
        screenshots.push(result.screenshot);
      }

      if (result.status === "fail") {
        if (step.optional) {
          uatLogger.warn(`Scenario "${scenario.name}" step #${i + 1} failed (optional, non-blocking)`);
        } else {
          hasFailed = true;
          uatLogger.warn(`Scenario "${scenario.name}" step #${i + 1} failed, continuing remaining steps...`);
        }
      }
    }

    const assertionResults: AssertionResult[] = [];
    for (const assertion of scenario.assertions) {
      const result = await runAssertion(page, assertion, timeout);
      assertionResults.push(result);
      if (result.status === "fail") {
        hasFailed = true;
      }
    }

    const endTime = Date.now();
    const status = hasFailed ? "fail" : "pass";

    if (status === "pass") {
      uatLogger.pass(`Scenario "${scenario.name}" PASSED in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    } else {
      uatLogger.fail(`Scenario "${scenario.name}" FAILED in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    }

    return {
      name: scenario.name,
      description: scenario.description,
      viewport: scenario.viewport,
      status,
      startTime,
      endTime,
      duration: endTime - startTime,
      steps: stepResults,
      assertions: assertionResults,
      consoleErrors,
      networkErrors,
      screenshots,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    uatLogger.error(`Scenario "${scenario.name}" errored`, err);

    const endTime = Date.now();
    return {
      name: scenario.name,
      description: scenario.description,
      viewport: scenario.viewport,
      status: "error",
      startTime,
      endTime,
      duration: endTime - startTime,
      steps: [],
      assertions: [],
      consoleErrors,
      networkErrors,
      screenshots,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}
