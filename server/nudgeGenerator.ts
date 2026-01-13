import { storage } from "./storage";
import type { Lead, Invoice, Job, AiNudge, InsertAiNudge } from "@shared/schema";

interface NudgeCandidate {
  entityType: "lead" | "invoice" | "job";
  entityId: string;
  nudgeType: string;
  priority: number;
  explainText: string;
  actionPayload: Record<string, any>;
  confidence?: number;
}

const MAX_NUDGES_PER_RUN = 20;
const MAX_ACTIVE_NUDGES_PER_ENTITY = 2;
const MAX_NUDGES_PER_DAY = 10; // Daily cap per user

function getDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function hoursAgo(isoString: string | null, hours: number): boolean {
  if (!isoString) return false;
  const then = new Date(isoString).getTime();
  const now = Date.now();
  return now - then >= hours * 60 * 60 * 1000;
}

function hoursSince(isoString: string | null): number {
  if (!isoString) return Infinity;
  const then = new Date(isoString).getTime();
  return (Date.now() - then) / (60 * 60 * 1000);
}

function generateLeadNudges(lead: Lead, userId: string): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];
  const today = getDateString();

  if (
    (lead.status === "new" || lead.status === "response_sent") &&
    !lead.lastContactedAt &&
    hoursAgo(lead.createdAt, 12)
  ) {
    candidates.push({
      entityType: "lead",
      entityId: lead.id,
      nudgeType: "lead_follow_up",
      priority: 90,
      explainText: "Follow up now — replies drop after 24h.",
      actionPayload: {
        suggestedMessage: `Hi ${lead.clientName || "there"}! Just following up on your inquiry about ${lead.serviceType || "our services"}. When would be a good time to chat?`,
      },
    });
  }

  if (
    (lead.status === "response_sent" || lead.status === "engaged") &&
    lead.lastContactedAt &&
    hoursAgo(lead.lastContactedAt, 48)
  ) {
    candidates.push({
      entityType: "lead",
      entityId: lead.id,
      nudgeType: "lead_silent_rescue",
      priority: 80,
      explainText: "Customers often respond to a quick check-in.",
      actionPayload: {
        suggestedMessage: `Hey ${lead.clientName || "there"}, just checking in to see if you're still interested. Let me know if you have any questions!`,
      },
    });
  }

  if (
    lead.status === "engaged" &&
    !lead.convertedJobId &&
    hoursAgo(lead.createdAt, 2)
  ) {
    // Boost priority based on lead score (clamp to 0 to avoid negative scores lowering priority)
    const basePriority = 85;
    const scoreBoost = lead.score && lead.score > 0 ? Math.min(lead.score * 0.1, 10) : 0;
    
    candidates.push({
      entityType: "lead",
      entityId: lead.id,
      nudgeType: "lead_convert_to_job",
      priority: basePriority + scoreBoost,
      explainText: "Turn this into a job?",
      actionPayload: {
        jobPrefill: {
          clientName: lead.clientName,
          clientPhone: lead.clientPhone,
          clientEmail: lead.clientEmail,
          serviceType: lead.serviceType,
          description: lead.description,
        },
      },
    });
  }

  // Hot lead alert: High score lead needing immediate action
  if (
    lead.score && 
    lead.score >= 80 &&
    (lead.status === "new" || lead.status === "response_sent") &&
    hoursAgo(lead.createdAt, 1) &&
    !hoursAgo(lead.createdAt, 24)
  ) {
    candidates.push({
      entityType: "lead",
      entityId: lead.id,
      nudgeType: "lead_hot_alert",
      priority: 95, // High priority
      explainText: `Hot lead! Score: ${lead.score}. Respond quickly.`,
      actionPayload: {
        suggestedMessage: `Hi ${lead.clientName || "there"}! Thanks for reaching out about ${lead.serviceType || "our services"}. I'd love to help. What time works best for you?`,
        leadScore: lead.score,
      },
    });
  }

  return candidates;
}

function generateInvoiceNudges(invoice: Invoice, userId: string): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];
  const amount = invoice.amount / 100;
  const hours = hoursSince(invoice.sentAt);

  // Only process unpaid invoices that have been sent
  if (!invoice.paidAt && invoice.sentAt && (invoice.status === "sent" || invoice.status === "draft")) {
    
    // Level 1: Gentle reminder (24-72 hours)
    if (hours >= 24 && hours < 72) {
      candidates.push({
        entityType: "invoice",
        entityId: invoice.id,
        nudgeType: "invoice_reminder",
        priority: 90,
        explainText: `You're owed $${amount.toFixed(0)} — send a friendly reminder?`,
        actionPayload: {
          reminderMessage: `Hi ${invoice.clientName}! Just a friendly reminder about invoice #${invoice.invoiceNumber} for $${amount.toFixed(2)}. Let me know if you have any questions! Payment link: {link}`,
          escalationLevel: "gentle",
        },
      });
    }
    
    // Level 2: Firm reminder (72 hours - 7 days)
    else if (hours >= 72 && hours < 168) {
      candidates.push({
        entityType: "invoice",
        entityId: invoice.id,
        nudgeType: "invoice_reminder_firm",
        priority: 92,
        explainText: `$${amount.toFixed(0)} unpaid for 3+ days — follow up now.`,
        actionPayload: {
          reminderMessage: `Hi ${invoice.clientName}, following up on invoice #${invoice.invoiceNumber} for $${amount.toFixed(2)} sent a few days ago. Would appreciate if you could take a look when you get a chance. Payment link: {link}`,
          escalationLevel: "firm",
        },
      });
    }
    
    // Level 3: Urgent escalation (7+ days)
    else if (hours >= 168) {
      candidates.push({
        entityType: "invoice",
        entityId: invoice.id,
        nudgeType: "invoice_overdue_escalation",
        priority: 95,
        explainText: `Invoice overdue 7+ days — $${amount.toFixed(0)} at risk. Take action now.`,
        actionPayload: {
          firmerMessage: `Hi ${invoice.clientName}, I noticed invoice #${invoice.invoiceNumber} ($${amount.toFixed(2)}) from over a week ago is still outstanding. Please let me know if there's an issue I can help resolve.`,
          escalationLevel: "urgent",
        },
      });
    }
  }

  return candidates;
}

