import { getAdminApiKey } from '../tests/utils/adminKey';

export const TEST_USER = {
  id: 'e2e-test-user',
  name: 'E2E Test Worker',
  email: 'e2e-test@gigaid.test',
  plan: 'free',
};

export const TEST_USER_PRO = {
  id: 'e2e-test-pro',
  name: 'E2E Pro Worker',
  email: 'e2e-pro@gigaid.test',
  plan: 'pro',
};

export const BASE_URL = 'http://localhost:5000';
export const ADMIN_API_KEY = getAdminApiKey();

export const STRIPE_TEST_CARD = {
  number: '4242424242424242',
  exp: '12/30',
  cvc: '123',
};
