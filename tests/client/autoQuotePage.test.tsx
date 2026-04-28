/**
 * @jest-environment jsdom
 *
 * Render coverage for the Smart Pricing card on `AutoQuotePage`.
 *
 * Why this exists: Task #159 — the Smart Pricing page silently broke
 * because the `QuoteEstimate` interface was reading `low` / `high` /
 * `median` from `/api/quote-estimate`, but the route returns
 * `suggestedPriceLow` / `suggestedPriceHigh` / `suggestedPriceMedian`.
 * Every successful response rendered "--" / "$NaN" with no test
 * failure to flag it.
 *
 * These cases lock the page's render contract: when the API returns
 * the canonical field names, the price-range and suggested-price
 * tiles MUST render real dollar values (not the safePrice "--"
 * placeholder). When the API returns the historical (broken) shape
 * with `low` / `high` / `median`, the page MUST fall back to the
 * placeholder — which is exactly the regression that slipped through
 * before, so we lock that behaviour too.
 */

import * as React from "react";

// --- Module mocks (must be declared before importing the page under
// test so jest hoists them ahead of the AutoQuotePage imports). -----

// `wouter` needs a Router context for `useLocation`. We never assert
// on navigation in this suite, so a stub that returns the standard
// [path, navigate] tuple is enough.
jest.mock("wouter", () => ({
  __esModule: true,
  useLocation: () => ["/auto-quote", () => {}],
}));

// `apiFetch` pulls in Capacitor + the auth-token plumbing, none of
// which is needed here because the mutation `mutationFn` is never
// invoked: we control `useMutation`'s return value directly.
jest.mock("@/lib/apiFetch", () => ({
  __esModule: true,
  apiFetch: jest.fn(),
}));

// Toaster is wired through a global hook; the page only calls
// `toast()` from click handlers we don't exercise. Stubbing it keeps
// the render tree light.
jest.mock("@/hooks/use-toast", () => ({
  __esModule: true,
  useToast: () => ({ toast: jest.fn() }),
}));

// `useIsMobile` reads window.matchMedia; jsdom's default doesn't
// implement it. Force the desktop layout for deterministic test IDs.
jest.mock("@/hooks/use-mobile", () => ({
  __esModule: true,
  useIsMobile: () => false,
}));

// Drive the page entirely through `useMutation`'s return value. The
// mutation doesn't need to run — we just need to control what `data`
// the page reads after the user "submits".
type MockMutationState = {
  data: unknown;
  isPending: boolean;
};

let mutationState: MockMutationState = { data: undefined, isPending: false };

jest.mock("@tanstack/react-query", () => ({
  __esModule: true,
  useMutation: () => ({
    data: mutationState.data,
    isPending: mutationState.isPending,
    mutate: jest.fn(),
  }),
}));

// ------- Test imports (must come AFTER the mocks above). -----------
import { render, screen, cleanup } from "@testing-library/react";
import AutoQuotePage from "@/pages/AutoQuotePage";

afterEach(() => {
  cleanup();
  mutationState = { data: undefined, isPending: false };
});

// Mirrors the live response from server/routes.ts > POST
// /api/quote-estimate. Defining this shape inline (instead of
// importing the page's `QuoteEstimate` interface) is intentional:
// the page interface drifted out of sync with the server once
// already, so this test must encode the server's contract
// independently.
const apiResponse = {
  source: "historical" as const,
  suggestedPriceLow: 8000, // cents -> "$80"
  suggestedPriceHigh: 16000, // cents -> "$160"
  suggestedPriceMedian: 12000, // cents -> "$120"
  rationale: "Based on your historical jobs.",
  avgDurationMinutes: 60,
  sampleSize: 4,
};

describe("AutoQuotePage Smart Pricing card — Task #159 contract", () => {
  it("renders real dollar values when API returns suggestedPriceLow/High/Median", () => {
    mutationState = { data: apiResponse, isPending: false };
    render(<AutoQuotePage />);

    // The result card should be visible.
    expect(screen.getByTestId("card-estimate-result")).toBeTruthy();

    // Price range tile must show actual dollars derived from the
    // API's `suggestedPriceLow` and `suggestedPriceHigh`. Without
    // the field-name contract this collapsed to "--" / "$NaN".
    const range = screen.getByTestId("text-price-range");
    expect(range.textContent).toContain("$80");
    expect(range.textContent).toContain("$160");
    expect(range.textContent).not.toContain("--");
    expect(range.textContent).not.toContain("NaN");

    // Suggested price tile must show the median converted to
    // dollars. The dollar sign comes from a Lucide icon, so we only
    // assert on the numeric portion.
    const suggested = screen.getByTestId("text-suggested-price");
    expect(suggested.textContent).toContain("120");
    expect(suggested.textContent).not.toContain("--");
    expect(suggested.textContent).not.toContain("NaN");
  });

  it("falls back to the safePrice placeholder when the API uses the legacy low/high/median names", () => {
    // This is the exact failure mode Task #159 was filed against:
    // if a future refactor reintroduces the short names on either
    // side of the contract, the page renders "--" instead of
    // dollars. Lock that fallback so the regression is visible
    // here BEFORE it ships to users.
    const legacyShape = {
      source: "historical" as const,
      low: 8000,
      high: 16000,
      median: 12000,
      rationale: "Legacy shape — should NOT render real dollars.",
    };
    mutationState = { data: legacyShape, isPending: false };
    render(<AutoQuotePage />);

    const range = screen.getByTestId("text-price-range");
    expect(range.textContent).toContain("--");
    expect(range.textContent).not.toMatch(/\$\d/);

    const suggested = screen.getByTestId("text-suggested-price");
    expect(suggested.textContent).toContain("--");
    expect(suggested.textContent).not.toMatch(/\$\d/);
  });

  it("does not render the result card before the user has submitted (no mutation data)", () => {
    mutationState = { data: undefined, isPending: false };
    render(<AutoQuotePage />);

    expect(screen.queryByTestId("card-estimate-result")).toBeNull();
    expect(screen.queryByTestId("text-price-range")).toBeNull();
    expect(screen.queryByTestId("text-suggested-price")).toBeNull();
  });
});
