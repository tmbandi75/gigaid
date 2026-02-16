import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers } from './setup';

const { userA } = createSuiteUsers('analytics-prefs');

describe('Analytics Preferences API', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(userA);
    tokenA = await getAuthToken(userA.id);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
  });

  describe('GET /api/profile includes analytics fields', () => {
    it('returns analytics preference fields with defaults', async () => {
      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      expect(status).toBe(200);
      expect(data).toHaveProperty('analyticsEnabled', false);
      expect(data).toHaveProperty('attStatus', 'unknown');
      expect(data).toHaveProperty('attPromptedAt', null);
      expect(data).toHaveProperty('analyticsDisabledReason', null);
    });
  });

  describe('PATCH /api/profile/analytics-preferences', () => {
    it('updates analytics_enabled to true', async () => {
      const { status, data } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: true,
      }, tokenA);
      expect(status).toBe(200);
      expect(data.analyticsEnabled).toBe(true);
    });

    it('updates att_status and att_prompted_at', async () => {
      const now = new Date().toISOString();
      const { status, data } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        attStatus: 'denied',
        attPromptedAt: now,
        analyticsDisabledReason: 'att_denied',
      }, tokenA);
      expect(status).toBe(200);
      expect(data.attStatus).toBe('denied');
      expect(data.attPromptedAt).toBe(now);
      expect(data.analyticsDisabledReason).toBe('att_denied');
    });

    it('persists att_status=denied and reflects in profile', async () => {
      await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        attStatus: 'denied',
        analyticsEnabled: false,
        analyticsDisabledReason: 'att_denied',
      }, tokenA);

      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      expect(status).toBe(200);
      expect(data.attStatus).toBe('denied');
      expect(data.analyticsEnabled).toBe(false);
      expect(data.analyticsDisabledReason).toBe('att_denied');
    });

    it('rejects invalid att_status', async () => {
      const { status } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        attStatus: 'invalid_status',
      }, tokenA);
      expect(status).toBe(400);
    });

    it('rejects invalid analytics_enabled type', async () => {
      const { status } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: 'yes',
      }, tokenA);
      expect(status).toBe(400);
    });

    it('rejects invalid analytics_disabled_reason', async () => {
      const { status } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsDisabledReason: 'bad_reason',
      }, tokenA);
      expect(status).toBe(400);
    });

    it('allows clearing analytics_disabled_reason with null', async () => {
      const { status, data } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: true,
        analyticsDisabledReason: null,
      }, tokenA);
      expect(status).toBe(200);
      expect(data.analyticsDisabledReason).toBeNull();
    });

    it('records user_disabled reason when toggle off', async () => {
      const { status, data } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: false,
        analyticsDisabledReason: 'user_disabled',
      }, tokenA);
      expect(status).toBe(200);
      expect(data.analyticsEnabled).toBe(false);
      expect(data.analyticsDisabledReason).toBe('user_disabled');
    });

    it('requires auth', async () => {
      const { status } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: true,
      });
      expect(status).toBe(401);
    });
  });

  describe('ATT denied no-reprompt state persistence', () => {
    it('persists denied state so auto-prompt path would be blocked', async () => {
      const now = new Date().toISOString();
      await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: true,
        attStatus: 'denied',
        attPromptedAt: now,
        analyticsDisabledReason: 'att_denied',
      }, tokenA);

      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      expect(status).toBe(200);
      expect(data.attStatus).toBe('denied');
      expect(data.attPromptedAt).toBe(now);
      expect(data.analyticsDisabledReason).toBe('att_denied');
    });

    it('records restricted status correctly', async () => {
      const { status, data } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        attStatus: 'restricted',
        analyticsEnabled: false,
        analyticsDisabledReason: 'restricted',
      }, tokenA);
      expect(status).toBe(200);
      expect(data.attStatus).toBe('restricted');
      expect(data.analyticsDisabledReason).toBe('restricted');
    });

    it('transition from denied to authorized (user changed iOS settings externally)', async () => {
      await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        attStatus: 'denied',
        analyticsEnabled: false,
        analyticsDisabledReason: 'att_denied',
      }, tokenA);

      const { status, data } = await apiRequest('PATCH', '/api/profile/analytics-preferences', {
        analyticsEnabled: true,
        attStatus: 'authorized',
        analyticsDisabledReason: null,
      }, tokenA);
      expect(status).toBe(200);
      expect(data.analyticsEnabled).toBe(true);
      expect(data.attStatus).toBe('authorized');
      expect(data.analyticsDisabledReason).toBeNull();
    });
  });
});
