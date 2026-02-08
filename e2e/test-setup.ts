import { Browser, Page } from '@playwright/test';
import { BASE_URL, ADMIN_API_KEY } from './test-constants';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ADMIN_API_KEY) {
    h['x-admin-api-key'] = ADMIN_API_KEY;
  }
  return h;
}

async function post(path: string, body: Record<string, any>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function setupTestUser(user: { id: string; name: string; email: string; plan?: string }) {
  return post('/api/test/create-user', user);
}

export async function resetTestData(userId: string) {
  return post('/api/test/reset-data', { userId });
}

export async function getAuthToken(userId: string): Promise<string> {
  const result = await post('/api/test/create-auth-token', { userId });
  return result.token;
}

export async function seedJob(data: {
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
  return post('/api/test/seed-job', data);
}

export async function seedLead(data: {
  userId: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceType?: string;
  status?: string;
  source?: string;
}) {
  return post('/api/test/seed-lead', data);
}

export async function seedInvoice(data: {
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
  return post('/api/test/seed-invoice', data);
}

export async function setUserPlan(userId: string, plan: string) {
  return post('/api/test/set-plan', { userId, plan });
}

export async function setUsage(userId: string, capability: string, count: number) {
  return post('/api/test/set-usage', { userId, capability, count });
}

export async function setUserSlug(userId: string, slug: string) {
  return post('/api/test/set-slug', { userId, slug });
}

export async function setReferralCode(userId: string, referralCode: string) {
  return post('/api/test/set-referral-code', { userId, referralCode });
}

export async function getGrowthLeads() {
  const res = await fetch(`${BASE_URL}/api/test/growth-leads`, {
    headers: headers(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET /api/test/growth-leads failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function authenticatedPage(browser: Browser, userId: string): Promise<Page> {
  const token = await getAuthToken(userId);
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((authToken: string) => {
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('gigaid_splash_seen', 'true');
    localStorage.setItem('gig-aid-welcome-seen', 'true');
    localStorage.setItem('gig-aid-onboarding-complete', 'true');
    localStorage.setItem('gig-aid-last-active', Date.now().toString());
  }, token);

  await page.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('/api/')) {
      const existingHeaders = request.headers();
      route.continue({
        headers: {
          ...existingHeaders,
          'Authorization': `Bearer ${token}`,
        },
      });
    } else {
      route.continue();
    }
  });

  return page;
}
