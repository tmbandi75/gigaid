/**
 * @jest-environment jsdom
 *
 * Render coverage for the Admin Analytics share-funnel card guidance
 * added in Task #107 (Task #98 follow-up).
 *
 * Why this exists: Task #107 added a prominent semantic-change banner
 * ("New completion definition (Task #98, April 2026): …"), a per-stat
 * "Confirmed shares only" sublabel under "Share completions", and a
 * "Historical PostHog data" note that renders only when the API
 * returns `notes.historical`. Without this coverage, a future refactor
 * of the AdminAnalytics page (or the API response shape) could
 * silently drop the banner / sublabel / note and reviewers would
 * once again misread historical PostHog totals as comparable to the
 * new corrected ones.
 *
 * The page wires five separate queries; we mock react-query's
 * `useQuery` so each one returns the data we want. We also stub out
 * recharts (the trend chart blows up in jsdom) and wouter's Link
 * (avoids needing a Router context just to render the back-button).
 */

import * as React from "react";

// --- Module mocks (must be declared before importing the page under
// test so jest hoists them ahead of the AdminAnalytics imports). ----

// Recharts components break under jsdom (they require layout). Replace
// them with no-op spans so the trend chart's container renders without
// throwing — we don't assert on chart internals in this suite.
jest.mock("recharts", () => {
  const React = require("react");
  const Stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children);
  return {
    __esModule: true,
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

// wouter's Link calls useLocation (needs a Router). For this test we
// only need the back-to-cockpit link to render; an anchor tag is plenty.
jest.mock("wouter", () => {
  const React = require("react");
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: React.ReactNode;
  };
  return {
    __esModule: true,
    Link: ({ href, children, ...rest }: LinkProps) =>
      React.createElement("a", { href, ...rest }, children),
    useLocation: () => ["/", () => {}],
  };
});

// Mock useQuery so each query the page issues returns the controlled
// data the test wants. We pattern-match on the queryKey URL the page
// passes through QUERY_KEYS.* helpers.
const SHARE_FUNNEL_HISTORICAL_NOTE =
  "Heads up: this report is unaffected, but raw `booking_link_shared` totals " +
  "in PostHog before Task #98 (April 2026) are inflated because every " +
  "Share-button tap was logged as a completion — including cancelled share " +
  "sheets.";

const buildShareFunnelData = (overrides?: { historical?: string | undefined }) => ({
  period: "Last 30 days",
  totals: {
    taps: 120,
    completions: 80,
    copies: 10,
    tapToCompletionRate: 0.6667,
  },
  surfaces: [
    {
      screen: "plan",
      taps: 50,
      completions: 30,
      copies: 5,
      tapToCompletionRate: 0.6,
    },
  ],
  platforms: [
    {
      platform: "web",
      taps: 60,
      completions: 40,
      copies: 5,
      tapToCompletionRate: 0.6667,
    },
  ],
  // The page reads `shareFunnel.targets.length` unconditionally, so
  // the mock must include the field even if this suite doesn't assert
  // on the destinations breakdown.
  targets: [],
  series: [],
  platformSeries: {},
  notes: {
    taps: "Counts every Share press.",
    completions: "Confirmed shares only.",
    copies: "Successful copies.",
    platforms: "Platforms come from X-Client-Platform.",
    targets: "Destination tagging.",
    series: "Daily rollup.",
    // Keep historical optional so a per-test override can drop it to
    // confirm the conditional render. Default value mirrors the live
    // server copy so the assertion uses realistic content.
    ...(overrides && Object.prototype.hasOwnProperty.call(overrides, "historical")
      ? { historical: overrides.historical }
      : { historical: SHARE_FUNNEL_HISTORICAL_NOTE }),
  },
});

let shareFunnelOverride: ReturnType<typeof buildShareFunnelData> | null = null;

jest.mock("@tanstack/react-query", () => {
  return {
    __esModule: true,
    useQuery: ({ queryKey }: { queryKey: ReadonlyArray<string> }) => {
      const key = String(queryKey?.[0] ?? "");
      if (key.startsWith("/api/admin/analytics/share-funnel")) {
        return { data: shareFunnelOverride, isLoading: false };
      }
      // For every other admin-analytics query the page still needs a
      // resolved (non-loading) state so the share-funnel card actually
      // renders — the page short-circuits to a loading spinner if ANY
      // query is still loading. Returning empty data for the others is
      // safe because they all use optional chaining.
      if (key.startsWith("/api/admin/analytics/revenue")) {
        return {
          data: {
            summary: { mrr: 0, payingCustomers: 0, netChurnPct: 0, revenueAtRisk: 0 },
            dailyMetrics: [],
            planDistribution: [],
            mrrByPlan: [],
          },
          isLoading: false,
        };
      }
      if (key.startsWith("/api/admin/analytics/cohorts")) {
        return { data: { cohorts: [] }, isLoading: false };
      }
      if (key.startsWith("/api/admin/analytics/funnels")) {
        return {
          data: {
            signupToPayment: {
              signups: 0, enabledProfile: 0, createdBookingLink: 0,
              sharedBookingLink: 0, receivedBooking: 0, receivedPayment: 0,
              subscribed: 0,
            },
            leadToJob: { totalLeads: 0, contacted: 0, quoted: 0, converted: 0 },
            jobToPayment: {
              totalJobs: 0, scheduled: 0, inProgress: 0, completed: 0,
              invoiced: 0, paid: 0,
            },
            period: "30d",
          },
          isLoading: false,
        };
      }
      if (key.startsWith("/api/admin/analytics/ltv")) {
        return { data: { ltvByPlan: [] }, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    },
  };
});

// ------- Test imports (must come AFTER the mocks above). -----------
import { render, screen, within, cleanup } from "@testing-library/react";
import AdminAnalytics from "@/pages/AdminAnalytics";

afterEach(() => {
  cleanup();
  shareFunnelOverride = null;
});

describe("AdminAnalytics share-funnel card — Task #98 guidance", () => {
  it("renders the semantic-change banner mentioning Task #98 and 'confirmed'", () => {
    shareFunnelOverride = buildShareFunnelData();
    render(<AdminAnalytics />);

    const banner = screen.getByTestId("share-funnel-semantic-banner");
    expect(banner).toBeTruthy();
    const bannerText = banner.textContent ?? "";
    // The banner is the headline guidance: it MUST tell reviewers (a)
    // which task changed the semantics and (b) that completions now
    // mean confirmed shares. Without either, the explainer loses its
    // anchor to the rest of the system.
    expect(bannerText).toMatch(/Task #98/);
    expect(bannerText.toLowerCase()).toContain("confirmed");
  });

  it("renders the 'Share completions' tile with the 'Confirmed shares only' sublabel", () => {
    shareFunnelOverride = buildShareFunnelData();
    render(<AdminAnalytics />);

    const tile = screen.getByTestId("share-funnel-total-completions");
    const tileText = tile.textContent ?? "";
    expect(tileText).toContain("Share completions");
    // The sublabel is the in-place explainer for the new semantics —
    // without it the headline number ("80") and label ("Share
    // completions") are ambiguous next to the historical PostHog data.
    expect(tileText).toContain("Confirmed shares only");
  });

  it("renders the 'Historical PostHog data' note when notes.historical is returned", () => {
    shareFunnelOverride = buildShareFunnelData();
    render(<AdminAnalytics />);

    const note = screen.getByTestId("share-funnel-note-historical");
    expect(note).toBeTruthy();
    const noteText = note.textContent ?? "";
    expect(noteText).toContain("Historical PostHog data");
    // Sanity-check the note actually carries the API copy, not just
    // the static label.
    expect(noteText).toContain("Task #98");
    expect(noteText.toLowerCase()).toContain("inflated");
  });

  it("hides the historical-note block when notes.historical is omitted by the API", () => {
    // Confirms the gating is wired correctly: if a future refactor of
    // server/admin/analyticsRoutes.ts drops the historical key, the UI
    // won't render an empty <p> stub or a stale label.
    shareFunnelOverride = buildShareFunnelData({ historical: undefined });
    render(<AdminAnalytics />);

    expect(screen.queryByTestId("share-funnel-note-historical")).toBeNull();
    // The other notes block (`share-funnel-notes`) must still render
    // — only the historical-data <p> should disappear.
    expect(screen.getByTestId("share-funnel-notes")).toBeTruthy();
  });

  it("scopes the historical note inside the share-funnel card", () => {
    // Defends against the explainer accidentally being relocated to a
    // different card during a refactor — it must stay attached to the
    // share-funnel card so reviewers see it next to the numbers it
    // explains.
    shareFunnelOverride = buildShareFunnelData();
    render(<AdminAnalytics />);

    const card = screen.getByTestId("card-share-funnel");
    const noteWithinCard = within(card).getByTestId(
      "share-funnel-note-historical",
    );
    expect(noteWithinCard).toBeTruthy();
  });
});
