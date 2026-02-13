import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers } from './setup';

const { userA } = createSuiteUsers('auth');

describe('Authentication API', () => {
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

  describe('Unauthenticated access', () => {
    it('returns 401 for GET /api/jobs without token', async () => {
      const { status } = await apiRequest('GET', '/api/jobs');
      expect(status).toBe(401);
    });

    it('returns 401 for GET /api/leads without token', async () => {
      const { status } = await apiRequest('GET', '/api/leads');
      expect(status).toBe(401);
    });

    it('returns 401 for GET /api/invoices without token', async () => {
      const { status } = await apiRequest('GET', '/api/invoices');
      expect(status).toBe(401);
    });

    it('returns 401 for GET /api/profile without token', async () => {
      const { status } = await apiRequest('GET', '/api/profile');
      expect(status).toBe(401);
    });
  });

  describe('Valid Bearer token', () => {
    it('returns user data from GET /api/profile with valid token', async () => {
      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      expect(status).toBe(200);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('email');
    });

    it('returns correct user profile fields', async () => {
      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      expect(status).toBe(200);
      expect(data.name).toBe(userA.name);
      expect(data.email).toBe(userA.email);
    });
  });

  describe('Invalid token', () => {
    it('returns 401 with invalid Bearer token', async () => {
      const { status } = await apiRequest('GET', '/api/profile', undefined, 'invalid-token-abc123');
      expect(status).toBe(401);
    });

    it('returns 401 with expired/malformed JWT', async () => {
      const { status } = await apiRequest('GET', '/api/profile', undefined, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid');
      expect(status).toBe(401);
    });
  });
});
