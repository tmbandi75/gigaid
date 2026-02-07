import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A } from './setup';

describe('Capabilities API', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(TEST_USER_A);
    tokenA = await getAuthToken(TEST_USER_A.id);
  });

  beforeEach(async () => {
    await resetTestData(TEST_USER_A.id);
  });

  afterAll(async () => {
    await resetTestData(TEST_USER_A.id);
  });

  const validJob = {
    title: 'Test Job',
    clientName: 'Test Client',
    serviceType: 'General',
    scheduledDate: '2026-03-15',
    scheduledTime: '10:00',
    price: 5000,
  };

  describe('Free plan job limit enforcement', () => {
    it('returns 403 with JOB_LIMIT_EXCEEDED when free plan user hits 10 jobs', async () => {
      await apiRequest('POST', '/api/test/set-usage', {
        userId: TEST_USER_A.id,
        capability: 'jobs.create',
        count: 10,
      });

      const { status, data } = await apiRequest('POST', '/api/jobs', validJob, tokenA);
      expect(status).toBe(403);
      expect(data.code).toBe('JOB_LIMIT_EXCEEDED');
    });
  });

  describe('Pro plan unlimited jobs', () => {
    it('allows pro plan user to create jobs beyond free limit', async () => {
      await createTestUser({ ...TEST_USER_A, plan: 'pro' });
      tokenA = await getAuthToken(TEST_USER_A.id);

      await apiRequest('POST', '/api/test/set-usage', {
        userId: TEST_USER_A.id,
        capability: 'jobs.create',
        count: 10,
      });

      const { status, data } = await apiRequest('POST', '/api/jobs', validJob, tokenA);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');

      await createTestUser({ ...TEST_USER_A, plan: 'free' });
      tokenA = await getAuthToken(TEST_USER_A.id);
    });
  });

  describe('GET /api/capabilities/:capability/check', () => {
    it('returns current usage and limit info for a capability', async () => {
      await apiRequest('POST', '/api/test/set-usage', {
        userId: TEST_USER_A.id,
        capability: 'jobs.create',
        count: 5,
      });

      const { status, data } = await apiRequest('GET', '/api/capabilities/jobs.create/check', undefined, tokenA);
      expect(status).toBe(200);
      expect(data.capability).toBe('jobs.create');
      expect(data.current).toBe(5);
      expect(data).toHaveProperty('allowed');
      expect(data).toHaveProperty('limit');
    });
  });

  describe('Free plan SMS limit enforcement', () => {
    it('returns 403 when sms.two_way usage reaches limit', async () => {
      await apiRequest('POST', '/api/test/set-usage', {
        userId: TEST_USER_A.id,
        capability: 'sms.two_way',
        count: 20,
      });

      const { status, data } = await apiRequest('POST', '/api/sms/send', {
        to: '+15551234567',
        message: 'Test message',
      }, tokenA);
      expect(status).toBe(403);
      expect(data.error).toBe('message_limit_reached');
    });
  });
});
