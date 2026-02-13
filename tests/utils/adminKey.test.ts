import { getAdminApiKey } from './adminKey';

describe('getAdminApiKey', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns GIGAID_ADMIN_API_KEY when set', () => {
    process.env.GIGAID_ADMIN_API_KEY = 'gigaid-key';
    process.env.TEST_ADMIN_API_KEY = 'test-key';
    process.env.ADMIN_API_KEY = 'admin-key';
    expect(getAdminApiKey()).toBe('gigaid-key');
  });

  it('falls back to TEST_ADMIN_API_KEY when GIGAID_ADMIN_API_KEY is not set', () => {
    delete process.env.GIGAID_ADMIN_API_KEY;
    process.env.TEST_ADMIN_API_KEY = 'test-key';
    process.env.ADMIN_API_KEY = 'admin-key';
    expect(getAdminApiKey()).toBe('test-key');
  });

  it('falls back to ADMIN_API_KEY when higher-priority vars are not set', () => {
    delete process.env.GIGAID_ADMIN_API_KEY;
    delete process.env.TEST_ADMIN_API_KEY;
    process.env.ADMIN_API_KEY = 'admin-key';
    expect(getAdminApiKey()).toBe('admin-key');
  });

  it('returns hardcoded default when no env vars are set', () => {
    delete process.env.GIGAID_ADMIN_API_KEY;
    delete process.env.TEST_ADMIN_API_KEY;
    delete process.env.ADMIN_API_KEY;
    expect(getAdminApiKey()).toBe('test_admin_key');
  });

  it('skips empty string values in fallback chain', () => {
    process.env.GIGAID_ADMIN_API_KEY = '';
    process.env.TEST_ADMIN_API_KEY = 'test-key';
    expect(getAdminApiKey()).toBe('test-key');
  });
});
