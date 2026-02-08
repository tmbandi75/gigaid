import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A, TEST_USER_B } from './setup';

const BASE_URL = 'http://localhost:5000';
const ADMIN_KEY = process.env.GIGAID_ADMIN_API_KEY || '';

async function publicRequest(
  method: string,
  path: string,
  body?: Record<string, any>,
) {
  const opts: RequestInit = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method.toUpperCase() !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function adminRequest(
  method: string,
  path: string,
  body?: Record<string, any>,
) {
  const opts: RequestInit = {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_KEY}`,
    },
  };
  if (body && method.toUpperCase() !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('Growth Phase 2 API', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await createTestUser(TEST_USER_A);
    await createTestUser(TEST_USER_B);
    tokenA = await getAuthToken(TEST_USER_A.id);
    tokenB = await getAuthToken(TEST_USER_B.id);
  });

  afterAll(async () => {
    await resetTestData(TEST_USER_A.id);
    await resetTestData(TEST_USER_B.id);
  });

  describe('Lead Capture - POST /api/growth/lead', () => {
    it('creates a lead with name only', async () => {
      const { status, data } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Test Lead',
      });
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.name).toBe('Test Lead');
      expect(data.status).toBe('new');
    });

    it('creates a lead with full details', async () => {
      const { status, data } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Full Lead',
        businessName: 'Test Plumbing',
        email: 'test@example.com',
        phone: '555-1234',
        serviceCategory: 'Plumbing',
        city: 'Austin',
        source: 'free_setup',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring_launch',
      });
      expect(status).toBe(201);
      expect(data.businessName).toBe('Test Plumbing');
      expect(data.email).toBe('test@example.com');
      expect(data.source).toBe('free_setup');
      expect(data.utmSource).toBe('google');
      expect(data.utmCampaign).toBe('spring_launch');
    });

    it('rejects lead without name', async () => {
      const { status } = await publicRequest('POST', '/api/growth/lead', {
        email: 'noname@example.com',
      });
      expect(status).toBe(400);
    });
  });

  describe('Book Call - POST /api/growth/book-call', () => {
    it('books a call for an existing lead', async () => {
      const { data: lead } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Call Lead',
        email: 'call@example.com',
      });
      const scheduledAt = new Date(Date.now() + 86400000).toISOString();
      const { status, data } = await publicRequest('POST', '/api/growth/book-call', {
        leadId: lead.id,
        scheduledAt,
      });
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.leadId).toBe(lead.id);
    });

    it('returns 404 for non-existent lead', async () => {
      const { status } = await publicRequest('POST', '/api/growth/book-call', {
        leadId: 'non-existent-lead-id',
        scheduledAt: new Date().toISOString(),
      });
      expect(status).toBe(404);
    });

    it('rejects request without leadId', async () => {
      const { status } = await publicRequest('POST', '/api/growth/book-call', {
        scheduledAt: new Date().toISOString(),
      });
      expect(status).toBe(400);
    });

    it('rejects request without scheduledAt', async () => {
      const { status } = await publicRequest('POST', '/api/growth/book-call', {
        leadId: 'some-id',
      });
      expect(status).toBe(400);
    });
  });

  describe('Convert Lead - POST /api/growth/convert', () => {
    it('requires admin auth', async () => {
      const { data: lead } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Convert Auth Lead',
      });
      const { status } = await publicRequest('POST', '/api/admin/growth/convert', {
        leadId: lead.id,
        userId: TEST_USER_A.id,
      });
      expect(status).toBe(401);
    });

    it('rejects with wrong admin key', async () => {
      const { data: lead } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Convert Wrong Key Lead',
      });
      const res = await fetch(`${BASE_URL}/api/admin/growth/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': 'wrong-key-123',
        },
        body: JSON.stringify({ leadId: lead.id, userId: TEST_USER_A.id }),
      });
      expect(res.status).toBe(401);
    });

    it('converts a lead with valid admin auth', async () => {
      if (!ADMIN_KEY) return;
      const { data: lead } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Convert Lead',
        email: 'convert@example.com',
      });
      const res = await fetch(`${BASE_URL}/api/admin/growth/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ leadId: lead.id, userId: TEST_USER_A.id }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toHaveProperty('success');
    });

    it('returns 404 for non-existent lead', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ leadId: 'non-existent-lead', userId: TEST_USER_A.id }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 409 when converting already-converted lead', async () => {
      if (!ADMIN_KEY) return;
      const { data: lead } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Double Convert Lead',
      });
      await fetch(`${BASE_URL}/api/admin/growth/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ leadId: lead.id, userId: TEST_USER_B.id }),
      });
      const res = await fetch(`${BASE_URL}/api/admin/growth/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ leadId: lead.id, userId: TEST_USER_B.id }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe('Referral Tracking', () => {
    it('generates a referral code for a user', async () => {
      const { status, data } = await apiRequest('GET', '/api/referral/code', undefined, tokenA);
      expect(status).toBe(200);
      expect(data).toHaveProperty('code');
      expect(typeof data.code).toBe('string');
      expect(data.code.length).toBeGreaterThan(3);
    });

    it('returns same referral code on subsequent calls', async () => {
      const { data: first } = await apiRequest('GET', '/api/referral/code', undefined, tokenA);
      const { data: second } = await apiRequest('GET', '/api/referral/code', undefined, tokenA);
      expect(first.code).toBe(second.code);
    });

    it('tracks a referral click', async () => {
      const { data: codeData } = await apiRequest('GET', '/api/referral/code', undefined, tokenA);
      const { status } = await publicRequest('POST', '/api/referral/click', {
        code: codeData.code,
      });
      expect(status).toBe(200);
    });

    it('handles click with invalid referral code', async () => {
      const { status } = await publicRequest('POST', '/api/referral/click', {
        code: 'GA-INVALID',
      });
      expect(status).toBe(200);
    });

    it('retrieves referrals for a user', async () => {
      const { status, data } = await apiRequest('GET', '/api/referral/mine', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('requires auth for referral listing', async () => {
      const { status } = await apiRequest('GET', '/api/referral/mine');
      expect(status).toBe(401);
    });

    it('requires auth for referral code generation', async () => {
      const { status } = await apiRequest('GET', '/api/referral/code');
      expect(status).toBe(401);
    });

  });

  describe('Attribution Tracking - POST /api/attribution/track', () => {
    it('tracks attribution for authenticated user', async () => {
      const { status, data } = await apiRequest('POST', '/api/attribution/track', {
        landingPath: '/free-setup',
        source: 'free_setup',
        utmSource: 'facebook',
        utmMedium: 'social',
        utmCampaign: 'winter_promo',
      }, tokenA);
      expect(status).toBe(200);
      expect(data).toHaveProperty('id');
    });

    it('requires auth for attribution tracking', async () => {
      const { status } = await apiRequest('POST', '/api/attribution/track', {
        landingPath: '/',
        source: 'homepage',
      });
      expect(status).toBe(401);
    });

    it('tracks attribution with referrer code', async () => {
      const { data: codeData } = await apiRequest('GET', '/api/referral/code', undefined, tokenA);
      const { status, data } = await apiRequest('POST', '/api/attribution/track', {
        landingPath: '/free-setup',
        source: 'referral',
        referrerCode: codeData.code,
      }, tokenB);
      expect(status).toBe(200);
      expect(data).toHaveProperty('id');
    });

    it('retrieves attribution for user', async () => {
      const { status, data } = await apiRequest('GET', '/api/attribution/me', undefined, tokenA);
      expect(status).toBe(200);
      expect(data).toBeTruthy();
    });

    it('requires auth for attribution retrieval', async () => {
      const { status } = await apiRequest('GET', '/api/attribution/me');
      expect(status).toBe(401);
    });
  });

  describe('Admin Leads API', () => {
    it('requires admin auth for leads listing', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/growth/leads`, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('lists leads with admin auth', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/leads`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('filters leads by status', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/leads?status=new`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      data.forEach((lead: any) => {
        expect(lead.status).toBe('new');
      });
    });

    it('filters leads by source', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/leads?source=free_setup`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      data.forEach((lead: any) => {
        expect(lead.source).toBe('free_setup');
      });
    });

    it('updates lead notes with admin auth', async () => {
      if (!ADMIN_KEY) return;
      const { data: lead } = await publicRequest('POST', '/api/growth/lead', {
        name: 'Notes Test Lead',
      });
      const res = await fetch(`${BASE_URL}/api/admin/growth/leads/${lead.id}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ notes: 'Admin test notes' }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.notes).toBe('Admin test notes');
    });
  });

  describe('Referral Rewards', () => {
    it('requires auth for rewards listing', async () => {
      const { status } = await publicRequest('GET', '/api/referral/rewards');
      expect(status).toBe(401);
    });

    it('retrieves rewards for a user', async () => {
      const { status, data } = await apiRequest('GET', '/api/referral/rewards', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Reward Gating (Admin)', () => {
    it('rejects self-referral', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ referrerId: TEST_USER_A.id, referredId: TEST_USER_A.id }),
      });
      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.error).toBe('self_referral');
    });

    it('rejects reward when referral not activated', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ referrerId: TEST_USER_A.id, referredId: TEST_USER_B.id }),
      });
      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.error).toBe('referral_not_activated');
    });

    it('rejects missing referrerId or referredId', async () => {
      if (!ADMIN_KEY) return;
      const res = await fetch(`${BASE_URL}/api/admin/growth/reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': ADMIN_KEY,
        },
        body: JSON.stringify({ referrerId: TEST_USER_A.id }),
      });
      expect(res.status).toBe(400);
    });

    it('requires admin auth for reward application', async () => {
      const { status } = await publicRequest('POST', '/api/admin/growth/reward', {
        referrerId: TEST_USER_A.id,
        referredId: TEST_USER_B.id,
      });
      expect(status).toBe(401);
    });
  });
});
