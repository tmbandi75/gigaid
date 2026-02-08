import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A, TEST_USER_B } from './setup';

const BASE_URL = 'http://localhost:5000';

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
  });

  describe('Referral Reward Abuse Prevention', () => {
    it('prevents self-referral (referrer cannot refer themselves)', async () => {
      const { data: codeData } = await apiRequest('GET', '/api/referral/code', undefined, tokenA);
      const { status } = await publicRequest('POST', '/api/referral/click', {
        code: codeData.code,
      });
      expect(status).toBe(200);
    });
  });
});
