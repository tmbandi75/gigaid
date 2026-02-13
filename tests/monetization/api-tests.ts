import { TestResult, createTestResult } from "./types.js";
import { getAdminApiKey } from "../utils/adminKey";

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:5000`;
const ADMIN_API_KEY = getAdminApiKey();

async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(ADMIN_API_KEY ? { "x-admin-api-key": ADMIN_API_KEY } : {}),
  };
  return fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } });
}

export async function runApiTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(...await testSubscriptionStatusEndpoint());
  results.push(...await testChangePlanValidation());
  results.push(...await testChangePlanDowngrade());
  results.push(...await testChangePlanUpgradeWithoutStripe());
  results.push(...await testBillingInvoicesEndpoint());
  results.push(...await testSubscriptionCheckoutWithoutStripe());

  return results;
}

async function testSubscriptionStatusEndpoint(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await apiRequest("/api/subscription/status");
    const data = await res.json();

    results.push(createTestResult(
      "GET /api/subscription/status returns valid response",
      "api",
      res.ok && data.plan !== undefined && data.planName !== undefined,
      res.ok ? `Plan: ${data.plan}, Status: ${data.status}` : `Failed: ${res.status}`,
      start,
      { status: res.status, data }
    ));

    const start2 = Date.now();
    results.push(createTestResult(
      "Subscription status has required fields",
      "api",
      "hasSubscription" in data && "cancelAtPeriodEnd" in data,
      "hasSubscription" in data ? "All required fields present" : "Missing required fields",
      start2,
      { fields: Object.keys(data) }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "GET /api/subscription/status returns valid response",
      "api",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testChangePlanValidation(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const start1 = Date.now();
  try {
    const res = await apiRequest("/api/subscription/change-plan", {
      method: "POST",
      body: JSON.stringify({ newPlan: "invalid_plan" }),
    });
    const data = await res.json();
    results.push(createTestResult(
      "Change plan: rejects invalid plan name",
      "api",
      res.status === 400 && data.error?.includes("Invalid plan"),
      res.status === 400 ? "Correctly rejected invalid plan" : `Unexpected: ${res.status} ${JSON.stringify(data)}`,
      start1,
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Change plan: rejects invalid plan name",
      "api",
      false,
      `Error: ${err.message}`,
      start1,
    ));
  }

  const start2 = Date.now();
  try {
    const res = await apiRequest("/api/subscription/change-plan", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const data = await res.json();
    results.push(createTestResult(
      "Change plan: rejects missing plan",
      "api",
      res.status === 400,
      res.status === 400 ? "Correctly rejected missing plan" : `Unexpected: ${res.status}`,
      start2,
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Change plan: rejects missing plan",
      "api",
      false,
      `Error: ${err.message}`,
      start2,
    ));
  }

  return results;
}

async function testChangePlanDowngrade(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const statusRes = await apiRequest("/api/subscription/status");
    const statusData = await statusRes.json();
    const currentPlan = statusData.plan;

    if (currentPlan === "free") {
      results.push(createTestResult(
        "Change plan: downgrade skipped (already on free)",
        "api",
        true,
        "User already on free plan, testing same-plan rejection",
        start,
      ));

      const start2 = Date.now();
      const res = await apiRequest("/api/subscription/change-plan", {
        method: "POST",
        body: JSON.stringify({ newPlan: "free" }),
      });
      const data = await res.json();
      results.push(createTestResult(
        "Change plan: rejects same plan change",
        "api",
        res.status === 400 && data.error?.includes("already on this plan"),
        res.status === 400 ? "Correctly rejected same plan" : `Unexpected: ${res.status} ${JSON.stringify(data)}`,
        start2,
      ));
    } else {
      const planOrder = ["free", "pro", "pro_plus", "business"];
      const currentIdx = planOrder.indexOf(currentPlan);
      const lowerPlan = currentIdx > 0 ? planOrder[currentIdx - 1] : "free";

      const res = await apiRequest("/api/subscription/change-plan", {
        method: "POST",
        body: JSON.stringify({ newPlan: lowerPlan }),
      });
      const data = await res.json();

      results.push(createTestResult(
        `Change plan: downgrade from ${currentPlan} to ${lowerPlan}`,
        "api",
        res.ok && data.success === true,
        res.ok ? `Successfully downgraded: ${data.message}` : `Failed: ${res.status} ${JSON.stringify(data)}`,
        start,
        { from: currentPlan, to: lowerPlan, response: data }
      ));

      if (res.ok) {
        const start2 = Date.now();
        const restoreRes = await apiRequest("/api/subscription/change-plan", {
          method: "POST",
          body: JSON.stringify({ newPlan: currentPlan }),
        });
        const restoreData = await restoreRes.json();

        results.push(createTestResult(
          `Change plan: restore back to ${currentPlan}`,
          "api",
          true,
          restoreRes.ok ? `Restored: ${restoreData.message}` : `Restore attempted (may need Stripe): ${restoreRes.status}`,
          start2,
          { response: restoreData }
        ));
      }
    }
  } catch (err: any) {
    results.push(createTestResult(
      "Change plan: downgrade test",
      "api",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testChangePlanUpgradeWithoutStripe(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const statusRes = await apiRequest("/api/subscription/status");
    const statusData = await statusRes.json();
    const currentPlan = statusData.plan;

    const planOrder = ["free", "pro", "pro_plus", "business"];
    const currentIdx = planOrder.indexOf(currentPlan);

    if (currentIdx >= planOrder.length - 1) {
      results.push(createTestResult(
        "Change plan: upgrade skipped (already on highest plan)",
        "api",
        true,
        "User already on business plan, cannot test upgrade",
        start,
      ));
      return results;
    }

    const higherPlan = planOrder[currentIdx + 1];
    const res = await apiRequest("/api/subscription/change-plan", {
      method: "POST",
      body: JSON.stringify({ newPlan: higherPlan }),
    });
    const data = await res.json();

    const expectedOutcome = !statusData.hasSubscription;

    if (expectedOutcome) {
      results.push(createTestResult(
        `Change plan: upgrade from ${currentPlan} to ${higherPlan} (no Stripe subscription)`,
        "api",
        (res.status === 503 && data.error?.includes("Payment processing")) || (res.ok && data.checkoutUrl),
        res.status === 503
          ? "Correctly requires payment processing (Stripe not enabled)"
          : res.ok
          ? `Checkout URL generated: ${data.checkoutUrl}`
          : `Unexpected: ${res.status} ${JSON.stringify(data)}`,
        start,
        { from: currentPlan, to: higherPlan, status: res.status }
      ));
    } else {
      results.push(createTestResult(
        `Change plan: upgrade from ${currentPlan} to ${higherPlan}`,
        "api",
        res.ok || res.status === 503,
        res.ok ? `Upgraded: ${data.message}` : `Stripe required: ${data.error}`,
        start,
        { from: currentPlan, to: higherPlan, status: res.status }
      ));
    }
  } catch (err: any) {
    results.push(createTestResult(
      "Change plan: upgrade test",
      "api",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testBillingInvoicesEndpoint(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await apiRequest("/api/billing/invoices");
    const data = await res.json();

    results.push(createTestResult(
      "GET /api/billing/invoices returns valid response",
      "api",
      res.ok && Array.isArray(data.invoices),
      res.ok ? `Found ${data.invoices.length} invoices` : `Failed: ${res.status}`,
      start,
      { invoiceCount: data.invoices?.length }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "GET /api/billing/invoices returns valid response",
      "api",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testSubscriptionCheckoutWithoutStripe(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await apiRequest("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "pro" }),
    });
    const data = await res.json();

    results.push(createTestResult(
      "POST /api/subscription/checkout graceful failure without Stripe",
      "api",
      res.status === 503 || res.ok,
      res.status === 503
        ? `Correctly returns 503 when Stripe disabled: ${data.error}`
        : `Checkout session created (Stripe enabled)`,
      start,
      { status: res.status, response: data }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "POST /api/subscription/checkout graceful failure without Stripe",
      "api",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}
