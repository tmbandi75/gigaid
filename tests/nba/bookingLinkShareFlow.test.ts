/**
 * @jest-environment jsdom
 *
 * Regression coverage for Task #89: the booking link should only be
 * recorded as "shared" after the native share sheet returns success.
 * Tapping Share and then dismissing the sheet must NOT mark the link
 * as shared, otherwise the Next Best Action card incorrectly advances
 * past NEW_USER.
 */

jest.mock("../../client/src/lib/share", () => ({
  __esModule: true,
  shareContent: jest.fn(),
  canShareContent: jest.fn(),
}));

jest.mock("../../client/src/lib/clipboard", () => ({
  __esModule: true,
  copyTextToClipboard: jest.fn(),
}));

jest.mock("../../client/src/lib/apiFetch", () => ({
  __esModule: true,
  apiFetch: jest.fn(),
}));

import { shareContent } from "../../client/src/lib/share";
import { copyTextToClipboard } from "../../client/src/lib/clipboard";
import { apiFetch } from "../../client/src/lib/apiFetch";
import {
  attemptShareBookingLink,
  copyBookingLinkToClipboard,
  recordBookingLinkShared,
} from "../../client/src/lib/bookingLinkShareFlow";
import { hasSharedBookingLinkLocally } from "../../client/src/lib/bookingLinkShared";
import { getNBAState, type NBAInputs } from "../../client/src/lib/nbaState";

const mockedShareContent = shareContent as jest.MockedFunction<typeof shareContent>;
const mockedCopyText = copyTextToClipboard as jest.MockedFunction<
  typeof copyTextToClipboard
>;
const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const BOOKING_LINK = "https://account.gigaid.ai/book/jane-1234";
const USER_ID = "user-99";

const baseShareOptions = {
  bookingLink: BOOKING_LINK,
  shareTitle: "Book my services",
  shareText: "Schedule a job with me using this link:",
  dialogTitle: "Share booking link",
  userId: USER_ID,
};

function newUserInputs(overrides: Partial<NBAInputs> = {}): NBAInputs {
  return {
    hasClients: false,
    hasJobs: false,
    hasCompletedJobs: false,
    hasUninvoicedCompletedJobs: false,
    hasInvoices: false,
    hasLinkShared: false,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mockedShareContent.mockReset();
  mockedCopyText.mockReset();
  mockedApiFetch.mockReset();
});

describe("attemptShareBookingLink — handleShare flow (BookingLinkShare) and doShare flow (NextBestActionCard)", () => {
  describe("when the share sheet is dismissed/cancelled", () => {
    beforeEach(() => {
      // shareContent returns { shared: false } when the user cancels the OS share sheet
      mockedShareContent.mockResolvedValue({ shared: false });
    });

    it("does NOT call /api/track/booking-link-shared", async () => {
      const onLocalMark = jest.fn();
      const onApiSuccess = jest.fn();

      const result = await attemptShareBookingLink({
        ...baseShareOptions,
        onLocalMark,
        onApiSuccess,
      });

      expect(result).toEqual({ shared: false });
      expect(mockedApiFetch).not.toHaveBeenCalled();
      expect(onLocalMark).not.toHaveBeenCalled();
      expect(onApiSuccess).not.toHaveBeenCalled();
    });

    it("does NOT set the local gigaid:hasSharedBookingLink flag", async () => {
      await attemptShareBookingLink(baseShareOptions);

      expect(hasSharedBookingLinkLocally(USER_ID)).toBe(false);
      // No localStorage entries created at all
      expect(window.localStorage.length).toBe(0);
    });

    it("does NOT advance the NBA past NEW_USER", async () => {
      await attemptShareBookingLink(baseShareOptions);

      const inputs = newUserInputs({
        hasLinkShared: hasSharedBookingLinkLocally(USER_ID),
      });
      expect(getNBAState(inputs)).toBe("NEW_USER");
    });

    it("forwards the configured share payload to shareContent", async () => {
      await attemptShareBookingLink(baseShareOptions);

      expect(mockedShareContent).toHaveBeenCalledTimes(1);
      expect(mockedShareContent).toHaveBeenCalledWith({
        title: "Book my services",
        text: "Schedule a job with me using this link:",
        url: BOOKING_LINK,
        dialogTitle: "Share booking link",
      });
    });
  });

  describe("when the share sheet returns success", () => {
    beforeEach(() => {
      mockedShareContent.mockResolvedValue({ shared: true });
      mockedApiFetch.mockResolvedValue(undefined as never);
    });

    it("records the share via the API with method: 'share'", async () => {
      const result = await attemptShareBookingLink(baseShareOptions);

      expect(result).toEqual({ shared: true });
      expect(mockedApiFetch).toHaveBeenCalledTimes(1);
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/track/booking-link-shared",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ method: "share", target: undefined }),
        }),
      );
    });

    it("forwards the OS-provided activity target into the result and the API call (Task #108)", async () => {
      mockedShareContent.mockResolvedValueOnce({
        shared: true,
        target: "messages",
      });

      const result = await attemptShareBookingLink(baseShareOptions);

      expect(result).toEqual({ shared: true, target: "messages" });
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/track/booking-link-shared",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ method: "share", target: "messages" }),
        }),
      );
    });

    it("flips the local gigaid:hasSharedBookingLink flag for the user", async () => {
      await attemptShareBookingLink(baseShareOptions);

      expect(hasSharedBookingLinkLocally(USER_ID)).toBe(true);
    });

    it("invokes the lifecycle callbacks (onLocalMark before API, onApiSuccess after)", async () => {
      const calls: string[] = [];
      const onLocalMark = jest.fn(() => {
        calls.push("local");
      });
      const onApiSuccess = jest.fn(() => {
        calls.push("api");
      });

      await attemptShareBookingLink({
        ...baseShareOptions,
        onLocalMark,
        onApiSuccess,
      });

      expect(onLocalMark).toHaveBeenCalledTimes(1);
      expect(onApiSuccess).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(["local", "api"]);
    });

    it("advances the NBA past NEW_USER once the local flag is set", async () => {
      await attemptShareBookingLink(baseShareOptions);

      const inputs = newUserInputs({
        hasLinkShared: hasSharedBookingLinkLocally(USER_ID),
      });
      expect(getNBAState(inputs)).toBe("NO_JOBS_YET");
    });

    it("still flips the local flag when the API request fails", async () => {
      mockedApiFetch.mockRejectedValueOnce(new Error("network down"));
      const onLocalMark = jest.fn();
      const onApiSuccess = jest.fn();

      const result = await attemptShareBookingLink({
        ...baseShareOptions,
        onLocalMark,
        onApiSuccess,
      });

      expect(result).toEqual({ shared: true });
      expect(hasSharedBookingLinkLocally(USER_ID)).toBe(true);
      expect(onLocalMark).toHaveBeenCalledTimes(1);
      expect(onApiSuccess).not.toHaveBeenCalled();
    });
  });

  describe("when shareContent returns shared: false (defensive cancel handling)", () => {
    it("treats it as cancelled and does not record", async () => {
      mockedShareContent.mockResolvedValue({ shared: false });

      await attemptShareBookingLink(baseShareOptions);

      expect(mockedApiFetch).not.toHaveBeenCalled();
      expect(hasSharedBookingLinkLocally(USER_ID)).toBe(false);
    });
  });
});

