// End-to-end coverage for the opt-out roster sort options.
//
// The roster endpoint (GET /api/admin/sms/opt-outs) and its CSV export
// sibling (GET /api/admin/sms/opt-outs/export) accept a `sort` query
// param backed by the OPT_OUT_SORT_OPTIONS allow-list in
// server/admin/smsHealthRoutes.ts. If someone removes a key, mistypes a
// column, or weakens the allow-list to allow raw input, the API could
// either start sorting unexpectedly or open up an ORDER BY injection
// vector. This suite pins:
//
//   1. Each accepted sort key returns rows in the expected order:
//      optOutAt_desc / optOutAt_asc / name_asc / name_desc /
//      email_asc / email_desc.
//   2. Unknown / malformed sort values fall back to the default
//      (optOutAt_desc) instead of erroring or being passed through to
//      SQL (so attempts like `?sort=name; DROP TABLE users` cannot
//      change the ORDER BY).
//   3. The CSV export honors the same `sort` query param so the
//      downloaded file matches what the UI shows.
//
// Tests scope every assertion to the four users this suite seeds (via a
// per-run TAG in their email/username/name) so concurrent rows in the
// users table from other suites do not interfere.

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const dbDescribe =
  process.env.DATABASE_URL && process.env.APP_JWT_SECRET ? describe : describe.skip;

