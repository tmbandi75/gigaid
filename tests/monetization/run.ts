import { canPerform, getLimit } from "../../shared/capabilities/canPerform";
import { checkUsage } from "../../shared/capabilities/usageTracking";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getAdminApiKey } from "../utils/adminKey";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.resolve(__dirname, "reports");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const ADMIN_API_KEY = getAdminApiKey();

const THRESHOLDS = { info: 0.60, warn: 0.80, critical: 0.95 };

interface TestResultItem {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  details?: any;
  duration_ms: number;
  timestamp: string;
}

interface TestReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  duration_ms: number;
  summary: { total: number; passed: number; failed: number; passRate: string };
  categories: Record<string, { passed: number; failed: number; tests: TestResultItem[] }>;
  fixesApplied: string[];
  stripeIds: string[];
}

function getThresholdLevel(percent: number): string | null {
  if (percent >= THRESHOLDS.critical * 100) return "critical";
  if (percent >= THRESHOLDS.warn * 100) return "warn";
  if (percent >= THRESHOLDS.info * 100) return "info";
  return null;
}

function tr(name: string, category: string, passed: boolean, message: string, startTime: number, details?: any): TestResultItem {
  return { name, category, passed, message, details, duration_ms: Date.now() - startTime, timestamp: new Date().toISOString() };
}

