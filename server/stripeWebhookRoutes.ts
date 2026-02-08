import { Express, Request, Response, raw } from "express";
import Stripe from "stripe";
import { IStorage } from "./storage";

const WEBHOOK_EVENT_TYPES = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_intent.created",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "charge.refunded",
  "charge.refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "account.updated",
];

function getBackoffMs(attemptCount: number): number {
  if (attemptCount <= 1) return 30 * 1000;
  if (attemptCount === 2) return 2 * 60 * 1000;
  if (attemptCount === 3) return 10 * 60 * 1000;
  return 60 * 60 * 1000;
}

function isTransientError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || "";
  return (
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    (error.statusCode && error.statusCode >= 500)
  );
}

export function registerStripeWebhookRoutes(app: Express, storage: IStorage) {
  app.post(
    "/api/stripe/webhook",
    raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook secret not configured" });
      }

      if (!sig) {
        console.warn("[Stripe Webhook] Missing stripe-signature header");
        return res.status(400).json({ error: "Missing signature" });
      }

      let event: Stripe.Event;
      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      console.log(`[Stripe Webhook] Received event: ${event.id} (${event.type})`);

      const existing = await storage.getStripeWebhookEvent(event.id);
      if (existing) {
        console.log(`[Stripe Webhook] Duplicate event ${event.id}, returning 200`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      try {
        await storage.createStripeWebhookEvent({
          stripeEventId: event.id,
          type: event.type,
          apiVersion: event.api_version || null,
          livemode: event.livemode,
          account: (event as any).account || null,
          created: new Date(event.created * 1000).toISOString(),
          payload: JSON.stringify(event),
          receivedAt: new Date().toISOString(),
          status: "received",
          attemptCount: 0,
        });
        console.log(`[Stripe Webhook] Stored event ${event.id}`);
      } catch (err: any) {
        console.error("[Stripe Webhook] Failed to store event:", err.message);
        return res.status(500).json({ error: "Failed to store webhook event" });
      }

      setImmediate(() => processWebhookEvent(event.id, storage));

      return res.status(200).json({ received: true });
    }
  );
}

async function processWebhookEvent(stripeEventId: string, storage: IStorage) {
  const webhookEvent = await storage.getStripeWebhookEvent(stripeEventId);
  if (!webhookEvent) {
    console.error(`[Stripe Webhook Processor] Event not found: ${stripeEventId}`);
    return;
  }

  if (webhookEvent.status === "processed") {
    console.log(`[Stripe Webhook Processor] Event already processed: ${stripeEventId}`);
    return;
  }

  const lockKey = `${stripeEventId}:process`;
  const lockAcquired = await storage.acquireStripeIdempotencyLock(lockKey);
  if (!lockAcquired) {
    console.log(`[Stripe Webhook Processor] Lock exists for ${stripeEventId}, skipping`);
    return;
  }

  try {
    await storage.incrementStripeWebhookAttempt(stripeEventId);

    const event: Stripe.Event = JSON.parse(webhookEvent.payload);
    await handleStripeEvent(event, webhookEvent.account, storage);

    await storage.markStripeWebhookProcessed(stripeEventId);
    await storage.releaseStripeIdempotencyLock(lockKey);
    console.log(`[Stripe Webhook Processor] Successfully processed: ${stripeEventId}`);
  } catch (err: any) {
    console.error(`[Stripe Webhook Processor] Error processing ${stripeEventId}:`, err.message);

    const currentEvent = await storage.getStripeWebhookEvent(stripeEventId);
    const attemptCount = currentEvent?.attemptCount || 1;

    if (isTransientError(err) && attemptCount < 5) {
      const nextAttemptAt = new Date(Date.now() + getBackoffMs(attemptCount)).toISOString();
      await storage.markStripeWebhookFailed(stripeEventId, err.message, nextAttemptAt);
      console.log(`[Stripe Webhook Processor] Scheduled retry at ${nextAttemptAt}`);
    } else {
      await storage.markStripeWebhookFailed(stripeEventId, err.message, null);
      console.log(`[Stripe Webhook Processor] Marked as failed (non-transient or max retries)`);
    }

    await storage.releaseStripeIdempotencyLock(lockKey);
  }
}

