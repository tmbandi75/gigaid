import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A, TEST_USER_B } from './setup';

describe('Leads API', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await createTestUser(TEST_USER_A);
    await createTestUser(TEST_USER_B);
    tokenA = await getAuthToken(TEST_USER_A.id);
    tokenB = await getAuthToken(TEST_USER_B.id);
  });

  beforeEach(async () => {
    await resetTestData(TEST_USER_A.id);
    await resetTestData(TEST_USER_B.id);
  });

  afterAll(async () => {
    await resetTestData(TEST_USER_A.id);
    await resetTestData(TEST_USER_B.id);
  });

  const validLead = {
    clientName: 'Jane Smith',
    serviceType: 'Electrical',
    userId: 'should-be-ignored',
  };

  describe('POST /api/leads', () => {
    it('creates a lead successfully', async () => {
      const { status, data } = await apiRequest('POST', '/api/leads', validLead, tokenA);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.clientName).toBe(validLead.clientName);
      expect(data.serviceType).toBe(validLead.serviceType);
    });

    it('uses authenticated user ID', async () => {
      const { status, data } = await apiRequest('POST', '/api/leads', validLead, tokenA);
      expect(status).toBe(201);
      expect(data.userId).not.toBe('should-be-ignored');
    });
  });

  describe('GET /api/leads', () => {
    it('returns only the authenticated user\'s leads', async () => {
      await apiRequest('POST', '/api/leads', validLead, tokenA);
      const { status, data } = await apiRequest('GET', '/api/leads', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].clientName).toBe(validLead.clientName);
    });
  });

  describe('PATCH /api/leads/:id', () => {
    it('updates lead fields', async () => {
      const { data: created } = await apiRequest('POST', '/api/leads', validLead, tokenA);
      const { status, data } = await apiRequest('PATCH', `/api/leads/${created.id}`, {
        clientName: 'Updated Client',
        serviceType: 'HVAC',
      }, tokenA);
      expect(status).toBe(200);
      expect(data.clientName).toBe('Updated Client');
      expect(data.serviceType).toBe('HVAC');
    });
  });

  describe('DELETE /api/leads/:id', () => {
    it('removes a lead', async () => {
      const { data: created } = await apiRequest('POST', '/api/leads', validLead, tokenA);
      const { status } = await apiRequest('DELETE', `/api/leads/${created.id}`, undefined, tokenA);
      expect(status).toBe(204);
    });
  });

  describe('POST /api/leads/:id/archive', () => {
    it('archives a lead', async () => {
      const { data: created } = await apiRequest('POST', '/api/leads', validLead, tokenA);
      const { status, data } = await apiRequest('POST', `/api/leads/${created.id}/archive`, {}, tokenA);
      expect(status).toBe(200);
      expect(data.archivedAt).toBeTruthy();
    });
  });

  describe('Cross-user isolation', () => {
    it('User B cannot see User A\'s leads', async () => {
      await apiRequest('POST', '/api/leads', validLead, tokenA);

      const { status: statusA, data: dataA } = await apiRequest('GET', '/api/leads', undefined, tokenA);
      expect(statusA).toBe(200);
      expect(dataA.length).toBe(1);

      const { status: statusB, data: dataB } = await apiRequest('GET', '/api/leads', undefined, tokenB);
      expect(statusB).toBe(200);
      expect(dataB.length).toBe(0);
    });
  });
});
