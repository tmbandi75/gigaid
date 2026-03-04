import { sendSMS } from "./twilio";
import { logger } from "./lib/logger";

const CHECK_INTERVAL_MS = 300000;

interface DefaultRule {
  ruleType: string;
  delayHours: number;
  messageTemplate: string;
  channel: string;
}

const DEFAULT_RULES: DefaultRule[] = [
  {
    ruleType: "no_reply",
    delayHours: 24,
    messageTemplate: "Hi {{client_first_name}}, just following up on my message. Let me know if you have any questions!",
    channel: "sms",
  },
  {
    ruleType: "quote_pending",
    delayHours: 48,
    messageTemplate: "Hi {{client_first_name}}, wanted to check if you had a chance to review the quote I sent. Happy to answer any questions!",
    channel: "sms",
  },
  {
    ruleType: "unpaid_invoice",
    delayHours: 12,
    messageTemplate: "Hi {{client_first_name}}, quick reminder about the outstanding invoice.{{invoice_link}} Let me know if you need anything!",
    channel: "sms",
  },
];

function renderTemplate(template: string, clientName: string, invoiceLink?: string): string {
  const firstName = (clientName || "").split(" ")[0] || "there";
  let result = template.replace(/\{\{client_first_name\}\}/g, firstName);
  if (invoiceLink) {
    result = result.replace(/\{\{invoice_link\}\}/g, ` You can view and pay it here: ${invoiceLink}`);
  } else {
    result = result.replace(/\{\{invoice_link\}\}/g, "");
  }
  return result;
}

