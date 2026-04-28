// SendGrid event-webhook handler. Records open / click / delivery / bounce
// events for outbound emails so we can compute open rate, click rate, and
// downstream first-booking conversion per touch (Task #81).
//
// Today only first-booking emails carry the customArgs needed for attribution
// (see `server/postJobMomentum.ts`), so events for other emails are silently
// dropped — they have no `outbound_message_id` to attribute against.
//
// Setup: configure SendGrid's "Event Webhook" to POST to
//   https://<host>/api/webhooks/sendgrid/events
// with all event types enabled (delivered, open, click, bounce, dropped,
// spamreport, unsubscribe, deferred). Optional signature verification: set
// SENDGRID_WEBHOOK_VERIFICATION_KEY to the public verification key from the
// SendGrid Mail Settings → Event Webhook page; payloads without a valid
// signature are then rejected.

import { Router, Request, Response } from "express";
import express from "express";
import crypto from "crypto";
import { db } from "./db";
import { outboundMessageEvents, outboundMessages, outboundMessageEventTypes } from "@shared/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { logger } from "./lib/logger";

const router = Router();

const TRACKED_EVENT_TYPES = new Set<string>(outboundMessageEventTypes as readonly string[]);

interface SendGridEvent {
  email?: string;
  timestamp?: number;
  event?: string;
  url?: string;
  useragent?: string;
  ip?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  outbound_message_id?: string;
  message_type?: string;
  user_id?: string;
  [key: string]: unknown;
}

// Verify SendGrid's ECDSA signature when a verification key is configured.
// The signed payload is `timestamp + raw_request_body` (concatenated, not
// JSON-encoded). Returns true if no key is configured (verification disabled).
function verifySendGridSignature(
  rawBody: Buffer,
  signature: string | undefined,
  timestamp: string | undefined,
): boolean {
  const publicKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (!publicKey) return true;
  if (!signature || !timestamp) return false;
  try {
    const verifier = crypto.createVerify("sha256");
    verifier.update(timestamp);
    verifier.update(rawBody);
    verifier.end();
    // SendGrid signatures are base64-encoded ECDSA. The public key arrives
    // as a base64 SPKI string; reconstitute it as a PEM.
    const pem = `-----BEGIN PUBLIC KEY-----\n${publicKey
      .replace(/-----BEGIN PUBLIC KEY-----/g, "")
      .replace(/-----END PUBLIC KEY-----/g, "")
      .trim()
      .match(/.{1,64}/g)
      ?.join("\n")}\n-----END PUBLIC KEY-----\n`;
    return verifier.verify(pem, signature, "base64");
  } catch (err) {
    logger.error("[SendGridWebhook] Signature verification threw:", err);
    return false;
  }
}

export function registerSendGridWebhookRoutes(app: { use: Function; post: Function }): void {
  // SendGrid posts raw JSON. The global `express.json` middleware in
  // `server/index.ts` runs first and stores the original bytes on
  // `req.rawBody` via its `verify` callback, so we can verify the signature
  // against the exact bytes SendGrid signed. We still register a route-level
  // `express.raw` parser as a safety net in case this handler is mounted in
  // an environment without the global verify hook (e.g. unit tests).
  app.post(
    "/api/webhooks/sendgrid/events",
    express.raw({ type: "application/json", limit: "2mb" }),
    handleSendGridEvents,
  );
}

