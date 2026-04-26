import { apiRequest, createTestUser, resetTestData, createSuiteUsers } from './setup';
import { ns } from '../utils/testNamespace';

const { userA } = createSuiteUsers('legacy-slug');
const CUSTOM_SLUG = ns('legacy-slug-custom');

describe('Public booking — legacy `user-XXXXXXXX` slug fallback', () => {
  let userId: string;
  let legacySlug: string;

  beforeAll(async () => {
    const created = await createTestUser(userA);
    userId = created.userId;
    legacySlug = `user-${userId.slice(0, 8).toLowerCase()}`;

    await apiRequest('POST', '/api/test/set-slug', {
      userId,
      slug: CUSTOM_SLUG,
    });
  });

  afterAll(async () => {
    await resetTestData(userId);
  });

  it('redirects a legacy `user-<first 8 hex chars>` URL to the user’s current slug', async () => {
    const { status, data } = await apiRequest('GET', `/api/public/profile/${legacySlug}`);
    expect(status).toBe(200);
    expect(data).toEqual({ redirect: CUSTOM_SLUG });
  });

  it('accepts the same legacy form regardless of letter case', async () => {
    const upperLegacy = `user-${userId.slice(0, 8).toUpperCase()}`;
    const { status, data } = await apiRequest('GET', `/api/public/profile/${upperLegacy}`);
    expect(status).toBe(200);
    expect(data).toEqual({ redirect: CUSTOM_SLUG });
  });

  it('still 404s for a `user-<8 hex>` form that matches no real user', async () => {
    const { status, data } = await apiRequest('GET', '/api/public/profile/user-99999999');
    expect(status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });

  it('serves the booking profile directly when the URL slug already matches the current slug (no redirect)', async () => {
    const { status, data } = await apiRequest('GET', `/api/public/profile/${CUSTOM_SLUG}`);
    expect(status).toBe(200);
    expect(data).not.toHaveProperty('redirect');
    expect(data).toHaveProperty('name');
  });

  it('keeps working for the legacy form when the user has not customized their slug', async () => {
    // Reset the slug back to the auto-generated form for this case.
    await apiRequest('POST', '/api/test/set-slug', {
      userId,
      slug: legacySlug,
    });

    const { status, data } = await apiRequest('GET', `/api/public/profile/${legacySlug}`);
    expect(status).toBe(200);
    expect(data).not.toHaveProperty('redirect');
    expect(data).toHaveProperty('name');

    // Restore the customized slug so any later ordering of cases stays clean.
    await apiRequest('POST', '/api/test/set-slug', {
      userId,
      slug: CUSTOM_SLUG,
    });
  });
});
