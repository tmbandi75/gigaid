import { Router, Response } from "express";
import { db } from "../db";
import { users, eventsCanonical, adminActionAudit } from "@shared/schema";
import { eq, desc, gte, sql, count } from "drizzle-orm";
import { adminMiddleware, AdminRequest, requireRole } from "../copilot/adminMiddleware";
import { logger } from "../lib/logger";

const router = Router();

router.use(adminMiddleware);

const CUSTOMERIO_SITE_ID = process.env.CUSTOMERIO_SITE_ID;
const CUSTOMERIO_API_KEY = process.env.CUSTOMERIO_API_KEY;
const CUSTOMERIO_APP_API_KEY = process.env.CUSTOMERIO_APP_API_KEY;

function isCustomerIoConfigured(): boolean {
  return !!(CUSTOMERIO_SITE_ID && CUSTOMERIO_API_KEY);
}

async function customerioRequest(
  method: string,
  endpoint: string,
  body?: any,
  useAppApi: boolean = false
): Promise<any> {
  const baseUrl = useAppApi 
    ? "https://api.customer.io/v1" 
    : "https://track.customer.io/api/v1";
  
  const auth = useAppApi
    ? `Bearer ${CUSTOMERIO_APP_API_KEY}`
    : `Basic ${Buffer.from(`${CUSTOMERIO_SITE_ID}:${CUSTOMERIO_API_KEY}`).toString("base64")}`;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "Authorization": auth,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Customer.io API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return { success: true };
  
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return { success: true };
}

router.get("/status", async (req: AdminRequest, res: Response) => {
  try {
    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const configured = isCustomerIoConfigured();
    const hasAppApi = !!CUSTOMERIO_APP_API_KEY;

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_view_status",
      reason: "Admin viewed Customer.io status",
      payload: null,
      source: "admin_ui",
    });

    if (!configured) {
      return res.json({
        configured: false,
        message: "Customer.io credentials not configured. Set CUSTOMERIO_SITE_ID and CUSTOMERIO_API_KEY.",
        features: {
          trackEvents: false,
          identifyUsers: false,
          campaigns: hasAppApi,
          segments: hasAppApi,
        }
      });
    }

    res.json({
      configured: true,
      features: {
        trackEvents: true,
        identifyUsers: true,
        campaigns: hasAppApi,
        segments: hasAppApi,
      }
    });
  } catch (error) {
    logger.error("[Customer.io] Status check error:", error);
    res.status(500).json({ error: "Failed to check Customer.io status" });
  }
});

router.post("/sync-user/:userId", async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!isCustomerIoConfigured()) {
      return res.status(400).json({ error: "Customer.io not configured" });
    }

    const [targetUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const customerData = {
      email: targetUser.email,
      created_at: Math.floor(new Date(targetUser.createdAt || Date.now()).getTime() / 1000),
      name: targetUser.name || targetUser.username,
      phone: targetUser.phone,
      plan: targetUser.plan || "free",
      is_pro: targetUser.isPro || false,
      onboarding_completed: targetUser.onboardingCompleted || false,
      onboarding_step: targetUser.onboardingStep || 0,
      stripe_customer_id: targetUser.stripeCustomerId,
    };

    await customerioRequest("PUT", `/customers/${userId}`, customerData);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "customerio_sync_user",
      reason: "Admin synced user to Customer.io",
      payload: JSON.stringify({ attributes: Object.keys(customerData) }),
      source: "admin_ui",
    });

    res.json({ success: true, message: "User synced to Customer.io" });
  } catch (error: any) {
    logger.error("[Customer.io] Sync user error:", error);
    res.status(500).json({ error: error.message || "Failed to sync user" });
  }
});

router.post("/track-event/:userId", async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { eventName, data } = req.body;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!isCustomerIoConfigured()) {
      return res.status(400).json({ error: "Customer.io not configured" });
    }

    if (!eventName) {
      return res.status(400).json({ error: "Event name is required" });
    }

    const eventPayload = {
      name: eventName,
      data: data || {},
    };

    await customerioRequest("POST", `/customers/${userId}/events`, eventPayload);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "customerio_track_event",
      reason: `Admin triggered event: ${eventName}`,
      payload: JSON.stringify({ eventName, data }),
      source: "admin_ui",
    });

    res.json({ success: true, message: `Event '${eventName}' sent to Customer.io` });
  } catch (error: any) {
    logger.error("[Customer.io] Track event error:", error);
    res.status(500).json({ error: error.message || "Failed to track event" });
  }
});

