import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A } from './setup';

describe('Booking API', () => {
  let tokenA: string;
  const testSlug = 'test-worker-slug';

  beforeAll(async () => {
    await createTestUser(TEST_USER_A);
    tokenA = await getAuthToken(TEST_USER_A.id);
  });

  beforeEach(async () => {
    await resetTestData(TEST_USER_A.id);
    await apiRequest('PATCH', '/api/settings', {
      publicProfileSlug: testSlug,
      publicProfileEnabled: true,
    }, tokenA);
  });

  afterAll(async () => {
    await resetTestData(TEST_USER_A.id);
  });

  const validBooking = {
    clientName: 'Alice Customer',
    clientPhone: '+15559876543',
    clientEmail: 'alice@example.com',
    serviceType: 'Cleaning',
    preferredDate: '2026-04-01',
    preferredTime: '14:00',
    location: '123 Main St',
  };

  describe('POST /api/public/book/:slug', () => {
    it('creates a booking request without authentication', async () => {
      const { status, data } = await apiRequest('POST', `/api/public/book/${testSlug}`, validBooking);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.clientName).toBe(validBooking.clientName);
    });
  });

  describe('GET /api/booking-requests', () => {
    it('returns booking requests for authenticated user', async () => {
      await apiRequest('POST', `/api/public/book/${testSlug}`, validBooking);

      const { status, data } = await apiRequest('GET', '/api/booking-requests', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].clientName).toBe(validBooking.clientName);
    });
  });

  describe('Invalid slug', () => {
    it('returns 404 for non-existent slug', async () => {
      const { status } = await apiRequest('POST', '/api/public/book/non-existent-slug-xyz', validBooking);
      expect(status).toBe(404);
    });
  });
});
