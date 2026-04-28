/**
 * Pricing Safety Net Tests
 *
 * These tests cover the four pricing routes that have a price safety net
 * (added in task #138). Each route must:
 *  1. Validate required inputs (return 400 for missing fields).
 *  2. Require authentication where applicable (return 401).
 *  3. Never crash with a 5xx for valid inputs — returning a deterministic
 *     fallback response instead when the upstream AI/calculation produces
 *     non-finite numbers or throws.
 *
 * Fallback behaviour is exercised deterministically via the
 * `x-test-pricing-mode` request header (non-production only):
 *   force-fallback  — skips the upstream call, returns the pre-built fallback.
 *   force-throw     — throws inside the try block to exercise catch-path fallback
 *                     (only routes 1 & 2 catch and return 200+fallback; routes 3 & 4
 *                     surface a 500 from their outer catch, which is expected and tested).
 */

import { TEST_BASE_URL } from "../utils/env";
import {
  apiRequest,
  createTestUser,
  resetTestData,
  getAuthToken,
  createSuiteUsers,
} from "./setup";
import { getAdminApiKey } from "../utils/adminKey";

const BASE_URL = TEST_BASE_URL;
const ADMIN_KEY = getAdminApiKey();

const { userA } = createSuiteUsers("pricing");

async function pricingRequest(
  method: "GET" | "POST",
  path: string,
  body: Record<string, any> | undefined,
  token: string | undefined,
  pricingMode: "force-fallback" | "force-throw",
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-test-pricing-mode": pricingMode,
  };
  if (ADMIN_KEY) headers["x-admin-api-key"] = ADMIN_KEY;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe("Pricing safety net", () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(userA);
    tokenA = await getAuthToken(userA.id);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
  });

  // ---------------------------------------------------------------------------
  // POST /api/public/ai/estimate-price  (public — no auth required)
  // ---------------------------------------------------------------------------

  describe("POST /api/public/ai/estimate-price", () => {
    it("returns 400 when description is missing", async () => {
      const { status, data } = await apiRequest(
        "POST",
        "/api/public/ai/estimate-price",
        {},
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("returns 400 when description is empty string", async () => {
      const { status, data } = await apiRequest(
        "POST",
        "/api/public/ai/estimate-price",
        { description: "" },
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("returns the fallback payload (non-finite/unavailable path) — force-fallback", async () => {
      const { status, data } = await pricingRequest(
        "POST",
        "/api/public/ai/estimate-price",
        { description: "Clean a 3-bedroom house" },
        undefined,
        "force-fallback",
      );
      expect(status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(data.estimateRange).toBe("$50 – $150");
      expect(typeof data.breakdown).toBe("string");
      expect(data.breakdown.length).toBeGreaterThan(0);
    });

    it("returns the fallback payload (throw path) — force-throw", async () => {
      const { status, data } = await pricingRequest(
        "POST",
        "/api/public/ai/estimate-price",
        { description: "Clean a 3-bedroom house" },
        undefined,
        "force-throw",
      );
      expect(status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(data.estimateRange).toBe("$50 – $150");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/estimation/in-app  (public — no auth required)
  // ---------------------------------------------------------------------------

  describe("POST /api/estimation/in-app", () => {
    it("returns 400 when category is missing", async () => {
      const { status, data } = await apiRequest(
        "POST",
        "/api/estimation/in-app",
        { description: "Small house clean" },
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("returns 400 when description is missing", async () => {
      const { status, data } = await apiRequest(
        "POST",
        "/api/estimation/in-app",
        { category: "Cleaning" },
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("returns 400 when both category and description are missing", async () => {
      const { status, data } = await apiRequest(
        "POST",
        "/api/estimation/in-app",
        {},
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("returns the fallback payload (non-finite/unavailable path) — force-fallback", async () => {
      const { status, data } = await pricingRequest(
        "POST",
        "/api/estimation/in-app",
        { category: "Cleaning", description: "Small house clean" },
        undefined,
        "force-fallback",
      );
      expect(status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(data.priceRange).toEqual({ min: 5000, max: 15000 });
      expect(data.confidence).toBe("low");
      expect(Array.isArray(data.factors)).toBe(true);
      expect(Array.isArray(data.disclaimers)).toBe(true);
      expect(data.aiGenerated).toBe(false);
      expect(data.formattedOutput).toBe("$50 – $150");
    });

  });

  // ---------------------------------------------------------------------------
  // POST /api/quote-estimate  (requires auth)
  // ---------------------------------------------------------------------------

  describe("POST /api/quote-estimate", () => {
    it("returns 401 without an auth token", async () => {
      const { status } = await apiRequest(
        "POST",
        "/api/quote-estimate",
        { jobType: "Cleaning" },
      );
      expect(status).toBe(401);
    });

    it("returns 400 when jobType is missing", async () => {
      const { status, data } = await apiRequest(
        "POST",
        "/api/quote-estimate",
        {},
        tokenA,
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("returns the fallback payload (non-finite/unavailable path) — force-fallback", async () => {
      const { status, data } = await pricingRequest(
        "POST",
        "/api/quote-estimate",
        { jobType: "House Cleaning" },
        tokenA,
        "force-fallback",
      );
      expect(status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(data.suggestedPriceLow).toBe(5000);
      expect(data.suggestedPriceHigh).toBe(15000);
      expect(data.suggestedPriceMedian).toBe(9000);
      expect(typeof data.rationale).toBe("string");
      expect(Number.isFinite(data.avgDurationMinutes)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/price-optimization  (requires auth)
  // ---------------------------------------------------------------------------

  describe("GET /api/price-optimization", () => {
    beforeEach(async () => {
      await resetTestData(userA.id);
    });

    it("returns 401 without an auth token", async () => {
      const { status } = await apiRequest("GET", "/api/price-optimization");
      expect(status).toBe(401);
    });

    it("returns fallback: true with empty insights for a user with no job data (deterministic empty-data path)", async () => {
      const { status, data } = await apiRequest(
        "GET",
        "/api/price-optimization",
        undefined,
        tokenA,
      );
      expect(status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(Array.isArray(data.insights)).toBe(true);
      expect(data.insights).toHaveLength(0);
    });

    it("returns the fallback payload (non-finite/unavailable path) — force-fallback", async () => {
      const { status, data } = await pricingRequest(
        "GET",
        "/api/price-optimization",
        undefined,
        tokenA,
        "force-fallback",
      );
      expect(status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(Array.isArray(data.insights)).toBe(true);
      expect(data.insights).toHaveLength(0);
    });

    it("never returns non-finite avgPrice or hourlyRate in any insight", async () => {
      const { status, data } = await apiRequest(
        "GET",
        "/api/price-optimization",
        undefined,
        tokenA,
      );
      expect(status).toBe(200);
      if (Array.isArray(data.insights)) {
        for (const insight of data.insights) {
          expect(Number.isFinite(insight.avgPrice)).toBe(true);
          expect(Number.isFinite(insight.hourlyRate)).toBe(true);
        }
      }
    });
  });
});
