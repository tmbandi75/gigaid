import { db } from "../db";
import { eventsCanonical, InsertEventsCanonical } from "@shared/schema";

export interface EmitEventParams {
  eventName: string;
  userId?: string;
  orgId?: string;
  context?: Record<string, any>;
  source?: "web" | "mobile" | "system";
  occurredAt?: string;
}

export async function emitCanonicalEvent(params: EmitEventParams): Promise<void> {
  const {
    eventName,
    userId,
    orgId,
    context,
    source = "system",
    occurredAt = new Date().toISOString(),
  } = params;

  try {
    const event: InsertEventsCanonical = {
      occurredAt,
      userId: userId || null,
      orgId: orgId || null,
      eventName,
      context: context ? JSON.stringify(context) : null,
      source,
      version: 1,
    };

    await db.insert(eventsCanonical).values(event);

    await fanOutToIntegrations(eventName, params);
    
    console.log(`[CanonicalEvent] ${eventName} emitted for user ${userId || "system"}`);
  } catch (error) {
    console.error(`[CanonicalEvent] Failed to emit ${eventName}:`, error);
  }
}

async function fanOutToIntegrations(eventName: string, params: EmitEventParams): Promise<void> {
  try {
    await sendToAmplitude(eventName, params);
  } catch (error) {
    console.error("[CanonicalEvent] Amplitude fan-out failed:", error);
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
    console.error("[CanonicalEvent] Customer.io fan-out failed:", error);
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
    console.error("[CanonicalEvent] OneSignal fan-out failed:", error);
  }
}

async function sendToAmplitude(eventName: string, params: EmitEventParams): Promise<void> {
  const amplitudeApiKey = process.env.AMPLITUDE_API_KEY;
  if (!amplitudeApiKey) return;

  console.log(`[Amplitude] Would send event: ${eventName}`);
}

async function sendToCustomerIO(eventName: string, params: EmitEventParams): Promise<void> {
  const customerioApiKey = process.env.CUSTOMERIO_API_KEY;
  if (!customerioApiKey) return;

  console.log(`[Customer.io] Would send lifecycle event: ${eventName}`);
}

async function sendToOneSignal(eventName: string, params: EmitEventParams): Promise<void> {
  const onesignalAppId = process.env.ONESIGNAL_APP_ID;
  if (!onesignalAppId) return;

  console.log(`[OneSignal] Would send push for: ${eventName}`);
}