describe("copyBookingLinkToClipboard — handleCopy flow (BookingLinkShare) and doCopy flow (NextBestActionCard)", () => {
  it("records the share with method: 'copy' when the copy succeeds", async () => {
    mockedCopyText.mockResolvedValue(true);
    mockedApiFetch.mockResolvedValue(undefined as never);

    const result = await copyBookingLinkToClipboard({
      bookingLink: BOOKING_LINK,
      userId: USER_ID,
    });

    expect(result).toEqual({ copied: true });
    expect(mockedCopyText).toHaveBeenCalledWith(BOOKING_LINK);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/track/booking-link-shared",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ method: "copy", target: "copy" }),
      }),
    );
    expect(hasSharedBookingLinkLocally(USER_ID)).toBe(true);
  });

  it("treats copy-to-clipboard as a completed share even when the API call fails", async () => {
    mockedCopyText.mockResolvedValue(true);
    mockedApiFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await copyBookingLinkToClipboard({
      bookingLink: BOOKING_LINK,
      userId: USER_ID,
    });

    expect(result).toEqual({ copied: true });
    expect(hasSharedBookingLinkLocally(USER_ID)).toBe(true);
  });

  it("does NOT record a share when copying to the clipboard fails", async () => {
    mockedCopyText.mockResolvedValue(false);

    const result = await copyBookingLinkToClipboard({
      bookingLink: BOOKING_LINK,
      userId: USER_ID,
    });

    expect(result).toEqual({ copied: false });
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(hasSharedBookingLinkLocally(USER_ID)).toBe(false);
  });

  it("invokes the local-mark callback before issuing the API call", async () => {
    mockedCopyText.mockResolvedValue(true);
    mockedApiFetch.mockResolvedValue(undefined as never);
    const calls: string[] = [];
    const onLocalMark = jest.fn(() => {
      calls.push("local");
    });
    const onApiSuccess = jest.fn(() => {
      calls.push("api");
    });

    await copyBookingLinkToClipboard({
      bookingLink: BOOKING_LINK,
      userId: USER_ID,
      onLocalMark,
      onApiSuccess,
    });

    expect(calls).toEqual(["local", "api"]);
  });
});

describe("recordBookingLinkShared", () => {
  it("returns apiOk: true when the request succeeds", async () => {
    mockedApiFetch.mockResolvedValue(undefined as never);

    const result = await recordBookingLinkShared({
      method: "share",
      userId: USER_ID,
    });

    expect(result).toEqual({ apiOk: true });
    expect(hasSharedBookingLinkLocally(USER_ID)).toBe(true);
  });

  it("returns apiOk: false but still marks locally when the request fails", async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error("boom"));

    const result = await recordBookingLinkShared({
      method: "share",
      userId: USER_ID,
    });

    expect(result).toEqual({ apiOk: false });
    expect(hasSharedBookingLinkLocally(USER_ID)).toBe(true);
  });
});