async function checkFollowUps() {
  try {
    const { db } = await import("./db");
    const { followUpRules, followUpLogs, leads, invoices, users, priceConfirmations } = await import("@shared/schema");
    const { eq, and, lt, sql } = await import("drizzle-orm");

    const allUsers = await db.select().from(users);

    for (const user of allUsers) {
      try {
        const userRules = await db
          .select()
          .from(followUpRules)
          .where(and(eq(followUpRules.userId, user.id), eq(followUpRules.enabled, true)));

        const rulesToUse = userRules.length > 0
          ? userRules.map((r) => ({
              ruleType: r.ruleType,
              delayHours: r.delayHours,
              messageTemplate: r.messageTemplate || DEFAULT_RULES.find((d) => d.ruleType === r.ruleType)?.messageTemplate || "",
              channel: r.channel || "sms",
              ruleId: r.id,
            }))
          : DEFAULT_RULES.map((r) => ({ ...r, ruleId: null as string | null }));

        const now = new Date();

        for (const rule of rulesToUse) {
          try {
            const cutoffTime = new Date(now.getTime() - rule.delayHours * 60 * 60 * 1000).toISOString();

            if (rule.ruleType === "no_reply") {
              const candidateLeads = await db
                .select()
                .from(leads)
                .where(
                  and(
                    eq(leads.userId, user.id),
                    eq(leads.status, "response_sent"),
                    lt(leads.lastContactedAt, cutoffTime)
                  )
                );

              for (const lead of candidateLeads) {
                if (!lead.clientPhone) continue;

                const existingLog = await db
                  .select()
                  .from(followUpLogs)
                  .where(
                    and(
                      eq(followUpLogs.userId, user.id),
                      eq(followUpLogs.ruleType, "no_reply"),
                      eq(followUpLogs.entityType, "lead"),
                      eq(followUpLogs.entityId, lead.id)
                    )
                  )
                  .limit(1);

                if (existingLog.length > 0) continue;

                const message = renderTemplate(rule.messageTemplate, lead.clientName);
                const smsRes = await sendSMS(lead.clientPhone, message);

                await db.insert(followUpLogs).values({
                  userId: user.id,
                  ruleId: rule.ruleId,
                  ruleType: "no_reply",
                  entityType: "lead",
                  entityId: lead.id,
                  channel: "sms",
                  toAddress: lead.clientPhone,
                  message,
                  status: smsRes.success ? "sent" : "failed",
                  failureReason: smsRes.success ? null : (smsRes.errorMessage || "SMS delivery failed"),
                });

                if (smsRes.success) {
                  logger.info(`[FollowUpBot] Sent no_reply follow-up for lead ${lead.id}`);
                }
              }
            }

            if (rule.ruleType === "quote_pending") {
              const candidateConfirmations = await db
                .select()
                .from(priceConfirmations)
                .where(
                  and(
                    eq(priceConfirmations.userId, user.id),
                    eq(priceConfirmations.status, "sent"),
                    lt(priceConfirmations.sentAt, cutoffTime)
                  )
                );

              for (const pc of candidateConfirmations) {
                const existingLog = await db
                  .select()
                  .from(followUpLogs)
                  .where(
                    and(
                      eq(followUpLogs.userId, user.id),
                      eq(followUpLogs.ruleType, "quote_pending"),
                      eq(followUpLogs.entityType, "lead"),
                      eq(followUpLogs.entityId, pc.leadId)
                    )
                  )
                  .limit(1);

                if (existingLog.length > 0) continue;

                const [lead] = await db
                  .select()
                  .from(leads)
                  .where(eq(leads.id, pc.leadId))
                  .limit(1);

                if (!lead || !lead.clientPhone) continue;

                const message = renderTemplate(rule.messageTemplate, lead.clientName);
                const smsRes2 = await sendSMS(lead.clientPhone, message);

                await db.insert(followUpLogs).values({
                  userId: user.id,
                  ruleId: rule.ruleId,
                  ruleType: "quote_pending",
                  entityType: "lead",
                  entityId: pc.leadId,
                  channel: "sms",
                  toAddress: lead.clientPhone,
                  message,
                  status: smsRes2.success ? "sent" : "failed",
                  failureReason: smsRes2.success ? null : (smsRes2.errorMessage || "SMS delivery failed"),
                });

                if (smsRes2.success) {
                  logger.info(`[FollowUpBot] Sent quote_pending follow-up for lead ${pc.leadId}`);
                }
              }
            }

            if (rule.ruleType === "unpaid_invoice") {
              const candidateInvoices = await db
                .select()
                .from(invoices)
                .where(
                  and(
                    eq(invoices.userId, user.id),
                    eq(invoices.status, "sent"),
                    lt(invoices.sentAt, cutoffTime)
                  )
                );

              for (const invoice of candidateInvoices) {
                if (!invoice.clientPhone) continue;

                const existingLog = await db
                  .select()
                  .from(followUpLogs)
                  .where(
                    and(
                      eq(followUpLogs.userId, user.id),
                      eq(followUpLogs.ruleType, "unpaid_invoice"),
                      eq(followUpLogs.entityType, "invoice"),
                      eq(followUpLogs.entityId, invoice.id)
                    )
                  )
                  .limit(1);

                if (existingLog.length > 0) continue;

                const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
                const invoiceToken = invoice.publicToken || invoice.shareLink;
                const invoiceLink = invoiceToken
                  ? `${frontendUrl}/invoice/${invoiceToken}`
                  : undefined;

                const message = renderTemplate(rule.messageTemplate, invoice.clientName, invoiceLink);
                const smsRes3 = await sendSMS(invoice.clientPhone, message);

                await db.insert(followUpLogs).values({
                  userId: user.id,
                  ruleId: rule.ruleId,
                  ruleType: "unpaid_invoice",
                  entityType: "invoice",
                  entityId: invoice.id,
                  channel: "sms",
                  toAddress: invoice.clientPhone,
                  message,
                  status: smsRes3.success ? "sent" : "failed",
                  failureReason: smsRes3.success ? null : (smsRes3.errorMessage || "SMS delivery failed"),
                });

                if (smsRes3.success) {
                  logger.info(`[FollowUpBot] Sent unpaid_invoice follow-up for invoice ${invoice.id}`);
                }
              }
            }
          } catch (ruleError) {
            logger.error(`[FollowUpBot] Error processing rule ${rule.ruleType} for user ${user.id}:`, ruleError);
          }
        }
      } catch (userError) {
        logger.error(`[FollowUpBot] Error processing user ${user.id}:`, userError);
      }
    }
  } catch (error) {
    logger.error("[FollowUpBot] Error in checkFollowUps:", error);
  }
}

export function startFollowUpBot() {
  logger.info("[FollowUpBot] Starting scheduler (checks every 5 minutes)");

  setInterval(async () => {
    try {
      await checkFollowUps();
    } catch (error) {
      logger.error("[FollowUpBot] Scheduler error:", error);
    }
  }, CHECK_INTERVAL_MS);

  setTimeout(() => checkFollowUps().catch(console.error), 15000);
}