async function handleStripeEvent(
  event: Stripe.Event,
  connectedAccountId: string | null,
  storage: IStorage
) {
  const eventType = event.type;

  switch (eventType) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
    case "payment_intent.created":
    case "payment_intent.processing":
    case "payment_intent.requires_action": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentEvent(event, paymentIntent, connectedAccountId, storage);
      break;
    }

    case "charge.refunded":
    case "charge.refund.updated": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefundEvent(event, charge, connectedAccountId, storage);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await handleAccountUpdatedEvent(event, account, storage);
      break;
    }

    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      await handleDisputeEvent(event, dispute, connectedAccountId, storage);
      break;
    }

    default:
      console.log(`[Stripe Webhook Processor] Unhandled event type: ${eventType}`);
  }
}

async function handlePaymentIntentEvent(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
  connectedAccountId: string | null,
  storage: IStorage
) {
  const statusMap: Record<string, string> = {
    requires_payment_method: "requires_payment_method",
    requires_confirmation: "requires_confirmation",
    requires_action: "requires_action",
    processing: "processing",
    requires_capture: "requires_capture",
    canceled: "canceled",
    succeeded: "succeeded",
  };

  const status = statusMap[paymentIntent.status] || paymentIntent.status;
  const metadata = paymentIntent.metadata || {};
  const jobId = metadata.job_id || metadata.jobId || null;
  const invoiceId = metadata.invoice_id || metadata.invoiceId || null;

  let chargeId: string | null = null;
  if (paymentIntent.latest_charge) {
    chargeId = typeof paymentIntent.latest_charge === "string" 
      ? paymentIntent.latest_charge 
      : paymentIntent.latest_charge.id;
  }

  await storage.upsertStripePaymentState({
    paymentIntentId: paymentIntent.id,
    chargeId,
    customerId: typeof paymentIntent.customer === "string" 
      ? paymentIntent.customer 
      : paymentIntent.customer?.id || null,
    connectedAccountId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status,
    lastEventId: event.id,
    lastEventType: event.type,
    lastUpdatedAt: new Date().toISOString(),
    metadata: JSON.stringify(metadata),
    jobId,
    invoiceId,
  });

  if (event.type === "payment_intent.succeeded") {
    // Track first_payment_received milestone from metadata
    const userId = metadata?.user_id;
    if (userId) {
      try {
        const user = await storage.getUser(userId);
        if (user && !user.firstPaymentReceivedAt) {
          await storage.updateUser(userId, {
            firstPaymentReceivedAt: new Date().toISOString(),
          });
          const timeToFirstDollarHours = user.createdAt ? Math.round((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60)) : null;
          console.log(`[Activation] first_payment_received (Stripe) for user ${userId}, time_to_first_dollar: ${timeToFirstDollarHours}h`);
        }
      } catch (err: any) {
        console.error(`[Activation] Failed to track first_payment_received:`, err.message);
      }
    }

    if (invoiceId) {
      try {
        const invoice = await storage.getInvoice(invoiceId);
        if (invoice && invoice.status !== "paid") {
          await storage.updateInvoice(invoiceId, {
            status: "paid",
            paidAt: new Date().toISOString(),
            paymentMethod: "card",
          });
          console.log(`[Stripe Webhook] Marked invoice ${invoiceId} as paid`);
        }
      } catch (err: any) {
        console.error(`[Stripe Webhook] Failed to update invoice ${invoiceId}:`, err.message);
      }
    }

    if (jobId) {
      try {
        const job = await storage.getJob(jobId);
        if (job && job.paymentStatus !== "paid") {
          await storage.updateJob(jobId, {
            paymentStatus: "paid",
            paymentMethod: "card",
          });
          console.log(`[Stripe Webhook] Marked job ${jobId} as paid`);
        }
      } catch (err: any) {
        console.error(`[Stripe Webhook] Failed to update job ${jobId}:`, err.message);
      }
    }
  }

  console.log(`[Stripe Webhook] Updated payment state for ${paymentIntent.id}: ${status}`);
}

