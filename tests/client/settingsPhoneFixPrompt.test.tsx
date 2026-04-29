/**
 * @jest-environment jsdom
 *
 * Task #72: lock the Settings "We couldn't deliver your SMS confirmation"
 * banner — its visibility gating, the two CTAs, and the auto-retry that
 * fires after a successful phone-link while the failure flag is set.
 */

import * as React from "react";

// --- Module mocks (must run before importing the page under test) ---

jest.mock("wouter", () => ({
  __esModule: true,
  useLocation: () => ["/settings", () => {}],
}));

const apiFetchMock = jest.fn(async (_url: string, _opts?: RequestInit) => ({
  success: true,
}));
jest.mock("@/lib/apiFetch", () => ({
  __esModule: true,
  apiFetch: (...args: unknown[]) => apiFetchMock(...(args as [string, RequestInit?])),
}));

jest.mock("@/lib/authToken", () => ({
  __esModule: true,
  getAuthToken: () => null,
  isTokenReady: () => true,
  setAuthToken: () => {},
  clearAuthToken: () => {},
}));

// Native platform = true so the PhoneLinkDialog wiring renders.
jest.mock("@/lib/platform", () => ({
  __esModule: true,
  isNativePlatform: () => true,
}));

jest.mock("@/lib/clipboard", () => ({
  __esModule: true,
  copyTextToClipboard: jest.fn(async () => true),
}));
jest.mock("@/lib/bookingBaseUrl", () => ({
  __esModule: true,
  buildBookingLink: (slug: string) => `https://book.gigaid.ai/${slug}`,
  BOOKING_LINK_HOST_DISPLAY: "book.gigaid.ai",
}));
jest.mock("@/lib/consent/analyticsConsent", () => ({
  __esModule: true,
  getAnalyticsConsent: () => "granted",
  setAnalyticsConsent: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/analytics/initAnalytics", () => ({
  __esModule: true,
  initAnalyticsSafely: jest.fn(),
  disableAnalytics: jest.fn(),
  persistAnalyticsPreferences: jest.fn(async () => {}),
}));
jest.mock("@/lib/att/attManager", () => ({
  __esModule: true,
  getATTStatus: jest.fn(async () => "unknown"),
  requestATTUserInitiated: jest.fn(async () => "authorized"),
  isIOSNative: () => false,
}));
jest.mock("@/lib/slugAdjustedNotice", () => ({
  __esModule: true,
  buildSlugAdjustedNotice: () => null,
}));

jest.mock("@/lib/firebase", () => ({
  __esModule: true,
  isEmailPasswordUser: () => false,
  getAccountLinkingInfo: () => ({
    currentProvider: "email",
    linkedMethods: [{ provider: "email", identifier: "test@example.com", verified: true }],
  }),
  linkAppleToCurrentUser: jest.fn(async () => {}),
  linkGoogleToCurrentUser: jest.fn(async () => {}),
  formatFirebaseLinkError: (e: unknown) => String(e),
  requireFirebaseUser: () => ({ reload: jest.fn(async () => {}) }),
}));

jest.mock("@/contexts/FirebaseAuthContext", () => ({
  __esModule: true,
  useFirebaseAuth: () => ({
    firebaseUser: { uid: "test-uid" },
    authLoading: false,
    lastAuthEventTs: 0,
    callbackCount: 0,
    isTokenReady: true,
    isInteractiveExchangeInProgress: false,
    setTokenReady: jest.fn(),
    setInteractiveExchangeInProgress: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    logout: jest.fn(),
  }),
}));
jest.mock("@/hooks/use-mobile", () => ({
  __esModule: true,
  useIsMobile: () => false,
}));
jest.mock("@/hooks/use-toast", () => ({
  __esModule: true,
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/hooks/use-auth", () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: true, logoutAsync: jest.fn() }),
}));
jest.mock("@/hooks/use-nudges", () => ({
  __esModule: true,
  useFeatureFlag: () => ({ data: { key: "ai_micro_nudges", enabled: true } }),
  useUpdateFeatureFlag: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/hooks/useKeyboardInset", () => ({
  __esModule: true,
  useKeyboardInset: () => 0,
}));

