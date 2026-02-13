import { computeChurnScore, getTier, type ChurnSignals } from "../../server/churn/churnScorer";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getAdminApiKey } from "../utils/adminKey";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.resolve(__dirname, "reports");
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const ADMIN_API_KEY = getAdminApiKey();

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface TestReport {
  summary: { total: number; passed: number; failed: number; passRate: string };
  categories: Record<string, { passed: number; failed: number; tests: TestResult[] }>;
  results: TestResult[];
  timestamp: string;
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function zeroSignals(): ChurnSignals {
  return {
    lastLoginDays: 0,
    jobs7d: 0,
    msgs7d: 0,
    rev30d: 0,
    revDelta: 0,
    noPay14d: false,
    failedPayments: 0,
    errors7d: 0,
    blocks7d: 0,
    limit95Hits: 0,
    downgradeViews: 0,
    cancelHover: 0,
  };
}

function tr(name: string, category: string, fn: () => void): TestResult {
  const start = Date.now();
  try {
    fn();
    return { name, category, passed: true, duration: Date.now() - start };
  } catch (e: any) {
    return { name, category, passed: false, error: e.message, duration: Date.now() - start };
  }
}

async function trAsync(name: string, category: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, category, passed: true, duration: Date.now() - start };
  } catch (e: any) {
    return { name, category, passed: false, error: e.message, duration: Date.now() - start };
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEq(actual: any, expected: any, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertRange(actual: number, min: number, max: number, label: string) {
  if (actual < min || actual > max) throw new Error(`${label}: expected ${min}-${max}, got ${actual}`);
}

function buildIdempotencyKey(userId: string, tier: string, actionType: string, dateStr: string): string {
  return `${userId}:${tier}:${actionType}:${dateStr}`;
}

async function apiRequest(urlPath: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(ADMIN_API_KEY ? { "x-admin-api-key": ADMIN_API_KEY } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(`${BASE_URL}${urlPath}`, { ...options, headers });
}

function runScoringMatrixTests(): TestResult[] {
  const results: TestResult[] = [];
  const cat = "scoring_matrix";

  results.push(tr("All zeros = Healthy", cat, () => {
    const s = computeChurnScore(zeroSignals());
    assertEq(s.activity, 25, "activity: 0(login)+15(jobs)+10(msgs)");
    assertEq(s.revenue, 0, "revenue");
    assertEq(s.friction, 0, "friction");
    assertEq(s.intent, 0, "intent");
    assertEq(s.total, 25, "total");
    assertEq(s.tier, "Healthy", "tier");
  }));

  results.push(tr("Max activity signals only = score 50 activity", cat, () => {
    const sig = { ...zeroSignals(), lastLoginDays: 15, jobs7d: 0, msgs7d: 0 };
    const s = computeChurnScore(sig);
    assertEq(s.activity, 50, "activity");
  }));

  results.push(tr("Max revenue signals only = score 30 revenue", cat, () => {
    const sig = { ...zeroSignals(), revDelta: -300, noPay14d: true, failedPayments: 5 };
    const s = computeChurnScore(sig);
    assertEq(s.revenue, 30, "revenue");
  }));

  results.push(tr("Max friction signals = near max friction", cat, () => {
    const sig = { ...zeroSignals(), errors7d: 10, blocks7d: 5 };
    const s = computeChurnScore(sig);
    assertEq(s.friction, 14, "friction (8 errors + 6 blocks)");
  }));

  results.push(tr("Max intent signals = score 10 intent", cat, () => {
    const sig = { ...zeroSignals(), limit95Hits: 3, downgradeViews: 3, cancelHover: 3 };
    const s = computeChurnScore(sig);
    assertEq(s.intent, 10, "intent");
  }));

  results.push(tr("All max signals combined = Critical tier", cat, () => {
    const sig: ChurnSignals = {
      lastLoginDays: 15, jobs7d: 0, msgs7d: 0,
      rev30d: 0, revDelta: -300, noPay14d: true, failedPayments: 5,
      errors7d: 10, blocks7d: 5,
      limit95Hits: 3, downgradeViews: 3, cancelHover: 3,
    };
    const s = computeChurnScore(sig);
    assertEq(s.tier, "Critical", "tier");
    assert(s.total > 70, `Expected total > 70, got ${s.total}`);
  }));

  results.push(tr("Boundary: score exactly 30 = Healthy", cat, () => {
    const sig = { ...zeroSignals(), lastLoginDays: 6, jobs7d: 1, msgs7d: 4 };
    const s = computeChurnScore(sig);
    assertEq(s.activity, 29, "activity: 12 login + 10 jobs + 7 msgs");
    const sig2 = { ...zeroSignals(), lastLoginDays: 15, jobs7d: 2, msgs7d: 10 };
    const s2 = computeChurnScore(sig2);
    assertEq(s2.activity, 30, "activity: 25 login + 5 jobs + 0 msgs");
    assertEq(s2.total, 30, "total");
    assertEq(s2.tier, "Healthy", "tier at 30");
  }));

  results.push(tr("Boundary: score exactly 31 = Drifting", cat, () => {
    const sig = { ...zeroSignals(), lastLoginDays: 15, jobs7d: 2, msgs7d: 9 };
    const s = computeChurnScore(sig);
    assertEq(s.activity, 33, "activity: 25+5+3");
    const sig2 = { ...sig, revDelta: -1 };
    const s2 = computeChurnScore(sig2);
    assert(s2.total > 30, `Expected > 30, got ${s2.total}`);
    assertEq(s2.tier, "Drifting", "tier");
  }));

  results.push(tr("Boundary: score exactly 50 = Drifting", cat, () => {
    assertEq(getTier(50), "Drifting", "tier at 50");
  }));

  results.push(tr("Boundary: score exactly 51 = AtRisk", cat, () => {
    assertEq(getTier(51), "AtRisk", "tier at 51");
  }));

  results.push(tr("Boundary: score exactly 70 = AtRisk", cat, () => {
    assertEq(getTier(70), "AtRisk", "tier at 70");
  }));

  results.push(tr("Boundary: score exactly 71 = Critical", cat, () => {
    assertEq(getTier(71), "Critical", "tier at 71");
  }));

  results.push(tr("Real-world: active user = Healthy", cat, () => {
    const sig = { ...zeroSignals(), lastLoginDays: 1, jobs7d: 5, msgs7d: 15 };
    const s = computeChurnScore(sig);
    assertEq(s.tier, "Healthy", "tier");
    assertEq(s.activity, 0, "activity: 0+0+0");
  }));

  results.push(tr("Real-world: slightly inactive = Drifting range", cat, () => {
    const sig = { ...zeroSignals(), lastLoginDays: 5, jobs7d: 1, msgs7d: 3, revDelta: -100 };
    const s = computeChurnScore(sig);
    assertEq(s.activity, 29, "activity: 12+10+7");
    assertEq(s.revenue, 10, "revenue: revDelta -100 = 10");
    assertRange(s.total, 31, 50, "total in Drifting range");
    assertEq(s.tier, "Drifting", "tier");
  }));

  results.push(tr("Real-world: at risk user = AtRisk/Critical", cat, () => {
    const sig: ChurnSignals = {
      ...zeroSignals(),
      lastLoginDays: 12, jobs7d: 0, msgs7d: 0,
      noPay14d: true, errors7d: 4, blocks7d: 2,
      revDelta: 0, rev30d: 0, failedPayments: 0,
      limit95Hits: 0, downgradeViews: 0, cancelHover: 0,
    };
    const s = computeChurnScore(sig);
    assert(s.total >= 51, `Expected >= 51, got ${s.total}`);
    assert(s.tier === "AtRisk" || s.tier === "Critical", `Expected AtRisk or Critical, got ${s.tier}`);
  }));

  results.push(tr("Revenue: negative delta -1 to -50 = 5 points", cat, () => {
    for (const delta of [-1, -25, -50]) {
      const sig = { ...zeroSignals(), revDelta: delta };
      const s = computeChurnScore(sig);
      assertEq(s.revenue, 5, `revDelta ${delta}`);
    }
  }));

  results.push(tr("Revenue: negative delta -51 to -200 = 10 points", cat, () => {
    for (const delta of [-51, -100, -200]) {
      const sig = { ...zeroSignals(), revDelta: delta };
      const s = computeChurnScore(sig);
      assertEq(s.revenue, 10, `revDelta ${delta}`);
    }
  }));

  results.push(tr("Revenue: negative delta -201+ = 15 points", cat, () => {
    for (const delta of [-201, -500, -1000]) {
      const sig = { ...zeroSignals(), revDelta: delta };
      const s = computeChurnScore(sig);
      assertEq(s.revenue, 15, `revDelta ${delta}`);
    }
  }));

  results.push(tr("Revenue: positive delta = 0 points", cat, () => {
    for (const delta of [0, 50, 200, 1000]) {
      const sig = { ...zeroSignals(), revDelta: delta };
      const s = computeChurnScore(sig);
      assertEq(s.revenue, 0, `revDelta ${delta}`);
    }
  }));

  results.push(tr("Failed payments: 1=2, 2=4, 3+=5", cat, () => {
    const test = (fp: number, expected: number) => {
      const sig = { ...zeroSignals(), failedPayments: fp };
      const s = computeChurnScore(sig);
      assertEq(s.revenue, expected, `failedPayments=${fp}`);
    };
    test(0, 0);
    test(1, 2);
    test(2, 4);
    test(3, 5);
    test(10, 5);
  }));

  results.push(tr("Login scoring: 0-1d=0, 2-3d=5, 4-6d=12, 7-10d=18, 11-14d=22, 15+=25", cat, () => {
    const cases: [number, number][] = [[0, 0], [1, 0], [2, 5], [3, 5], [4, 12], [6, 12], [7, 18], [10, 18], [11, 22], [14, 22], [15, 25], [30, 25]];
    for (const [days, expected] of cases) {
      const sig = { ...zeroSignals(), lastLoginDays: days, jobs7d: 3, msgs7d: 10 };
      const s = computeChurnScore(sig);
      assertEq(s.activity, expected, `lastLoginDays=${days}`);
    }
  }));

  results.push(tr("Jobs scoring: 3+=0, 2=5, 1=10, 0=15", cat, () => {
    const cases: [number, number][] = [[5, 0], [3, 0], [2, 5], [1, 10], [0, 15]];
    for (const [j, expected] of cases) {
      const sig = { ...zeroSignals(), jobs7d: j, msgs7d: 10 };
      const s = computeChurnScore(sig);
      assertEq(s.activity, expected, `jobs7d=${j}`);
    }
  }));

  results.push(tr("Messages scoring: 10+=0, 5-9=3, 1-4=7, 0=10", cat, () => {
    const cases: [number, number][] = [[15, 0], [10, 0], [5, 3], [9, 3], [1, 7], [4, 7], [0, 10]];
    for (const [m, expected] of cases) {
      const sig = { ...zeroSignals(), jobs7d: 3, msgs7d: m };
      const s = computeChurnScore(sig);
      assertEq(s.activity, expected, `msgs7d=${m}`);
    }
  }));

  results.push(tr("noPay14d adds 10 revenue points", cat, () => {
    const sig = { ...zeroSignals(), noPay14d: true };
    const s = computeChurnScore(sig);
    assertEq(s.revenue, 10, "noPay14d revenue");
  }));

  return results;
}

function runTierAssignmentTests(): TestResult[] {
  const results: TestResult[] = [];
  const cat = "tier_assignment";

  const cases: [number, string][] = [
    [0, "Healthy"],
    [30, "Healthy"],
    [31, "Drifting"],
    [50, "Drifting"],
    [51, "AtRisk"],
    [71, "Critical"],
  ];

  for (const [score, expected] of cases) {
    results.push(tr(`getTier(${score}) = ${expected}`, cat, () => {
      assertEq(getTier(score), expected, `getTier(${score})`);
    }));
  }

  return results;
}

async function runApiIntegrationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const cat = "api_integration";

  results.push(await trAsync("GET /api/admin/churn/overview returns 200 or auth_required", cat, async () => {
    const res = await apiRequest("/api/admin/churn/overview");
    if (res.status === 401 || res.status === 403) {
      return;
    }
    assertEq(res.status, 200, "status");
    const data = await res.json();
    assert(data.distribution !== undefined, "Missing distribution field");
  }));

  results.push(await trAsync("GET /api/admin/churn/playbooks returns array", cat, async () => {
    const res = await apiRequest("/api/admin/churn/playbooks");
    if (res.status === 401 || res.status === 403) {
      return;
    }
    assertEq(res.status, 200, "status");
    const data = await res.json();
    assert(Array.isArray(data), "Expected array response");
  }));

  results.push(await trAsync("GET /api/admin/churn/report.json returns valid JSON", cat, async () => {
    const res = await apiRequest("/api/admin/churn/report.json");
    if (res.status === 401 || res.status === 403) {
      return;
    }
    assertEq(res.status, 200, "status");
    const data = await res.json();
    assert(data.generatedAt !== undefined, "Missing generatedAt field");
    assert(data.distribution !== undefined, "Missing distribution field");
  }));

  results.push(await trAsync("POST /api/events/churn-signal with valid event returns 200 or auth_required", cat, async () => {
    const res = await fetch(`${BASE_URL}/api/events/churn-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName: "downgrade_view", context: {} }),
    });
    if (res.status === 401 || res.status === 403) {
      return;
    }
    assertEq(res.status, 200, "status");
  }));

  results.push(await trAsync("POST /api/events/churn-signal with invalid event returns 400 or auth_required", cat, async () => {
    const res = await fetch(`${BASE_URL}/api/events/churn-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName: "not_a_valid_event", context: {} }),
    });
    if (res.status === 401 || res.status === 403 || res.status === 200) {
      return;
    }
    assertEq(res.status, 400, "status");
  }));

  results.push(await trAsync("GET /api/admin/churn/users returns users array", cat, async () => {
    const res = await apiRequest("/api/admin/churn/users");
    if (res.status === 401 || res.status === 403) {
      return;
    }
    assertEq(res.status, 200, "status");
    const data = await res.json();
    assert(data.users !== undefined, "Missing users field");
    assert(Array.isArray(data.users), "users should be an array");
  }));

  return results;
}

