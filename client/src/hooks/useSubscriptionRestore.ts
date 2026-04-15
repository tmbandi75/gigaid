import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import { getGlobalLoggingOut } from "@/lib/queryClient";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import { restoreNativePurchasesThenServer } from "@/lib/revenuecat";

const RESTORE_SESSION_KEY = "gigaid_sub_restore_checked";

export function useSubscriptionRestore(user: {
  id?: string | number;
  plan?: string | null;
  isPro?: boolean | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
} | null | undefined) {
  const queryClient = useQueryClient();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || attemptedRef.current) return;

    if (getGlobalLoggingOut()) return;

    const alreadyChecked = sessionStorage.getItem(RESTORE_SESSION_KEY);
    if (alreadyChecked === String(user.id)) return;

    const needsRestore =
      (!user.plan || user.plan === "free") &&
      !user.isPro &&
      !user.stripeSubscriptionId;

    if (!needsRestore) {
      sessionStorage.setItem(RESTORE_SESSION_KEY, String(user.id));
      return;
    }

    attemptedRef.current = true;

    const token = getAuthToken();
    if (!token) {
      sessionStorage.setItem(RESTORE_SESSION_KEY, String(user.id));
      return;
    }

    const controller = new AbortController();
    const userId = String(user.id);

    logger.info("[AutoRestore] User on free plan with no subscription ID, checking billing...");

    (async () => {
      try {
        await restoreNativePurchasesThenServer();
        if (controller.signal.aborted) return;
        const res = await fetch("/api/subscription/restore", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) throw new Error(`Restore failed: ${res.status}`);
        const data = await res.json();
        if (controller.signal.aborted) return;
        sessionStorage.setItem(RESTORE_SESSION_KEY, userId);
        if (data.restored) {
          logger.info("[AutoRestore] Subscription restored:", data.plan);
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.authUser() });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptionStatus() });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
        } else {
          logger.info("[AutoRestore] No active subscription found:", data.reason);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        logger.warn("[AutoRestore] Restore check failed:", err?.message);
        sessionStorage.setItem(RESTORE_SESSION_KEY, userId);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [user?.id, user?.plan, user?.isPro, user?.stripeSubscriptionId, queryClient]);
}
