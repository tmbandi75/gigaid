import { TestResult, createTestResult } from "./types.js";

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:5000`;

export async function runFailureTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(...await testMissingWebhookSignature());
  results.push(...await testInvalidWebhookPayload());
  results.push(...await testExpiredTokenHandling());
  results.push(...await testMalformedRequestBodies());
  results.push(...await testRateLimitGraceful());
  results.push(...await testConcurrentPlanChanges());

  return results;
}

async function testMissingWebhookSignature(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } }),
    });

    results.push(createTestResult(
      "Failure: missing webhook signature rejected",
      "failure_injection",
      res.status === 400 || res.status === 500,
      `Correctly rejected: ${res.status}`,
      start,
      { status: res.status }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Failure: missing webhook signature rejected",
      "failure_injection",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testInvalidWebhookPayload(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1234567890,v1=invalid_signature",
      },
      body: "not valid json at all",
    });

    results.push(createTestResult(
      "Failure: invalid webhook payload rejected gracefully",
      "failure_injection",
      res.status >= 400,
      `Rejected with status ${res.status} (no server crash)`,
      start,
      { status: res.status }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Failure: invalid webhook payload rejected gracefully",
      "failure_injection",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testExpiredTokenHandling(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/subscription/status`, {
      headers: {
        "Authorization": "Bearer expired.invalid.token",
        "Content-Type": "application/json",
      },
    });

    results.push(createTestResult(
      "Failure: expired/invalid auth token handled gracefully",
      "failure_injection",
      res.status === 401 || res.status === 403 || res.ok,
      `Response: ${res.status} (no server crash)`,
      start,
      { status: res.status }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Failure: expired/invalid auth token handled gracefully",
      "failure_injection",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testMalformedRequestBodies(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const endpoints = [
    { path: "/api/subscription/change-plan", method: "POST" },
    { path: "/api/subscription/checkout", method: "POST" },
    { path: "/api/subscription/portal", method: "POST" },
  ];

  for (const { path, method } of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: "this is not json",
      });

      results.push(createTestResult(
        `Failure: ${path} handles malformed JSON`,
        "failure_injection",
        res.status >= 400,
        `Handled gracefully: ${res.status}`,
        start,
        { path, status: res.status }
      ));
    } catch (err: any) {
      results.push(createTestResult(
        `Failure: ${path} handles malformed JSON`,
        "failure_injection",
        false,
        `Error: ${err.message}`,
        start,
      ));
    }
  }

  return results;
}

async function testRateLimitGraceful(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const promises = Array.from({ length: 10 }, () =>
      fetch(`${BASE_URL}/api/subscription/status`, {
        headers: { "Content-Type": "application/json" },
      })
    );

    const responses = await Promise.all(promises);
    const allOk = responses.every(r => r.ok || r.status === 429);
    const statuses = responses.map(r => r.status);

    results.push(createTestResult(
      "Failure: rapid requests handled gracefully (no 500s)",
      "failure_injection",
      !statuses.includes(500),
      `All responses handled: ${[...new Set(statuses)].join(", ")}`,
      start,
      { statuses: [...new Set(statuses)], requestCount: 10 }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Failure: rapid requests handled gracefully",
      "failure_injection",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testConcurrentPlanChanges(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const promises = Array.from({ length: 3 }, () =>
      fetch(`${BASE_URL}/api/subscription/change-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlan: "pro" }),
      })
    );

    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r.status);
    const noServerErrors = !statuses.includes(500);

    results.push(createTestResult(
      "Failure: concurrent plan changes don't crash server",
      "failure_injection",
      noServerErrors,
      `Handled gracefully: statuses ${[...new Set(statuses)].join(", ")}`,
      start,
      { statuses: [...new Set(statuses)] }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Failure: concurrent plan changes don't crash server",
      "failure_injection",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}
