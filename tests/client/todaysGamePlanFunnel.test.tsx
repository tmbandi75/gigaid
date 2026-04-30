/**
 * @jest-environment jsdom
 *
 * Page-level integration coverage for the conversion-funnel surfaces
 * the mobile/tablet `TodaysGamePlanPage` mounts (Tasks #308 / #309 /
 * #310): the first-action overlay, the shares-away banner, the
 * follow-up card, and the booking-zone toast effect.
 *
 * The four surfaces are gated by a combination of:
 *   - viewport (`useIsBelowDesktop`),
 *   - booking-link presence (`/api/booking/link`),
 *   - the user's daily share count (`/api/booking/share-progress`), and
 *   - per-surface sessionStorage dismissal flags.
 *
 * Component-level rendering of each surface is locked by
 * `bookingFunnelComponents.test.tsx`. THIS file locks the *gating*
 * (each surface only mounts when every required condition is met) and
 * the *page-orchestrated* behaviour (booking-zone toast firing on a
 * <3 → ≥3 transition but NOT on a fresh load that lands at ≥3, and
 * the follow-up CTA opening the share sheet with `screen=plan_followup`
 * + a messageOverride that contains the booking link).
 *
 * The page wires a long list of heavyweight collaborators (Framer
 * Motion, the upgrade orchestrator, the activation checklist, the NBA
 * card, recharts-using campaign banners, the desktop column grid, etc.)
 * that bring no value to these gating tests. We stub them out so the
 * test only renders what Task #310 actually contracts on.
 */

import * as React from "react";

// ---------------------------------------------------------------------------
// Module mocks (must run BEFORE the page import below — Jest hoists
// jest.mock(...) calls but the imports they reference are evaluated at
// require time, so the order of jest.mock declarations vs `import
// TodaysGamePlanPage` matters).
// ---------------------------------------------------------------------------

