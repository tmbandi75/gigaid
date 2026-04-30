import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { canShareContent } from "@/lib/share";
import { trackEvent } from "@/components/PostHogProvider";
import { recordCopy, recordShareTap } from "@/lib/bookingLinkAnalytics";
import { getPostActionMessage } from "@/encouragement/encouragementToast";
import {
  attemptShareBookingLink,
  copyBookingLinkToClipboard,
} from "@/lib/bookingLinkShareFlow";

export type BookingLinkShareScreen =
  | "plan"
  | "plan_empty"
  | "leads"
  | "jobs"
  | "bookings";

export interface UseBookingLinkShareActionOptions {
  /**
   * Screen / surface label sent to PostHog so we can break the share
   * funnel down by where the user kicked off the action.
   */
  screen: BookingLinkShareScreen;
  /**
   * Server-side analytics context (legacy — kept for backwards compat
   * with `recordCopy` / `recordShareTap`). Defaults to "plan".
   */
  context?: "plan" | "leads" | "jobs" | "bookings";
  /**
   * Title shown in the OS share sheet on platforms that surface it.
   */
  shareTitle?: string;
  /**
   * Body text shown in the OS share sheet (alongside the URL).
   */
  shareText?: string;
  /**
   * When true, navigates the user to /profile if the booking link
   * isn't ready yet (e.g. they haven't added a service). Default:
   * false (caller decides what to do via the returned `bookingLink`
   * being null).
   */
  redirectToProfileWhenMissing?: boolean;
}

export interface UseBookingLinkShareActionResult {
  bookingLink: string | null;
  hasServices: boolean;
  copied: boolean;
  /**
   * Triggers the OS share sheet (or copy-fallback on platforms
   * without `navigator.share`). Resolves once the user dismisses
   * the share UI.
   */
  share: () => Promise<void>;
  /**
   * Copies the booking link to the clipboard and records the share
   * with method "copy". Sets `copied=true` for 2s so callers can
   * flash a checkmark.
   */
  copy: () => Promise<boolean>;
  /** True when the platform supports a native share sheet. */
  supportsShare: boolean;
}

const DEFAULT_SHARE_TITLE = "Book my services";
const DEFAULT_SHARE_TEXT = "Schedule a job with me using this link:";

/**
 * Single source of truth for the booking-link share/copy action.
 * Used by:
 *  - The hero `BookingLinkShare` card on Today's Game Plan
 *  - The "Send Booking Link" button in the empty state on Today's
 *    Game Plan
 *  - Any future surface that needs the same toast + analytics
 *    behavior (leads inline, jobs compact, etc.)
 *
 * Keeping the logic here prevents drift between surfaces and
 * guarantees the analytics funnel remains consistent.
 */
export function useBookingLinkShareAction(
  opts: UseBookingLinkShareActionOptions,
): UseBookingLinkShareActionResult {
  const {
    screen,
    context = "plan",
    shareTitle = DEFAULT_SHARE_TITLE,
    shareText = DEFAULT_SHARE_TEXT,
    redirectToProfileWhenMissing = false,
  } = opts;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery<{ bookingLink: string | null; servicesCount: number }>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const bookingLink = data?.bookingLink ?? null;
  const hasServices = (data?.servicesCount || 0) > 0;
  const supportsShare = canShareContent();

  const invalidateGamePlan = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });

  const handleMissingLink = (): boolean => {
    if (bookingLink) return false;
    toast({
      title: "Booking link not ready yet",
      description: "Add a service first to generate your booking link.",
    });
    if (redirectToProfileWhenMissing) {
      navigate("/profile");
    }
    return true;
  };

  const copy = async (): Promise<boolean> => {
    if (handleMissingLink()) return false;
    if (!bookingLink) return false;

    const { copied: copiedOk } = await copyBookingLinkToClipboard({
      bookingLink,
      userId,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    if (copiedOk) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent("booking_link_copied", { screen });
      void recordCopy(context);
      const encouragement = getPostActionMessage("link_shared");
      toast({
        title: "Link copied",
        description: encouragement || "Your booking link is ready to share",
      });
      return true;
    }
    toast({
      title: "Couldn't copy",
      description: "Please copy the link manually",
      variant: "destructive",
    });
    return false;
  };

  const share = async (): Promise<void> => {
    if (handleMissingLink()) return;
    if (!bookingLink) return;

    trackEvent("booking_link_share_opened", { screen });
    void recordShareTap(context);

    if (!supportsShare) {
      const copiedOk = await copy();
      if (copiedOk) {
        trackEvent("booking_link_shared", { screen, method: "copy" });
      }
      return;
    }

    const { shared, target } = await attemptShareBookingLink({
      bookingLink,
      shareTitle,
      shareText,
      dialogTitle: "Share booking link",
      userId,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    if (shared) {
      trackEvent("booking_link_shared", { screen, method: "share", target });
    }
  };

  return { bookingLink, hasServices, copied, share, copy, supportsShare };
}
