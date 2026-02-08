import { apiRequest, createTestUser, resetTestData, getAuthToken, seedInvoice, TEST_USER_A } from './setup';

const ACTIVATION_USER = {
  id: 'activation-test-user',
  name: 'Activation Test User',
  email: 'activation@gigaid.test',
  plan: 'free',
};

describe('Activation Engine API', () => {
  let token: string;

  beforeAll(async () => {
    await createTestUser(ACTIVATION_USER);
    token = await getAuthToken(ACTIVATION_USER.id);
  });

  beforeEach(async () => {
    await resetTestData(ACTIVATION_USER.id);
  });

  afterAll(async () => {
    await resetTestData(ACTIVATION_USER.id);
  });

  describe('GET /api/activation', () => {
    it('returns activation status for authenticated user', async () => {
      const { status, data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(status).toBe(200);
      expect(data).toHaveProperty('servicesDone');
      expect(data).toHaveProperty('pricingDone');
      expect(data).toHaveProperty('paymentsDone');
      expect(data).toHaveProperty('linkDone');
      expect(data).toHaveProperty('quoteDone');
      expect(data).toHaveProperty('completedSteps');
      expect(data).toHaveProperty('totalSteps');
      expect(data).toHaveProperty('percentComplete');
      expect(data).toHaveProperty('isFullyActivated');
      expect(data.totalSteps).toBe(5);
    });

    it('requires authentication', async () => {
      const { status } = await apiRequest('GET', '/api/activation');
      expect(status).toBe(401);
    });

    it('starts with no steps completed for a fresh user', async () => {
      const { status, data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(status).toBe(200);
      expect(data.servicesDone).toBe(false);
      expect(data.pricingDone).toBe(false);
      expect(data.paymentsDone).toBe(false);
      expect(data.linkDone).toBe(false);
      expect(data.quoteDone).toBe(false);
      expect(data.completedSteps).toBe(0);
      expect(data.percentComplete).toBe(0);
      expect(data.isFullyActivated).toBe(false);
      expect(data.completedAt).toBeNull();
    });
  });

  describe('Activation step tracking', () => {
    it('marks services_done when user adds a service', async () => {
      await apiRequest('PATCH', '/api/profile', {
        services: ['Plumbing'],
      }, token);

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.servicesDone).toBe(true);
      expect(data.completedSteps).toBeGreaterThanOrEqual(1);
    });

    it('marks pricing_done when user sets a default price', async () => {
      await apiRequest('PATCH', '/api/profile', {
        defaultPrice: 5000,
      }, token);

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.pricingDone).toBe(true);
    });

    it('marks link_done when user enables public profile with slug', async () => {
      await apiRequest('PATCH', '/api/profile', {
        publicProfileEnabled: true,
        publicProfileSlug: 'test-activation-user',
      }, token);

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.linkDone).toBe(true);
    });

    it('marks quote_done when user has a sent invoice', async () => {
      await seedInvoice({
        userId: ACTIVATION_USER.id,
        clientName: 'Test Client',
        clientEmail: 'test@test.com',
        amount: 5000,
        status: 'sent',
        serviceDescription: 'Test service',
      });

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.quoteDone).toBe(true);
    });

    it('marks quote_done when user has a paid invoice', async () => {
      await seedInvoice({
        userId: ACTIVATION_USER.id,
        clientName: 'Test Client',
        clientEmail: 'test@test.com',
        amount: 5000,
        status: 'paid',
        serviceDescription: 'Test service',
      });

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.quoteDone).toBe(true);
    });

    it('does not mark quote_done for draft invoices', async () => {
      await seedInvoice({
        userId: ACTIVATION_USER.id,
        clientName: 'Test Client',
        amount: 5000,
        status: 'draft',
        serviceDescription: 'Test service',
      });

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.quoteDone).toBe(false);
    });
  });

  describe('POST /api/activation/refresh', () => {
    it('returns refreshed activation status', async () => {
      const { status, data } = await apiRequest('POST', '/api/activation/refresh', {}, token);
      expect(status).toBe(200);
      expect(data).toHaveProperty('servicesDone');
      expect(data).toHaveProperty('isFullyActivated');
    });

    it('requires authentication', async () => {
      const { status } = await apiRequest('POST', '/api/activation/refresh', {});
      expect(status).toBe(401);
    });

    it('reflects updated state after profile changes', async () => {
      await apiRequest('PATCH', '/api/profile', {
        services: ['Cleaning'],
        defaultPrice: 3000,
      }, token);

      const { data } = await apiRequest('POST', '/api/activation/refresh', {}, token);
      expect(data.servicesDone).toBe(true);
      expect(data.pricingDone).toBe(true);
      expect(data.completedSteps).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Percent and step calculations', () => {
    it('calculates correct percentage for partial completion', async () => {
      await apiRequest('PATCH', '/api/profile', {
        services: ['Plumbing'],
        defaultPrice: 5000,
      }, token);

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.servicesDone).toBe(true);
      expect(data.pricingDone).toBe(true);
      expect(data.completedSteps).toBe(2);
      expect(data.percentComplete).toBe(40);
    });

    it('calculates 20% for one step completed', async () => {
      await apiRequest('PATCH', '/api/profile', {
        services: ['Plumbing'],
      }, token);

      const { data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(data.completedSteps).toBe(1);
      expect(data.percentComplete).toBe(20);
    });
  });

  describe('Feature flag behavior', () => {
    it('returns a response even when feature flag may be disabled', async () => {
      const { status, data } = await apiRequest('GET', '/api/activation', undefined, token);
      expect(status).toBe(200);
      expect(data).toBeDefined();
      if (data.disabled) {
        expect(data.isFullyActivated).toBe(true);
        expect(data.percentComplete).toBe(100);
      } else {
        expect(typeof data.servicesDone).toBe('boolean');
        expect(typeof data.isFullyActivated).toBe('boolean');
      }
    });
  });
});