async function apiRequest(urlPath: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(ADMIN_API_KEY ? { "x-admin-api-key": ADMIN_API_KEY } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(`${BASE_URL}${urlPath}`, { ...options, headers });
}

function runLimitTests(): TestResultItem[] {
  const results: TestResultItem[] = [];

  let s = Date.now();
  let r = canPerform("free", "jobs.create", 0);
  results.push(tr("canPerform: Free zero usage allows jobs.create", "limits", r.allowed === true, r.allowed ? "Allowed" : `Blocked: ${r.reason}`, s));

  s = Date.now();
  r = canPerform("free", "jobs.create", 10);
  results.push(tr("canPerform: Free at limit blocks jobs.create", "limits", r.allowed === false && r.limitReached === true, r.allowed ? "Unexpectedly allowed" : `Blocked: ${r.reason}`, s));

  s = Date.now();
  r = canPerform("free", "jobs.create", 15);
  results.push(tr("canPerform: Free over limit blocks jobs.create", "limits", r.allowed === false, r.allowed ? "Unexpectedly allowed" : `Blocked: ${r.reason}`, s));

  const limitedCaps: [string, number][] = [
    ["jobs.create", 10], ["deposit.enforce", 1], ["price.confirmation", 3],
    ["sms.two_way", 20], ["sms.auto_followups", 1], ["offline.photos", 3],
  ];
  for (const [cap, expected] of limitedCaps) {
    s = Date.now();
    const lim = getLimit("free", cap as any);
    results.push(tr(`Free limit: ${cap} = ${expected}`, "limits", lim === expected, lim === expected ? `Correct: ${expected}` : `Expected ${expected}, got ${lim}`, s));
  }

  const unlimitedCaps = ["invoices.send", "leads.manage", "clients.manage", "booking.link", "ai.micro_nudges", "ai.priority_signals", "offline.capture", "drive.mode"];
  for (const cap of unlimitedCaps) {
    s = Date.now();
    const lim = getLimit("free", cap as any);
    results.push(tr(`Free unlimited: ${cap}`, "limits", lim === undefined, lim === undefined ? "Unlimited" : `Unexpected limit: ${lim}`, s));
  }

  s = Date.now();
  results.push(tr("Pro: jobs.create unlimited", "limits", getLimit("pro", "jobs.create") === undefined, getLimit("pro", "jobs.create") === undefined ? "Unlimited" : "Has limit", s));

  s = Date.now();
  const crewResult = canPerform("pro", "crew.manage", 0);
  results.push(tr("Pro: crew.manage blocked (business only)", "limits", crewResult.allowed === false, crewResult.allowed ? "Unexpectedly allowed" : `Blocked: ${crewResult.reason}`, s));

  const businessCaps = ["jobs.create", "crew.manage", "admin.controls", "deposit.enforce", "analytics.advanced"];
  for (const cap of businessCaps) {
    s = Date.now();
    const br = canPerform("business", cap as any, 999);
    results.push(tr(`Business: ${cap} allowed at high usage`, "limits", br.allowed === true, br.allowed ? "Allowed" : `Blocked: ${br.reason}`, s));
  }

  return results;
}

function runThresholdTests(): TestResultItem[] {
  const results: TestResultItem[] = [];
  const limit = 10;
  const cases: [number, string | null, string][] = [
    [5, null, "Below 60% (50%) no banner"],
    [6, "info", "At 60% info banner"],
    [7, "info", "At 70% info banner"],
    [8, "warn", "At 80% warn banner"],
    [9, "warn", "At 90% warn banner"],
    [10, "critical", "At 100% critical modal"],
  ];

  for (const [usage, expected, desc] of cases) {
    const s = Date.now();
    const pct = ((usage as number) / limit) * 100;
    const level = getThresholdLevel(pct);
    results.push(tr(`Threshold: ${desc}`, "thresholds", level === expected, level === expected ? `Correct: ${level || "none"}` : `Expected ${expected || "none"}, got ${level || "none"}`, s, { usage, limit, pct }));
  }

  return results;
}

function runEscalationTests(): TestResultItem[] {
  const results: TestResultItem[] = [];
  const limit = getLimit("free", "jobs.create") || 10;

  for (let usage = 0; usage <= limit + 1; usage++) {
    const s = Date.now();
    const check = checkUsage("free", "jobs.create", usage);
    if (usage < limit) {
      results.push(tr(`Escalation: ${usage}/${limit} allowed`, "escalation", check.allowed === true, check.allowed ? `Allowed at ${usage}/${limit}` : `Blocked: ${check.reason}`, s));
    } else {
      results.push(tr(`Escalation: ${usage}/${limit} blocked`, "escalation", check.allowed === false, check.allowed ? `Unexpectedly allowed at ${usage}/${limit}` : `Blocked at ${usage}/${limit}`, s));
    }
  }

  return results;
}

function runModeTests(): TestResultItem[] {
  const results: TestResultItem[] = [];
  const cases: [string, string, string][] = [
    ["free", "booking.risk_protection", "read_only"],
    ["free", "ai.money_plan", "read_only"],
    ["free", "ai.campaign_suggestions", "read_only"],
    ["free", "notifications.event_driven", "suggest_only"],
  ];

  for (const [plan, cap, mode] of cases) {
    const s = Date.now();
    const r = canPerform(plan as any, cap as any, 0);
    results.push(tr(`Mode: ${plan}/${cap} = ${mode}`, "limits", r.allowed === false, r.allowed ? `Unexpectedly allowed (expected ${mode})` : `Blocked: ${r.reason}`, s));
  }

  return results;
}

async function runApiTests(): Promise<TestResultItem[]> {
  const results: TestResultItem[] = [];

  {
    const s = Date.now();
    try {
      const res = await apiRequest("/api/test/create-user", { method: "POST", body: JSON.stringify({ id: "smoke-test-light", name: "Smoke Light", email: "smoke-light@test.gigaid.ai", plan: "free" }) });
      const data = await res.json();
      results.push(tr("Test API: create user", "api", res.ok, res.ok ? `User created: ${data.action}` : `Failed: ${res.status}`, s, data));
    } catch (e: any) { results.push(tr("Test API: create user", "api", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const res = await apiRequest("/api/test/set-plan", { method: "POST", body: JSON.stringify({ userId: "smoke-test-light", plan: "pro" }) });
      const data = await res.json();
      results.push(tr("Test API: set plan to pro", "api", res.ok, res.ok ? `Plan set: ${data.plan}` : `Failed: ${res.status}`, s, data));
    } catch (e: any) { results.push(tr("Test API: set plan", "api", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const res = await apiRequest("/api/test/set-plan", { method: "POST", body: JSON.stringify({ userId: "smoke-test-light", plan: "free" }) });
      results.push(tr("Test API: restore plan to free", "api", res.ok, res.ok ? "Restored" : `Failed: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Test API: restore plan", "api", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const res = await apiRequest("/api/test/set-plan", { method: "POST", body: JSON.stringify({ userId: "smoke-test-light", plan: "invalid" }) });
      results.push(tr("Test API: reject invalid plan", "api", res.status === 400, res.status === 400 ? "Correctly rejected" : `Unexpected: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Test API: reject invalid plan", "api", false, `Error: ${e.message}`, s)); }
  }

  return results;
}

async function runStripeTests(): Promise<TestResultItem[]> {
  const results: TestResultItem[] = [];

  {
    const s = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      results.push(tr("Stripe: webhook rejects unsigned", "stripe", res.status === 400 || res.status === 500, `Rejected: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Stripe: webhook rejects unsigned", "stripe", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const res = await apiRequest("/api/stripe/connect/status");
      const data = await res.json();
      results.push(tr("Stripe: Connect status endpoint", "stripe", res.ok || res.status === 401, res.ok ? `Connected: ${data.connected}` : `Auth required: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Stripe: Connect status", "stripe", false, `Error: ${e.message}`, s)); }
  }

  return results;
}

async function runFailureTests(): Promise<TestResultItem[]> {
  const results: TestResultItem[] = [];

  {
    const s = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } }) });
      results.push(tr("Failure: missing webhook sig rejected", "failure", res.status >= 400, `Rejected: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Failure: missing webhook sig", "failure", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "t=1234567890,v1=fake" }, body: "not valid" });
      results.push(tr("Failure: invalid payload rejected", "failure", res.status >= 400, `Rejected: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Failure: invalid payload", "failure", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/api/subscription/status`, { headers: { "Authorization": "Bearer expired.invalid.token" } });
      results.push(tr("Failure: expired token handled", "failure", res.status === 401 || res.status === 403, `Handled: ${res.status}`, s));
    } catch (e: any) { results.push(tr("Failure: expired token", "failure", false, `Error: ${e.message}`, s)); }
  }

  const malformedEndpoints = ["/api/subscription/change-plan", "/api/subscription/checkout"];
  for (const ep of malformedEndpoints) {
    const s = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${ep}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" });
      results.push(tr(`Failure: ${ep} malformed JSON`, "failure", res.status >= 400, `Handled: ${res.status}`, s));
    } catch (e: any) { results.push(tr(`Failure: ${ep} malformed`, "failure", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const promises = Array.from({ length: 10 }, () => fetch(`${BASE_URL}/api/subscription/status`));
      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);
      results.push(tr("Failure: rapid requests no 500s", "failure", !statuses.includes(500), `Statuses: ${[...new Set(statuses)].join(",")}`, s));
    } catch (e: any) { results.push(tr("Failure: rapid requests", "failure", false, `Error: ${e.message}`, s)); }
  }

  {
    const s = Date.now();
    try {
      const promises = Array.from({ length: 3 }, () => fetch(`${BASE_URL}/api/subscription/change-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPlan: "pro" }) }));
      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);
      results.push(tr("Failure: concurrent plan changes no crash", "failure", !statuses.includes(500), `Statuses: ${[...new Set(statuses)].join(",")}`, s));
    } catch (e: any) { results.push(tr("Failure: concurrent changes", "failure", false, `Error: ${e.message}`, s)); }
  }

  return results;
}

function buildReport(runId: string, startedAt: string, results: TestResultItem[]): TestReport {
  const categories: Record<string, { passed: number; failed: number; tests: TestResultItem[] }> = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { passed: 0, failed: 0, tests: [] };
    categories[r.category].tests.push(r);
    if (r.passed) categories[r.category].passed++;
    else categories[r.category].failed++;
  }
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  return {
    runId, startedAt, completedAt: new Date().toISOString(),
    duration_ms: Date.now() - new Date(startedAt).getTime(),
    summary: { total, passed, failed: total - passed, passRate: `${((passed / total) * 100).toFixed(1)}%` },
    categories, fixesApplied: [], stripeIds: [],
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

  for (const [cat, data] of Object.entries(report.categories)) {
    const icon = data.failed === 0 ? "PASS" : "FAIL";
    console.log(`\n[${icon}] ${cat.toUpperCase()} (${data.passed}/${data.passed + data.failed})`);
    for (const t of data.tests) {
      console.log(`  ${t.passed ? "+" : "-"} ${t.name}`);
      if (!t.passed) console.log(`      ${t.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (report.summary.failed === 0) {
    console.log("  ALL TESTS PASSED");
  } else {
    console.log(`  ${report.summary.failed} TEST(S) FAILED`);
    console.log("\n  Failed:");
    for (const [cat, data] of Object.entries(report.categories)) {
      for (const t of data.tests) {
        if (!t.passed) console.log(`    - [${cat}] ${t.name}: ${t.message}`);
      }
    }
  }
  console.log("=".repeat(60) + "\n");
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

    const runId = `smoke-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
    const startedAt = new Date().toISOString();
    const allResults: TestResultItem[] = [];

    console.log("\n[1/7] Running capability limit tests...");
    const limitResults = runLimitTests();
    allResults.push(...limitResults);
    console.log(`  -> ${limitResults.filter(r => r.passed).length}/${limitResults.length} passed`);

    console.log("[2/7] Running threshold tests...");
    const thresholdResults = runThresholdTests();
    allResults.push(...thresholdResults);
    console.log(`  -> ${thresholdResults.filter(r => r.passed).length}/${thresholdResults.length} passed`);

    console.log("[3/7] Running escalation tests...");
    const escalationResults = runEscalationTests();
    allResults.push(...escalationResults);
    console.log(`  -> ${escalationResults.filter(r => r.passed).length}/${escalationResults.length} passed`);

    console.log("[4/7] Running mode restriction tests...");
    const modeResults = runModeTests();
    allResults.push(...modeResults);
    console.log(`  -> ${modeResults.filter(r => r.passed).length}/${modeResults.length} passed`);

    console.log("[5/7] Running API tests...");
    const apiResults = await runApiTests();
    allResults.push(...apiResults);
    console.log(`  -> ${apiResults.filter(r => r.passed).length}/${apiResults.length} passed`);

    console.log("[6/7] Running Stripe integration tests...");
    const stripeResults = await runStripeTests();
    allResults.push(...stripeResults);
    console.log(`  -> ${stripeResults.filter(r => r.passed).length}/${stripeResults.length} passed`);

    console.log("[7/7] Running failure injection tests...");
    const failureResults = await runFailureTests();
    allResults.push(...failureResults);
    console.log(`  -> ${failureResults.filter(r => r.passed).length}/${failureResults.length} passed`);

    const report = buildReport(runId, startedAt, allResults);
    printResults(report);

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, `${runId}.json`), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
    console.log(`Report saved: ${path.join(REPORT_DIR, `${runId}.json`)}`);

    reports.push(report);
    if (report.summary.failed > 0) allPassed = false;

    if (i < runCount) await new Promise(r => setTimeout(r, 1000));
  }

  if (runCount > 1) {
    console.log(`\n${"#".repeat(60)}`);
    console.log(`  CONSECUTIVE RUN SUMMARY (${runCount} runs)`);
    console.log(`${"#".repeat(60)}`);
    reports.forEach((r, i) => {
      const icon = r.summary.failed === 0 ? "PASS" : "FAIL";
      console.log(`  Run ${i + 1}: [${icon}] ${r.summary.passed}/${r.summary.total} (${r.summary.passRate})`);
    });
    console.log(`${"#".repeat(60)}\n`);
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
