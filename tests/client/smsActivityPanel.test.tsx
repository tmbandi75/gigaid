/**
 * @jest-environment jsdom
 *
 * Render coverage for the Settings "SMS activity" panel that surfaces the
 * texts we held back because the user hit their 24h SMS cap. The panel
 * lives at client/src/components/settings/SmsActivityPanel.tsx and is
 * powered by GET /api/sms/rate-limited-recent.
 *
 * Why this exists: the panel has four distinct states (loading, error,
 * empty, populated) and a friendly amber explainer that only renders in
 * the populated state. Without coverage, a refactor of useQuery wiring
 * or the conditional ladder could silently drop the explainer or one of
 * the empty/error variants and the user would lose the very signal this
 * panel was built to provide ("we held back N texts; the next one will
 * go out automatically").
 *
 * The component reads its data via @tanstack/react-query's useQuery; we
 * mock that hook so each test controls the response shape directly. The
 * default fetcher is irrelevant in this suite — only the loading / error
 * / data fields drive the rendered output.
 */

import * as React from "react";

// --- Module mocks (must be declared BEFORE importing the component
// under test so jest hoists them ahead of its imports). ----------------

let queryResultOverride: {
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
} = { isLoading: true };

jest.mock("@tanstack/react-query", () => {
  return {
    __esModule: true,
    useQuery: () => ({
      data: queryResultOverride.data,
      isLoading: !!queryResultOverride.isLoading,
      isError: !!queryResultOverride.isError,
    }),
  };
});

// --- Test imports (after mocks). ---------------------------------------
import { render, screen, within, cleanup } from "@testing-library/react";
import { SmsActivityPanel } from "@/components/settings/SmsActivityPanel";

afterEach(() => {
  cleanup();
  queryResultOverride = { isLoading: true };
});