router.post("/backfill/:userId", async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { since, eventTypes } = req.body;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!isCustomerIoConfigured()) {
      return res.status(400).json({ error: "Customer.io not configured" });
    }

    const sinceDate = since 
      ? new Date(since).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let query = db.select()
      .from(eventsCanonical)
      .where(eq(eventsCanonical.userId, userId));

    const events = await query
      .orderBy(desc(eventsCanonical.occurredAt))
      .limit(500);

    const filteredEvents = events.filter(e => {
      if (eventTypes && eventTypes.length > 0) {
        return eventTypes.includes(e.eventName);
      }
      return new Date(e.occurredAt || 0) >= new Date(sinceDate);
    });

    let synced = 0;
    let failed = 0;

    for (const event of filteredEvents) {
      try {
        await customerioRequest("POST", `/customers/${userId}/events`, {
          name: event.eventName,
          timestamp: Math.floor(new Date(event.occurredAt || Date.now()).getTime() / 1000),
          data: event.context ? JSON.parse(event.context) : {},
        });
        synced++;
      } catch (err) {
        logger.error(`[Customer.io] Failed to backfill event ${event.id}:`, err);
        failed++;
      }
    }

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "customerio_backfill",
      reason: "Admin backfilled events to Customer.io",
      payload: JSON.stringify({ synced, failed, since: sinceDate, eventTypes }),
      source: "admin_ui",
    });

    res.json({ 
      success: true, 
      synced, 
      failed, 
      message: `Backfilled ${synced} events (${failed} failed)` 
    });
  } catch (error: any) {
    logger.error("[Customer.io] Backfill error:", error);
    res.status(500).json({ error: error.message || "Failed to backfill events" });
  }
});

router.post("/suppress/:userId", async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!isCustomerIoConfigured()) {
      return res.status(400).json({ error: "Customer.io not configured" });
    }

    await customerioRequest("POST", `/customers/${userId}/suppress`);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "customerio_suppress",
      reason: "Admin suppressed user in Customer.io",
      payload: null,
      source: "admin_ui",
    });

    res.json({ success: true, message: "User suppressed in Customer.io" });
  } catch (error: any) {
    logger.error("[Customer.io] Suppress error:", error);
    res.status(500).json({ error: error.message || "Failed to suppress user" });
  }
});

router.post("/unsuppress/:userId", async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!isCustomerIoConfigured()) {
      return res.status(400).json({ error: "Customer.io not configured" });
    }

    await customerioRequest("POST", `/customers/${userId}/unsuppress`);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "customerio_unsuppress",
      reason: "Admin unsuppressed user in Customer.io",
      payload: null,
      source: "admin_ui",
    });

    res.json({ success: true, message: "User unsuppressed in Customer.io" });
  } catch (error: any) {
    logger.error("[Customer.io] Unsuppress error:", error);
    res.status(500).json({ error: error.message || "Failed to unsuppress user" });
  }
});

router.get("/campaigns", requireRole("super_admin", "admin"), async (req: AdminRequest, res: Response) => {
  try {
    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!CUSTOMERIO_APP_API_KEY) {
      return res.status(400).json({ error: "Customer.io App API key not configured" });
    }

    const campaigns = await customerioRequest("GET", "/campaigns", undefined, true);
    
    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_view_campaigns",
      reason: "Admin viewed Customer.io campaigns",
      payload: null,
      source: "admin_ui",
    });

    res.json({ campaigns: campaigns.campaigns || [] });
  } catch (error: any) {
    logger.error("[Customer.io] List campaigns error:", error);
    res.status(500).json({ error: error.message || "Failed to list campaigns" });
  }
});

router.get("/campaigns/:campaignId", requireRole("super_admin", "admin"), async (req: AdminRequest, res: Response) => {
  try {
    const { campaignId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!CUSTOMERIO_APP_API_KEY) {
      return res.status(400).json({ error: "Customer.io App API key not configured" });
    }

    const campaign = await customerioRequest("GET", `/campaigns/${campaignId}`, undefined, true);
    
    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_view_campaign",
      reason: `Admin viewed campaign ${campaignId}`,
      payload: JSON.stringify({ campaignId }),
      source: "admin_ui",
    });

    res.json({ campaign });
  } catch (error: any) {
    logger.error("[Customer.io] Get campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign" });
  }
});

router.post("/campaigns/:campaignId/pause", requireRole("super_admin"), async (req: AdminRequest, res: Response) => {
  try {
    const { campaignId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!CUSTOMERIO_APP_API_KEY) {
      return res.status(400).json({ error: "Customer.io App API key not configured" });
    }

    await customerioRequest("POST", `/campaigns/${campaignId}/actions`, { action: "pause" }, true);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_pause_campaign",
      reason: `Admin paused campaign ${campaignId}`,
      payload: JSON.stringify({ campaignId }),
      source: "admin_ui",
    });

    res.json({ success: true, message: `Campaign ${campaignId} paused` });
  } catch (error: any) {
    logger.error("[Customer.io] Pause campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to pause campaign" });
  }
});

