import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  const baseUrl = 'http://localhost:5000';

  test.describe('Jobs API', () => {
    test('GET /api/jobs should return jobs list', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/jobs`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  test.describe('Leads API', () => {
    test('GET /api/leads should return leads list', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/leads`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  test.describe('Invoices API', () => {
    test('GET /api/invoices should return invoices list', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/invoices`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  test.describe('Admin API', () => {
    test('GET /api/admin/users/search should work', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/admin/users/search?q=demo`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.users).toBeDefined();
    });

    test('GET /api/admin/users/views should work', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/admin/users/views?view=onboarding_stalled`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.users).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    test('GET /api/admin/users/:id should return user detail', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/admin/users/demo-user`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.profile).toBeDefined();
      expect(data.funnelState).toBeDefined();
    });

    test('POST /api/admin/users/:id/actions should require reason', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/admin/users/demo-user/actions`, {
        data: {
          action_key: 'add_note',
          reason: '',
          payload: { note: 'test' }
        }
      });
      
      expect(response.status()).toBe(400);
    });

    test('POST /api/admin/users/:id/actions should reject invalid action keys', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/admin/users/demo-user/actions`, {
        data: {
          action_key: 'delete_user',
          reason: 'test'
        }
      });
      
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Admin Tests API', () => {
    test('POST /api/test/admin-users should run admin tests', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/test/admin-users`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.passed).toBe(true);
      expect(data.total).toBeGreaterThan(0);
    });
  });

  test.describe('Copilot API', () => {
    test('GET /api/copilot/metrics should return metrics', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/copilot/metrics`);
      expect(response.status()).toBe(200);
    });

    test('GET /api/copilot/focus should return focus recommendations', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/copilot/focus`);
      expect(response.status()).toBe(200);
    });
  });
});