dbDescribe("GET /api/admin/sms/opt-outs sort options", () => {
  jest.setTimeout(30000);

  // Per-run tag scopes the `q` filter on the route to only the rows this
  // suite seeds, even when other tests / production data also have
  // smsOptOut=true users.
  const TAG = `optoutsort${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  // Seed plan: 4 users with intentionally-different orderings for each
  // sortable column so the per-key assertions below can tell them apart.
  //
  //   index | name       | email          | smsOptOutAt
  //   ------+------------+----------------+----------------------
  //     1   | TAG-Alpha  | TAG-d@         | 2025-01-01T00:00:00Z
  //     2   | TAG-Bravo  | TAG-c@         | 2025-02-01T00:00:00Z
  //     3   | TAG-Charlie| TAG-b@         | 2025-03-01T00:00:00Z
  //     4   | TAG-Delta  | TAG-a@         | 2025-04-01T00:00:00Z
  //
  // Expected orders (by index):
  //   optOutAt_desc -> 4,3,2,1   optOutAt_asc -> 1,2,3,4
  //   name_asc      -> 1,2,3,4   name_desc    -> 4,3,2,1
  //   email_asc     -> 4,3,2,1   email_desc   -> 1,2,3,4
  const seedPlan = [
    { idx: 1, name: `${TAG}-Alpha`, emailLocal: `${TAG}-d`, optOutAt: "2025-01-01T00:00:00.000Z" },
    { idx: 2, name: `${TAG}-Bravo`, emailLocal: `${TAG}-c`, optOutAt: "2025-02-01T00:00:00.000Z" },
    { idx: 3, name: `${TAG}-Charlie`, emailLocal: `${TAG}-b`, optOutAt: "2025-03-01T00:00:00.000Z" },
    { idx: 4, name: `${TAG}-Delta`, emailLocal: `${TAG}-a`, optOutAt: "2025-04-01T00:00:00.000Z" },
  ] as const;

  let adminToken: string;
  // Maps idx -> real DB user id; used to translate route responses into
  // the planned ordering.
  const idByIdx = new Map<number, string>();

  function authHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    };
  }

  async function fetchOptOutIds(sort?: string): Promise<string[]> {
    const params = new URLSearchParams();
    params.set("q", TAG);
    params.set("limit", "200");
    if (sort !== undefined) {
      params.set("sort", sort);
    }
    const res = await fetch(
      `${BASE_URL}/api/admin/sms/opt-outs?${params.toString()}`,
      { headers: authHeaders() },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: Array<{ id: string }>;
      sort: string;
      pagination: { total: number };
    };
    // Restrict to the IDs we actually seeded; the `q` filter also matches
    // username/phone, but other data should never include our TAG. This
    // keeps the assertion robust even if the route ever loosens scoping.
    const ourIds = new Set(idByIdx.values());
    const ids = body.users.map((u) => u.id).filter((id) => ourIds.has(id));
    expect(ids.length).toBe(seedPlan.length);
    return ids;
  }

  function expectOrder(actualIds: string[], expectedIdxOrder: number[]): void {
    const expectedIds = expectedIdxOrder.map((i) => {
      const id = idByIdx.get(i);
      if (!id) throw new Error(`No seeded id for idx=${i}`);
      return id;
    });
    expect(actualIds).toEqual(expectedIds);
  }

  beforeAll(async () => {
    const { signAppJwt } = await import("../../server/appJwt");
    const { db } = await import("../../server/db");
    const { users } = await import("@shared/schema");
    const { inArray } = await import("drizzle-orm");

    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs sub to
    // match — no real users row required.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });

    // Sanity: confirm no leftover rows from a prior run with this TAG
    // exist (TAG includes Date.now() so a collision is virtually
    // impossible, but cleaning defensively keeps the assertions clean).
    await db.delete(users).where(inArray(users.username, seedPlan.map((p) => `${TAG}-u${p.idx}`)));

    for (const plan of seedPlan) {
      const [row] = await db
        .insert(users)
        .values({
          username: `${TAG}-u${plan.idx}`,
          // Password column is NOT NULL on the users table; tests never
          // log in as these accounts so any non-empty value is fine.
          password: "test-sort-suite",
          name: plan.name,
          email: `${plan.emailLocal}@gigaid.test`,
          // `public_profile_slug` is NOT NULL (Task #217). Derive a unique
          // per-row slug from the TAG so concurrent test runs don't
          // collide on the unique index.
          publicProfileSlug: `${TAG}-slug-${plan.idx}`,
          smsOptOut: true,
          smsOptOutAt: plan.optOutAt,
          notifyBySms: false,
        })
        .returning({ id: users.id });
      if (!row?.id) throw new Error(`Failed to seed user idx=${plan.idx}`);
      idByIdx.set(plan.idx, row.id);
    }
  });

  afterAll(async () => {
    if (idByIdx.size === 0) return;
    const { db } = await import("../../server/db");
    const { users } = await import("@shared/schema");
    const { inArray } = await import("drizzle-orm");
    await db.delete(users).where(inArray(users.id, Array.from(idByIdx.values())));
  });

  describe("each accepted sort key orders the rows as documented", () => {
    const cases: Array<{ sort: string; expected: number[] }> = [
      { sort: "optOutAt_desc", expected: [4, 3, 2, 1] },
      { sort: "optOutAt_asc", expected: [1, 2, 3, 4] },
      { sort: "name_asc", expected: [1, 2, 3, 4] },
      { sort: "name_desc", expected: [4, 3, 2, 1] },
      { sort: "email_asc", expected: [4, 3, 2, 1] },
      { sort: "email_desc", expected: [1, 2, 3, 4] },
    ];

    it.each(cases)("sort=$sort returns rows in $expected order", async ({ sort, expected }) => {
      const ids = await fetchOptOutIds(sort);
      expectOrder(ids, expected);
    });

    it("echoes the resolved sort key back in the response body", async () => {
      const params = new URLSearchParams({ q: TAG, limit: "200", sort: "name_asc" });
      const res = await fetch(
        `${BASE_URL}/api/admin/sms/opt-outs?${params.toString()}`,
        { headers: authHeaders() },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sort: string };
      expect(body.sort).toBe("name_asc");
    });
  });

  describe("unknown / malformed sort values fall back to the default", () => {
    // The default is documented as optOutAt_desc, which for our seed
    // plan produces 4,3,2,1.
    const defaultOrder = [4, 3, 2, 1];

    it("missing ?sort uses the default", async () => {
      const ids = await fetchOptOutIds(undefined);
      expectOrder(ids, defaultOrder);
    });

    it("empty ?sort= uses the default", async () => {
      const ids = await fetchOptOutIds("");
      expectOrder(ids, defaultOrder);
    });

    it.each([
      "bogus",
      "createdAt_asc",
      // Wrong-case key: the allow-list compares case-sensitively so
      // this must NOT match optOutAt_desc.
      "OPTOUTAT_DESC",
      // SQL fragment shaped like an injection attempt — must be
      // rejected by the allow-list, not concatenated into ORDER BY.
      "name; DROP TABLE users",
      // Column name without a direction suffix.
      "email",
      // Numeric / non-string-ish values still come through as strings.
      "1",
    ])("?sort=%p falls back to the default", async (raw) => {
      const ids = await fetchOptOutIds(raw);
      expectOrder(ids, defaultOrder);
    });

    it("the response echoes the resolved (default) sort, not the raw input", async () => {
      const params = new URLSearchParams({ q: TAG, sort: "bogus", limit: "200" });
      const res = await fetch(
        `${BASE_URL}/api/admin/sms/opt-outs?${params.toString()}`,
        { headers: authHeaders() },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sort: string };
      expect(body.sort).toBe("optOutAt_desc");
    });
  });

  describe("GET /api/admin/sms/opt-outs/export honors the same sort key", () => {
    async function fetchExportIds(sort?: string): Promise<string[]> {
      const params = new URLSearchParams();
      params.set("q", TAG);
      if (sort !== undefined) {
        params.set("sort", sort);
      }
      const res = await fetch(
        `${BASE_URL}/api/admin/sms/opt-outs/export?${params.toString()}`,
        { headers: authHeaders() },
      );
      expect(res.status).toBe(200);
      expect((res.headers.get("content-type") || "").toLowerCase()).toContain("text/csv");
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.length > 0);
      // First line is the header — drop it. The rest are seeded users
      // (and possibly other opt-outs whose data still matches `q=TAG`,
      // which by construction should be none — TAG is unique per run).
      const dataRows = lines.slice(1);
      // First column is `id`; parse it accounting for CSV quoting.
      const ourIds = new Set(idByIdx.values());
      const ids = dataRows
        .map((row) => parseFirstCsvField(row))
        .filter((id) => ourIds.has(id));
      expect(ids.length).toBe(seedPlan.length);
      return ids;
    }

    const cases: Array<{ sort: string; expected: number[] }> = [
      { sort: "optOutAt_desc", expected: [4, 3, 2, 1] },
      { sort: "optOutAt_asc", expected: [1, 2, 3, 4] },
      { sort: "name_asc", expected: [1, 2, 3, 4] },
      { sort: "name_desc", expected: [4, 3, 2, 1] },
      { sort: "email_asc", expected: [4, 3, 2, 1] },
      { sort: "email_desc", expected: [1, 2, 3, 4] },
    ];

    it.each(cases)("CSV export with sort=$sort matches the JSON ordering", async ({ sort, expected }) => {
      const ids = await fetchExportIds(sort);
      expectOrder(ids, expected);
    });

    it("CSV export with unknown sort falls back to the default", async () => {
      const ids = await fetchExportIds("not-a-real-sort");
      expectOrder(ids, [4, 3, 2, 1]);
    });

    it("CSV export with no sort uses the default", async () => {
      const ids = await fetchExportIds(undefined);
      expectOrder(ids, [4, 3, 2, 1]);
    });
  });
});

// Minimal CSV first-field parser that handles RFC-4180-style quoting.
// The export route writes the `id` column first, and we only need that
// column to assert ordering, so a full CSV parser would be overkill.
function parseFirstCsvField(row: string): string {
  if (row.length === 0) return "";
  if (row[0] !== '"') {
    const comma = row.indexOf(",");
    return comma === -1 ? row : row.slice(0, comma);
  }
  // Quoted field — read until an unescaped closing quote.
  let i = 1;
  let out = "";
  while (i < row.length) {
    const ch = row[i];
    if (ch === '"') {
      if (row[i + 1] === '"') {
        out += '"';
        i += 2;
        continue;
      }
      return out;
    }
    out += ch;
    i += 1;
  }
  return out;
}
