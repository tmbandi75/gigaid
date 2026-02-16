import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { processRetryableWebhooks, reconcileStuckPayments } from "../stripeWebhookRoutes";
import { adminMiddleware, requireRole, type AdminRequest } from "../copilot/adminMiddleware";
import type { StripeWebhookEvent, StripePaymentState, StripeDispute } from "@shared/schema";
import Stripe from "stripe";
import { logger } from "../lib/logger";

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
    logger.error("[StripeAdmin] Get webhooks error:", error);
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
    logger.error("[StripeAdmin] Get webhook event error:", error);
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
    logger.error("[StripeAdmin] Retry webhook error:", error);
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
    logger.error("[StripeAdmin] Get payments error:", error);
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
    logger.error("[StripeAdmin] Get payment error:", error);
    res.status(500).json({ error: "Failed to fetch payment state" });
  }
});

router.post("/reconcile", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const result = await reconcileStuckPayments(storage);
    res.json({ success: true, result });
  } catch (error) {
    logger.error("[StripeAdmin] Reconcile error:", error);
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
      activeDisputes,
    ] = await Promise.all([
      storage.getStripeWebhookEvents({ status: "received", limit: 1000 }),
      storage.getStripeWebhookEvents({ status: "failed", limit: 1000 }),
      storage.getStripeWebhookEvents({ status: "processed", limit: 1000 }),
      storage.getStripePaymentStates({ status: "processing", limit: 1000 }),
      storage.getStripePaymentStates({ status: "succeeded", limit: 1000 }),
      storage.getActiveStripeDisputes(),
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
      disputes: {
        active: activeDisputes.length,
        needsResponse: activeDisputes.filter((d: StripeDispute) => d.status === "needs_response").length,
        underReview: activeDisputes.filter((d: StripeDispute) => d.status === "under_review").length,
      },
    });
  } catch (error) {
    logger.error("[StripeAdmin] Get stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/disputes", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    
    const disputes = await storage.getStripeDisputes({
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
    
    res.json({ disputes, total: disputes.length });
  } catch (error) {
    logger.error("[StripeAdmin] Get disputes error:", error);
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

router.get("/disputes/active", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const disputes = await storage.getActiveStripeDisputes();
    res.json({ disputes, total: disputes.length });
  } catch (error) {
    logger.error("[StripeAdmin] Get active disputes error:", error);
    res.status(500).json({ error: "Failed to fetch active disputes" });
  }
});

router.get("/disputes/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const dispute = await storage.getStripeDispute(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }
    res.json(dispute);
  } catch (error) {
    logger.error("[StripeAdmin] Get dispute error:", error);
    res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

router.post("/disputes/:id/evidence", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const dispute = await storage.getStripeDispute(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const { evidence } = req.body;
    if (!evidence) {
      return res.status(400).json({ error: "Evidence data required" });
    }

    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const updatedDispute = await stripe.disputes.update(
      dispute.stripeDisputeId,
      { evidence },
      dispute.connectedAccountId ? { stripeAccount: dispute.connectedAccountId } : undefined
    );

    await storage.upsertStripeDispute({
      ...dispute,
      status: updatedDispute.status,
      evidenceSubmittedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });

    res.json({ success: true, dispute: updatedDispute });
  } catch (error: any) {
    logger.error("[StripeAdmin] Submit evidence error:", error);
    res.status(500).json({ error: error.message || "Failed to submit evidence" });
  }
});

router.post("/disputes/:id/close", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const dispute = await storage.getStripeDispute(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const closedDispute = await stripe.disputes.close(
      dispute.stripeDisputeId,
      dispute.connectedAccountId ? { stripeAccount: dispute.connectedAccountId } : undefined
    );

    await storage.upsertStripeDispute({
      ...dispute,
      status: closedDispute.status,
      resolvedAt: new Date().toISOString(),
      resolution: "withdrawn",
      lastUpdatedAt: new Date().toISOString(),
    });

    res.json({ success: true, dispute: closedDispute });
  } catch (error: any) {
    logger.error("[StripeAdmin] Close dispute error:", error);
    res.status(500).json({ error: error.message || "Failed to close dispute" });
  }
});

router.post("/invoices/:id/refund", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.status !== "paid") {
      return res.status(400).json({ error: "Can only refund paid invoices" });
    }

    const paymentState = await storage.searchStripePayments(invoice.id);
    const paidPayment = paymentState.find(p => p.status === "succeeded" && p.invoiceId === invoice.id);
    
    if (!paidPayment) {
      return res.status(400).json({ error: "No successful payment found for this invoice" });
    }

    const { amount: refundAmountCents, reason = "requested_by_customer" } = req.body;
    const amountToRefund = refundAmountCents || paidPayment.amount;

    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const refund = await stripe.refunds.create({
      payment_intent: paidPayment.paymentIntentId,
      amount: amountToRefund,
      reason: reason as Stripe.RefundCreateParams.Reason,
    }, paidPayment.connectedAccountId ? { stripeAccount: paidPayment.connectedAccountId } : undefined);

    const isFullRefund = amountToRefund >= paidPayment.amount;
    await storage.updateInvoice(invoice.id, {
      status: isFullRefund ? "refunded" : "partially_refunded",
    });

    await storage.upsertStripePaymentState({
      ...paidPayment,
      status: isFullRefund ? "refunded" : "partially_refunded",
      lastUpdatedAt: new Date().toISOString(),
    });

    res.json({ success: true, refund });
  } catch (error: any) {
    logger.error("[StripeAdmin] Refund invoice error:", error);
    res.status(500).json({ error: error.message || "Failed to process refund" });
  }
});

router.post("/jobs/:id/refund", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.paymentStatus !== "paid") {
      return res.status(400).json({ error: "Can only refund paid jobs" });
    }

    const paymentState = await storage.searchStripePayments(job.id);
    const paidPayment = paymentState.find(p => p.status === "succeeded" && p.jobId === job.id);
    
    if (!paidPayment) {
      return res.status(400).json({ error: "No successful payment found for this job" });
    }

    const { amount: refundAmountCents, reason = "requested_by_customer" } = req.body;
    const amountToRefund = refundAmountCents || paidPayment.amount;

    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const refund = await stripe.refunds.create({
      payment_intent: paidPayment.paymentIntentId,
      amount: amountToRefund,
      reason: reason as Stripe.RefundCreateParams.Reason,
    }, paidPayment.connectedAccountId ? { stripeAccount: paidPayment.connectedAccountId } : undefined);

    const isFullRefund = amountToRefund >= paidPayment.amount;
    await storage.updateJob(job.id, {
      paymentStatus: isFullRefund ? "refunded" : "partial_refund",
    });

    await storage.upsertStripePaymentState({
      ...paidPayment,
      status: isFullRefund ? "refunded" : "partially_refunded",
      lastUpdatedAt: new Date().toISOString(),
    });

    res.json({ success: true, refund });
  } catch (error: any) {
    logger.error("[StripeAdmin] Refund job error:", error);
    res.status(500).json({ error: error.message || "Failed to process refund" });
  }
});

export default router;
