import { db } from "../db";
import { eventsCanonical, InsertEventsCanonical } from "@shared/schema";
import { logger } from "../lib/logger";

export interface EmitEventParams {
  eventName: string;
  userId?: string;
  orgId?: string;
  context?: Record<string, any>;
  source?: "web" | "mobile" | "system";
  occurredAt?: string;
}

export interface EmitEventOptions {
  /**
   * When true, a failed insert into `events_canonical` is re-thrown to the
   * caller instead of being swallowed. Use this for tracking endpoints
   * that should fail loudly (return 5xx) so the client can retry rather
   * than silently dropping the event. The integration fan-out is still
   * best-effort and never throws regardless of this flag.
   */
  throwOnInsertFailure?: boolean;
}

export async function emitCanonicalEvent(
  params: EmitEventParams,
  options: EmitEventOptions = {},
): Promise<void> {
  const {
    eventName,
    userId,
    orgId,
    context,
    source = "system",
    occurredAt = new Date().toISOString(),
  } = params;

  const event: InsertEventsCanonical = {
    occurredAt,
    userId: userId || null,
    orgId: orgId || null,
    eventName,
    context: context ? JSON.stringify(context) : null,
    source,
    version: 1,
  };

  try {
    await db.insert(eventsCanonical).values(event);
    logger.info(`[CanonicalEvent] ${eventName} emitted for user ${userId || "system"}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      `[CanonicalEvent] DB insert failed for ${eventName}`,
      {
        eventName,
        userId: userId || null,
        orgId: orgId || null,
        source,
        error: errMsg,
      },
    );
    if (options.throwOnInsertFailure) {
      throw error;
    }
    return;
  }

  // Fan-out to third-party integrations (Amplitude / Customer.io / OneSignal)
  // is intentionally NOT awaited. The canonical event row is the source of
  // truth and is already durably written; the integrations are best-effort
  // mirrors. Detaching them here keeps caller latency tied only to the
  // local DB insert — important for hot paths like the
  // /api/track/booking-link-* handlers that block the user's share UI.
  void fanOutToIntegrations(eventName, params).catch((error) => {
    logger.error(`[CanonicalEvent] Detached fan-out failed for ${eventName}:`, error);
  });
}

async function fanOutToIntegrations(eventName: string, params: EmitEventParams): Promise<void> {
  try {
    await sendToAmplitude(eventName, params);
  } catch (error) {
    logger.error("[CanonicalEvent] Amplitude fan-out failed:", error);
  }

  try {
    const lifecycleEvents = [
      "onboarding_stalled",
      "no_estimate_24h", 
      "inactive_7_days",
      "first_booking_completed",
      "churn_risk_detected",
    ];
    if (lifecycleEvents.includes(eventName)) {
      await sendToCustomerIO(eventName, params);
    }
  } catch (error) {
    logger.error("[CanonicalEvent] Customer.io fan-out failed:", error);
  }

  try {
    const immediateEvents = [
      "lead_received",
      "photos_uploaded",
      "job_starts_soon",
      "payment_succeeded",
      "booking_canceled",
    ];
    if (immediateEvents.includes(eventName)) {
      await sendToOneSignal(eventName, params);
    }
  } catch (error) {
    logger.error("[CanonicalEvent] OneSignal fan-out failed:", error);
  }
}

async function sendToAmplitude(eventName: string, params: EmitEventParams): Promise<void> {
  const amplitudeApiKey = process.env.AMPLITUDE_API_KEY;
  if (!amplitudeApiKey) return;

  logger.info(`[Amplitude] Would send event: ${eventName}`);
}

async function sendToCustomerIO(eventName: string, params: EmitEventParams): Promise<void> {
  const customerioApiKey = process.env.CUSTOMERIO_API_KEY;
  if (!customerioApiKey) return;

  logger.info(`[Customer.io] Would send lifecycle event: ${eventName}`);
}

async function sendToOneSignal(eventName: string, params: EmitEventParams): Promise<void> {
  const onesignalAppId = process.env.ONESIGNAL_APP_ID;
  if (!onesignalAppId) return;

  logger.info(`[OneSignal] Would send push for: ${eventName}`);
}
