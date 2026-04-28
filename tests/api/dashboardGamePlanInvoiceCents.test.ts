import {
  apiRequest,
  createTestUser,
  getAuthToken,
  resetTestData,
  seedInvoice,
  createSuiteUsers,
} from './setup';

const { userA } = createSuiteUsers('game-plan-invoice-cents');

describe('GET /api/dashboard/game-plan invoice action items preserve cents', () => {
  let token: string;

  beforeAll(async () => {
    await createTestUser(userA);
    token = await getAuthToken(userA.id);
  });

  beforeEach(async () => {
    await resetTestData(userA.id);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
  });

  it('renders draft invoice subtitle with exact dollars and cents', async () => {
    await seedInvoice({
      userId: userA.id,
      clientName: 'Cents Client',
      amount: 12345,
      status: 'draft',
      serviceDescription: 'Job with cents',
    });

    const { status, data } = await apiRequest(
      'GET',
      '/api/dashboard/game-plan',
      undefined,
      token,
    );

    expect(status).toBe(200);
    const items = [data.priorityItem, ...(data.upNextItems || [])].filter(Boolean);
    const invoiceItem = items.find(
      (it: any) => it && it.type === 'invoice' && it.title?.includes('Cents Client'),
    );
    expect(invoiceItem).toBeDefined();
    expect(invoiceItem.subtitle).toBe('$123.45 • Draft');
    expect(invoiceItem.subtitle).not.toContain('$123 ');
  });
});
