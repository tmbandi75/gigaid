import {
  hasSharedBookingLinkLocally,
  markBookingLinkShared,
} from "../../client/src/lib/bookingLinkShared";

const STORAGE_KEY_PREFIX = "gigaid:hasSharedBookingLink";

beforeEach(() => {
  window.localStorage.clear();
});

describe("bookingLinkShared local flag", () => {
  it("returns false by default for any user", () => {
    expect(hasSharedBookingLinkLocally()).toBe(false);
    expect(hasSharedBookingLinkLocally("user-a")).toBe(false);
  });

  it("persists the flag for an identified user", () => {
    markBookingLinkShared("user-a");
    expect(hasSharedBookingLinkLocally("user-a")).toBe(true);
    expect(window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:user-a`)).toBe(
      "1",
    );
  });

  it("does NOT leak the shared flag across two accounts on the same browser", () => {
    // The whole reason this task exists: switching accounts must not carry
    // user A's NO_JOBS_YET state into user B's brand-new dashboard.
    markBookingLinkShared("user-a");

    expect(hasSharedBookingLinkLocally("user-a")).toBe(true);
    expect(hasSharedBookingLinkLocally("user-b")).toBe(false);
  });

  it("keeps anonymous and identified flags isolated", () => {
    markBookingLinkShared(); // anonymous (pre-login)
    expect(hasSharedBookingLinkLocally()).toBe(true);
    // A subsequently-identified user should not inherit the anon flag.
    expect(hasSharedBookingLinkLocally("user-a")).toBe(false);
  });

  it("preserves user A's flag after user B logs in and out", () => {
    markBookingLinkShared("user-a");
    // Simulate user B signing in and never sharing.
    expect(hasSharedBookingLinkLocally("user-b")).toBe(false);
    // User A signs back in and should still see their flag.
    expect(hasSharedBookingLinkLocally("user-a")).toBe(true);
  });

  it("is a no-op (does not throw) if localStorage throws", () => {
    // jsdom doesn't let us replace Storage prototype methods, so we
    // monkey-patch via spies on the storage instance.
    const setSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    const getSpy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    expect(() => markBookingLinkShared("user-a")).not.toThrow();
    expect(hasSharedBookingLinkLocally("user-a")).toBe(false);

    setSpy.mockRestore();
    getSpy.mockRestore();
  });
});
