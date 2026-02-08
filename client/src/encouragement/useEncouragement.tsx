import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { X, Sparkles } from "lucide-react";

let sessionResetDone = false;

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

  return { message, dismiss };
}

interface EncouragementBannerProps {
  message: SelectedEncouragement;
  onDismiss: () => void;
}

export function EncouragementBanner({ message, onDismiss }: EncouragementBannerProps) {
  return (
    <div
      className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/10 text-sm text-foreground"
      data-testid="banner-encouragement"
    >
      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="flex-1">{message.message}</span>
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