export async function handleSendGridEvents(req: Request, res: Response): Promise<void> {
  try {
    // Prefer the buffer captured by the global express.json `verify` callback
    // (server/index.ts), which holds the exact bytes SendGrid signed. Fall
    // back to req.body if it is already a Buffer (route-level raw parser),
    // and finally to a JSON.stringify reconstruction (only used in tests
    // that post a parsed body — signature verification is disabled there).
    let rawBody: Buffer;
    const captured = (req as unknown as { rawBody?: unknown }).rawBody;
    if (Buffer.isBuffer(captured)) {
      rawBody = captured;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === "string") {
      rawBody = Buffer.from(req.body);
    } else {
      rawBody = Buffer.from(JSON.stringify(req.body ?? []));
    }

    const signature = req.header("X-Twilio-Email-Event-Webhook-Signature") ?? undefined;
    const timestamp = req.header("X-Twilio-Email-Event-Webhook-Timestamp") ?? undefined;
    if (!verifySendGridSignature(rawBody, signature, timestamp)) {
      logger.warn("[SendGridWebhook] Invalid signature, rejecting payload");
      res.status(401).json({ error: "invalid_signature" });
      return;
    }

    let events: SendGridEvent[];
    try {
      const parsed = JSON.parse(rawBody.toString("utf8"));
      events = Array.isArray(parsed) ? parsed : [];
    } catch {
      res.status(400).json({ error: "invalid_json" });
      return;
    }

    if (events.length === 0) {
      res.status(200).json({ ok: true, processed: 0 });
      return;
    }

    // Build a fallback lookup table for events that arrived without
    // customArgs but do have a `sg_message_id` we previously persisted.
    const fallbackSgMessageIds = events
      .filter((ev) => !ev.outbound_message_id && typeof ev.sg_message_id === "string")
      .map((ev) => ev.sg_message_id as string);

    let messageIdLookup = new Map<string, { id: string; type: string }>();
    if (fallbackSgMessageIds.length > 0) {
      // SendGrid sometimes appends `.<recipient_index>` to sg_message_id on
      // per-event payloads. Strip the suffix before lookup.
      const baseIds = Array.from(
        new Set(fallbackSgMessageIds.map((id) => id.split(".")[0])),
      );
      const rows = await db
        .select({
          id: outboundMessages.id,
          type: outboundMessages.type,
          providerMessageId: outboundMessages.providerMessageId,
        })
        .from(outboundMessages)
        .where(inArray(outboundMessages.providerMessageId, baseIds));
      for (const row of rows) {
        if (row.providerMessageId) {
          messageIdLookup.set(row.providerMessageId, { id: row.id, type: row.type });
        }
      }
    }

    let inserted = 0;
    let skipped = 0;
    for (const ev of events) {
      const eventType = typeof ev.event === "string" ? ev.event : "";
      if (!TRACKED_EVENT_TYPES.has(eventType)) {
        skipped++;
        continue;
      }

      let outboundMessageId: string | null = null;
      let messageType: string | null = null;
      if (typeof ev.outbound_message_id === "string" && ev.outbound_message_id) {
        outboundMessageId = ev.outbound_message_id;
        messageType = typeof ev.message_type === "string" ? ev.message_type : null;
      } else if (typeof ev.sg_message_id === "string") {
        const baseId = ev.sg_message_id.split(".")[0];
        const hit = messageIdLookup.get(baseId);
        if (hit) {
          outboundMessageId = hit.id;
          messageType = hit.type;
        }
      }

      if (!outboundMessageId) {
        skipped++;
        continue;
      }

      // Backfill messageType from the parent row if customArgs didn't carry it.
      if (!messageType) {
        try {
          const [row] = await db
            .select({ type: outboundMessages.type })
            .from(outboundMessages)
            .where(eq(outboundMessages.id, outboundMessageId))
            .limit(1);
          messageType = row?.type ?? null;
        } catch {
          // ignore — we'll skip below if still null
        }
      }
      if (!messageType) {
        skipped++;
        continue;
      }

      const occurredAt = typeof ev.timestamp === "number"
        ? new Date(ev.timestamp * 1000).toISOString()
        : new Date().toISOString();

      try {
        const result = await db
          .insert(outboundMessageEvents)
          .values({
            outboundMessageId,
            messageType,
            eventType,
            occurredAt,
            url: typeof ev.url === "string" ? ev.url : null,
            userAgent: typeof ev.useragent === "string" ? ev.useragent : null,
            ip: typeof ev.ip === "string" ? ev.ip : null,
            sgEventId: typeof ev.sg_event_id === "string" ? ev.sg_event_id : null,
            sgMessageId: typeof ev.sg_message_id === "string" ? ev.sg_message_id : null,
            rawPayload: JSON.stringify(ev),
          })
          .onConflictDoNothing({ target: outboundMessageEvents.sgEventId })
          .returning({ id: outboundMessageEvents.id });
        if (result.length > 0) inserted++;
        else skipped++;
      } catch (err) {
        logger.error(
          `[SendGridWebhook] Failed to insert event for outbound_message_id=${outboundMessageId}:`,
          err,
        );
        skipped++;
      }
    }

    res.status(200).json({ ok: true, processed: inserted, skipped });
  } catch (error) {
    logger.error("[SendGridWebhook] Unhandled error processing events:", error);
    // Always 200 in production so SendGrid doesn't retry-storm on a logic bug.
    // The error has been logged for investigation.
    res.status(200).json({ ok: false });
  }
}

export default router;
