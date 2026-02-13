import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers } from './setup';

const { userA } = createSuiteUsers('messaging');

describe('Messaging API', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(userA);
    tokenA = await getAuthToken(userA.id);
  });

  beforeEach(async () => {
    await resetTestData(userA.id);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
  });

  describe('POST /api/sms/send', () => {
    it('requires authentication', async () => {
      const { status } = await apiRequest('POST', '/api/sms/send', {
        to: '+15551234567',
        message: 'Hello',
      });
      expect(status).toBe(401);
    });

    it('returns 400 without required fields', async () => {
      const { status, data } = await apiRequest('POST', '/api/sms/send', {}, tokenA);
      expect(status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('returns 400 without message field', async () => {
      const { status } = await apiRequest('POST', '/api/sms/send', { to: '+15551234567' }, tokenA);
      expect(status).toBe(400);
    });

    it('returns 400 without to field', async () => {
      const { status } = await apiRequest('POST', '/api/sms/send', { message: 'Hello' }, tokenA);
      expect(status).toBe(400);
    });
  });

  describe('GET /api/sms/messages', () => {
    it('requires authentication', async () => {
      const { status } = await apiRequest('GET', '/api/sms/messages');
      expect(status).toBe(401);
    });

    it('returns messages for authenticated user', async () => {
      const { status, data } = await apiRequest('GET', '/api/sms/messages', undefined, tokenA);
      expect(status).toBe(200);
    });
  });

  describe('GET /api/sms/conversations', () => {
    it('requires authentication', async () => {
      const { status } = await apiRequest('GET', '/api/sms/conversations');
      expect(status).toBe(401);
    });

    it('returns conversations for authenticated user', async () => {
      const { status, data } = await apiRequest('GET', '/api/sms/conversations', undefined, tokenA);
      expect(status).toBe(200);
    });
  });

  describe('GET /api/messages/usage', () => {
    it('returns usage information for authenticated user', async () => {
      const { status, data } = await apiRequest('GET', '/api/messages/usage', undefined, tokenA);
      expect(status).toBe(200);
      expect(data).toHaveProperty('outboundSent');
      expect(data).toHaveProperty('outboundLimit');
      expect(data).toHaveProperty('plan');
    });

    it('requires authentication', async () => {
      const { status } = await apiRequest('GET', '/api/messages/usage');
      expect(status).toBe(401);
    });
  });
});
