import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { processRetryableWebhooks, reconcileStuckPayments } from "../stripeWebhookRoutes";
import { adminMiddleware, requireRole, type AdminRequest } from "../copilot/adminMiddleware";
import type { StripeWebhookEvent, StripePaymentState } from "@shared/schema";

const router = Router();

router.get("/webhooks", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    
    const events = await storage.getStripeWebhookEvents({
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
    
    res.json({ events, total: events.length });
  } catch (error) {
    console.error("[StripeAdmin] Get webhooks error:", error);
    res.status(500).json({ error: "Failed to fetch webhook events" });
  }
});

router.get("/webhooks/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const event = await storage.getStripeWebhookEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Webhook event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("[StripeAdmin] Get webhook event error:", error);
    res.status(500).json({ error: "Failed to fetch webhook event" });
  }
});

router.post("/webhooks/:id/retry", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const event = await storage.getStripeWebhookEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Webhook event not found" });
    }
    
    if (event.status === "processed") {
      return res.status(400).json({ error: "Event already processed successfully" });
    }
    
    await storage.updateStripeWebhookEvent(event.stripeEventId, {
      status: "received",
      attemptCount: 0,
      nextAttemptAt: null,
    });
    
    await processRetryableWebhooks(storage);
    
    const updatedEvent = await storage.getStripeWebhookEvent(req.params.id);
    res.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error("[StripeAdmin] Retry webhook error:", error);
    res.status(500).json({ error: "Failed to retry webhook event" });
  }
});

router.get("/payments", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    
    const payments = await storage.getStripePaymentStates({
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
    
    res.json({ payments, total: payments.length });
  } catch (error) {
    console.error("[StripeAdmin] Get payments error:", error);
    res.status(500).json({ error: "Failed to fetch payment states" });
  }
});

router.get("/payments/:paymentIntentId", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const payment = await storage.getStripePaymentStateByPI(req.params.paymentIntentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment state not found" });
    }
    res.json(payment);
  } catch (error) {
    console.error("[StripeAdmin] Get payment error:", error);
    res.status(500).json({ error: "Failed to fetch payment state" });
  }
});

router.post("/reconcile", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const result = await reconcileStuckPayments(storage);
    res.json({ success: true, result });
  } catch (error) {
    console.error("[StripeAdmin] Reconcile error:", error);
    res.status(500).json({ error: "Failed to run reconciliation" });
  }
});

router.get("/stats", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      receivedWebhooks,
      failedWebhooks,
      processedWebhooks24h,
      processingPayments,
      succeededPayments24h,
    ] = await Promise.all([
      storage.getStripeWebhookEvents({ status: "received", limit: 1000 }),
      storage.getStripeWebhookEvents({ status: "failed", limit: 1000 }),
      storage.getStripeWebhookEvents({ status: "processed", limit: 1000 }),
      storage.getStripePaymentStates({ status: "processing", limit: 1000 }),
      storage.getStripePaymentStates({ status: "succeeded", limit: 1000 }),
    ]);
    
    res.json({
      webhooks: {
        received: receivedWebhooks.length,
        failed: failedWebhooks.length,
        processed24h: processedWebhooks24h.filter(
          (e: StripeWebhookEvent) => new Date(e.receivedAt) >= twentyFourHoursAgo
        ).length,
      },
      payments: {
        processing: processingPayments.length,
        succeeded24h: succeededPayments24h.filter(
          (p: StripePaymentState) => new Date(p.lastUpdatedAt) >= twentyFourHoursAgo
        ).length,
      },
    });
  } catch (error) {
    console.error("[StripeAdmin] Get stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
