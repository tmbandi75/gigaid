export type RcWebhookBody = {
  type?: string;
  id?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_to?: string[];
  transferred_from?: string[];
};

type RcWebhookEnvelope = {
  event?: unknown;
  api_version?: string;
};

/** RevenueCat sometimes posts `{ event: { ... } }` instead of a flat event object. */
export function pickPayload(raw: unknown): { payload: RcWebhookBody; nestedEvent: boolean } {
  if (raw && typeof raw === "object" && "event" in raw) {
    const inner = (raw as RcWebhookEnvelope).event;
    if (inner && typeof inner === "object") {
      return { payload: inner as RcWebhookBody, nestedEvent: true };
    }
  }
  return {
    payload: raw && typeof raw === "object" ? (raw as RcWebhookBody) : {},
    nestedEvent: false,
  };
}

function firstAlias(aliases: unknown): string | null {
  if (!Array.isArray(aliases)) return null;
  for (const entry of aliases) {
    if (typeof entry === "string" && entry.length > 0) return entry;
  }
  return null;
}

export function resolveAppUserId(body: RcWebhookBody): string | null {
  if (typeof body.app_user_id === "string" && body.app_user_id.length > 0) {
    return body.app_user_id;
  }
  if (typeof body.original_app_user_id === "string" && body.original_app_user_id.length > 0) {
    return body.original_app_user_id;
  }
  const fromAlias = firstAlias(body.aliases);
  if (fromAlias) return fromAlias;
  if (Array.isArray(body.transferred_to) && body.transferred_to[0]) {
    return body.transferred_to[0]!;
  }
  // TRANSFER payloads omit app_user_id; fall back to source ids when destination list is empty.
  if (body.type === "TRANSFER" && Array.isArray(body.transferred_from) && body.transferred_from[0]) {
    return body.transferred_from[0]!;
  }
  return null;
}