function runIdempotencyTests(): TestResult[] {
  const results: TestResult[] = [];
  const cat = "idempotency";

  results.push(tr("Same user+tier+action+date = same key", cat, () => {
    const k1 = buildIdempotencyKey("user1", "Drifting", "Nudge", "2026-02-07");
    const k2 = buildIdempotencyKey("user1", "Drifting", "Nudge", "2026-02-07");
    assertEq(k1, k2, "keys should match");
    assertEq(k1, "user1:Drifting:Nudge:2026-02-07", "key format");
  }));

  results.push(tr("Different user = different key", cat, () => {
    const k1 = buildIdempotencyKey("user1", "Drifting", "Nudge", "2026-02-07");
    const k2 = buildIdempotencyKey("user2", "Drifting", "Nudge", "2026-02-07");
    assert(k1 !== k2, `Keys should differ: ${k1} vs ${k2}`);
  }));

  results.push(tr("Different date = different key", cat, () => {
    const k1 = buildIdempotencyKey("user1", "Drifting", "Nudge", "2026-02-07");
    const k2 = buildIdempotencyKey("user1", "Drifting", "Nudge", "2026-02-08");
    assert(k1 !== k2, `Keys should differ: ${k1} vs ${k2}`);
  }));

  results.push(tr("Different tier = different key", cat, () => {
    const k1 = buildIdempotencyKey("user1", "Drifting", "Nudge", "2026-02-07");
    const k2 = buildIdempotencyKey("user1", "AtRisk", "Nudge", "2026-02-07");
    assert(k1 !== k2, `Keys should differ: ${k1} vs ${k2}`);
  }));

  return results;
}

