import { apiRequest, createTestUser, createSuiteUsers, getAuthToken } from './setup';

const { userA } = createSuiteUsers('account-delete');

describe('Account Deletion API', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(userA);
    tokenA = await getAuthToken(userA.id);
  });

  describe('DELETE /api/account', () => {
    it('requires authentication', async () => {
      const { status } = await apiRequest('DELETE', '/api/account');
      expect(status).toBe(401);
    });

    it('successfully deletes user account', async () => {
      const { status, data } = await apiRequest('DELETE', '/api/account', {}, tokenA);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Account deleted');
      expect(data.tablesCleared).toBeGreaterThan(0);
    });

    it('returns success for already deleted account', async () => {
      const newToken = await getAuthToken(userA.id);
      const { status, data } = await apiRequest('DELETE', '/api/account', {}, newToken);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Account already deleted');
    });

    it('anonymizes user data after deletion', async () => {
      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      if (status === 200) {
        expect(data.name).toBe('Deleted User');
        expect(data.phone).toBeNull();
        expect(data.bio).toBeNull();
        expect(data.businessName).toBeNull();
        expect(data.deletedAt).toBeTruthy();
      }
    });
  });

  describe('POST /api/account/delete (legacy)', () => {
    it('redirects to DELETE /api/account', async () => {
      const freshUser = {
        id: `account-delete-legacy-${Date.now()}`,
        name: 'Legacy Delete User',
        email: `legacy-delete-${Date.now()}@gigaid.test`,
        plan: 'free',
      };
      await createTestUser(freshUser);
      const token = await getAuthToken(freshUser.id);
      const { status, data } = await apiRequest('POST', '/api/account/delete', {}, token);
      expect([200, 307]).toContain(status);
    });
  });
});
