import {
  shouldFireNBAShown,
  nbaShownDedupeKey,
  _resetNBAShownDedupeForTests,
} from "../../client/src/lib/nbaAnalytics";

beforeEach(() => {
  _resetNBAShownDedupeForTests();
});

describe("nba_shown analytics dedupe", () => {
  it("fires on the first time a (user, state) is seen and only that once", () => {
    expect(shouldFireNBAShown("user-a", "NEW_USER")).toBe(true);
    expect(shouldFireNBAShown("user-a", "NEW_USER")).toBe(false);
    expect(shouldFireNBAShown("user-a", "NEW_USER")).toBe(false);
  });

  it("fires again when the same user transitions to a new state", () => {
    expect(shouldFireNBAShown("user-a", "NEW_USER")).toBe(true);
    expect(shouldFireNBAShown("user-a", "NO_JOBS_YET")).toBe(true);
    expect(shouldFireNBAShown("user-a", "READY_TO_INVOICE")).toBe(true);
    // Re-entering an old state in the same session is suppressed.
    expect(shouldFireNBAShown("user-a", "NEW_USER")).toBe(false);
  });

  it("treats different users as independent dedupe scopes", () => {
    expect(shouldFireNBAShown("user-a", "IN_PROGRESS")).toBe(true);
    expect(shouldFireNBAShown("user-b", "IN_PROGRESS")).toBe(true);
    expect(shouldFireNBAShown("user-a", "IN_PROGRESS")).toBe(false);
    expect(shouldFireNBAShown("user-b", "IN_PROGRESS")).toBe(false);
  });

  it("uses an 'anon' scope when no userId is provided", () => {
    expect(nbaShownDedupeKey(undefined, "NEW_USER")).toBe("anon:NEW_USER");
    expect(shouldFireNBAShown(undefined, "NEW_USER")).toBe(true);
    expect(shouldFireNBAShown(undefined, "NEW_USER")).toBe(false);
    // Once the user signs in, the per-user scope is fresh.
    expect(shouldFireNBAShown("user-a", "NEW_USER")).toBe(true);
  });
});
