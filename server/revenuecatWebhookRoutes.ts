import type { Express, Request, Response } from "express";
import type { IStorage } from "./storage";
import { logger } from "./lib/logger";
import { syncSubscriberFromRevenueCat } from "./revenuecatSync";

type RcWebhookBody = {
  type?: string;
  id?: string;
  app_user_id?: string;
  transferred_to?: string[];
};

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

function resolveAppUserId(body: RcWebhookBody): string | null {
  if (body.app_user_id && typeof body.app_user_id === "string") {
    return body.app_user_id;
  }
  if (Array.isArray(body.transferred_to) && body.transferred_to[0]) {
    return body.transferred_to[0]!;
  }
  return null;
}

export function registerRevenueCatWebhookRoutes(app: Express, storage: IStorage) {
  app.post("/api/revenuecat/webhook", async (req: Request, res: Response) => {
    if (!verifyWebhookAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as RcWebhookBody;
    const appUserId = resolveAppUserId(body);

    if (!appUserId) {
      logger.warn("[RevenueCat Webhook] Missing app_user_id", { type: body.type });
      return res.status(400).json({ error: "Missing app_user_id" });
    }

    const eventId = typeof body.id === "string" ? body.id : null;
    const type = body.type ?? "UNKNOWN";

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
