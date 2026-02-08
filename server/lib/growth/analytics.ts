const POSTHOG_API_KEY = process.env.VITE_POSTHOG_API_KEY || "";
const POSTHOG_CAPTURE_URL = "https://us.i.posthog.com/capture/";

export function trackServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): void {
  if (!POSTHOG_API_KEY) return;

  const payload = {
    api_key: POSTHOG_API_KEY,
    event,
    distinct_id: distinctId,
    properties: {
      ...properties,
      $lib: "gigaid-server",
    },
  };

  fetch(POSTHOG_CAPTURE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
