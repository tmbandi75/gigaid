import { TestResult, TestReport } from "./types.js";
import { runLimitTests } from "./limit-tests.js";
import { runApiTests } from "./api-tests.js";
import { runStripeTests } from "./stripe-tests.js";
import { runFailureTests } from "./failure-tests.js";
import * as fs from "fs";
import * as path from "path";

const REPORT_DIR = path.resolve("tests/monetization/reports");

function generateRunId(): string {
  const now = new Date();
  return `smoke-${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
}

function buildReport(runId: string, startedAt: string, results: TestResult[]): TestReport {
  const categories: Record<string, { passed: number; failed: number; tests: TestResult[] }> = {};

  for (const result of results) {
    if (!categories[result.category]) {
      categories[result.category] = { passed: 0, failed: 0, tests: [] };
    }
    categories[result.category].tests.push(result);
    if (result.passed) {
      categories[result.category].passed++;
    } else {
      categories[result.category].failed++;
    }
  }

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  return {
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    duration_ms: Date.now() - new Date(startedAt).getTime(),
    summary: {
      total,
      passed,
      failed,
      passRate: `${((passed / total) * 100).toFixed(1)}%`,
    },
    categories,
    fixesApplied: [],
    stripeIds: [],
  };
}

function printResults(report: TestReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("  MONETIZATION SMOKE TEST REPORT");
  console.log("=".repeat(60));
  console.log(`  Run ID:    ${report.runId}`);
  console.log(`  Duration:  ${report.duration_ms}ms`);
  console.log(`  Total:     ${report.summary.total}`);
  console.log(`  Passed:    ${report.summary.passed}`);
  console.log(`  Failed:    ${report.summary.failed}`);
  console.log(`  Pass Rate: ${report.summary.passRate}`);
  console.log("=".repeat(60));

  for (const [category, data] of Object.entries(report.categories)) {
    const statusIcon = data.failed === 0 ? "PASS" : "FAIL";
    console.log(`\n[${statusIcon}] ${category.toUpperCase()} (${data.passed}/${data.passed + data.failed})`);

    for (const test of data.tests) {
      const icon = test.passed ? "  +" : "  -";
      console.log(`${icon} ${test.name}`);
      if (!test.passed) {
        console.log(`      ${test.message}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));

  if (report.summary.failed === 0) {
    console.log("  ALL TESTS PASSED");
  } else {
    console.log(`  ${report.summary.failed} TEST(S) FAILED`);
    console.log("\n  Failed tests:");
    for (const [category, data] of Object.entries(report.categories)) {
      for (const test of data.tests) {
        if (!test.passed) {
          console.log(`    - [${category}] ${test.name}: ${test.message}`);
        }
      }
    }
  }

  console.log("=".repeat(60) + "\n");
}

async function runAllTests(): Promise<TestResult[]> {
  const allResults: TestResult[] = [];

  console.log("\n[1/4] Running capability limit tests...");
  const limitResults = await runLimitTests();
  allResults.push(...limitResults);
  console.log(`  -> ${limitResults.filter(r => r.passed).length}/${limitResults.length} passed`);

  console.log("[2/4] Running API endpoint tests...");
  const apiResults = await runApiTests();
  allResults.push(...apiResults);
  console.log(`  -> ${apiResults.filter(r => r.passed).length}/${apiResults.length} passed`);

  console.log("[3/4] Running Stripe integration tests...");
  const stripeResults = await runStripeTests();
  allResults.push(...stripeResults);
  console.log(`  -> ${stripeResults.filter(r => r.passed).length}/${stripeResults.length} passed`);

  console.log("[4/4] Running failure injection tests...");
  const failureResults = await runFailureTests();
  allResults.push(...failureResults);
  console.log(`  -> ${failureResults.filter(r => r.passed).length}/${failureResults.length} passed`);

  return allResults;
}

async function main() {
  const runCount = parseInt(process.argv[2] || "1", 10);
  const reports: TestReport[] = [];
  let allPassed = true;

  for (let i = 1; i <= runCount; i++) {
    if (runCount > 1) {
      console.log(`\n${"#".repeat(60)}`);
      console.log(`  RUN ${i} OF ${runCount}`);
      console.log(`${"#".repeat(60)}`);
    }

    const runId = generateRunId();
    const startedAt = new Date().toISOString();

    const results = await runAllTests();
    const report = buildReport(runId, startedAt, results);

    printResults(report);

    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    const reportPath = path.join(REPORT_DIR, `${runId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved: ${reportPath}`);

    const latestPath = path.join(REPORT_DIR, "latest.json");
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

    reports.push(report);
    if (report.summary.failed > 0) {
      allPassed = false;
    }

    if (i < runCount) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (runCount > 1) {
    console.log(`\n${"#".repeat(60)}`);
    console.log(`  CONSECUTIVE RUN SUMMARY (${runCount} runs)`);
    console.log(`${"#".repeat(60)}`);
    reports.forEach((r, i) => {
      const icon = r.summary.failed === 0 ? "PASS" : "FAIL";
      console.log(`  Run ${i + 1}: [${icon}] ${r.summary.passed}/${r.summary.total} passed (${r.summary.passRate})`);
    });
    console.log(`${"#".repeat(60)}\n`);
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error("Smoke test fatal error:", err);
  process.exit(1);
});
