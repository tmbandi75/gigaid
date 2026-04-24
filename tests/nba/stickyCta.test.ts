import {
  getStickyCtaInfo,
  getNBAStickyCta,
  type ActionItem,
  type GamePlanStats,
} from "../../client/src/lib/stickyCta";
import type { NBAState } from "../../client/src/lib/nbaState";

function makeStats(overrides: Partial<GamePlanStats> = {}): GamePlanStats {
  return {
    jobsToday: 0,
    moneyCollectedToday: 0,
    moneyWaiting: 0,
    messagesToSend: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "item-1",
    type: "job",
    priority: 1,
    title: "Mow the lawn",
    subtitle: "Today",
    actionLabel: "View Job",
    actionRoute: "/jobs/item-1",
    urgency: "normal",
    ...overrides,
  };
}

describe("getStickyCtaInfo (dashboard sticky bottom CTA)", () => {
  describe("money-waiting branch (highest priority)", () => {
    it("nudges the user to collect outstanding money before anything else", () => {
      const result = getStickyCtaInfo(
        makeStats({ moneyWaiting: 12500 }),
        null,
        "ACTIVE_USER",
      );
      expect(result).not.toBeNull();
      expect(result!.label).toBe("Collect $125");
      expect(result!.route).toBe("/invoices");
    });

    it("formats whole-dollar amounts with the $ sign and no cents", () => {
      const result = getStickyCtaInfo(
        makeStats({ moneyWaiting: 5000 }),
        null,
        "NEW_USER",
      );
      expect(result!.label).toBe("Collect $50");
    });

    it("wins over an unrelated priority item", () => {
      const result = getStickyCtaInfo(
        makeStats({ moneyWaiting: 9900 }),
        makeItem({ type: "job", actionLabel: "View Job", actionRoute: "/jobs/abc" }),
        "IN_PROGRESS",
      );
      expect(result!.route).toBe("/invoices");
      expect(result!.label).toMatch(/^Collect /);
    });

    it("wins over an invoice priority item too — money in hand beats next-step nudges", () => {
      const result = getStickyCtaInfo(
        makeStats({ moneyWaiting: 1500 }),
        makeItem({
          type: "invoice",
          actionLabel: "Send Invoice",
          actionRoute: "/invoices/abc",
        }),
        "READY_TO_INVOICE",
      );
      expect(result!.route).toBe("/invoices");
      expect(result!.label).toBe("Collect $15");
    });

    it("does not trigger when moneyWaiting is exactly zero", () => {
      // Edge: 0 is not > 0, so we should fall through to the priority item branch.
      const result = getStickyCtaInfo(
        makeStats({ moneyWaiting: 0 }),
        makeItem({
          type: "invoice",
          actionLabel: "Send Invoice",
          actionRoute: "/invoices/abc",
        }),
        "READY_TO_INVOICE",
      );
      expect(result!.route).toBe("/invoices/abc");
      expect(result!.label).toBe("Send Invoice");
    });
  });

  describe("priority-item invoice branch (second priority)", () => {
    it("routes to the invoice's actionRoute when the priority item is an invoice", () => {
      const result = getStickyCtaInfo(
        makeStats(),
        makeItem({
          type: "invoice",
          actionLabel: "Send Invoice",
          actionRoute: "/invoices/inv-42",
        }),
        "ACTIVE_USER",
      );
      expect(result!.label).toBe("Send Invoice");
      expect(result!.route).toBe("/invoices/inv-42");
    });

    it("beats the per-NBA-state fallback, even for a non-ACTIVE_USER state", () => {
      // Documents precedence: an invoice priority item is more specific than
      // the generic per-state nudge, so we surface it instead of "View Jobs".
      const result = getStickyCtaInfo(
        makeStats(),
        makeItem({
          type: "invoice",
          actionLabel: "Send Invoice",
          actionRoute: "/invoices/inv-9",
        }),
        "IN_PROGRESS",
      );
      expect(result!.route).toBe("/invoices/inv-9");
      expect(result!.label).toBe("Send Invoice");
    });
  });

  describe("per-NBA-state fallback (third priority)", () => {
    it("nudges NEW_USER to share their booking link", () => {
      const result = getStickyCtaInfo(makeStats(), null, "NEW_USER");
      expect(result).toEqual(
        expect.objectContaining({
          label: "Share Booking Link",
          route: "/profile",
        }),
      );
    });

    it("nudges NO_JOBS_YET to share their booking link", () => {
      const result = getStickyCtaInfo(makeStats(), null, "NO_JOBS_YET");
      expect(result).toEqual(
        expect.objectContaining({
          label: "Share Booking Link",
          route: "/profile",
        }),
      );
    });

    it("nudges IN_PROGRESS to view their jobs", () => {
      const result = getStickyCtaInfo(makeStats(), null, "IN_PROGRESS");
      expect(result).toEqual(
        expect.objectContaining({
          label: "View Jobs",
          route: "/jobs",
        }),
      );
    });

    it("nudges READY_TO_INVOICE to create a new invoice", () => {
      const result = getStickyCtaInfo(makeStats(), null, "READY_TO_INVOICE");
      expect(result).toEqual(
        expect.objectContaining({
          label: "Create Invoice",
          route: "/invoices/new",
        }),
      );
    });

    it("falls through past the NBA branch when the state is ACTIVE_USER", () => {
      // ACTIVE_USER intentionally has no NBA sticky, so with no priority item we get null.
      expect(getStickyCtaInfo(makeStats(), null, "ACTIVE_USER")).toBeNull();
    });

    it("the per-state nudge takes precedence over a non-invoice priority item", () => {
      // Documents precedence: when the user has a job-type priority item BUT
      // we are still in NEW_USER (e.g. a stale demo job), we should keep
      // pushing the booking-link share over a generic "View Job" nudge.
      const result = getStickyCtaInfo(
        makeStats(),
        makeItem({ type: "job", actionLabel: "View Job", actionRoute: "/jobs/abc" }),
        "NEW_USER",
      );
      expect(result!.label).toBe("Share Booking Link");
      expect(result!.route).toBe("/profile");
    });
  });

  describe("priority-item generic fallback (fourth priority)", () => {
    it("uses the priority item's label and route for a job item when state is ACTIVE_USER", () => {
      const result = getStickyCtaInfo(
        makeStats(),
        makeItem({
          type: "job",
          actionLabel: "View Job",
          actionRoute: "/jobs/job-7",
        }),
        "ACTIVE_USER",
      );
      expect(result!.label).toBe("View Job");
      expect(result!.route).toBe("/jobs/job-7");
    });

    it("uses the priority item's label and route for a lead item", () => {
      const result = getStickyCtaInfo(
        makeStats(),
        makeItem({
          type: "lead",
          actionLabel: "Reply to Lead",
          actionRoute: "/leads/lead-3",
        }),
        "ACTIVE_USER",
      );
      expect(result!.label).toBe("Reply to Lead");
      expect(result!.route).toBe("/leads/lead-3");
    });

    it("uses the priority item's label and route for a reminder item", () => {
      const result = getStickyCtaInfo(
        makeStats(),
        makeItem({
          type: "reminder",
          actionLabel: "Send Reminder",
          actionRoute: "/messages/r-1",
        }),
        "ACTIVE_USER",
      );
      expect(result!.label).toBe("Send Reminder");
      expect(result!.route).toBe("/messages/r-1");
    });
  });

  describe("returns null when there is nothing to nudge", () => {
    it("returns null for an ACTIVE_USER with no money waiting and no priority item", () => {
      expect(getStickyCtaInfo(makeStats(), null, "ACTIVE_USER")).toBeNull();
    });
  });
});

describe("getNBAStickyCta (per-state nudge for the bottom CTA)", () => {
  const cases: Array<{
    state: NBAState;
    expected: { label: string; route: string } | null;
  }> = [
    { state: "NEW_USER", expected: { label: "Share Booking Link", route: "/profile" } },
    { state: "NO_JOBS_YET", expected: { label: "Share Booking Link", route: "/profile" } },
    { state: "IN_PROGRESS", expected: { label: "View Jobs", route: "/jobs" } },
    { state: "READY_TO_INVOICE", expected: { label: "Create Invoice", route: "/invoices/new" } },
    { state: "ACTIVE_USER", expected: null },
  ];

  it.each(cases)(
    "returns the right label and route for $state",
    ({ state, expected }) => {
      const result = getNBAStickyCta(state);
      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toEqual(expect.objectContaining(expected));
      }
    },
  );
});