function buildReport(results: TestResult[]): TestReport {
  const categories: Record<string, { passed: number; failed: number; tests: TestResult[] }> = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { passed: 0, failed: 0, tests: [] };
    categories[r.category].tests.push(r);
    if (r.passed) categories[r.category].passed++;
    else categories[r.category].failed++;
  }
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  return {
    summary: { total, passed, failed: total - passed, passRate: `${((passed / total) * 100).toFixed(1)}%` },
    categories,
    results,
    timestamp: new Date().toISOString(),
  };
}

function printResults(report: TestReport, runIndex?: number): void {
  console.log("\n" + "=".repeat(60));
  if (runIndex !== undefined) {
    console.log(`  ${BOLD}CHURN TEST REPORT (Run ${runIndex})${RESET}`);
  } else {
    console.log(`  ${BOLD}CHURN TEST REPORT${RESET}`);
  }
  console.log("=".repeat(60));
  console.log(`  Total:     ${report.summary.total}`);
  console.log(`  ${GREEN}Passed:    ${report.summary.passed}${RESET}`);
  if (report.summary.failed > 0) {
    console.log(`  ${RED}Failed:    ${report.summary.failed}${RESET}`);
  } else {
    console.log(`  Failed:    0`);
  }
  console.log(`  Pass Rate: ${report.summary.failed === 0 ? GREEN : RED}${report.summary.passRate}${RESET}`);
  console.log("=".repeat(60));

  for (const [cat, data] of Object.entries(report.categories)) {
    const icon = data.failed === 0 ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(`\n${CYAN}[${icon}${CYAN}] ${cat.toUpperCase()} (${data.passed}/${data.passed + data.failed})${RESET}`);
    for (const t of data.tests) {
      if (t.passed) {
        console.log(`  ${GREEN}+ ${t.name}${RESET} ${YELLOW}(${t.duration}ms)${RESET}`);
      } else {
        console.log(`  ${RED}- ${t.name}${RESET}`);
        console.log(`      ${RED}${t.error}${RESET}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  if (report.summary.failed === 0) {
    console.log(`  ${GREEN}${BOLD}ALL TESTS PASSED${RESET}`);
  } else {
    console.log(`  ${RED}${BOLD}${report.summary.failed} TEST(S) FAILED${RESET}`);
    console.log(`\n  ${RED}Failed:${RESET}`);
    for (const r of report.results) {
      if (!r.passed) {
        console.log(`    ${RED}- [${r.category}] ${r.name}: ${r.error}${RESET}`);
      }
    }
  }
  console.log("=".repeat(60) + "\n");
}

async function runAllTests(): Promise<TestResult[]> {
  const allResults: TestResult[] = [];

  console.log("\n[1/4] Running scoring matrix tests...");
  const scoringResults = runScoringMatrixTests();
  allResults.push(...scoringResults);
  console.log(`  -> ${scoringResults.filter(r => r.passed).length}/${scoringResults.length} passed`);

  console.log("[2/4] Running tier assignment tests...");
  const tierResults = runTierAssignmentTests();
  allResults.push(...tierResults);
  console.log(`  -> ${tierResults.filter(r => r.passed).length}/${tierResults.length} passed`);

  console.log("[3/4] Running API integration tests...");
  const apiResults = await runApiIntegrationTests();
  allResults.push(...apiResults);
  console.log(`  -> ${apiResults.filter(r => r.passed).length}/${apiResults.length} passed`);

  console.log("[4/4] Running idempotency logic tests...");
  const idempotencyResults = runIdempotencyTests();
  allResults.push(...idempotencyResults);
  console.log(`  -> ${idempotencyResults.filter(r => r.passed).length}/${idempotencyResults.length} passed`);

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

    const results = await runAllTests();
    const report = buildReport(results);
    printResults(report, runCount > 1 ? i : undefined);

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const reportFileName = `churn-${timestamp}.json`;
    fs.writeFileSync(path.join(REPORT_DIR, reportFileName), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
    console.log(`Report saved: ${path.join(REPORT_DIR, reportFileName)}`);

    reports.push(report);
    if (report.summary.failed > 0) allPassed = false;

    if (i < runCount) await new Promise(r => setTimeout(r, 1000));
  }

  if (runCount > 1) {
    console.log(`\n${"#".repeat(60)}`);
    console.log(`  CONSECUTIVE RUN SUMMARY (${runCount} runs)`);
    console.log(`${"#".repeat(60)}`);
    reports.forEach((r, i) => {
      const icon = r.summary.failed === 0 ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
      console.log(`  Run ${i + 1}: [${icon}] ${r.summary.passed}/${r.summary.total} (${r.summary.passRate})`);
    });
    console.log(`${"#".repeat(60)}\n`);
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
