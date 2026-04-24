import { getNBAState, type NBAInputs } from "../../client/src/lib/nbaState";

function inputs(overrides: Partial<NBAInputs> = {}): NBAInputs {
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

describe("getNBAState (5-state Next Best Action machine)", () => {
  describe("NEW_USER", () => {
    it("returns NEW_USER for a brand-new account with nothing", () => {
      expect(getNBAState(inputs())).toBe("NEW_USER");
    });

    it("falls back to NEW_USER when no clients/jobs/share exist, even if a stale hasInvoices signal arrives — the NEW_USER guard wins first", () => {
      // Documents the precedence: the NEW_USER guard short-circuits any later
      // ACTIVE_USER fallback when the user truly has no clients/jobs and has
      // never shared. This prevents flashing "Keep the momentum going" to a
      // brand-new account.
      expect(getNBAState(inputs({ hasInvoices: true }))).toBe("NEW_USER");
    });
  });

  describe("NO_JOBS_YET", () => {
    it("returns NO_JOBS_YET when the link has been shared but no jobs exist", () => {
      expect(getNBAState(inputs({ hasLinkShared: true }))).toBe("NO_JOBS_YET");
    });

    it("still returns NO_JOBS_YET if the user has clients but no jobs yet", () => {
      expect(
        getNBAState(inputs({ hasLinkShared: true, hasClients: true })),
      ).toBe("NO_JOBS_YET");
    });
  });

  describe("IN_PROGRESS", () => {
    it("returns IN_PROGRESS when there are jobs but none are completed", () => {
      expect(
        getNBAState(inputs({ hasJobs: true, hasClients: true })),
      ).toBe("IN_PROGRESS");
    });

    it("returns IN_PROGRESS even if the link was shared, as long as there are open jobs", () => {
      expect(
        getNBAState(
          inputs({ hasJobs: true, hasLinkShared: true, hasClients: true }),
        ),
      ).toBe("IN_PROGRESS");
    });
  });

  describe("READY_TO_INVOICE", () => {
    it("returns READY_TO_INVOICE when there is at least one completed job not yet invoiced", () => {
      expect(
        getNBAState(
          inputs({
            hasJobs: true,
            hasCompletedJobs: true,
            hasUninvoicedCompletedJobs: true,
            hasClients: true,
          }),
        ),
      ).toBe("READY_TO_INVOICE");
    });

    it("returns READY_TO_INVOICE even if the user has prior invoices, as long as a fresh completed job is uninvoiced", () => {
      expect(
        getNBAState(
          inputs({
            hasJobs: true,
            hasCompletedJobs: true,
            hasUninvoicedCompletedJobs: true,
            hasInvoices: true,
            hasClients: true,
          }),
        ),
      ).toBe("READY_TO_INVOICE");
    });
  });

  describe("ACTIVE_USER", () => {
    it("returns ACTIVE_USER when completed jobs exist and nothing is uninvoiced", () => {
      expect(
        getNBAState(
          inputs({
            hasJobs: true,
            hasCompletedJobs: true,
            hasInvoices: true,
            hasClients: true,
          }),
        ),
      ).toBe("ACTIVE_USER");
    });

    it("returns ACTIVE_USER for a user who has invoices but no current job in flight", () => {
      // Edge case: their last job was completed and invoiced; nothing in progress.
      expect(
        getNBAState(
          inputs({
            hasInvoices: true,
            hasCompletedJobs: true,
            hasClients: true,
          }),
        ),
      ).toBe("ACTIVE_USER");
    });
  });

  describe("transitions across the canonical journey", () => {
    it("walks NEW_USER → NO_JOBS_YET → IN_PROGRESS → READY_TO_INVOICE → ACTIVE_USER", () => {
      // Brand new
      let state = inputs();
      expect(getNBAState(state)).toBe("NEW_USER");

      // Shares the link
      state = { ...state, hasLinkShared: true };
      expect(getNBAState(state)).toBe("NO_JOBS_YET");

      // First job booked
      state = { ...state, hasJobs: true, hasClients: true };
      expect(getNBAState(state)).toBe("IN_PROGRESS");

      // Job completed, invoice not yet sent
      state = {
        ...state,
        hasCompletedJobs: true,
        hasUninvoicedCompletedJobs: true,
      };
      expect(getNBAState(state)).toBe("READY_TO_INVOICE");

      // Invoice sent → caught up
      state = {
        ...state,
        hasInvoices: true,
        hasUninvoicedCompletedJobs: false,
      };
      expect(getNBAState(state)).toBe("ACTIVE_USER");
    });
  });
});