function generateJobNudges(job: Job, userId: string, invoices: Invoice[]): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];

  // Job → Invoice nudge for completed jobs
  if (
    job.status === "completed" &&
    !invoices.some(inv => inv.jobId === job.id) &&
    hoursAgo(job.createdAt, 1)
  ) {
    const amount = job.price ? job.price / 100 : 0;
    candidates.push({
      entityType: "job",
      entityId: job.id,
      nudgeType: "invoice_create_from_job_done",
      priority: 88,
      explainText: "Invoice now while the job is fresh.",
      actionPayload: {
        invoicePrefill: {
          clientName: job.clientName,
          clientEmail: job.clientEmail,
          clientPhone: job.clientPhone,
          serviceDescription: job.title,
          amount: job.price || 0,
          jobId: job.id,
        },
      },
    });
  }

  // Job stuck: Scheduled job with no progress for 48+ hours after scheduled time
  if (
    job.status === "scheduled" &&
    job.scheduledDate &&
    job.scheduledTime
  ) {
    const scheduledDateTime = new Date(`${job.scheduledDate}T${job.scheduledTime}`);
    const hoursSinceScheduled = (Date.now() - scheduledDateTime.getTime()) / (60 * 60 * 1000);
    
    if (hoursSinceScheduled >= 48) {
      candidates.push({
        entityType: "job",
        entityId: job.id,
        nudgeType: "job_stuck",
        priority: 80,
        explainText: "This job was scheduled 2+ days ago. Update status?",
        actionPayload: {
          suggestedActions: ["mark_completed", "reschedule", "cancel"],
        },
      });
    }
  }

  return candidates;
}

export async function generateNudgesForUser(userId: string): Promise<{ createdCount: number; activeCount: number }> {
  const featureFlag = await storage.getFeatureFlag("ai_micro_nudges");
  if (!featureFlag?.enabled) {
    return { createdCount: 0, activeCount: 0 };
  }

  // Check daily cap
  const todayCount = await storage.getTodayNudgeCount(userId);
  if (todayCount >= MAX_NUDGES_PER_DAY) {
    const activeNudges = await storage.getActiveAiNudgesForUser(userId);
    return { createdCount: 0, activeCount: activeNudges.length };
  }
  const remainingDailyCap = MAX_NUDGES_PER_DAY - todayCount;

  const [leads, invoices, jobs] = await Promise.all([
    storage.getLeads(userId),
    storage.getInvoices(userId),
    storage.getJobs(userId),
  ]);

  const candidates: NudgeCandidate[] = [];
  const today = getDateString();

  for (const lead of leads) {
    candidates.push(...generateLeadNudges(lead, userId));
  }

  for (const invoice of invoices) {
    candidates.push(...generateInvoiceNudges(invoice, userId));
  }

  for (const job of jobs) {
    candidates.push(...generateJobNudges(job, userId, invoices));
  }

  let createdCount = 0;
  const entityNudgeCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (createdCount >= MAX_NUDGES_PER_RUN) break;
    if (createdCount >= remainingDailyCap) break; // Enforce daily cap

    const entityKey = `${candidate.entityType}:${candidate.entityId}`;
    const currentCount = entityNudgeCounts.get(entityKey) || 0;
    if (currentCount >= MAX_ACTIVE_NUDGES_PER_ENTITY) continue;

    const existingNudges = await storage.getAiNudgesByEntity(candidate.entityType, candidate.entityId);
    const activeNudges = existingNudges.filter(n => n.status === "active");
    if (activeNudges.length >= MAX_ACTIVE_NUDGES_PER_ENTITY) continue;

    const dedupeKey = `${userId}:${candidate.entityType}:${candidate.entityId}:${candidate.nudgeType}:${today}`;
    const existing = await storage.getAiNudgeByDedupeKey(dedupeKey);
    if (existing) continue;
    
    // Check for recently snoozed nudges of the same type to prevent immediate re-triggering
    const recentNudges = existingNudges.filter(n => 
      n.nudgeType === candidate.nudgeType && 
      (n.status === "snoozed" || n.status === "dismissed") &&
      n.createdAt && 
      hoursSince(n.createdAt) < 24 // 24-hour cooldown after snooze/dismiss
    );
    if (recentNudges.length > 0) continue;

    const nudge: InsertAiNudge = {
      userId,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      nudgeType: candidate.nudgeType,
      priority: candidate.priority,
      status: "active",
      createdAt: new Date().toISOString(),
      explainText: candidate.explainText,
      actionPayload: JSON.stringify(candidate.actionPayload),
      dedupeKey,
      confidence: candidate.confidence,
    };

    await storage.createAiNudge(nudge);
    await storage.createAiNudgeEvent({
      nudgeId: nudge.dedupeKey,
      userId,
      eventType: "created",
      eventAt: new Date().toISOString(),
    });

    createdCount++;
    entityNudgeCounts.set(entityKey, currentCount + 1);
  }

  const activeNudges = await storage.getActiveAiNudgesForUser(userId);
  return { createdCount, activeCount: activeNudges.length };
}
