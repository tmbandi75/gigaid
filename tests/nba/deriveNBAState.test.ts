import {
  deriveNBAState,
  type DashboardSummary,
} from "../../client/src/lib/nbaState";
import { markBookingLinkShared } from "../../client/src/lib/bookingLinkShared";

beforeEach(() => {
  window.localStorage.clear();
});

const baseSummary: DashboardSummary = {
  totalJobs: 0,
  completedJobs: 0,
  totalInvoices: 0,
  sentInvoices: 0,
  hasClients: false,
  hasUninvoicedCompletedJobs: false,
  hasLinkShared: false,
};

describe("deriveNBAState bridges dashboard summary, local flag, and the state machine", () => {
  it("treats an empty summary as NEW_USER", () => {
    expect(deriveNBAState(baseSummary, "user-a")).toBe("NEW_USER");
  });

  it("treats undefined summary as NEW_USER (defensive)", () => {
    expect(deriveNBAState(undefined, "user-a")).toBe("NEW_USER");
  });

  it("flips to NO_JOBS_YET when the server reports the link was shared", () => {
    expect(
      deriveNBAState({ ...baseSummary, hasLinkShared: true }, "user-a"),
    ).toBe("NO_JOBS_YET");
  });

  it("flips to NO_JOBS_YET from the local flag alone (offline / before backend confirms)", () => {
    markBookingLinkShared("user-a");
    expect(deriveNBAState(baseSummary, "user-a")).toBe("NO_JOBS_YET");
  });

  it("does not leak user A's local share flag to user B", () => {
    markBookingLinkShared("user-a");
    expect(deriveNBAState(baseSummary, "user-a")).toBe("NO_JOBS_YET");
    // Same browser, different account, same empty summary: must stay NEW_USER.
    expect(deriveNBAState(baseSummary, "user-b")).toBe("NEW_USER");
  });

  it("derives IN_PROGRESS when the user has open jobs", () => {
    expect(
      deriveNBAState(
        { ...baseSummary, totalJobs: 1, hasClients: true },
        "user-a",
      ),
    ).toBe("IN_PROGRESS");
  });

  it("derives READY_TO_INVOICE when there is an uninvoiced completed job", () => {
    expect(
      deriveNBAState(
        {
          ...baseSummary,
          totalJobs: 1,
          completedJobs: 1,
          hasUninvoicedCompletedJobs: true,
          hasClients: true,
        },
        "user-a",
      ),
    ).toBe("READY_TO_INVOICE");
  });

  it("derives ACTIVE_USER when everything is invoiced and no work is open", () => {
    expect(
      deriveNBAState(
        {
          ...baseSummary,
          totalJobs: 2,
          completedJobs: 2,
          totalInvoices: 1,
          sentInvoices: 1,
          hasClients: true,
        },
        "user-a",
      ),
    ).toBe("ACTIVE_USER");
  });
});