// SettingsSectionAccordion must render its children — the banner lives
// inside the "Account" accordion, which defaults to closed in prod.
jest.mock("@/components/settings/SettingsSectionAccordion", () => {
  const Real = require("react");
  return {
    __esModule: true,
    SettingsSectionAccordion: ({ children }: { children: React.ReactNode }) =>
      Real.createElement("div", null, children),
  };
});
jest.mock("@/components/HelpLink", () => ({ __esModule: true, HelpLink: () => null }));
jest.mock("@/components/settings/AvailabilityEditor", () => ({
  __esModule: true,
  AvailabilityEditor: () => null,
}));
jest.mock("@/components/PaymentMethodsSettings", () => ({
  __esModule: true,
  PaymentMethodsSettings: () => null,
}));
jest.mock("@/components/settings/StripeConnectSettings", () => ({
  __esModule: true,
  StripeConnectSettings: () => null,
}));
jest.mock("@/components/settings/EmailSignatureSettings", () => ({
  __esModule: true,
  EmailSignatureSettings: () => null,
}));
jest.mock("@/components/settings/AutomationSettings", () => ({
  __esModule: true,
  AutomationSettings: () => null,
}));
jest.mock("@/components/settings/MessagingSettings", () => ({
  __esModule: true,
  MessagingSettings: () => null,
}));
jest.mock("@/components/settings/SmsActivityPanel", () => ({
  __esModule: true,
  SmsActivityPanel: () => null,
}));
jest.mock("@/components/settings/ChangePasswordDialog", () => ({
  __esModule: true,
  ChangePasswordDialog: () => null,
}));
jest.mock("@/components/settings/SubscriptionSettings", () => ({
  __esModule: true,
  SubscriptionSettings: () => null,
}));

// Expose the AccountLinking onLinkPhone prop as a clickable button so
// tests can drive the auto-retry-after-phone-link flow.
jest.mock("@/components/mobile-auth/AccountLinking", () => {
  const Real = require("react");
  return {
    __esModule: true,
    AccountLinking: ({ onLinkPhone }: { onLinkPhone?: () => Promise<void> }) =>
      Real.createElement(
        "div",
        null,
        Real.createElement(
          "button",
          {
            type: "button",
            "data-testid": "stub-button-link-phone",
            onClick: () => {
              void onLinkPhone?.();
            },
          },
          "stub link phone",
        ),
      ),
  };
});

// Same idea for PhoneLinkDialog.onLinked — the trigger for auto-retry.
jest.mock("@/components/mobile-auth/PhoneLinkDialog", () => {
  const Real = require("react");
  return {
    __esModule: true,
    PhoneLinkDialog: ({
      open,
      onLinked,
    }: {
      open: boolean;
      onLinked: () => void;
    }) =>
      Real.createElement(
        "div",
        { "data-open": String(open) },
        Real.createElement(
          "button",
          {
            type: "button",
            "data-testid": "stub-button-phone-link-success",
            onClick: () => onLinked?.(),
          },
          "stub phone linked",
        ),
      ),
  };
});

jest.mock("@capacitor/filesystem", () => ({
  __esModule: true,
  Directory: { Documents: "DOCUMENTS" },
  Filesystem: { writeFile: jest.fn(), getUri: jest.fn() },
}));

// Selectively mock useQuery so /api/profile returns our fixture; keep
// useMutation / useQueryClient real so useApiMutation actually fires
// apiFetch — that's the wire contract this suite locks.
let profileMock: Record<string, unknown> | undefined = undefined;

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    __esModule: true,
    ...actual,
    useQuery: ({ queryKey }: { queryKey: ReadonlyArray<unknown> }) => {
      const head = String(queryKey?.[0] ?? "");
      if (head === "/api/profile") {
        return { data: profileMock, isLoading: false, isError: false };
      }
      return { data: undefined, isLoading: false, isError: false };
    },
  };
});

// ---- Test imports (after mocks). ------------------------------------
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Settings from "@/pages/Settings";

const buildProfile = (
  overrides: Partial<{
    smsConfirmationLastFailureAt: string | null;
    smsConfirmationLastFailureMessage: string | null;
    phone: string | null;
  }> = {},
) => ({
  email: "test@example.com",
  phone: "+15551234567",
  publicProfileEnabled: false,
  publicProfileSlug: "",
  notifyBySms: true,
  notifyByEmail: true,
  availability: null,
  slotDuration: 60,
  showReviewsOnBooking: true,
  publicEstimationEnabled: true,
  noShowProtectionEnabled: true,
  noShowProtectionDepositPercent: 25,
  smsConfirmationLastFailureAt: null,
  smsConfirmationLastFailureMessage: null,
  smsOptOut: false,
  attStatus: "unknown",
  attPromptedAt: null,
  analyticsEnabled: false,
  analyticsDisabledReason: null,
  ...overrides,
});

const renderSettings = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <Settings />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async () => ({ success: true }));
  profileMock = undefined;
});

