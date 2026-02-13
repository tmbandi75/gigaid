import { execFileSync } from "child_process";

const SMOKE_SUITES = [
  { name: "auth", pattern: "auth\\.test" },
  { name: "activation", pattern: "activation\\.test" },
  { name: "revenue.drift", pattern: "revenue\\.drift\\.test" },
  { name: "revenue.regression", pattern: "revenue\\.regression\\.test" },
  { name: "capabilities", pattern: "capabilities\\.test" },
];

const TIMEOUT_MS = 5 * 60 * 1000;

interface SmokeResult {
  suite: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
}

function runSuite(suite: typeof SMOKE_SUITES[number]): SmokeResult {
  const start = Date.now();
  try {
    execFileSync("npx", ["jest", "--selectProjects", "api", `--testPathPatterns=${suite.pattern}`, "--forceExit"], {
      timeout: TIMEOUT_MS,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });
    return { suite: suite.name, passed: true, duration_ms: Date.now() - start };
  } catch (err: any) {
    const output = ((err.stdout || "") + "\n" + (err.stderr || "")).trim();
    const lastLines = output.split("\n").slice(-10).join("\n");
    return { suite: suite.name, passed: false, duration_ms: Date.now() - start, error: lastLines };
  }
}

function main() {
  const globalStart = Date.now();
  console.log("\n  SMOKE TEST GATE");
  console.log("  " + new Date().toISOString());
  console.log("  Timeout: " + (TIMEOUT_MS / 1000) + "s per suite\n");

  const results: SmokeResult[] = [];
  let allPassed = true;

  for (const suite of SMOKE_SUITES) {
    console.log(`  Running ${suite.name}...`);
    const result = runSuite(suite);
    results.push(result);
    const icon = result.passed ? "OK" : "FAIL";
    console.log(`  [${icon}] ${suite.name} (${(result.duration_ms / 1000).toFixed(1)}s)`);
    if (!result.passed) {
      allPassed = false;
      console.log(`  ${result.error}\n`);
      break;
    }
  }

  const totalMs = Date.now() - globalStart;
  console.log(`\n  Total: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Status: ${allPassed ? "PASS" : "FAIL"}\n`);

  process.exit(allPassed ? 0 : 1);
}

export { SMOKE_SUITES, runSuite };
export type { SmokeResult };

const isDirectRun = process.argv[1]?.endsWith("smokeTest.ts");
if (isDirectRun) {
  main();
}
