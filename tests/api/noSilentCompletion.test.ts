/**
 * No Silent Completion Regression Test
 *
 * CRITICAL: These tests MUST pass. They guard the revenue-protection
 * enforcement that prevents jobs from being marked as completed without
 * an associated resolution (invoice, recorded payment, or waiver).
 *
 * The same checks were previously exposed via a non-Jest endpoint
 * (POST /api/test/no-silent-completion). They now live as a real Jest
 * suite under the `api` project so they run as part of the standard
 * automated test pipeline.
 */
import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers } from './setup';

const { userA } = createSuiteUsers('no-silent-completion');

const baseJob = {
  title: 'Enforcement Test Job',
  clientName: 'Enforcement Test Client',
  clientPhone: '555-0000',
  serviceType: 'Test Service',
  scheduledDate: '2026-03-15',
  scheduledTime: '10:00',
  price: 10000,
};

describe('No Silent Completion enforcement', () => {
  let tokenA: string;

  beforeAll(async () => {
    await createTestUser(userA);
    tokenA = await getAuthToken(userA.id);
  });

  beforeEach(async () => {
    await resetTestData(userA.id);
  });

  afterAll(async () => {
    await resetTestData(userA.id);
  });

  describe('UPDATE path', () => {
    it('rejects PATCH to status="completed" with 409 when there is no resolution', async () => {
      const created = await apiRequest('POST', '/api/jobs', baseJob, tokenA);
      expect(created.status).toBe(201);

      const completion = await apiRequest(
        'PATCH',
        `/api/jobs/${created.data.id}`,
        { status: 'completed' },
        tokenA,
      );

      expect(completion.status).toBe(409);
      expect(completion.data?.code).toBe('RESOLUTION_REQUIRED');

      const stillScheduled = await apiRequest(
        'GET',
        `/api/jobs/${created.data.id}`,
        undefined,
        tokenA,
      );
      expect(stillScheduled.status).toBe(200);
      expect(stillScheduled.data.status).not.toBe('completed');
    });
  });

  describe('INSERT path', () => {
    it('does not allow creating a job that is already "completed" without a resolution', async () => {
      const created = await apiRequest(
        'POST',
        '/api/jobs',
        { ...baseJob, status: 'completed' },
        tokenA,
      );

      // The DB-level trigger raises P0001 / RESOLUTION_REQUIRED.
      // The route surfaces this as a non-2xx response. We only require
      // that the request is rejected — never a silent 2xx success.
      expect(created.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Legitimate flow', () => {
    it('allows completion once a resolution has been created', async () => {
      const created = await apiRequest('POST', '/api/jobs', baseJob, tokenA);
      expect(created.status).toBe(201);

      const resolution = await apiRequest(
        'POST',
        `/api/jobs/${created.data.id}/resolution`,
        { resolutionType: 'waived', waiverReason: 'internal' },
        tokenA,
      );
      expect([200, 201]).toContain(resolution.status);

      const completion = await apiRequest(
        'PATCH',
        `/api/jobs/${created.data.id}`,
        { status: 'completed' },
        tokenA,
      );

      expect(completion.status).toBe(200);
      // The PATCH route returns either the job directly or a wrapped
      // response when an invoice was auto-created. Both shapes should
      // surface the completed status.
      const completedStatus =
        completion.data?.status ?? completion.data?.job?.status;
      expect(completedStatus).toBe('completed');
    });
  });
});
