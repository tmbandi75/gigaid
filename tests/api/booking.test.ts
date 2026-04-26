import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers, getApp } from './setup';
import { ns } from '../utils/testNamespace';

const { userA } = createSuiteUsers('booking');

describe('Booking API', () => {
  let tokenA: string;
  const testSlug = ns('booking-test-slug');

  beforeAll(async () => {
    await createTestUser(userA);
    tokenA = await getAuthToken(userA.id);
  });

  beforeEach(async () => {
    await resetTestData(userA.id);
    await apiRequest('PATCH', '/api/settings', {
      publicProfileSlug: testSlug,
      publicProfileEnabled: true,
    }, tokenA);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
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

  // Regression for Task #128: every booking link the server hands to the
  // client must use the configured booking host (account.gigaid.ai by
  // default) — never the request's Host header, never localhost, never the
  // legacy `gigaid.ai/book/...` URL.
  describe('Task #128: booking link host', () => {
    it('GET /api/booking/link returns a URL on the account.gigaid.ai host (not the request host)', async () => {
      const { status, data } = await apiRequest('GET', '/api/booking/link', undefined, tokenA);
      expect(status).toBe(200);
      expect(typeof data.bookingLink).toBe('string');
      expect(data.bookingLink).toMatch(/^https:\/\/account\.gigaid\.ai\/book\//);
      expect(data.bookingLink.endsWith(`/book/${testSlug}`)).toBe(true);
      expect(data.bookingLink).not.toMatch(/localhost/i);
      expect(data.bookingLink).not.toMatch(/^https?:\/\/gigaid\.ai\//);
    });

    it('GET /api/profile returns the same account.gigaid.ai booking link', async () => {
      const { status, data } = await apiRequest('GET', '/api/profile', undefined, tokenA);
      expect(status).toBe(200);
      expect(typeof data.bookingLink).toBe('string');
      expect(data.bookingLink).toMatch(/^https:\/\/account\.gigaid\.ai\/book\//);
      expect(data.bookingLink.endsWith(`/book/${testSlug}`)).toBe(true);
    });

    it('ignores a hostile Host header — booking link still uses account.gigaid.ai', async () => {
      const { baseUrl } = getApp();
      const res = await fetch(`${baseUrl}/api/booking/link`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
          'Host': 'evil.example.com',
          'X-Forwarded-Host': 'evil.example.com',
          'X-Forwarded-Proto': 'http',
          ...(process.env.ADMIN_API_KEY ? { 'x-admin-api-key': process.env.ADMIN_API_KEY } : {}),
        },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.bookingLink).toMatch(/^https:\/\/account\.gigaid\.ai\/book\//);
      expect(data.bookingLink).not.toMatch(/evil\.example\.com/);
      expect(data.bookingLink).not.toMatch(/localhost/i);
    });
  });
});
