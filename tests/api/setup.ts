import { getAdminApiKey } from '../utils/adminKey';
import { ns } from '../utils/testNamespace';

const BASE_URL = 'http://localhost:5000';
const ADMIN_API_KEY = getAdminApiKey();

export interface TestUser {
  id: string;
  name: string;
  email: string;
  plan: string;
}

export function createSuiteUsers(suite: string): { userA: TestUser; userB: TestUser } {
  return {
    userA: {
      id: ns(`${suite}-user-a`),
      name: `${suite} Test User A`,
      email: ns(`${suite}-a@gigaid.test`),
      plan: 'free',
    },
    userB: {
      id: ns(`${suite}-user-b`),
      name: `${suite} Test User B`,
      email: ns(`${suite}-b@gigaid.test`),
      plan: 'free',
    },
  };
}

export const TEST_USER_A = {
  id: 'api-test-user-a',
  name: 'API Test User A',
  email: 'api-test-a@gigaid.test',
  plan: 'free',
};

export const TEST_USER_B = {
  id: 'api-test-user-b',
  name: 'API Test User B',
  email: 'api-test-b@gigaid.test',
  plan: 'free',
};

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ADMIN_API_KEY) {
    h['x-admin-api-key'] = ADMIN_API_KEY;
  }
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

export async function apiRequest(
  method: string,
  path: string,
  body?: Record<string, any>,
  token?: string,
) {
  const opts: RequestInit = {
    method: method.toUpperCase(),
    headers: headers(token),
  };
  if (body && method.toUpperCase() !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export function getApp() {
  return { baseUrl: BASE_URL };
}

export async function createTestUser(user: { id: string; name: string; email: string; plan?: string }) {
  const { status, data } = await apiRequest('POST', '/api/test/create-user', user);
  if (status !== 200) {
    throw new Error(`createTestUser failed (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function resetTestData(userId: string, opts?: { resetProfile?: boolean }) {
  const { status, data } = await apiRequest('POST', '/api/test/reset-data', { userId, ...opts });
  if (status !== 200) {
    throw new Error(`resetTestData failed (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function getAuthToken(userId: string): Promise<string> {
  const { status, data } = await apiRequest('POST', '/api/test/create-auth-token', { userId });
  if (status !== 200) {
    throw new Error(`getAuthToken failed (${status}): ${JSON.stringify(data)}`);
  }
  return data.token;
}

export async function seedJob(jobData: {
  userId: string;
  title?: string;
  clientName?: string;
  status?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  price?: number;
  serviceType?: string;
  location?: string;
}) {
  const { status, data } = await apiRequest('POST', '/api/test/seed-job', jobData);
  if (status !== 200) {
    throw new Error(`seedJob failed (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function seedInvoice(invoiceData: {
  userId: string;
  invoiceNumber?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  amount?: number;
  status?: string;
  serviceDescription?: string;
  publicToken?: string;
}) {
  const { status, data } = await apiRequest('POST', '/api/test/seed-invoice', invoiceData);
  if (status !== 200) {
    throw new Error(`seedInvoice failed (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function seedLead(leadData: {
  userId: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceType?: string;
  status?: string;
  source?: string;
}) {
  const { status, data } = await apiRequest('POST', '/api/test/seed-lead', leadData);
  if (status !== 200) {
    throw new Error(`seedLead failed (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}