async function handleChargeRefundEvent(
  event: Stripe.Event,
  charge: Stripe.Charge,
  connectedAccountId: string | null,
  storage: IStorage
) {
  if (!charge.payment_intent) return;

  const paymentIntentId = typeof charge.payment_intent === "string" 
    ? charge.payment_intent 
    : charge.payment_intent.id;

  const existingState = await storage.getStripePaymentStateByPI(paymentIntentId);
  if (!existingState) {
    console.log(`[Stripe Webhook] No payment state for refund event, PI: ${paymentIntentId}`);
    return;
  }

  const refundedAmount = charge.amount_refunded || 0;
  const totalAmount = charge.amount || 0;
  const isFullRefund = refundedAmount >= totalAmount;

  await storage.upsertStripePaymentState({
    ...existingState,
    status: isFullRefund ? "refunded" : "partially_refunded",
    lastEventId: event.id,
    lastEventType: event.type,
    lastUpdatedAt: new Date().toISOString(),
  });

  console.log(`[Stripe Webhook] Updated payment ${paymentIntentId} to ${isFullRefund ? "refunded" : "partially_refunded"}`);
}

async function handleAccountUpdatedEvent(
  event: Stripe.Event,
  account: Stripe.Account,
  storage: IStorage
) {
  const users = await storage.getUsersByStripeConnectAccountId(account.id);
  
  for (const user of users) {
    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;
    
    let status: string;
    if (chargesEnabled && payoutsEnabled) {
      status = "active";
    } else if (account.details_submitted) {
      status = "restricted";
    } else {
      status = "pending";
    }

    await storage.updateUser(user.id, {
      stripeConnectStatus: status,
    });
    
    console.log(`[Stripe Webhook] Updated Connect status for user ${user.id}: ${status}`);
  }
}

async function handleDisputeEvent(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  connectedAccountId: string | null,
  storage: IStorage
) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  const paymentIntentId = typeof dispute.payment_intent === "string" 
    ? dispute.payment_intent 
    : dispute.payment_intent?.id || null;

  const metadata = (dispute.metadata || {}) as Record<string, string>;
  const jobId = metadata.job_id || metadata.jobId || null;
  const invoiceId = metadata.invoice_id || metadata.invoiceId || null;
  const bookingId = metadata.booking_id || metadata.bookingId || null;

  const disputeData = {
    stripeDisputeId: dispute.id,
    chargeId: chargeId || null,
    paymentIntentId,
    connectedAccountId,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    evidenceDueBy: dispute.evidence_details?.due_by 
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString() 
      : null,
    lastEventId: event.id,
    lastEventType: event.type,
    lastUpdatedAt: new Date().toISOString(),
    metadata: JSON.stringify(metadata),
    jobId,
    invoiceId,
    bookingId,
  };

  await storage.upsertStripeDispute(disputeData);

  if (paymentIntentId) {
    const existingPaymentState = await storage.getStripePaymentStateByPI(paymentIntentId);
    if (existingPaymentState) {
      let paymentStatus = existingPaymentState.status;
      if (event.type === "charge.dispute.created") {
        paymentStatus = "disputed";
      } else if (event.type === "charge.dispute.closed") {
        if (dispute.status === "won") {
          paymentStatus = "succeeded";
        } else if (dispute.status === "lost") {
          paymentStatus = "refunded";
        }
      }

      await storage.upsertStripePaymentState({
        ...existingPaymentState,
        status: paymentStatus,
        lastEventId: event.id,
        lastEventType: event.type,
        lastUpdatedAt: new Date().toISOString(),
      });
    }
  }

  if (invoiceId && event.type === "charge.dispute.created") {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (invoice) {
        await storage.updateInvoice(invoiceId, {
          status: "disputed",
        });
        console.log(`[Stripe Webhook] Marked invoice ${invoiceId} as disputed`);
      }
    } catch (err: any) {
      console.error(`[Stripe Webhook] Failed to update invoice ${invoiceId}:`, err.message);
    }
  }

  if (jobId && event.type === "charge.dispute.created") {
    try {
      const job = await storage.getJob(jobId);
      if (job) {
        await storage.updateJob(jobId, {
          paymentStatus: "disputed",
        });
        console.log(`[Stripe Webhook] Marked job ${jobId} payment as disputed`);
      }
    } catch (err: any) {
      console.error(`[Stripe Webhook] Failed to update job ${jobId}:`, err.message);
    }
  }

  console.log(`[Stripe Webhook] ${event.type} for dispute ${dispute.id}: status=${dispute.status}, reason=${dispute.reason}`);
}

