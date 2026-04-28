/**
 * Field-contract coverage for `POST /api/quote-estimate` (Smart Pricing).
 *
 * Why this exists: Task #159 — the Smart Pricing page (`AutoQuotePage.tsx`)
 * silently broke once because the route returns
 * `suggestedPriceLow` / `suggestedPriceHigh` / `suggestedPriceMedian`
 * but the frontend `QuoteEstimate` interface was reading `low` / `high`
 * / `median`. Every successful response rendered "--" / "$NaN" with no
 * test failure to flag it.
 *
 * These cases lock the server-side response shape so any future rename
 * of those three fields fails CI immediately, before the broken page
 * ships.
 */

import { apiRequest, createTestUser, resetTestData, getAuthToken, createSuiteUsers } from './setup';

// The DB enforces that any job in `completed` status has a
// job_resolution row (server/dbEnforcement.ts). The seed-job
// shortcut therefore can't insert completed rows directly — we have
// to walk the legitimate flow: create scheduled job → add resolution
// → PATCH to completed. Wrap that here so each iteration in the
// historical-branch test is one call.
async function createCompletedJob(token: string, overrides: { price: number; serviceType: string }) {
  const created = await apiRequest(
    'POST',
    '/api/jobs',
    {
      title: `Historical job ${overrides.price}`,
      clientName: 'Historical Client',
      serviceType: overrides.serviceType,
      scheduledDate: '2026-01-15',
      scheduledTime: '10:00',
      price: overrides.price,
    },
    token,
  );
  if (created.status !== 201) {
    throw new Error(`createCompletedJob: create failed (${created.status}): ${JSON.stringify(created.data)}`);
  }
  const jobId = created.data.id;

  const resolution = await apiRequest(
    'POST',
    `/api/jobs/${jobId}/resolution`,
    { resolutionType: 'waived', waiverReason: 'internal' },
    token,
  );
  if (![200, 201].includes(resolution.status)) {
    throw new Error(`createCompletedJob: resolution failed (${resolution.status}): ${JSON.stringify(resolution.data)}`);
  }

  const completion = await apiRequest(
    'PATCH',
    `/api/jobs/${jobId}`,
    { status: 'completed' },
    token,
  );
  if (completion.status !== 200) {
    throw new Error(`createCompletedJob: completion failed (${completion.status}): ${JSON.stringify(completion.data)}`);
  }
  return jobId;
}

const { userA } = createSuiteUsers('quote-estimate');

const REQUIRED_PRICE_FIELDS = [
  'suggestedPriceLow',
  'suggestedPriceHigh',
  'suggestedPriceMedian',
] as const;

// Fields the frontend used to read by mistake. If any of these reappear
// at the top level of the response, the test should flag it so we
// don't accidentally introduce another field-name mismatch.
// Task #165: `averageDuration` is added here because the page used to
// read that name while the route only ever returned `avgDurationMinutes`,
// so the duration tile silently never rendered.
const FORBIDDEN_LEGACY_FIELDS = ['low', 'high', 'median', 'averageDuration'] as const;

describe('POST /api/quote-estimate field contract (Task #159)', () => {
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

  it('returns suggestedPriceLow / High / Median when there is enough job history', async () => {
    // Walk 3+ jobs through the legitimate complete-with-resolution
    // flow so the route takes the deterministic "historical" branch —
    // that branch does not depend on OpenAI being reachable from CI.
    const serviceType = `handyman-${Date.now()}`;
    for (const price of [8000, 12000, 16000, 20000]) {
      await createCompletedJob(tokenA, { price, serviceType });
    }

    const { status, data } = await apiRequest(
      'POST',
      '/api/quote-estimate',
      { jobType: serviceType, location: 'Austin, TX', description: 'Standard job' },
      tokenA,
    );

    expect(status).toBe(200);
    expect(data).toBeTruthy();

    // Field-name contract: every key the page reads must be present
    // and finite. Without this, a rename on the server side would
    // silently break the Smart Pricing card again.
    for (const field of REQUIRED_PRICE_FIELDS) {
      expect(data).toHaveProperty(field);
      expect(typeof data[field]).toBe('number');
      expect(Number.isFinite(data[field])).toBe(true);
      expect(data[field]).toBeGreaterThan(0);
    }

    // Task #165: the duration tile reads `avgDurationMinutes`. Lock
    // the canonical name on every successful response so the tile
    // never silently disappears again.
    expect(data).toHaveProperty('avgDurationMinutes');
    expect(typeof data.avgDurationMinutes).toBe('number');
    expect(Number.isFinite(data.avgDurationMinutes)).toBe(true);
    expect(data.avgDurationMinutes).toBeGreaterThan(0);

    // Guard against the historical mismatch returning. The server
    // must NOT expose the short `low` / `high` / `median` names at
    // the top level, because that's what the broken interface used to
    // read. `averageDuration` is forbidden for the same reason
    // (Task #165).
    for (const legacy of FORBIDDEN_LEGACY_FIELDS) {
      expect(data).not.toHaveProperty(legacy);
    }

    // Sanity: the response also identifies the source so the page
    // can render the "Based on your history" badge correctly.
    expect(data.source).toBe('historical');
  });

  it('returns the same field shape on the fallback branch (no history, no AI)', async () => {
    // No seeded jobs => the route enters the AI branch. If the OpenAI
    // call throws (e.g. CI without network), the route falls through
    // to the static "default" object — which must STILL use the
    // canonical suggestedPrice* field names so the page never sees
    // `low` / `high` / `median`. This case is what locks the
    // top-level fallback object in server/routes.ts to the contract.
    const serviceType = `cleaning-${Date.now()}`;
    const { status, data } = await apiRequest(
      'POST',
      '/api/quote-estimate',
      { jobType: serviceType, location: 'Austin, TX', description: '' },
      tokenA,
    );

    expect(status).toBe(200);
    expect(data).toBeTruthy();

    for (const field of REQUIRED_PRICE_FIELDS) {
      expect(data).toHaveProperty(field);
      expect(typeof data[field]).toBe('number');
      expect(Number.isFinite(data[field])).toBe(true);
      expect(data[field]).toBeGreaterThan(0);
    }

    // Task #165: the duration field must also be present on the
    // fallback branch, under the canonical `avgDurationMinutes`
    // name. The static default object in server/routes.ts sets it
    // to 60.
    expect(data).toHaveProperty('avgDurationMinutes');
    expect(typeof data.avgDurationMinutes).toBe('number');
    expect(Number.isFinite(data.avgDurationMinutes)).toBe(true);
    expect(data.avgDurationMinutes).toBeGreaterThan(0);

    for (const legacy of FORBIDDEN_LEGACY_FIELDS) {
      expect(data).not.toHaveProperty(legacy);
    }
  });

  it('rejects the request without a jobType (basic validation still in place)', async () => {
    const { status } = await apiRequest(
      'POST',
      '/api/quote-estimate',
      { location: 'Austin, TX' },
      tokenA,
    );
    expect(status).toBe(400);
  });
});
