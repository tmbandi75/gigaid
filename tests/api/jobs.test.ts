import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers } from './setup';

const { userA, userB } = createSuiteUsers('jobs');

describe('Jobs API', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await createTestUser(userA);
    await createTestUser(userB);
    tokenA = await getAuthToken(userA.id);
    tokenB = await getAuthToken(userB.id);
  });

  beforeEach(async () => {
    await resetTestData(userA.id);
    await resetTestData(userB.id);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
    await resetTestData(userB.id);
  });

  const validJob = {
    title: 'Fix Kitchen Sink',
    clientName: 'John Doe',
    serviceType: 'Plumbing',
    scheduledDate: '2026-03-15',
    scheduledTime: '10:00',
    price: 15000,
    userId: 'should-be-ignored',
  };

  describe('POST /api/jobs', () => {
    it('creates a job successfully', async () => {
      const { status, data } = await apiRequest('POST', '/api/jobs', validJob, tokenA);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.title).toBe(validJob.title);
      expect(data.clientName).toBe(validJob.clientName);
      expect(data.serviceType).toBe(validJob.serviceType);
    });

    it('uses authenticated user ID, not the userId in body', async () => {
      const { status, data } = await apiRequest('POST', '/api/jobs', validJob, tokenA);
      expect(status).toBe(201);
      expect(data.userId).not.toBe('should-be-ignored');
    });

    it('requires authentication', async () => {
      const { status } = await apiRequest('POST', '/api/jobs', validJob);
      expect(status).toBe(401);
    });
  });

  describe('GET /api/jobs', () => {
    it('returns only the authenticated user\'s jobs', async () => {
      await apiRequest('POST', '/api/jobs', validJob, tokenA);
      const { status, data } = await apiRequest('GET', '/api/jobs', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].title).toBe(validJob.title);
    });

    it('returns empty array when user has no jobs', async () => {
      const { status, data } = await apiRequest('GET', '/api/jobs', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('returns a specific job', async () => {
      const { data: created } = await apiRequest('POST', '/api/jobs', validJob, tokenA);
      const { status, data } = await apiRequest('GET', `/api/jobs/${created.id}`, undefined, tokenA);
      expect(status).toBe(200);
      expect(data.id).toBe(created.id);
      expect(data.title).toBe(validJob.title);
    });
  });

  describe('PATCH /api/jobs/:id', () => {
    it('updates job fields', async () => {
      const { data: created } = await apiRequest('POST', '/api/jobs', validJob, tokenA);
      const { status, data } = await apiRequest('PATCH', `/api/jobs/${created.id}`, {
        title: 'Updated Title',
        price: 20000,
      }, tokenA);
      expect(status).toBe(200);
      expect(data.title).toBe('Updated Title');
      expect(data.price).toBe(20000);
    });
  });

  describe('Cross-user isolation', () => {
    it('User B cannot see User A\'s jobs', async () => {
      await apiRequest('POST', '/api/jobs', validJob, tokenA);

      const { status: statusA, data: dataA } = await apiRequest('GET', '/api/jobs', undefined, tokenA);
      expect(statusA).toBe(200);
      expect(dataA.length).toBe(1);

      const { status: statusB, data: dataB } = await apiRequest('GET', '/api/jobs', undefined, tokenB);
      expect(statusB).toBe(200);
      expect(dataB.length).toBe(0);
    });
  });

  describe('Capability usage', () => {
    it('creating a job increments capability usage for jobs.create', async () => {
      await apiRequest('POST', '/api/jobs', validJob, tokenA);

      const { status, data } = await apiRequest('GET', '/api/capabilities/jobs.create/check', undefined, tokenA);
      expect(status).toBe(200);
      expect(data.current).toBeGreaterThanOrEqual(1);
    });
  });
});