export async function processRetryableWebhooks(storage: IStorage) {
  const now = new Date().toISOString();
  const pendingEvents = await storage.getRetryableStripeWebhookEvents(now, 25);

  console.log(`[Stripe Webhook Retry] Found ${pendingEvents.length} events to retry`);

  for (const event of pendingEvents) {
    await processWebhookEvent(event.stripeEventId, storage);
  }
}

let webhookRetrySchedulerInterval: NodeJS.Timeout | null = null;

export function startWebhookRetryScheduler(storage: IStorage, intervalMs: number = 60000) {
  if (webhookRetrySchedulerInterval) {
    clearInterval(webhookRetrySchedulerInterval);
  }
  
  console.log(`[Stripe Webhook Retry] Starting scheduler with ${intervalMs / 1000}s interval`);
  
  webhookRetrySchedulerInterval = setInterval(async () => {
    try {
      await processRetryableWebhooks(storage);
      await cleanupStaleIdempotencyLocks(storage);
    } catch (err: any) {
      console.error("[Stripe Webhook Retry] Scheduler error:", err.message);
    }
  }, intervalMs);
  
  setImmediate(async () => {
    try {
      await processRetryableWebhooks(storage);
    } catch (err: any) {
      console.error("[Stripe Webhook Retry] Initial run error:", err.message);
    }
  });
}

async function cleanupStaleIdempotencyLocks(storage: IStorage) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const cleaned = await storage.cleanupStaleStripeIdempotencyLocks(oneHourAgo);
  if (cleaned > 0) {
    console.log(`[Stripe Webhook Retry] Cleaned up ${cleaned} stale idempotency locks`);
  }
}

export async function reconcileStuckPayments(storage: IStorage): Promise<{
  checked: number;
  fixed: number;
  unchanged: number;
  errors: number;
}> {
  const cutoffTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const stuckPayments = await storage.getStuckStripePayments(cutoffTime);

  const result = { checked: 0, fixed: 0, unchanged: 0, errors: 0 };

  const { getUncachableStripeClient } = await import("./stripeClient");
  const stripe = await getUncachableStripeClient();

  for (const payment of stuckPayments) {
    result.checked++;

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        payment.paymentIntentId,
        payment.connectedAccountId ? { stripeAccount: payment.connectedAccountId } : undefined
      );

      const currentStatus = payment.status;
      const latestStatus = paymentIntent.status;

      if (currentStatus !== latestStatus) {
        await storage.upsertStripePaymentState({
          ...payment,
          status: latestStatus,
          lastUpdatedAt: new Date().toISOString(),
        });

        if (latestStatus === "succeeded") {
          if (payment.invoiceId) {
            await storage.updateInvoice(payment.invoiceId, {
              status: "paid",
              paidAt: new Date().toISOString(),
              paymentMethod: "card",
            });
          }
          if (payment.jobId) {
            await storage.updateJob(payment.jobId, {
              paymentStatus: "paid",
              paymentMethod: "card",
            });
          }
        }

        result.fixed++;
        console.log(`[Stripe Reconcile] Fixed payment ${payment.paymentIntentId}: ${currentStatus} -> ${latestStatus}`);
      } else {
        result.unchanged++;
      }
    } catch (err: any) {
      result.errors++;
      console.error(`[Stripe Reconcile] Error for ${payment.paymentIntentId}:`, err.message);
    }
  }

  return result;
}
