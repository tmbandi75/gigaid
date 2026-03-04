import { db } from "../db";
import { retentionPlaybooks, retentionActions, planOverrides, users } from "@shared/schema";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { emitCanonicalEvent } from "../copilot/canonicalEvents";
import { sendEmail } from "../sendgrid";
import { sendSMS } from "../twilio";
import { logger } from "../lib/logger";

export const RETENTION_TEMPLATES: Record<string, { subject: string; body: string }> = {
  payday_flow_nudge: {
    subject: "Get booked this week",
    body: "Want more bookings this week? Start the Get Paid Today flow to fill your schedule.",
  },
  pro_trial_7day: {
    subject: "Try Pro free for 7 days",
    body: "We noticed you haven't been as active lately. Here's a free 7-day Pro trial to help you get more bookings.",
  },
  pro_trial_7day_email: {
    subject: "Your free Pro trial is waiting",
    body: "Let's get you booked this week. Activate your free 7-day Pro trial and unlock premium features.",
  },
  founder_save_offer: {
    subject: "We'll help you get set up",
    body: "We see you haven't been using GigAid much. Let us help \u2014 here's a free month on us to get you back on track.",
  },
  founder_save_inapp: {
    subject: "Special offer from GigAid",
    body: "We want to help you succeed. Accept this special offer to continue using Pro features.",
  },
} as const;

export async function seedDefaultPlaybooks(): Promise<void> {
  const existing = await db.select().from(retentionPlaybooks).limit(1);
  if (existing.length > 0) {
    logger.info("[RetentionEngine] Playbooks already seeded, skipping.");
    return;
  }

  const defaults = [
    { tier: "Drifting", priority: 1, actionType: "Nudge", channel: "InApp", templateKey: "payday_flow_nudge", delayHours: 0, enabled: true },
    { tier: "AtRisk", priority: 1, actionType: "Trial", channel: "InApp", templateKey: "pro_trial_7day", delayHours: 0, enabled: true },
    { tier: "AtRisk", priority: 2, actionType: "Trial", channel: "Email", templateKey: "pro_trial_7day_email", delayHours: 2, enabled: true },
    { tier: "Critical", priority: 1, actionType: "FounderSave", channel: "Email", templateKey: "founder_save_offer", delayHours: 0, enabled: true },
    { tier: "Critical", priority: 2, actionType: "FounderSave", channel: "InApp", templateKey: "founder_save_inapp", delayHours: 1, enabled: true },
  ];

  await db.insert(retentionPlaybooks).values(defaults);
  logger.info("[RetentionEngine] Default playbooks seeded.");
}

export async function executeRetentionForUser(userId: string, tier: string): Promise<void> {
  const todayDateString = new Date().toISOString().split("T")[0];
  const todayStart = `${todayDateString}T00:00:00.000Z`;

  const playbooks = await db
    .select()
    .from(retentionPlaybooks)
    .where(and(eq(retentionPlaybooks.tier, tier), eq(retentionPlaybooks.enabled, true)))
    .orderBy(retentionPlaybooks.priority);

  if (playbooks.length === 0) {
    logger.info(`[RetentionEngine] No enabled playbooks for tier=${tier}`);
    return;
  }

  for (const playbook of playbooks) {
    const idempotencyKey = `${userId}:${tier}:${playbook.actionType}:${todayDateString}`;

    const [existingAction] = await db
      .select()
      .from(retentionActions)
      .where(eq(retentionActions.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingAction) {
      logger.info(`[RetentionEngine] Skipping duplicate action: ${idempotencyKey}`);
      continue;
    }

    const [todayCount] = await db
      .select({ value: count() })
      .from(retentionActions)
      .where(and(eq(retentionActions.userId, userId), gte(retentionActions.createdAt, todayStart)));

    if ((todayCount?.value ?? 0) >= 1) {
      logger.info(`[RetentionEngine] Max 1 action/day reached for user=${userId}`);
      break;
    }

    const template = RETENTION_TEMPLATES[playbook.templateKey];
    if (!template) {
      logger.error(`[RetentionEngine] Unknown template: ${playbook.templateKey}`);
      continue;
    }

    const [actionRecord] = await db
      .insert(retentionActions)
      .values({
        userId,
        tier,
        actionType: playbook.actionType,
        channel: playbook.channel,
        payload: JSON.stringify({ templateKey: playbook.templateKey, ...template }),
        status: "Queued",
        idempotencyKey,
      })
      .returning();

    let sendSuccess = false;
    let sendError: string | undefined;

    try {
      if (playbook.channel === "InApp") {
        await emitCanonicalEvent({
          eventName: "retention_nudge",
          userId,
          context: { body: template.body, actionType: playbook.actionType, tier },
          source: "system",
        });
        sendSuccess = true;
      } else if (playbook.channel === "Email") {
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.email) {
          sendError = "User has no email address";
        } else {
          const result = await sendEmail({
            to: user.email,
            subject: template.subject,
            text: template.body,
          });
          sendSuccess = result === true;
          if (!sendSuccess) sendError = "Email send returned false";
        }
      } else if (playbook.channel === "SMS") {
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.phone) {
          sendError = "User has no phone number";
        } else {
          const smsRes = await sendSMS(user.phone, template.body);
          sendSuccess = smsRes.success;
          if (!sendSuccess) sendError = smsRes.errorMessage || "SMS send failed";
        }
      } else {
        sendError = `Unknown channel: ${playbook.channel}`;
      }
    } catch (err: any) {
      sendError = err.message || "Send failed with unknown error";
      logger.error(`[RetentionEngine] Send error for ${playbook.channel}:`, err);
    }

    if (sendSuccess) {
      await db
        .update(retentionActions)
        .set({ status: "Sent", sentAt: new Date().toISOString() })
        .where(eq(retentionActions.id, actionRecord.id));
    } else {
      await db
        .update(retentionActions)
        .set({ status: "Failed", error: sendError || "Unknown error" })
        .where(eq(retentionActions.id, actionRecord.id));
    }

    if (playbook.actionType === "Trial") {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(planOverrides).values({
        userId,
        overrideType: "pro_trial",
        expiresAt,
        createdBy: "retention_engine",
      });
      logger.info(`[RetentionEngine] Pro trial override created for user=${userId}, expires=${expiresAt}`);
    }

    if (playbook.actionType === "Credit") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(planOverrides).values({
        userId,
        overrideType: "free_month",
        expiresAt,
        createdBy: "retention_engine",
      });
      logger.info(`[RetentionEngine] Free month override created for user=${userId}, expires=${expiresAt}`);
    }

    if (playbook.actionType === "FounderSave") {
      await emitCanonicalEvent({
        eventName: "founder_save_flagged",
        userId,
        context: { tier, templateKey: playbook.templateKey },
        source: "system",
      });
    }

    break;
  }
}

export async function getActionHistoryForUser(userId: string) {
  return db
    .select()
    .from(retentionActions)
    .where(eq(retentionActions.userId, userId))
    .orderBy(desc(retentionActions.createdAt));
}
