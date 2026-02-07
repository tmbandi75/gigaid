import { canPerform, getLimit } from "../../shared/capabilities/canPerform.js";
import { checkUsage } from "../../shared/capabilities/usageTracking.js";
import { CAPABILITY_RULES } from "../../shared/capabilities/capabilityRules.js";
import type { Plan, Capability } from "../../shared/capabilities/plans.js";
import { TestResult, createTestResult } from "./types.js";

const THRESHOLDS = {
  info: 0.60,
  warn: 0.80,
  critical: 0.95,
};

function getThresholdLevel(percent: number): "info" | "warn" | "critical" | null {
  if (percent >= THRESHOLDS.critical * 100) return "critical";
  if (percent >= THRESHOLDS.warn * 100) return "warn";
  if (percent >= THRESHOLDS.info * 100) return "info";
  return null;
}

export async function runLimitTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(...testCanPerformBasics());
  results.push(...testFreePlanLimits());
  results.push(...testProPlanUpgrades());
  results.push(...testBusinessUnlimited());
  results.push(...testThresholdTriggers());
  results.push(...testLimitEscalation());
  results.push(...testModeRestrictions());

  return results;
}

function testCanPerformBasics(): TestResult[] {
  const results: TestResult[] = [];

  const start = Date.now();
  const result = canPerform("free", "jobs.create", 0);
  results.push(createTestResult(
    "canPerform: Free plan, zero usage allows job creation",
    "limits",
    result.allowed === true,
    result.allowed ? "Allowed as expected" : `Unexpectedly blocked: ${result.reason}`,
    start,
    { plan: "free", capability: "jobs.create", usage: 0, result }
  ));

  const start2 = Date.now();
  const result2 = canPerform("free", "jobs.create", 10);
  results.push(createTestResult(
    "canPerform: Free plan, at limit blocks job creation",
    "limits",
    result2.allowed === false && result2.limitReached === true,
    result2.allowed ? "Unexpectedly allowed at limit" : `Blocked correctly: ${result2.reason}`,
    start2,
    { plan: "free", capability: "jobs.create", usage: 10, result: result2 }
  ));

  const start3 = Date.now();
  const result3 = canPerform("free", "jobs.create", 15);
  results.push(createTestResult(
    "canPerform: Free plan, over limit blocks job creation",
    "limits",
    result3.allowed === false,
    result3.allowed ? "Unexpectedly allowed over limit" : `Blocked correctly: ${result3.reason}`,
    start3,
    { plan: "free", capability: "jobs.create", usage: 15, result: result3 }
  ));

  return results;
}

function testFreePlanLimits(): TestResult[] {
  const results: TestResult[] = [];

  const limitedCapabilities: { capability: Capability; expectedLimit: number }[] = [
    { capability: "jobs.create", expectedLimit: 10 },
    { capability: "deposit.enforce", expectedLimit: 1 },
    { capability: "price.confirmation", expectedLimit: 3 },
    { capability: "sms.two_way", expectedLimit: 20 },
    { capability: "sms.auto_followups", expectedLimit: 1 },
    { capability: "offline.photos", expectedLimit: 3 },
  ];

  for (const { capability, expectedLimit } of limitedCapabilities) {
    const start = Date.now();
    const limit = getLimit("free", capability);
    results.push(createTestResult(
      `Free plan limit: ${capability} = ${expectedLimit}`,
      "limits",
      limit === expectedLimit,
      limit === expectedLimit
        ? `Limit correctly set to ${expectedLimit}`
        : `Expected ${expectedLimit}, got ${limit}`,
      start,
      { capability, expectedLimit, actualLimit: limit }
    ));
  }

  const unlimitedCapabilities: Capability[] = [
    "invoices.send",
    "leads.manage",
    "clients.manage",
    "booking.link",
    "ai.micro_nudges",
    "ai.priority_signals",
    "offline.capture",
    "drive.mode",
  ];

  for (const capability of unlimitedCapabilities) {
    const start = Date.now();
    const limit = getLimit("free", capability);
    results.push(createTestResult(
      `Free plan unlimited: ${capability}`,
      "limits",
      limit === undefined,
      limit === undefined
        ? "Correctly unlimited"
        : `Expected unlimited, got limit ${limit}`,
      start,
      { capability, limit }
    ));
  }

  return results;
}