router.post("/campaigns/:campaignId/resume", requireRole("super_admin"), async (req: AdminRequest, res: Response) => {
  try {
    const { campaignId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!CUSTOMERIO_APP_API_KEY) {
      return res.status(400).json({ error: "Customer.io App API key not configured" });
    }

    await customerioRequest("POST", `/campaigns/${campaignId}/actions`, { action: "start" }, true);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_resume_campaign",
      reason: `Admin resumed campaign ${campaignId}`,
      payload: JSON.stringify({ campaignId }),
      source: "admin_ui",
    });

    res.json({ success: true, message: `Campaign ${campaignId} resumed` });
  } catch (error: any) {
    logger.error("[Customer.io] Resume campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to resume campaign" });
  }
});

router.post("/campaigns/:campaignId/trigger", requireRole("super_admin"), async (req: AdminRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { userId, data } = req.body;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!CUSTOMERIO_APP_API_KEY) {
      return res.status(400).json({ error: "Customer.io App API key not configured" });
    }

    const triggerPayload: any = {};
    if (userId) {
      triggerPayload.ids = [userId];
    }
    if (data) {
      triggerPayload.data = data;
    }

    await customerioRequest("POST", `/campaigns/${campaignId}/triggers`, triggerPayload, true);

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId || null,
      actionKey: "customerio_trigger_campaign",
      reason: `Admin triggered campaign ${campaignId}`,
      payload: JSON.stringify({ campaignId, userId, data }),
      source: "admin_ui",
    });

    res.json({ success: true, message: `Campaign ${campaignId} triggered` });
  } catch (error: any) {
    logger.error("[Customer.io] Trigger campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to trigger campaign" });
  }
});

router.get("/campaigns/:campaignId/metrics", requireRole("super_admin", "admin"), async (req: AdminRequest, res: Response) => {
  try {
    const { campaignId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!CUSTOMERIO_APP_API_KEY) {
      return res.status(400).json({ error: "Customer.io App API key not configured" });
    }

    const metrics = await customerioRequest("GET", `/campaigns/${campaignId}/metrics`, undefined, true);
    
    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_view_metrics",
      reason: `Admin viewed campaign ${campaignId} metrics`,
      payload: JSON.stringify({ campaignId }),
      source: "admin_ui",
    });

    res.json({ metrics });
  } catch (error: any) {
    logger.error("[Customer.io] Campaign metrics error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign metrics" });
  }
});

router.get("/user/:userId/preview", async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { campaignId } = req.query;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const [targetUser] = await db.select({
      id: users.id,
      email: users.email,
      plan: users.plan,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      isPro: users.isPro,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    let customerioStatus: any = null;
    if (CUSTOMERIO_APP_API_KEY) {
      try {
        customerioStatus = await customerioRequest("GET", `/customers/${userId}/attributes`, undefined, true);
      } catch (err) {
        customerioStatus = { error: "User not found in Customer.io or API error" };
      }
    }

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "customerio_preview_user",
      reason: "Admin previewed user for Customer.io eligibility",
      payload: JSON.stringify({ campaignId: campaignId || null }),
      source: "admin_ui",
    });

    res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        plan: targetUser.plan,
        isPro: targetUser.isPro,
        onboardingCompleted: targetUser.onboardingCompleted,
        createdAt: targetUser.createdAt,
      },
      customerioStatus,
      campaignId: campaignId || null,
      configured: !!CUSTOMERIO_APP_API_KEY,
    });
  } catch (error: any) {
    logger.error("[Customer.io] User preview error:", error);
    res.status(500).json({ error: error.message || "Failed to preview user" });
  }
});

router.get("/delivery-metrics", requireRole("super_admin", "admin"), async (req: AdminRequest, res: Response) => {
  try {
    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deliveryLogs = await db.select({
      actionKey: adminActionAudit.actionKey,
      count: count(),
    })
      .from(adminActionAudit)
      .where(gte(adminActionAudit.createdAt, startDate.toISOString()))
      .groupBy(adminActionAudit.actionKey);

    const customerioActions = deliveryLogs.filter(l => 
      l.actionKey?.startsWith("customerio_")
    );

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: null,
      actionKey: "customerio_view_delivery_metrics",
      reason: `Admin viewed delivery metrics for ${days} days`,
      payload: JSON.stringify({ days }),
      source: "admin_ui",
    });

    res.json({
      period: `${days} days`,
      actions: customerioActions,
    });
  } catch (error) {
    logger.error("[Customer.io] Delivery metrics error:", error);
    res.status(500).json({ error: "Failed to fetch delivery metrics" });
  }
});

export default router;
