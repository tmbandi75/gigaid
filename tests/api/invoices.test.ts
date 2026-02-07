import { apiRequest, createTestUser, resetTestData, getAuthToken, TEST_USER_A } from './setup';

describe('Invoices API', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(TEST_USER_A);
    tokenA = await getAuthToken(TEST_USER_A.id);
  });

  beforeEach(async () => {
    await resetTestData(TEST_USER_A.id);
  });

  afterAll(async () => {
    await resetTestData(TEST_USER_A.id);
  });

  const validInvoice = {
    clientName: 'Bob Builder',
    serviceDescription: 'Kitchen renovation',
    amount: 25000,
    invoiceNumber: 'INV-TEST-001',
    userId: 'should-be-ignored',
  };

  describe('POST /api/invoices', () => {
    it('creates an invoice successfully', async () => {
      const { status, data } = await apiRequest('POST', '/api/invoices', validInvoice, tokenA);
      expect(status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.clientName).toBe(validInvoice.clientName);
      expect(data.serviceDescription).toBe(validInvoice.serviceDescription);
      expect(data.amount).toBe(validInvoice.amount);
      expect(data.invoiceNumber).toBe(validInvoice.invoiceNumber);
    });

    it('uses authenticated user ID', async () => {
      const { status, data } = await apiRequest('POST', '/api/invoices', validInvoice, tokenA);
      expect(status).toBe(201);
      expect(data.userId).not.toBe('should-be-ignored');
    });
  });

  describe('GET /api/invoices', () => {
    it('returns only auth user\'s invoices', async () => {
      await apiRequest('POST', '/api/invoices', validInvoice, tokenA);
      const { status, data } = await apiRequest('GET', '/api/invoices', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].clientName).toBe(validInvoice.clientName);
    });

    it('returns empty array when user has no invoices', async () => {
      const { status, data } = await apiRequest('GET', '/api/invoices', undefined, tokenA);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('PATCH /api/invoices/:id', () => {
    it('updates invoice fields', async () => {
      const { data: created } = await apiRequest('POST', '/api/invoices', validInvoice, tokenA);
      const { status, data } = await apiRequest('PATCH', `/api/invoices/${created.id}`, {
        clientName: 'Updated Client',
        amount: 30000,
      }, tokenA);
      expect(status).toBe(200);
      expect(data.clientName).toBe('Updated Client');
      expect(data.amount).toBe(30000);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('returns a specific invoice', async () => {
      const { data: created } = await apiRequest('POST', '/api/invoices', validInvoice, tokenA);
      const { status, data } = await apiRequest('GET', `/api/invoices/${created.id}`, undefined, tokenA);
      expect(status).toBe(200);
      expect(data.id).toBe(created.id);
      expect(data.clientName).toBe(validInvoice.clientName);
    });
  });
});