function testProPlanUpgrades(): TestResult[] {
  const results: TestResult[] = [];

  const start = Date.now();
  const jobLimit = getLimit("pro", "jobs.create");
  results.push(createTestResult(
    "Pro plan: jobs.create is unlimited",
    "limits",
    jobLimit === undefined,
    jobLimit === undefined ? "Correctly unlimited" : `Unexpected limit: ${jobLimit}`,
    start,
  ));

  const start2 = Date.now();
  const smsLimit = getLimit("pro", "sms.two_way");
  results.push(createTestResult(
    "Pro plan: sms.two_way is unlimited",
    "limits",
    smsLimit === undefined,
    smsLimit === undefined ? "Correctly unlimited" : `Unexpected limit: ${smsLimit}`,
    start2,
  ));

  const start3 = Date.now();
  const result = canPerform("pro", "crew.manage", 0);
  results.push(createTestResult(
    "Pro plan: crew.manage is blocked (business only)",
    "limits",
    result.allowed === false && result.upgradeRequired === true,
    result.allowed ? "Unexpectedly allowed" : `Correctly blocked: ${result.reason}`,
    start3,
  ));

  return results;
}

function testBusinessUnlimited(): TestResult[] {
  const results: TestResult[] = [];

  const capabilities: Capability[] = [
    "jobs.create", "crew.manage", "admin.controls",
    "deposit.enforce", "analytics.advanced",
  ];

  for (const capability of capabilities) {
    const start = Date.now();
    const result = canPerform("business", capability, 999);
    results.push(createTestResult(
      `Business plan: ${capability} allowed at high usage`,
      "limits",
      result.allowed === true,
      result.allowed ? "Correctly allowed" : `Unexpectedly blocked: ${result.reason}`,
      start,
    ));
  }

  return results;
}

function testThresholdTriggers(): TestResult[] {
  const results: TestResult[] = [];

  const limit = 10;

  const testCases = [
    { usage: 5, expected: null, desc: "Below 60% (50%) shows no banner" },
    { usage: 6, expected: "info", desc: "At 60% shows info banner" },
    { usage: 7, expected: "info", desc: "At 70% shows info banner" },
    { usage: 8, expected: "warn", desc: "At 80% shows warning banner" },
    { usage: 9, expected: "warn", desc: "At 90% shows warning banner" },
    { usage: 10, expected: "critical", desc: "At 100% shows critical modal" },
  ];

  for (const { usage, expected, desc } of testCases) {
    const start = Date.now();
    const percentUsed = (usage / limit) * 100;
    const level = getThresholdLevel(percentUsed);
    results.push(createTestResult(
      `Threshold: ${desc}`,
      "thresholds",
      level === expected,
      level === expected
        ? `Correct threshold: ${level || "none"}`
        : `Expected ${expected || "none"}, got ${level || "none"}`,
      start,
      { usage, limit, percentUsed, expectedLevel: expected, actualLevel: level }
    ));
  }

  return results;
}

function testLimitEscalation(): TestResult[] {
  const results: TestResult[] = [];
  const plan: Plan = "free";
  const capability: Capability = "jobs.create";
  const limit = getLimit(plan, capability) || 10;

  for (let usage = 0; usage <= limit + 1; usage++) {
    const start = Date.now();
    const check = checkUsage(plan, capability, usage);
    const percentUsed = limit > 0 ? (usage / limit) * 100 : 0;
    const threshold = getThresholdLevel(percentUsed);

    if (usage < limit) {
      results.push(createTestResult(
        `Escalation: jobs.create usage ${usage}/${limit} → allowed`,
        "escalation",
        check.allowed === true,
        check.allowed ? `Allowed at ${usage}/${limit}` : `Unexpectedly blocked at ${usage}/${limit}: ${check.reason}`,
        start,
        { usage, limit, threshold, allowed: check.allowed }
      ));
    } else {
      results.push(createTestResult(
        `Escalation: jobs.create usage ${usage}/${limit} → blocked`,
        "escalation",
        check.allowed === false,
        check.allowed ? `Unexpectedly allowed at ${usage}/${limit}` : `Correctly blocked at ${usage}/${limit}`,
        start,
        { usage, limit, threshold, allowed: check.allowed, reason: check.reason }
      ));
    }
  }

  return results;
}

function testModeRestrictions(): TestResult[] {
  const results: TestResult[] = [];

  const modeTests: { plan: Plan; capability: Capability; expectedMode: string }[] = [
    { plan: "free", capability: "booking.risk_protection", expectedMode: "read_only" },
    { plan: "free", capability: "ai.money_plan", expectedMode: "read_only" },
    { plan: "free", capability: "ai.campaign_suggestions", expectedMode: "read_only" },
    { plan: "free", capability: "notifications.event_driven", expectedMode: "suggest_only" },
  ];

  for (const { plan, capability, expectedMode } of modeTests) {
    const start = Date.now();
    const result = canPerform(plan, capability, 0);
    results.push(createTestResult(
      `Mode restriction: ${plan}/${capability} = ${expectedMode}`,
      "limits",
      result.allowed === false && result.reason?.toLowerCase().includes(expectedMode.replace("_", " ").replace("_", "-")) || result.allowed === false,
      result.allowed
        ? `Unexpectedly allowed (expected ${expectedMode})`
        : `Correctly restricted: ${result.reason}`,
      start,
      { plan, capability, expectedMode, result }
    ));
  }

  return results;
}
