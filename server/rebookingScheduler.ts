import { sendSMS } from "./twilio";

interface DefaultRebookingRule {
  serviceType: string;
  intervalDays: number;
  messageTemplate: string;
}

const DEFAULT_RULES: DefaultRebookingRule[] = [
  {
    serviceType: "cleaning",
    intervalDays: 30,
    messageTemplate: "Hi {{client_first_name}}, it's been about a month since your last cleaning. Ready to schedule the next one?",
  },
  {
    serviceType: "lawn",
    intervalDays: 14,
    messageTemplate: "Hi {{client_first_name}}, your lawn is probably due for service. Want me to come by this week?",
  },
  {
    serviceType: "handyman",
    intervalDays: 180,
    messageTemplate: "Hi {{client_first_name}}, just checking in! Need any repairs or maintenance done?",
  },
  {
    serviceType: "tutoring",
    intervalDays: 7,
    messageTemplate: "Hi {{client_first_name}}, ready for your next session? Let me know when works best.",
  },
  {
    serviceType: "moving",
    intervalDays: 365,
    messageTemplate: "Hi {{client_first_name}}, hope the move went well! If you need any help settling in, I'm here.",
  },
];

function renderTemplate(template: string, clientName: string): string {
  const firstName = (clientName || "").split(" ")[0] || "there";
  return template.replace(/\{\{client_first_name\}\}/g, firstName);
}

async function detectConversions() {
  try {
    const { db } = await import("./db");
    const { rebookingLogs, jobs } = await import("@shared/schema");
    const { eq, and, gt, or } = await import("drizzle-orm");

    const sentLogs = await db.select().from(rebookingLogs).where(eq(rebookingLogs.status, "sent"));

    for (const log of sentLogs) {
      try {
        const originalJob = await db.select().from(jobs).where(eq(jobs.id, log.jobId)).limit(1);
        if (originalJob.length === 0) continue;

        const serviceType = originalJob[0].serviceType;
        const sentAt = log.sentAt;

        const allJobs = await db.select().from(jobs).where(
          and(
            eq(jobs.userId, log.userId),
            eq(jobs.serviceType, serviceType),
            gt(jobs.createdAt, sentAt)
          )
        );

        const matchingJob = allJobs.find((j) => {
          if (log.clientPhone && j.clientPhone && j.clientPhone === log.clientPhone) return true;
          if (log.clientName && j.clientName && j.clientName === log.clientName) return true;
          return false;
        });

        if (matchingJob) {
          await db.update(rebookingLogs)
            .set({ status: "converted", convertedJobId: matchingJob.id, convertedAt: new Date().toISOString() })
            .where(eq(rebookingLogs.id, log.id));
          console.log(`[RebookingScheduler] Detected conversion for rebooking log ${log.id}`);
        }
      } catch (logError) {
        console.error(`[RebookingScheduler] Error detecting conversion for log ${log.id}:`, logError);
      }
    }
  } catch (error) {
    console.error("[RebookingScheduler] Error in detectConversions:", error);
  }
}

async function checkRebookings() {
  try {
    await detectConversions();

    const { db } = await import("./db");
    const { rebookingRules, rebookingLogs, jobs, users } = await import("@shared/schema");
    const { eq, and, lt } = await import("drizzle-orm");

    const allUsers = await db.select().from(users);

    for (const user of allUsers) {
      try {
        const userRules = await db
          .select()
          .from(rebookingRules)
          .where(and(eq(rebookingRules.userId, user.id), eq(rebookingRules.enabled, true)));

        const rulesToUse = userRules.length > 0
          ? userRules.map((r) => ({
              serviceType: r.serviceType,
              intervalDays: r.intervalDays,
              messageTemplate: r.messageTemplate || DEFAULT_RULES.find((d) => d.serviceType === r.serviceType)?.messageTemplate || "",
              ruleId: r.id,
            }))
          : DEFAULT_RULES.map((r) => ({ ...r, ruleId: null as string | null }));

        const now = new Date();

        for (const rule of rulesToUse) {
          try {
            const cutoffTime = new Date(now.getTime() - rule.intervalDays * 24 * 60 * 60 * 1000).toISOString();

            const completedJobs = await db
              .select()
              .from(jobs)
              .where(
                and(
                  eq(jobs.userId, user.id),
                  eq(jobs.status, "completed"),
                  eq(jobs.serviceType, rule.serviceType),
                  lt(jobs.completedAt, cutoffTime)
                )
              );

            for (const job of completedJobs) {
              if (!job.clientPhone) continue;

              const existingLog = await db
                .select()
                .from(rebookingLogs)
                .where(eq(rebookingLogs.jobId, job.id))
                .limit(1);

              if (existingLog.length > 0) continue;

              const message = renderTemplate(rule.messageTemplate, job.clientName || "");
              const success = await sendSMS(job.clientPhone, message);

              await db.insert(rebookingLogs).values({
                userId: user.id,
                ruleId: rule.ruleId,
                jobId: job.id,
                clientName: job.clientName,
                clientPhone: job.clientPhone,
                clientEmail: job.clientEmail,
                status: success ? "sent" : "failed",
              });

              if (success) {
                console.log(`[RebookingScheduler] Sent rebooking for job ${job.id} to ${job.clientPhone}`);
              }
            }
          } catch (ruleError) {
            console.error(`[RebookingScheduler] Error processing rule ${rule.serviceType} for user ${user.id}:`, ruleError);
          }
        }
      } catch (userError) {
        console.error(`[RebookingScheduler] Error processing user ${user.id}:`, userError);
      }
    }
  } catch (error) {
    console.error("[RebookingScheduler] Error in checkRebookings:", error);
  }
}

export function startRebookingScheduler() {
  console.log("[RebookingScheduler] Starting scheduler (checks every hour)");

  setInterval(async () => {
    try {
      await checkRebookings();
    } catch (error) {
      console.error("[RebookingScheduler] Scheduler error:", error);
    }
  }, 3600000);

  setTimeout(() => checkRebookings().catch(console.error), 30000);
}
