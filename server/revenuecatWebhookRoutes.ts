import type { Express, Request, Response } from "express";
import type { IStorage } from "./storage";
import { logger } from "./lib/logger";
import { syncSubscriberFromRevenueCat } from "./revenuecatSync";
import { pickPayload, resolveAppUserId } from "./revenuecatWebhookPayload";

function verifyWebhookAuth(req: Request): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  if (!expected) {
    logger.error("[RevenueCat Webhook] REVENUECAT_WEBHOOK_AUTHORIZATION not set");
    return false;
  }
  const got = req.headers.authorization ?? "";
  if (got !== expected) {
    logger.warn("[RevenueCat Webhook] Invalid authorization header");
    return false;
  }
  return true;
}

export function registerRevenueCatWebhookRoutes(app: Express, storage: IStorage) {
  app.post("/api/revenuecat/webhook", async (req: Request, res: Response) => {
    if (!verifyWebhookAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { payload, nestedEvent } = pickPayload(req.body);
    const appUserId = resolveAppUserId(payload);

    if (!appUserId) {
      logger.warn("[RevenueCat Webhook] Missing app_user_id (no resolvable subscriber id)", {
        type: payload.type ?? null,
        nestedEvent,
        keys: Object.keys(payload as object).slice(0, 25),
      });
      // 200 avoids RevenueCat retry storms for benign or empty payloads after auth succeeds.
      return res.status(200).json({ received: true, skipped: "no_app_user_id" });
    }

    const eventId = typeof payload.id === "string" ? payload.id : null;
    const type = payload.type ?? "UNKNOWN";

    try {
      const result = await syncSubscriberFromRevenueCat(storage, appUserId, {
        eventId,
        reason: `webhook:${type}`,
      });
      if (!result.ok) {
        logger.error(`[RevenueCat Webhook] Sync failed for ${appUserId}: ${result.error}`);
        return res.status(500).json({ error: "Sync failed" });
      }
    } catch (err: any) {
      logger.error(`[RevenueCat Webhook] Sync error for ${appUserId}:`, err?.message || err);
      return res.status(500).json({ error: "Sync error" });
    }

    return res.status(200).json({ received: true });
  });
}
