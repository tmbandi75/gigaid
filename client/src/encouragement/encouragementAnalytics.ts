import { trackEvent } from "@/components/PostHogProvider";
import type { SelectedEncouragement } from "./encouragementEngine";

type EncouragementEvent = "shown" | "dismissed" | "action_clicked";

export function trackEncouragement(
  event: EncouragementEvent,
  encouragement: SelectedEncouragement,
  surface?: string
): void {
  trackEvent(`encouragement_${event}`, {
    category: encouragement.category,
    templateId: encouragement.id,
    surface: surface || "dashboard",
  });
}
