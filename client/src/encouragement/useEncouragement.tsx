import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/hooks/use-auth";
import {
  getEncouragementMessage,
  type SelectedEncouragement,
  type EncouragementData,
} from "./encouragementEngine";
import {
  recordShown,
  recordDismissed,
  resetSessionCount,
} from "./encouragementRules";
import { trackEncouragement } from "./encouragementAnalytics";
import { X, Sparkles, ChevronRight } from "lucide-react";

let sessionResetDone = false;

const ACTION_ROUTES: Record<string, string> = {
  weekly_earnings: "/invoices",
  weekly_growth: "/invoices",
  jobs_completed: "/jobs",
  collected_today: "/invoices",
  money_waiting: "/invoices",
  reminder_sent: "/reminders",
  invoice_sent: "/invoices",
  link_shared: "/settings",
  job_marked_complete: "/invoices",
  follow_up_sent: "/reminders",
  quiet_day: "/reminders",
  follow_up_reminder: "/reminders",
  invoice_nudge: "/invoices",
  booking_reminder: "/settings",
};

export function useEncouragement() {
  const [message, setMessage] = useState<SelectedEncouragement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const initialized = useRef(false);
  const { user } = useAuth();
  const userPlan = user?.plan || "free";

  useEffect(() => {
    if (!sessionResetDone) {
      resetSessionCount();
      sessionResetDone = true;
    }
  }, []);

  const { data } = useQuery<EncouragementData>({
    queryKey: QUERY_KEYS.encouragementData(),
    queryFn: () => apiFetch<EncouragementData>("/api/encouragement/data"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data || dismissed || message || initialized.current) return;
    initialized.current = true;

    const selected = getEncouragementMessage(data);
    if (selected) {
      recordShown(selected.id, selected.category === "identity");
      trackEncouragement("shown", selected, {
        surface: "dashboard",
        amount: data.weeklyEarnings,
        userPlan,
      });
      setMessage(selected);
    }
  }, [data, dismissed, message, userPlan]);

  const dismiss = useCallback(() => {
    if (message) {
      trackEncouragement("dismissed", message, { surface: "dashboard", userPlan });
    }
    recordDismissed();
    setDismissed(true);
    setMessage(null);
  }, [message, userPlan]);

  return { message, dismiss, userPlan };
}

interface EncouragementBannerProps {
  message: SelectedEncouragement;
  onDismiss: () => void;
  userPlan?: string;
}

export function EncouragementBanner({ message, onDismiss, userPlan }: EncouragementBannerProps) {
  const [, navigate] = useLocation();
  const actionRoute = ACTION_ROUTES[message.id];

  const handleActionClick = () => {
    trackEncouragement("action_clicked", message, {
      surface: "dashboard",
      trigger: message.id,
      userPlan,
    });
    if (actionRoute) {
      navigate(actionRoute);
    }
  };

  return (
    <div
      className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/10 text-sm text-foreground"
      data-testid="banner-encouragement"
    >
      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
      <button
        onClick={handleActionClick}
        className="flex-1 text-left hover-elevate rounded px-1 -mx-1"
        data-testid="button-encouragement-action"
      >
        <span>{message.message}</span>
        {actionRoute && <ChevronRight className="inline h-3.5 w-3.5 ml-1 text-muted-foreground" />}
      </button>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-0.5 rounded hover-elevate"
        data-testid="button-dismiss-encouragement"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
