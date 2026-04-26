/**
 * Regression coverage for Task #128.
 *
 * Every booking link the app generates must use the `account.gigaid.ai`
 * host so customers see a consistent URL across email, SMS, follow-ups,
 * and the in-app share UI — never the local request host or a leftover
 * `gigaid.ai` URL.
 */
describe("server/lib/bookingLinkUrl — getBookingBaseUrl / buildBookingLink", () => {
  const ORIGINAL_FRONTEND_URL = process.env.FRONTEND_URL;

  afterEach(() => {
    if (ORIGINAL_FRONTEND_URL === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = ORIGINAL_FRONTEND_URL;
    }
    jest.resetModules();
  });

  function load() {
    jest.resetModules();
    return require("../../server/lib/bookingLinkUrl") as typeof import("../../server/lib/bookingLinkUrl");
  }

  it("defaults to account.gigaid.ai when FRONTEND_URL is unset", () => {
    delete process.env.FRONTEND_URL;
    const { getBookingBaseUrl, buildBookingLink } = load();
    expect(getBookingBaseUrl()).toBe("https://account.gigaid.ai");
    expect(buildBookingLink("chiq-mbandi")).toBe(
      "https://account.gigaid.ai/book/chiq-mbandi",
    );
  });

  it("defaults to account.gigaid.ai when FRONTEND_URL is empty/whitespace", () => {
    process.env.FRONTEND_URL = "   ";
    const { buildBookingLink } = load();
    expect(buildBookingLink("jane")).toBe(
      "https://account.gigaid.ai/book/jane",
    );
  });

  it("honors FRONTEND_URL when explicitly set", () => {
    process.env.FRONTEND_URL = "https://account.gigaid.ai";
    const { buildBookingLink } = load();
    expect(buildBookingLink("jane")).toBe(
      "https://account.gigaid.ai/book/jane",
    );
  });

  it("strips trailing slashes from FRONTEND_URL so the path is well-formed", () => {
    process.env.FRONTEND_URL = "https://account.gigaid.ai/";
    const { buildBookingLink } = load();
    expect(buildBookingLink("jane")).toBe(
      "https://account.gigaid.ai/book/jane",
    );
  });

  it("never falls back to localhost — even if FRONTEND_URL was previously set to a dev URL the helper itself yields the configured value, not localhost (Task #128 invoice-flow leak fix)", () => {
    delete process.env.FRONTEND_URL;
    const { getBookingBaseUrl } = load();
    const url = getBookingBaseUrl();
    expect(url).not.toMatch(/localhost/i);
    expect(url).not.toMatch(/127\.0\.0\.1/);
    expect(url.startsWith("https://account.gigaid.ai")).toBe(true);
  });
});
