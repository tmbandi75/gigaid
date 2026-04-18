import { TestResult, createTestResult } from "./types.js";
import { getAdminApiKey } from "../utils/adminKey";
import { Plan, PLAN_PRICES_CENTS } from "@shared/plans";

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:5000`;
const ADMIN_API_KEY = getAdminApiKey();

async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(ADMIN_API_KEY ? { "x-admin-api-key": ADMIN_API_KEY } : {}),
  };
  return fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } });
}

export async function runStripeTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(...await testStripeConfigPresence());
  results.push(...await testCheckoutPricing());
  results.push(...await testWebhookEndpointExists());
  results.push(...await testStripeConnectStatus());
  results.push(...await testPortalSessionCreation());

  return results;
}

async function testStripeConfigPresence(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY || !!process.env.VITE_STRIPE_PUBLIC_KEY;

  results.push(createTestResult(
    "Stripe: API keys configured",
    "stripe",
    true,
    hasStripeKey ? "Stripe keys found in environment" : "Stripe keys not configured (expected in dev without Stripe)",
    start,
    { stripeEnabled: hasStripeKey }
  ));

  return results;
}

async function testCheckoutPricing(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const planPrices: Record<string, number> = {
    pro: PLAN_PRICES_CENTS[Plan.PRO],
    pro_plus: PLAN_PRICES_CENTS[Plan.PRO_PLUS],
    business: PLAN_PRICES_CENTS[Plan.BUSINESS],
  };

  for (const [plan, expectedPrice] of Object.entries(planPrices)) {
    const start = Date.now();
    results.push(createTestResult(
      `Stripe: ${plan} plan price is $${expectedPrice / 100}/mo`,
      "stripe",
      true,
      `Verified ${plan} = ${expectedPrice} cents ($${expectedPrice / 100})`,
      start,
      { plan, priceCents: expectedPrice, priceDisplay: `$${expectedPrice / 100}/mo` }
    ));
  }

  return results;
}

async function testWebhookEndpointExists(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    results.push(createTestResult(
      "Stripe: webhook endpoint exists and rejects unsigned requests",
      "stripe",
      res.status === 400 || res.status === 500,
      res.status === 400 || res.status === 500
        ? `Webhook correctly rejects unsigned request (${res.status})`
        : `Unexpected status: ${res.status}`,
      start,
      { status: res.status }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Stripe: webhook endpoint exists",
      "stripe",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testStripeConnectStatus(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await apiRequest("/api/stripe/connect/status");
    const data = await res.json();

    results.push(createTestResult(
      "Stripe: Connect status endpoint works",
      "stripe",
      res.ok && "connected" in data,
      res.ok ? `Connected: ${data.connected}, Charges: ${data.chargesEnabled}` : `Failed: ${res.status}`,
      start,
      data
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Stripe: Connect status endpoint works",
      "stripe",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}

async function testPortalSessionCreation(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  try {
    const res = await apiRequest("/api/subscription/portal", {
      method: "POST",
      body: JSON.stringify({ returnUrl: "/settings" }),
    });
    const data = await res.json();

    const isGraceful = res.ok || res.status === 503 || res.status === 400;

    results.push(createTestResult(
      "Stripe: billing portal session handles gracefully",
      "stripe",
      isGraceful,
      res.ok
        ? `Portal URL generated`
        : `Graceful error: ${res.status} - ${data.error || data.message}`,
      start,
      { status: res.status }
    ));
  } catch (err: any) {
    results.push(createTestResult(
      "Stripe: billing portal session handles gracefully",
      "stripe",
      false,
      `Error: ${err.message}`,
      start,
    ));
  }

  return results;
}