describe("Settings — SMS confirmation failure banner (Task #72)", () => {
  it("does NOT render the banner when smsConfirmationLastFailureAt is null", () => {
    profileMock = buildProfile({ smsConfirmationLastFailureAt: null });
    renderSettings();

    expect(screen.queryByTestId("banner-sms-confirmation-failed")).toBeNull();
    expect(screen.queryByTestId("button-sms-confirmation-update-phone")).toBeNull();
    expect(screen.queryByTestId("button-sms-confirmation-try-again")).toBeNull();
  });

  it("renders the banner with both CTAs when smsConfirmationLastFailureAt is set", () => {
    profileMock = buildProfile({
      smsConfirmationLastFailureAt: "2026-04-29T12:00:00.000Z",
      smsConfirmationLastFailureMessage:
        "Twilio rejected your number as unreachable.",
    });
    renderSettings();

    const banner = screen.getByTestId("banner-sms-confirmation-failed");
    expect(banner).toBeTruthy();
    expect(banner.textContent ?? "").toContain(
      "Twilio rejected your number as unreachable.",
    );
    expect(screen.getByTestId("button-sms-confirmation-update-phone")).toBeTruthy();
    expect(screen.getByTestId("button-sms-confirmation-try-again")).toBeTruthy();
  });

  it("'Update phone number' scrolls to + highlights the account-linking section and focuses the inline phone input", () => {
    // Spy on Element.prototype.scrollIntoView before render so we
    // capture the call from focusPhoneNumberField. jsdom does not
    // implement scrollIntoView, so we MUST install a stub.
    const scrollIntoViewSpy = jest.fn();
    const originalScrollIntoView =
      // @ts-expect-error - jsdom does not declare scrollIntoView
      Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoViewSpy;

    jest.useFakeTimers();
    try {
      profileMock = buildProfile({
        smsConfirmationLastFailureAt: "2026-04-29T12:00:00.000Z",
      });
      renderSettings();

      expect(screen.queryByTestId("form-sms-confirmation-update-phone")).toBeNull();
      const sectionBefore = screen.getByTestId("section-account-linking");
      expect(sectionBefore.className).not.toMatch(/ring-2/);

      act(() => {
        fireEvent.click(
          screen.getByTestId("button-sms-confirmation-update-phone"),
        );
      });

      // Inline editor opens.
      expect(screen.getByTestId("form-sms-confirmation-update-phone")).toBeTruthy();
      const phoneInput = screen.getByTestId(
        "input-sms-confirmation-phone",
      ) as HTMLInputElement;
      expect(screen.getByTestId("button-sms-confirmation-save-phone")).toBeTruthy();
      expect(screen.getByTestId("button-sms-confirmation-cancel-phone")).toBeTruthy();

      // Account-linking section is scrolled into view AND highlighted.
      const section = screen.getByTestId("section-account-linking");
      expect(scrollIntoViewSpy).toHaveBeenCalled();
      const scrolledOnSection = scrollIntoViewSpy.mock.instances.some(
        (instance) => instance === section || section.contains(instance as Node),
      );
      expect(scrolledOnSection).toBe(true);
      expect(section.className).toMatch(/ring-2/);

      // Drain the 50ms focus timer and assert focus on the input.
      act(() => {
        jest.advanceTimersByTime(60);
      });
      expect(document.activeElement).toBe(phoneInput);
    } finally {
      jest.useRealTimers();
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        // @ts-expect-error - restore jsdom's missing impl
        delete Element.prototype.scrollIntoView;
      }
    }
  });

  it("'Try again' POSTs /api/profile/sms/resume and the banner disappears once the failure flag clears", async () => {
    profileMock = buildProfile({
      smsConfirmationLastFailureAt: "2026-04-29T12:00:00.000Z",
    });
    const { rerender } = renderSettings();

    expect(screen.getByTestId("banner-sms-confirmation-failed")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-sms-confirmation-try-again"));
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const resumeCall = apiFetchMock.mock.calls.find(
      ([url]) => url === "/api/profile/sms/resume",
    );
    expect(resumeCall).toBeDefined();
    expect(resumeCall?.[1]?.method).toBe("POST");

    // Simulate the post-success profile re-fetch clearing the flag.
    profileMock = buildProfile({ smsConfirmationLastFailureAt: null });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    rerender(
      <QueryClientProvider client={client}>
        <Settings />
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId("banner-sms-confirmation-failed")).toBeNull();
  });

  it("auto-fires POST /api/profile/sms/resume after a successful phone link while the failure flag is set", async () => {
    profileMock = buildProfile({
      smsConfirmationLastFailureAt: "2026-04-29T12:00:00.000Z",
    });
    renderSettings();

    // Arms autoRetryAfterPhoneLinkRef inside the page.
    await act(async () => {
      fireEvent.click(screen.getByTestId("stub-button-link-phone"));
    });
    // Simulates PhoneLinkDialog signalling a successful link.
    await act(async () => {
      fireEvent.click(screen.getByTestId("stub-button-phone-link-success"));
    });

    await waitFor(() => {
      const resumeCall = apiFetchMock.mock.calls.find(
        ([url]) => url === "/api/profile/sms/resume",
      );
      expect(resumeCall).toBeDefined();
      expect(resumeCall?.[1]?.method).toBe("POST");
    });
  });

  it("does NOT auto-fire the resume mutation after a phone link when the failure flag is null", async () => {
    profileMock = buildProfile({ smsConfirmationLastFailureAt: null });
    renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByTestId("stub-button-link-phone"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("stub-button-phone-link-success"));
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const resumeCall = apiFetchMock.mock.calls.find(
      ([url]) => url === "/api/profile/sms/resume",
    );
    expect(resumeCall).toBeUndefined();
  });
});
