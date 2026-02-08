import { trackEvent } from "@/components/PostHogProvider";
import type { SelectedEncouragement } from "./encouragementEngine";

type EncouragementEvent = "shown" | "dismissed" | "action_clicked";

interface TrackOptions {
  surface?: string;
  amount?: number;
  trigger?: string;
  userPlan?: string;
}

export function trackEncouragement(
  event: EncouragementEvent,
  encouragement: SelectedEncouragement,
  options?: string | TrackOptions
): void {
  const opts: TrackOptions = typeof options === "string" ? { surface: options } : (options || {});
  trackEvent(`encouragement_${event}`, {
    category: encouragement.category,
    templateId: encouragement.id,
    surface: opts.surface || "dashboard",
    trigger: opts.trigger || encouragement.category,
    ...(opts.amount !== undefined && { amount: opts.amount }),
    ...(opts.userPlan && { user_plan: opts.userPlan }),
  });
}
