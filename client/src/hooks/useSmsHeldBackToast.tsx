import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getGlobalLoggingOut } from "@/lib/queryClient";
import { logger } from "@/lib/logger";

interface RateLimitedSms {
  id: string;
  type: string;
  channel: string;
  toAddress: string;
  scheduledFor: string | null;
  canceledAt: string | null;
}

interface RateLimitedResponse {
  messages: RateLimitedSms[];
}

const SEEN_KEY_PREFIX = "sms_rate_limit_last_seen:";
const SESSION_FIRED_KEY = "sms_rate_limit_toast_fired";
// Mirrors the LS_KEY in SettingsSectionAccordion.tsx — we pre-open the
// "account" section there so the SmsActivityPanel is visible after deep-link
// navigation from the toast.
const SETTINGS_SECTIONS_LS_KEY = "settings_sections_state";
const ACCOUNT_SECTION_ID = "account";

function getSeenKey(userId: string): string {
  return `${SEEN_KEY_PREFIX}${userId}`;
}

function readSeenAt(userId: string): string | null {
  try {
    return localStorage.getItem(getSeenKey(userId));
  } catch {
    return null;
  }
}

function writeSeenAt(userId: string, isoTimestamp: string): void {
  try {
    localStorage.setItem(getSeenKey(userId), isoTimestamp);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function markFiredThisSession(userId: string): void {
  try {
    sessionStorage.setItem(SESSION_FIRED_KEY, userId);
  } catch {
    /* non-fatal */
  }
}

function alreadyFiredThisSession(userId: string): boolean {
  try {
    return sessionStorage.getItem(SESSION_FIRED_KEY) === userId;
  } catch {
    return false;
  }
}

function preOpenAccountSection(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_SECTIONS_LS_KEY);
    const state: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    state[ACCOUNT_SECTION_ID] = true;
    localStorage.setItem(SETTINGS_SECTIONS_LS_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal — at worst the user has to expand the section themselves */
  }
}

/**
 * Fires a one-time, non-blocking toast on app open when one or more outbound
 * SMS rows have been canceled with failureReason='rate_limited' since the last
 * time we surfaced the nudge to this user. Each cancellation surfaces at most
 * once per device — we persist the latest "seen" canceledAt to localStorage,
 * keyed by user id. A sessionStorage flag prevents the toast from re-firing
 * inside the same session if the user keeps the app open and the query
 * refetches.
 *
 * Pairs with the SMS activity panel in Settings — the toast action navigates
 * the user there and scrolls to the panel via the #sms-activity hash.
 */
export function useSmsHeldBackToast(
  user: { id?: string | number } | null | undefined,
) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const firedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // We keep the query disabled until we have an authenticated user. Sharing the
  // queryKey with SmsActivityPanel means React Query dedupes the fetch when
  // the user opens Settings.
  const userIdStr = user?.id != null ? String(user.id) : null;
  const enabled = !!userIdStr && !getGlobalLoggingOut();

  // Reset the in-memory fire-once guard when the active user changes within
  // the same session (e.g. shared device, sign-out + sign-in as a different
  // user without a full reload). The localStorage marker is per-user, so the
  // new user still gets their own dedupe — we just need to let the effect run.
  useEffect(() => {
    if (lastUserIdRef.current !== userIdStr) {
      lastUserIdRef.current = userIdStr;
      firedRef.current = false;
    }
  }, [userIdStr]);

  const { data } = useQuery<RateLimitedResponse>({
    queryKey: QUERY_KEYS.smsRateLimitedRecent(),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!userIdStr || !data || firedRef.current) return;
    if (alreadyFiredThisSession(userIdStr)) {
      firedRef.current = true;
      return;
    }

    const messages = data.messages ?? [];
    if (messages.length === 0) return;

    // Find the newest canceledAt across the returned rows. The endpoint
    // already orders desc, but we don't want to depend on that contract here.
    let newestIso: string | null = null;
    for (const m of messages) {
      if (!m.canceledAt) continue;
      if (!newestIso || m.canceledAt > newestIso) {
        newestIso = m.canceledAt;
      }
    }
    if (!newestIso) return;

    const seenIso = readSeenAt(userIdStr);

    // If a marker already exists and is at-or-after the newest cancellation
    // we know about, we've already surfaced this nudge — bail.
    if (seenIso && newestIso <= seenIso) {
      firedRef.current = true;
      return;
    }

    firedRef.current = true;
    writeSeenAt(userIdStr, newestIso);
    markFiredThisSession(userIdStr);

    logger.debug("[SmsHeldBackToast] Showing one-time held-back nudge", {
      newestIso,
      seenIso,
    });

    toast({
      title: "A scheduled text was held back today",
      description: "See SMS activity in Settings for details.",
      action: (
        <ToastAction
          altText="Open Settings"
          data-testid="button-toast-sms-activity-open"
          onClick={() => {
            // Pre-open the Account accordion that wraps the panel so the
            // user lands on visible content, not a collapsed section.
            preOpenAccountSection();
            setLocation("/settings");
            // wouter doesn't manage hash; setting it directly lets the
            // Settings page scroll to the SmsActivityPanel anchor.
            try {
              window.location.hash = "sms-activity";
            } catch {
              /* non-fatal */
            }
          }}
        >
          Open Settings
        </ToastAction>
      ),
    });
  }, [data, userIdStr, toast, setLocation]);
}
