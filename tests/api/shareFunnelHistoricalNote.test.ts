// Server-side coverage for the /api/admin/analytics/share-funnel
// `notes.historical` field added in Task #107.
//
// Why this exists: Task #107 added a top-level "Historical PostHog data"
// explainer to the share-funnel response so the admin UI can warn
// reviewers that pre-Task #98 PostHog `booking_link_shared` totals are
// inflated. The Admin Analytics page only renders the explainer when
// `notes.historical` comes back as a truthy string. If a future
// refactor of server/admin/analyticsRoutes.ts strips that note from the
// response, the UI guard silently hides the explainer and reviewers
// once again misread the historical PostHog data without anyone
// noticing.
//
// This test mirrors the existing share-funnel API tests (see
// tests/api/bookingLinkShareFunnel.test.ts and
// tests/api/shareFunnelPlatform.test.ts) — same admin-bootstrap pattern,
// same dbDescribe gate so the suite skips cleanly when the DB env vars
// aren't present.

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const dbDescribe =
  process.env.DATABASE_URL && process.env.APP_JWT_SECRET ? describe : describe.skip;

dbDescribe("GET /api/admin/analytics/share-funnel — notes.historical", () => {
  jest.setTimeout(30000);

  let adminToken: string;

  beforeAll(async () => {
    const { signAppJwt } = await import("../../server/appJwt");
    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs `sub` to
    // match — the bootstrap check does not require a real users row.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });
  });

  it("returns a non-empty notes.historical string explaining the Task #98 semantic change", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel?days=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { notes?: Record<string, string> };

    // The UI only renders the historical-data note when this field is
    // truthy. We assert it's a real string with a meaningful length so
    // a refactor that swaps it for `null`, `""`, or removes the key
    // entirely will trip the guard.
    expect(body.notes).toBeDefined();
    expect(typeof body.notes?.historical).toBe("string");
    expect((body.notes!.historical || "").length).toBeGreaterThan(0);

    // The exact wording can be tuned without breaking this guard, but
    // the note's core purpose — explaining that historical PostHog
    // totals are inflated and pointing reviewers at Task #98 — must
    // remain in the copy. Without these anchors the note loses the
    // information that motivated Task #107 in the first place.
    const note = body.notes!.historical;
    expect(note).toMatch(/Task #98/);
    expect(note.toLowerCase()).toMatch(/posthog/);
    expect(note.toLowerCase()).toMatch(/inflated/);
  });
});
