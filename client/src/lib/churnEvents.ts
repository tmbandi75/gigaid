import { apiFetch } from "./apiFetch";

export function emitChurnEvent(eventName: string, context?: Record<string, any>) {
  apiFetch("/api/events/churn-signal", {
    method: "POST",
    body: JSON.stringify({ eventName, context }),
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
}
