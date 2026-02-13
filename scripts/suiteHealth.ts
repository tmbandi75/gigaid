import * as fs from "fs";
import * as path from "path";

export const FLAKY_THRESHOLD = 0.05;
export const HISTORY_LIMIT = 20;
export const CRITICAL_RECENT_WINDOW = 5;

const CRITICAL_SUITES = ["revenue", "capability", "billing", "auth", "activation"];

const HISTORY_PATH = path.resolve(process.cwd(), "reports", "test-history.json");

export interface SuiteRun {
  suiteName: string;
  timestamp: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
}

export interface TestHistory {
  version: 1;
  suites: Record<string, SuiteRun[]>;
}

export interface SuiteHealthResult {
  suiteName: string;
  runs: number;
  failures: number;
  flakyRate: number;
  recentFailures: number;
  status: "healthy" | "flaky" | "critical";
  isCriticalSuite: boolean;
}

export interface HealthSummary {
  checkedAt: string;
  threshold: number;
  historyLimit: number;
  suites: SuiteHealthResult[];
  overallHealthy: boolean;
  blockRelease: boolean;
  blockReason?: string;
}

function ensureReportsDir(): void {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadHistory(): TestHistory {
  ensureReportsDir();
  if (!fs.existsSync(HISTORY_PATH)) {
    return { version: 1, suites: {} };
  }
  try {
    const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (data.version === 1 && data.suites) {
      return data as TestHistory;
    }
    return { version: 1, suites: {} };
  } catch {
    return { version: 1, suites: {} };
  }
}

function saveHistory(history: TestHistory): void {
  ensureReportsDir();
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
}

export function recordRun(run: SuiteRun): void {
  const history = loadHistory();
  if (!history.suites[run.suiteName]) {
    history.suites[run.suiteName] = [];
  }
  history.suites[run.suiteName].push(run);
  if (history.suites[run.suiteName].length > HISTORY_LIMIT) {
    history.suites[run.suiteName] = history.suites[run.suiteName].slice(-HISTORY_LIMIT);
  }
  saveHistory(history);
}

function isCritical(suiteName: string): boolean {
  const lower = suiteName.toLowerCase();
  return CRITICAL_SUITES.some((c) => lower.includes(c));
}

export function computeHealth(): HealthSummary {
  const history = loadHistory();
  const suites: SuiteHealthResult[] = [];
  let blockRelease = false;
  let blockReason: string | undefined;

  for (const [name, runs] of Object.entries(history.suites)) {
    if (runs.length === 0) continue;
    const failures = runs.filter((r) => !r.passed).length;
    const flakyRate = failures / runs.length;
    const critical = isCritical(name);
    let status: SuiteHealthResult["status"] = "healthy";

    const recentRuns = runs.slice(-CRITICAL_RECENT_WINDOW);
    const recentFailures = recentRuns.filter((r) => !r.passed).length;

    if (critical && recentFailures > 0) {
      status = "critical";
      blockRelease = true;
      const reason = `${name}: ${recentFailures} failure(s) in last ${recentRuns.length} runs`;
      blockReason = blockReason ? `${blockReason}; ${reason}` : `Critical suite failure: ${reason}`;
    } else if (flakyRate > FLAKY_THRESHOLD) {
      status = critical ? "critical" : "flaky";
      if (critical) {
        blockRelease = true;
        blockReason = blockReason
          ? `${blockReason}; ${name} flaky rate ${(flakyRate * 100).toFixed(1)}%`
          : `Flaky test suite detected: ${name} flaky rate ${(flakyRate * 100).toFixed(1)}%`;
      }
    }

    suites.push({ suiteName: name, runs: runs.length, failures, flakyRate, recentFailures, status, isCriticalSuite: critical });
  }

  if (!blockRelease) {
    const anyFlaky = suites.some((s) => s.flakyRate > FLAKY_THRESHOLD);
    if (anyFlaky) {
      blockRelease = true;
      const flakyNames = suites.filter((s) => s.flakyRate > FLAKY_THRESHOLD).map((s) => s.suiteName);
      blockReason = `Flaky test suite detected: ${flakyNames.join(", ")}`;
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    threshold: FLAKY_THRESHOLD,
    historyLimit: HISTORY_LIMIT,
    suites,
    overallHealthy: !blockRelease,
    blockRelease,
    blockReason,
  };
}

export function printHealthTable(summary: HealthSummary): void {
  const header = "Suite Name".padEnd(30) + "Runs".padStart(6) + "Fails".padStart(7) + "Flaky %".padStart(9) + "  Status";
  const divider = "-".repeat(header.length);

  console.log(`\n${divider}`);
  console.log(`  SUITE HEALTH (threshold: ${(summary.threshold * 100).toFixed(0)}%, window: ${summary.historyLimit} runs)`);
  console.log(divider);
  console.log(`  ${header}`);
  console.log(`  ${divider}`);

  if (summary.suites.length === 0) {
    console.log("  No test history recorded yet.");
  }

  for (const s of summary.suites) {
    const pct = (s.flakyRate * 100).toFixed(1) + "%";
    const statusLabel = s.status === "critical" ? "CRITICAL" : s.status === "flaky" ? "FLAKY" : "OK";
    const line =
      `  ${s.suiteName.padEnd(30)}${String(s.runs).padStart(6)}${String(s.failures).padStart(7)}${pct.padStart(9)}  ${statusLabel}`;
    console.log(line);
  }

  console.log(`  ${divider}`);
  if (summary.blockRelease) {
    console.log(`  BLOCKED: ${summary.blockReason}`);
  } else {
    console.log("  All suites healthy.");
  }
  console.log(divider);
}

const isDirectRun = process.argv[1]?.endsWith("suiteHealth.ts");
if (isDirectRun) {
  const summary = computeHealth();
  printHealthTable(summary);
  process.exit(summary.blockRelease ? 1 : 0);
}