describe("SmsActivityPanel — Settings 'SMS activity' surface", () => {
  it("always renders the panel header and 'Last 7 days' scope label", () => {
    queryResultOverride = { isLoading: true };
    render(<SmsActivityPanel />);

    const panel = screen.getByTestId("panel-sms-activity");
    const txt = panel.textContent ?? "";
    // The header makes it discoverable on the Settings page; the "Last 7
    // days" scope label tells users why nothing older shows up.
    expect(txt).toContain("SMS activity");
    expect(txt).toContain("Last 7 days");
    // The static intro line that explains *what* this panel is about
    // ("Texts we held back…") is the user-facing definition. It must
    // render in every state so the panel is never ambiguous.
    expect(txt).toContain("Texts we held back because you hit your daily safety limit.");
  });

  it("loading state: shows the loading status node and not empty/error/list", () => {
    queryResultOverride = { isLoading: true };
    render(<SmsActivityPanel />);

    expect(screen.getByTestId("status-sms-activity-loading")).toBeTruthy();
    expect(screen.queryByTestId("status-sms-activity-empty")).toBeNull();
    expect(screen.queryByTestId("status-sms-activity-error")).toBeNull();
    expect(screen.queryByTestId("list-sms-rate-limited")).toBeNull();
    expect(screen.queryByTestId("text-sms-activity-explainer")).toBeNull();
  });

  it("error state: shows the friendly error copy and not loading/empty/list", () => {
    queryResultOverride = { isLoading: false, isError: true };
    render(<SmsActivityPanel />);

    const err = screen.getByTestId("status-sms-activity-error");
    expect(err.textContent ?? "").toContain(
      "We couldn't load your recent SMS activity. Try again in a moment.",
    );
    expect(screen.queryByTestId("status-sms-activity-loading")).toBeNull();
    expect(screen.queryByTestId("status-sms-activity-empty")).toBeNull();
    expect(screen.queryByTestId("list-sms-rate-limited")).toBeNull();
    expect(screen.queryByTestId("text-sms-activity-explainer")).toBeNull();
  });

  it("empty state: shows the 'nothing to show' copy when messages is []", () => {
    queryResultOverride = {
      isLoading: false,
      isError: false,
      data: { messages: [] },
    };
    render(<SmsActivityPanel />);

    const empty = screen.getByTestId("status-sms-activity-empty");
    expect(empty.textContent ?? "").toContain(
      "Nothing to show — no scheduled texts have been held back recently.",
    );
    expect(screen.queryByTestId("status-sms-activity-loading")).toBeNull();
    expect(screen.queryByTestId("status-sms-activity-error")).toBeNull();
    expect(screen.queryByTestId("list-sms-rate-limited")).toBeNull();
    // The amber explainer ONLY renders when there are held-back rows.
    // It's the "what's happening + what to do" copy, and showing it on
    // an empty state would actively misinform.
    expect(screen.queryByTestId("text-sms-activity-explainer")).toBeNull();
  });

  it("empty state: also handles a missing `messages` field defensively", () => {
    // The component reads `data?.messages ?? []`. If a future server
    // tweak ever returns `{}` (no messages key), the panel must still
    // render the empty state, not crash.
    queryResultOverride = {
      isLoading: false,
      isError: false,
      data: {},
    };
    render(<SmsActivityPanel />);
    expect(screen.getByTestId("status-sms-activity-empty")).toBeTruthy();
  });

  it("populated state: renders the explainer + a row per held-back text with type, time, and recipient", () => {
    const baseIso = "2026-04-26T14:30:00.000Z";
    queryResultOverride = {
      isLoading: false,
      isError: false,
      data: {
        messages: [
          {
            id: "msg-newer",
            type: "first_booking_nudge_10m",
            channel: "sms",
            toAddress: "+15551234567",
            scheduledFor: baseIso,
            canceledAt: baseIso,
          },
          {
            id: "msg-older",
            type: "followup",
            channel: "sms",
            toAddress: "5559876543",
            scheduledFor: "2026-04-25T09:15:00.000Z",
            canceledAt: "2026-04-25T09:15:00.000Z",
          },
          {
            // Unmapped type: must fall through to the title-cased
            // fallback in formatType, not to a blank label.
            id: "msg-fallback-type",
            type: "weird_new_type",
            channel: "sms",
            toAddress: "+44123456789",
            scheduledFor: null,
            canceledAt: "2026-04-24T12:00:00.000Z",
          },
        ],
      },
    };

    render(<SmsActivityPanel />);

    // The amber "you hit the safety limit" explainer is the part the
    // task acceptance criteria call out by name as "the friendly
    // explainer copy". It must appear EXACTLY when there are rows.
    const explainer = screen.getByTestId("text-sms-activity-explainer");
    const explainerText = explainer.textContent ?? "";
    expect(explainerText).toContain("3-text-per-day safety limit");
    expect(explainerText).toContain("next scheduled text will go out automatically");

    // The list container exists and holds one <li> per message.
    const list = screen.getByTestId("list-sms-rate-limited");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);

    // Row 1: known type label gets the friendly mapping.
    const row1 = screen.getByTestId("row-sms-rate-limited-msg-newer");
    expect(
      within(row1).getByTestId("text-sms-rate-limited-type-msg-newer").textContent,
    ).toBe("First-booking nudge (10 min)");
    // Recipient is formatted as a US phone when 11 digits starting with 1.
    expect(
      within(row1).getByTestId("text-sms-rate-limited-to-msg-newer").textContent,
    ).toBe("To (555) 123-4567");

    // Row 2: another known type + a 10-digit US phone formatted without
    // the leading "1".
    const row2 = screen.getByTestId("row-sms-rate-limited-msg-older");
    expect(
      within(row2).getByTestId("text-sms-rate-limited-type-msg-older").textContent,
    ).toBe("Post-job follow-up");
    expect(
      within(row2).getByTestId("text-sms-rate-limited-to-msg-older").textContent,
    ).toBe("To (555) 987-6543");

    // Row 3: unmapped type falls back to title-cased "Weird New Type",
    // and a non-NANP number passes through untouched.
    const row3 = screen.getByTestId("row-sms-rate-limited-msg-fallback-type");
    expect(
      within(row3).getByTestId("text-sms-rate-limited-type-msg-fallback-type").textContent,
    ).toBe("Weird New Type");
    expect(
      within(row3).getByTestId("text-sms-rate-limited-to-msg-fallback-type").textContent,
    ).toBe("To +44123456789");

    // None of the empty/error/loading states leak into the populated view.
    expect(screen.queryByTestId("status-sms-activity-loading")).toBeNull();
    expect(screen.queryByTestId("status-sms-activity-error")).toBeNull();
    expect(screen.queryByTestId("status-sms-activity-empty")).toBeNull();
  });

  it("populated state: time cell prefers canceledAt, falling back to scheduledFor when canceledAt is missing", () => {
    // Defends against the panel silently rendering an empty time cell
    // for a row that was canceled with a null canceled_at — the fallback
    // to scheduledFor is the only thing that keeps the timestamp column
    // populated in that edge case.
    queryResultOverride = {
      isLoading: false,
      isError: false,
      data: {
        messages: [
          {
            id: "msg-no-canceled",
            type: "followup",
            channel: "sms",
            toAddress: "+15551234567",
            scheduledFor: "2026-04-26T14:30:00.000Z",
            canceledAt: null,
          },
        ],
      },
    };
    render(<SmsActivityPanel />);

    const timeCell = screen.getByTestId(
      "text-sms-rate-limited-time-msg-no-canceled",
    );
    // The exact string is locale-dependent under jsdom, so we just
    // assert the cell has SOME formatted content (not the empty
    // string the formatter returns for a null/invalid input).
    expect((timeCell.textContent ?? "").trim().length).toBeGreaterThan(0);
  });
});
