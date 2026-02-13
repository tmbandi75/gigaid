import { TestResult, TestUser, createTestResult } from "./types.js";
import { getAdminApiKey } from "../utils/adminKey";

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:5000`;
const ADMIN_API_KEY = getAdminApiKey();

const TEST_USERS: TestUser[] = [
  { id: "smoke-test-light", name: "Smoke Test Light", email: "smoke-light@test.gigaid.ai", plan: "free", usagePattern: "light" },
  { id: "smoke-test-heavy", name: "Smoke Test Heavy", email: "smoke-heavy@test.gigaid.ai", plan: "free", usagePattern: "heavy" },
  { id: "smoke-test-max", name: "Smoke Test Max", email: "smoke-max@test.gigaid.ai", plan: "free", usagePattern: "max" },
];

export function getTestUsers(): TestUser[] {
  return TEST_USERS;
}

export async function createTestUsers(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const user of TEST_USERS) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/api/test/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ADMIN_API_KEY ? { "x-admin-api-key": ADMIN_API_KEY } : {}) },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          plan: user.plan,
        }),
      });

      if (res.ok) {
        results.push(createTestResult(
          `Create user: ${user.name}`,
          "test_accounts",
          true,
          `User ${user.id} created/verified on ${user.plan} plan`,
          start,
          { userId: user.id, plan: user.plan }
        ));
      } else {
        const body = await res.text();
        results.push(createTestResult(
          `Create user: ${user.name}`,
          "test_accounts",
          false,
          `Failed to create user: ${res.status} ${body}`,
          start,
          { userId: user.id, status: res.status }
        ));
      }
    } catch (err: any) {
      results.push(createTestResult(
        `Create user: ${user.name}`,
        "test_accounts",
        false,
        `Error creating user: ${err.message}`,
        start,
      ));
    }
  }

  return results;
}

export async function cleanupTestUsers(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const user of TEST_USERS) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/api/test/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ADMIN_API_KEY ? { "x-admin-api-key": ADMIN_API_KEY } : {}) },
        body: JSON.stringify({ id: user.id }),
      });

      results.push(createTestResult(
        `Cleanup user: ${user.name}`,
        "cleanup",
        res.ok,
        res.ok ? `User ${user.id} cleaned up` : `Cleanup failed: ${res.status}`,
        start,
      ));
    } catch (err: any) {
      results.push(createTestResult(
        `Cleanup user: ${user.name}`,
        "cleanup",
        true,
        `Cleanup skipped (user may not exist): ${err.message}`,
        start,
      ));
    }
  }

  return results;
}