// --- wouter ----------------------------------------------------------------
jest.mock("wouter", () => ({
  __esModule: true,
  useLocation: () => ["/", () => {}],
  Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// --- framer-motion ---------------------------------------------------------
// Render motion.div / motion.section as plain divs and AnimatePresence as
// a passthrough; we never assert on animations here and the real lib
// pulls in heavy intersection / matchMedia code that jsdom doesn't model.
jest.mock("framer-motion", () => {
  const React = require("react");
  const passthrough = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef(
      (
        { children, ...rest }: React.PropsWithChildren<Record<string, unknown>>,
        ref: React.Ref<HTMLElement>,
      ) =>
        React.createElement(
          tag,
          { ref, ...filterMotionProps(rest) },
          children,
        ),
    );
  function filterMotionProps(props: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(props)) {
      if (
        k === "variants" ||
        k === "initial" ||
        k === "animate" ||
        k === "exit" ||
        k === "transition" ||
        k === "whileTap" ||
        k === "whileHover" ||
        k === "layout"
      ) {
        continue;
      }
      out[k] = props[k];
    }
    return out;
  }
  return {
    __esModule: true,
    motion: new Proxy(
      {},
      {
        get: (_t, key: string) => passthrough(key as keyof JSX.IntrinsicElements),
      },
    ),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

// --- queryKeys (real) ------------------------------------------------------
// We pattern-match on the queryKey URL inside our useQuery mock; the real
// helpers stay in scope so QUERY_KEYS.bookingShareProgress() works.

// --- useQuery / useQueryClient --------------------------------------------
type ShareProgressData = { count: number; target: number };
let shareProgressData: ShareProgressData = { count: 0, target: 5 };
let bookingLinkData: { bookingLink: string | null; servicesCount: number } = {
  bookingLink: "https://gigaid.test/book/test",
  servicesCount: 1,
};

const invalidateQueriesMock = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  __esModule: true,
  useQuery: ({ queryKey }: { queryKey: ReadonlyArray<unknown> }) => {
    const key = String(queryKey?.[0] ?? "");
    if (key === "/api/dashboard/game-plan") {
      return {
        data: {
          priorityItem: null,
          upNextItems: [],
          stats: {
            jobsToday: 0,
            moneyCollectedToday: 0,
            moneyWaiting: 0,
            messagesToSend: 0,
          },
          recentlyCompleted: [],
          dashboardSummary: {
            totalJobs: 0,
            completedJobs: 0,
            totalLeads: 0,
            totalInvoices: 0,
            sentInvoices: 0,
          },
        },
        isLoading: false,
      };
    }
    if (key === "/api/next-actions") {
      return { data: [], isLoading: false };
    }
    if (key === "/api/profile") {
      return {
        data: { services: ["Lawn Care"], servicesCount: 1 },
        isLoading: false,
      };
    }
    if (key === "/api/booking/share-progress") {
      return { data: shareProgressData, isLoading: false };
    }
    if (key === "/api/booking/link") {
      return { data: bookingLinkData, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

// --- toast -----------------------------------------------------------------
const toastMock = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  __esModule: true,
  useToast: () => ({ toast: toastMock, dismiss: jest.fn(), toasts: [] }),
}));

// --- viewport / mobile flag -----------------------------------------------
let isBelowDesktopValue = true;
jest.mock("@/hooks/use-mobile", () => ({
  __esModule: true,
  useIsMobile: () => true,
  useIsBelowDesktop: () => isBelowDesktopValue,
}));

// --- auth ------------------------------------------------------------------
jest.mock("@/hooks/use-auth", () => ({
  __esModule: true,
  useAuth: () => ({
    user: {
      id: "test-user",
      firstName: "Test",
      name: "Test User",
      username: "test",
    },
  }),
}));

// --- useApiMutation --------------------------------------------------------
jest.mock("@/hooks/useApiMutation", () => ({
  __esModule: true,
  useApiMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

// --- apiFetch / queryKeys (apiFetch unused but imported) ------------------
jest.mock("@/lib/apiFetch", () => ({
  __esModule: true,
  apiFetch: jest.fn(async () => ({})),
}));

// --- booking-link share action --------------------------------------------
jest.mock("@/lib/useBookingLinkShareAction", () => ({
  __esModule: true,
  useBookingLinkShareAction: () => ({
    bookingLink: bookingLinkData.bookingLink,
    hasServices: true,
    copied: false,
    share: jest.fn(),
    copy: jest.fn(),
    supportsShare: true,
  }),
}));

// --- Replace the heavyweight children with simple stubs that can't drag
// in framer-motion / recharts / matchMedia internals from their own
// transitive imports. Each stub keeps its data-testid so a future test
// file can still assert on its presence if needed.
jest.mock("@/components/booking-link", () => ({
  __esModule: true,
  BookingLinkShare: () => <div data-testid="stub-booking-link-share" />,
  BookingLinkEmptyState: () => null,
}));

// Capture every BookingLinkShareSheet render so we can assert on the
// `screen` and `messageOverride` props the page passes through after a
// follow-up CTA click. We also surface `open` so we can verify the
// sheet only opens after the click.
const bookingLinkShareSheetCalls: Array<{
  open: boolean;
  screen: string;
  messageOverride: string | undefined;
}> = [];
jest.mock("@/components/booking-link/BookingLinkShareSheet", () => ({
  __esModule: true,
  BookingLinkShareSheet: (props: {
    open: boolean;
    screen: string;
    messageOverride?: string;
  }) => {
    bookingLinkShareSheetCalls.push({
      open: props.open,
      screen: props.screen,
      messageOverride: props.messageOverride,
    });
    return null;
  },
}));

jest.mock("@/components/CampaignSuggestionBanner", () => ({
  __esModule: true,
  CampaignSuggestionBanner: () => null,
}));
jest.mock("@/components/activation/ActivationChecklist", () => ({
  __esModule: true,
  ActivationChecklist: () => null,
}));
jest.mock("@/components/dashboard/NextBestActionCard", () => ({
  __esModule: true,
  NextBestActionCard: () => null,
  deriveNBAState: () => "NEW_USER",
}));
jest.mock("@/lib/nbaStyling", () => ({
  __esModule: true,
  shouldDemoteNBAMoneyTone: () => false,
  shouldSuppressBookingLinkPrimary: () => false,
}));
jest.mock("@/components/game-plan/GamePlanDesktopView", () => ({
  __esModule: true,
  GamePlanDesktopView: () => null,
}));
jest.mock("@/components/settings/AddServiceDialog", () => ({
  __esModule: true,
  AddServiceDialog: () => null,
}));
jest.mock("@/components/ai/VoiceNoteSummarizer", () => ({
  __esModule: true,
  VoiceNoteSummarizer: () => null,
}));
jest.mock("@/coaching/CoachingRenderer", () => ({
  __esModule: true,
  CoachingRenderer: () => null,
}));

// Upgrade orchestrator returns a no-op shape so the stall banner /
// modal stay dormant.
jest.mock("@/upgrade", () => ({
  __esModule: true,
  useUpgradeOrchestrator: () => ({
    maybeShowStallPrompt: jest.fn(),
    showModal: false,
    dismissModal: jest.fn(),
    modalPayload: null,
    variant: "soft",
  }),
  useStallSignals: () => ({
    hasActionableStall: false,
    topStall: null,
  }),
  UpgradeNudgeModal: () => null,
}));

// Encouragement engine — return a stable subtitle so the page header
// renders deterministically regardless of the mocked dashboard data.
jest.mock("@/encouragement/encouragementEngine", () => ({
  __esModule: true,
  getSubtitleMessage: () => "Let's get you paid today",
}));

// Sticky-CTA helper: stub getStickyCtaInfo so the sticky CTA gate stays
// inactive in this suite. formatCurrency / getIconForType are also
// stubbed (with non-rendering placeholders) because getStickyCtaInfo
// returns null and nothing in the rendered tree ever calls them — but
// we still need to provide the exports so the consuming module's
// destructured imports don't blow up.
jest.mock("@/lib/stickyCta", () => {
  const { Briefcase } = require("lucide-react");
  return {
    __esModule: true,
    formatCurrency: (n: number) => String(n),
    getIconForType: () => Briefcase,
    getStickyCtaInfo: () => null,
  };
});

// ---------------------------------------------------------------------------
// Test imports (must come AFTER the mocks above)
// ---------------------------------------------------------------------------

import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import TodaysGamePlanPage from "@/pages/TodaysGamePlanPage";
import { FIRST_ACTION_OVERLAY_SKIP_KEY } from "@/components/booking-link/FirstActionOverlay";
import { SHARES_AWAY_BANNER_DISMISSED_KEY } from "@/components/booking-link/SharesAwayBanner";
import { FOLLOW_UP_DISMISSED_KEY } from "@/components/booking-link/FollowUpCard";

const BOOKING_ZONE_TOAST_KEY = "gigaid:booking-zone-toast-fired";

// Reset every piece of mocked state between tests so a previous-test
// gate (e.g. a sessionStorage skip flag) can't leak into the next.
beforeEach(() => {
  cleanup();
  toastMock.mockReset();
  invalidateQueriesMock.mockReset();
  bookingLinkShareSheetCalls.length = 0;
  isBelowDesktopValue = true;
  shareProgressData = { count: 0, target: 5 };
  bookingLinkData = {
    bookingLink: "https://gigaid.test/book/test",
    servicesCount: 1,
  };
  try {
    window.sessionStorage.clear();
  } catch {
    // jsdom always provides sessionStorage; the guard is purely defensive.
  }
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Surface gating
// ---------------------------------------------------------------------------

describe("TodaysGamePlanPage funnel surfaces — gating", () => {
  describe("FirstActionOverlay", () => {
    it("renders when isBelowDesktop + bookingLink + count=0 + no skip flag", () => {
      shareProgressData = { count: 0, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.getByTestId("overlay-first-action")).toBeTruthy();
    });

    it("does not render on desktop widths (isBelowDesktop=false)", () => {
      isBelowDesktopValue = false;
      shareProgressData = { count: 0, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("overlay-first-action")).toBeNull();
    });

    it("does not render when the user has no booking link yet", () => {
      bookingLinkData = { bookingLink: null, servicesCount: 0 };
      shareProgressData = { count: 0, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("overlay-first-action")).toBeNull();
    });

    it("does not render once the user has shared at least once today", () => {
      shareProgressData = { count: 1, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("overlay-first-action")).toBeNull();
    });

    it("does not render when the session-skip flag is already set", () => {
      window.sessionStorage.setItem(FIRST_ACTION_OVERLAY_SKIP_KEY, "1");
      shareProgressData = { count: 0, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("overlay-first-action")).toBeNull();
    });
  });

  describe("SharesAwayBanner", () => {
    it("renders when isBelowDesktop + bookingLink + count<3 + no dismiss flag", () => {
      shareProgressData = { count: 1, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.getByTestId("banner-shares-away")).toBeTruthy();
    });

    it("does not render on desktop widths", () => {
      isBelowDesktopValue = false;
      shareProgressData = { count: 1, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("banner-shares-away")).toBeNull();
    });

    it("does not render when the booking link is missing", () => {
      bookingLinkData = { bookingLink: null, servicesCount: 0 };
      shareProgressData = { count: 1, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("banner-shares-away")).toBeNull();
    });

    it("does not render once the share count crosses the 3-share threshold", () => {
      shareProgressData = { count: 3, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("banner-shares-away")).toBeNull();
    });

    it("does not render when the session-dismissed flag is already set", () => {
      window.sessionStorage.setItem(SHARES_AWAY_BANNER_DISMISSED_KEY, "1");
      shareProgressData = { count: 1, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("banner-shares-away")).toBeNull();
    });
  });

  describe("FollowUpCard", () => {
    it("renders when isBelowDesktop + bookingLink + count>=2 + no dismiss flag", () => {
      shareProgressData = { count: 2, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.getByTestId("card-follow-up")).toBeTruthy();
    });

    it("does not render on desktop widths", () => {
      isBelowDesktopValue = false;
      shareProgressData = { count: 2, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("card-follow-up")).toBeNull();
    });

    it("does not render when the booking link is missing", () => {
      bookingLinkData = { bookingLink: null, servicesCount: 0 };
      shareProgressData = { count: 2, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("card-follow-up")).toBeNull();
    });

    it("does not render under the 2-share threshold", () => {
      shareProgressData = { count: 1, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("card-follow-up")).toBeNull();
    });

    it("does not render when the session-dismissed flag is already set", () => {
      window.sessionStorage.setItem(FOLLOW_UP_DISMISSED_KEY, "1");
      shareProgressData = { count: 2, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("card-follow-up")).toBeNull();
    });
  });

  describe("SegmentedShareProgress", () => {
    it("always renders in the mobile/tablet hero (regardless of bookingLink)", () => {
      bookingLinkData = { bookingLink: null, servicesCount: 0 };
      shareProgressData = { count: 0, target: 5 };
      render(<TodaysGamePlanPage />);

      expect(screen.getByTestId("hero-share-progress")).toBeTruthy();
    });

    it("does not render on desktop widths", () => {
      isBelowDesktopValue = false;
      render(<TodaysGamePlanPage />);

      expect(screen.queryByTestId("hero-share-progress")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Booking-zone toast effect
// ---------------------------------------------------------------------------

describe("TodaysGamePlanPage funnel surfaces — booking-zone toast", () => {
  it("fires exactly once when the daily share count transitions <3 → >=3", () => {
    shareProgressData = { count: 2, target: 5 };
    const { rerender } = render(<TodaysGamePlanPage />);

    // First mount establishes the baseline at 2 — the toast must NOT
    // fire on the baseline render itself, otherwise every page load
    // that lands at count >= 3 would re-fire it.
    expect(toastMock).not.toHaveBeenCalled();

    // Now simulate a fresh share completing while the page is open:
    // the share-progress query refetches and returns count=3.
    act(() => {
      shareProgressData = { count: 3, target: 5 };
    });
    rerender(<TodaysGamePlanPage />);

    expect(toastMock).toHaveBeenCalledTimes(1);
    const callArg = toastMock.mock.calls[0][0] as {
      title: string;
      description: string;
    };
    expect(callArg.title.toLowerCase()).toContain("booking zone");

    // The toast also persists the "fired" flag in sessionStorage so a
    // subsequent <3 → ≥3 transition (rare but possible — e.g. share
    // count regression after a refund) doesn't re-fire it within the
    // same browser session.
    expect(window.sessionStorage.getItem(BOOKING_ZONE_TOAST_KEY)).toBe("1");

    // A second crossing within the same session must NOT re-fire.
    act(() => {
      shareProgressData = { count: 2, target: 5 };
    });
    rerender(<TodaysGamePlanPage />);
    act(() => {
      shareProgressData = { count: 4, target: 5 };
    });
    rerender(<TodaysGamePlanPage />);

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire on a fresh page load that lands with count >= 3", () => {
    // Spec contract: the toast is the celebratory "you've crossed into
    // the booking zone" moment. A user who reloads the page after
    // having already crossed the threshold should NOT see the toast
    // pop on every refresh — only once-per-session, and only on the
    // actual in-session transition.
    shareProgressData = { count: 4, target: 5 };
    render(<TodaysGamePlanPage />);

    expect(toastMock).not.toHaveBeenCalled();
    // Baseline-only render must not write the "fired" flag either:
    // otherwise a future <3 → ≥3 transition in the same session would
    // be incorrectly treated as already-fired.
    expect(window.sessionStorage.getItem(BOOKING_ZONE_TOAST_KEY)).toBeNull();
  });

  it("does NOT fire when the session-fired flag is already set", () => {
    window.sessionStorage.setItem(BOOKING_ZONE_TOAST_KEY, "1");
    shareProgressData = { count: 2, target: 5 };
    const { rerender } = render(<TodaysGamePlanPage />);

    act(() => {
      shareProgressData = { count: 3, target: 5 };
    });
    rerender(<TodaysGamePlanPage />);

    // The page already considered this celebrated this session — even
    // a real <3 → ≥3 transition must respect the flag.
    expect(toastMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Follow-up CTA → share sheet
// ---------------------------------------------------------------------------

describe("TodaysGamePlanPage funnel surfaces — follow-up CTA", () => {
  it("opens the share sheet with screen=plan_followup and a messageOverride containing the booking link", () => {
    const link = "https://gigaid.test/book/follow-up-user";
    bookingLinkData = { bookingLink: link, servicesCount: 1 };
    shareProgressData = { count: 2, target: 5 };

    render(<TodaysGamePlanPage />);

    // Sanity: the funnel sheet starts closed.
    const initialSheet = bookingLinkShareSheetCalls.find(
      (c) => c.screen === "plan_overlay" || c.screen === "plan_banner" || c.screen === "plan_followup",
    );
    expect(initialSheet?.open ?? false).toBe(false);

    fireEvent.click(screen.getByTestId("button-follow-up-send"));

    // The latest BookingLinkShareSheet render after the click MUST be
    // the funnel sheet (not the empty-state sheet) carrying the
    // follow-up screen + messageOverride. We inspect the most recent
    // matching call so a re-render order doesn't trip the assertion.
    const lastFunnelCall = [...bookingLinkShareSheetCalls]
      .reverse()
      .find((c) => c.screen !== "plan_empty");
    expect(lastFunnelCall).toBeDefined();
    expect(lastFunnelCall!.open).toBe(true);
    expect(lastFunnelCall!.screen).toBe("plan_followup");
    // The pre-fill MUST contain the booking link so the share sheet
    // opens with a ready-to-send second-touch message.
    expect(lastFunnelCall!.messageOverride).toBeDefined();
    expect(lastFunnelCall!.messageOverride!).toContain(link);
  });
});
