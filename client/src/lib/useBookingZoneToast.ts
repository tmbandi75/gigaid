import { useEffect, useRef } from "react";

import { useToast } from "@/hooks/use-toast";
import type { BookingShareProgress } from "@shared/bookingLink";

export const BOOKING_ZONE_TOAST_FIRED_KEY = "gigaid:booking-zone-toast-fired";

export const BOOKING_ZONE_TOAST_TITLE = "You're in the booking zone — keep going";
export const BOOKING_ZONE_TOAST_DESCRIPTION =
  "Most pros land their first booking around here.";

/**
 * Booking-zone celebration toast: fires ONCE per browser session the first
 * time the pro's daily share count crosses the 3-shares threshold while the
 * page is open. The hook waits for the first non-undefined `shareProgress`
 * value to capture a baseline so a refresh that lands with `count >= 3`
 * doesn't mistakenly re-fire the toast — only an in-session transition does.
 *
 * The sessionStorage key (`gigaid:booking-zone-toast-fired`) doubles as a
 * cross-mount guard: even a real <3 → ≥3 transition is suppressed if the
 * flag is already set, so a route change + remount inside the same session
 * can't replay the celebration.
 */
export function useBookingZoneToast(
  shareProgress: BookingShareProgress | undefined,
) {
  const { toast } = useToast();
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shareProgress) return;
    const current = shareProgress.count;
    if (baselineRef.current === null) {
      baselineRef.current = current;
      return;
    }
    const previous = baselineRef.current;
    baselineRef.current = current;
    if (previous >= 3 || current < 3) return;
    try {
      if (
        window.sessionStorage.getItem(BOOKING_ZONE_TOAST_FIRED_KEY) === "1"
      ) {
        return;
      }
      window.sessionStorage.setItem(BOOKING_ZONE_TOAST_FIRED_KEY, "1");
    } catch {
      // sessionStorage unavailable — accept that the toast may re-fire
      // on subsequent transitions (extremely rare in this session).
    }
    toast({
      title: BOOKING_ZONE_TOAST_TITLE,
      description: BOOKING_ZONE_TOAST_DESCRIPTION,
    });
  }, [shareProgress, toast]);
}
