import { getActionEncouragement } from "./encouragementEngine";
import { recordShown } from "./encouragementRules";
import { trackEncouragement } from "./encouragementAnalytics";

type ActionType = "reminder_sent" | "invoice_sent" | "link_shared" | "job_marked_complete" | "follow_up_sent";

export function getPostActionMessage(actionType: ActionType): string | null {
  const selected = getActionEncouragement(actionType);
  if (!selected) return null;

  recordShown(selected.id, false);
  trackEncouragement("shown", selected, {
    surface: actionType,
    trigger: actionType,
  });
  return selected.message;
}
