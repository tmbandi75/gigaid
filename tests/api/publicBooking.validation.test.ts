import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A } from './setup';

const SLUG = 'booking-val-test-slug';

const validBooking = {
  clientName: 'Validation Test Client',
  clientPhone: '+15559990001',
  clientEmail: 'valtest@example.com',
  serviceType: 'Plumbing',
  preferredDate: '2026-06-15',
  preferredTime: '09:00',
  location: '456 Oak Ave',
};

describe('Public Booking Validation', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(TEST_USER_A);
    tokenA = await getAuthToken(TEST_USER_A.id);
    await apiRequest('PATCH', '/api/settings', {
      publicProfileSlug: SLUG,
      publicProfileEnabled: true,
    }, tokenA);
  });

  afterAll(async () => {
    await resetTestData(TEST_USER_A.id);
  });

  describe('404 — missing/invalid slug', () => {
    it('returns 404 for a slug that does not exist', async () => {
      const { status, data } = await apiRequest(
        'POST',
        '/api/public/book/nonexistent-slug-zzz-999',
        validBooking,
      );
      expect(status).toBe(404);
      expect(data.error).toMatch(/not found/i);
    });

    it('returns 404 for an empty slug segment', async () => {
      const { status } = await apiRequest(
        'POST',
        '/api/public/book/%20',
        validBooking,
      );
      expect(status).toBe(404);
    });
  });

  describe('400 — missing required fields', () => {
    it('rejects when clientName is missing', async () => {
      const { clientName, ...noName } = validBooking;
      const { status } = await apiRequest('POST', `/api/public/book/${SLUG}`, noName);
      expect(status).toBe(400);
    });

    it('accepts booking when clientPhone is omitted (optional field)', async () => {
      const { clientPhone, ...noPhone } = validBooking;
      const { status, data } = await apiRequest('POST', `/api/public/book/${SLUG}`, noPhone);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
    });

    it('rejects when serviceType is missing', async () => {
      const { serviceType, ...noService } = validBooking;
      const { status } = await apiRequest('POST', `/api/public/book/${SLUG}`, noService);
      expect(status).toBe(400);
    });

    it('rejects a completely empty body', async () => {
      const { status } = await apiRequest('POST', `/api/public/book/${SLUG}`, {});
      expect(status).toBe(400);
    });
  });

  describe('201 — valid booking creation', () => {
    it('creates booking with all required fields', async () => {
      const { status, data } = await apiRequest('POST', `/api/public/book/${SLUG}`, validBooking);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.clientName).toBe(validBooking.clientName);
      expect(data.clientPhone).toBe(validBooking.clientPhone);
      expect(data.serviceType).toBe(validBooking.serviceType);
      expect(data.status).toBe('pending');
    });

    it('creates booking without optional fields (email, date, time, location)', async () => {
      const minimal = {
        clientName: 'Minimal Client',
        clientPhone: '+15559990002',
        serviceType: 'Cleaning',
      };
      const { status, data } = await apiRequest('POST', `/api/public/book/${SLUG}`, minimal);
      expect(status).toBe(201);
      expect(data.clientName).toBe(minimal.clientName);
    });

    it('returns null protection when provider has no deposit config', async () => {
      const { status, data } = await apiRequest('POST', `/api/public/book/${SLUG}`, validBooking);
      expect(status).toBe(201);
      expect(data.depositPayment).toBeNull();
    });
  });

  describe('Deposit policy acknowledgment', () => {
    beforeEach(async () => {
      await apiRequest('POST', '/api/test/set-deposit-config', {
        userId: TEST_USER_A.id,
        depositEnabled: true,
        depositValue: 25,
        depositType: 'percent',
        defaultPrice: 10000,
        defaultServiceType: 'Plumbing',
        depositPolicySet: true,
        noShowProtectionEnabled: false,
      });
    });

    afterEach(async () => {
      await apiRequest('POST', '/api/test/set-deposit-config', {
        userId: TEST_USER_A.id,
        depositEnabled: false,
        depositValue: 0,
        depositPolicySet: false,
      });
    });

    it('rejects booking when deposit is enabled but policyAcknowledged is missing', async () => {
      const { status, data } = await apiRequest('POST', `/api/public/book/${SLUG}`, validBooking);
      expect(status).toBe(400);
      expect(data.error).toMatch(/policy/i);
    });

    it('accepts booking when deposit is enabled and policyAcknowledged is true', async () => {
      const { status, data } = await apiRequest('POST', `/api/public/book/${SLUG}`, {
        ...validBooking,
        policyAcknowledged: true,
      });
      expect(status).toBe(201);
      expect(data.policyAcknowledged).toBe(true);
    });
  });

  describe('Cross-user isolation', () => {
    it('booking requests are scoped to the slug owner', async () => {
      await apiRequest('POST', `/api/public/book/${SLUG}`, validBooking);

      const { status, data } = await apiRequest('GET', '/api/booking-requests', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      const found = data.find((b: any) => b.clientName === validBooking.clientName);
      expect(found).toBeDefined();
    });
  });
});
