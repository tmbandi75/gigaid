import { IStorage } from "./storage";
import { InsertAiNudge, AiNudge, Lead, Job, Invoice } from "@shared/schema";

const STALE_LEAD_DAYS = 7;
const HOT_LEAD_RESPONSE_HOURS = 24;

export class NudgeService {
  constructor(private storage: IStorage) {}

  async generateNudgesForUser(userId: string): Promise<AiNudge[]> {
    const generatedNudges: AiNudge[] = [];

    const [leads, jobs, invoices] = await Promise.all([
      this.storage.getLeads(userId),
      this.storage.getJobs(userId),
      this.storage.getInvoices(userId),
    ]);

    const leadNudges = await this.generateLeadNudges(userId, leads);
    const jobNudges = await this.generateJobNudges(userId, jobs);
    const invoiceNudges = await this.generateInvoiceNudges(userId, invoices, jobs);

    generatedNudges.push(...leadNudges, ...jobNudges, ...invoiceNudges);
    return generatedNudges;
  }

  private async generateLeadNudges(userId: string, leads: Lead[]): Promise<AiNudge[]> {
    const nudges: AiNudge[] = [];
    const now = new Date();

    for (const lead of leads) {
      if (lead.status === "converted" || lead.status === "lost") continue;

      const lastContactDate = lead.lastContactedAt 
        ? new Date(lead.lastContactedAt) 
        : new Date(lead.createdAt);
      
      const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceContact >= STALE_LEAD_DAYS) {
        const nudge = await this.createNudgeIfNotExists({
          userId,
          entityType: "lead",
          entityId: lead.id,
          nudgeType: "lead_follow_up",
          priority: daysSinceContact >= 14 ? 80 : 60,
          status: "active",
          createdAt: now.toISOString(),
          explainText: `${lead.clientName} hasn't been contacted in ${daysSinceContact} days. A quick follow-up could keep this opportunity alive.`,
          actionPayload: JSON.stringify({
            suggestedMessage: `Hi ${lead.clientName}, just checking in to see if you're still interested in our services. Let me know if you have any questions!`,
            leadId: lead.id,
          }),
          dedupeKey: `lead_follow_up:${lead.id}`,
        });
        if (nudge) nudges.push(nudge);
      }

      if (lead.status === "hot" || lead.status === "warm") {
        const nudge = await this.createNudgeIfNotExists({
          userId,
          entityType: "lead",
          entityId: lead.id,
          nudgeType: "lead_convert_to_job",
          priority: lead.status === "hot" ? 90 : 70,
          status: "active",
          createdAt: now.toISOString(),
          explainText: `${lead.clientName} looks ready to book. Convert this ${lead.status} lead to a scheduled job.`,
          actionPayload: JSON.stringify({
            leadId: lead.id,
            prefillJob: {
              title: lead.serviceType || "New Job",
              clientName: lead.clientName,
              clientPhone: lead.clientPhone,
              clientEmail: lead.clientEmail,
            },
          }),
          dedupeKey: `lead_convert:${lead.id}`,
        });
        if (nudge) nudges.push(nudge);
      }
    }

    return nudges;
  }

  private async generateJobNudges(userId: string, jobs: Job[]): Promise<AiNudge[]> {
    const nudges: AiNudge[] = [];
    const now = new Date();

    for (const job of jobs) {
      if (job.status === "completed" && !job.reviewRequestedAt) {
        const completedDate = new Date(job.scheduledDate);
        const daysSinceComplete = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceComplete >= 1 && daysSinceComplete <= 7) {
          const nudge = await this.createNudgeIfNotExists({
            userId,
            entityType: "job",
            entityId: job.id,
            nudgeType: "invoice_create_from_job_done",
            priority: 75,
            status: "active",
            createdAt: now.toISOString(),
            explainText: `Job "${job.title}" was completed ${daysSinceComplete} day(s) ago. Request a review while it's fresh!`,
            actionPayload: JSON.stringify({
              jobId: job.id,
              action: "request_review",
            }),
            dedupeKey: `job_review:${job.id}`,
          });
          if (nudge) nudges.push(nudge);
        }
      }
    }

    return nudges;
  }

  private async generateInvoiceNudges(userId: string, invoices: Invoice[], jobs: Job[]): Promise<AiNudge[]> {
    const nudges: AiNudge[] = [];
    const now = new Date();

    for (const invoice of invoices) {
      if (invoice.status === "unpaid" || invoice.status === "overdue") {
        const createdDate = new Date(invoice.createdAt);
        const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceCreated >= 7) {
          const nudge = await this.createNudgeIfNotExists({
            userId,
            entityType: "invoice",
            entityId: invoice.id,
            nudgeType: "invoice_reminder",
            priority: invoice.status === "overdue" ? 85 : 65,
            status: "active",
            createdAt: now.toISOString(),
            explainText: `Invoice #${invoice.id.slice(-6)} for $${(invoice.amount / 100).toFixed(2)} is ${daysSinceCreated} days old. Send a reminder?`,
            actionPayload: JSON.stringify({
              invoiceId: invoice.id,
              action: "send_reminder",
            }),
            dedupeKey: `invoice_reminder:${invoice.id}`,
          });
          if (nudge) nudges.push(nudge);
        }
      }
    }

    const completedJobsWithoutInvoice = jobs.filter(job => {
      if (job.status !== "completed") return false;
      return !invoices.some(inv => inv.jobId === job.id);
    });

    for (const job of completedJobsWithoutInvoice) {
      const nudge = await this.createNudgeIfNotExists({
        userId,
        entityType: "job",
        entityId: job.id,
        nudgeType: "invoice_create_from_job_done",
        priority: 80,
        status: "active",
        createdAt: now.toISOString(),
        explainText: `Job "${job.title}" is complete but has no invoice. Create one to get paid!`,
        actionPayload: JSON.stringify({
          jobId: job.id,
          action: "create_invoice",
          prefillInvoice: {
            clientName: job.clientName,
            clientEmail: job.clientEmail,
            amount: job.price,
          },
        }),
        dedupeKey: `job_needs_invoice:${job.id}`,
      });
      if (nudge) nudges.push(nudge);
    }

    return nudges;
  }

  private async createNudgeIfNotExists(nudge: InsertAiNudge): Promise<AiNudge | null> {
    const existing = await this.storage.getAiNudgeByDedupeKey(nudge.dedupeKey);
    if (existing) {
      if (existing.status === "active" || existing.status === "snoozed") {
        return null;
      }
    }
    return await this.storage.createAiNudge(nudge);
  }

  async dismissNudge(nudgeId: string, userId: string): Promise<AiNudge | null> {
    const nudge = await this.storage.getAiNudge(nudgeId);
    if (!nudge || nudge.userId !== userId) return null;

    const updated = await this.storage.updateAiNudge(nudgeId, {
      status: "dismissed",
      updatedAt: new Date().toISOString(),
    });

    await this.storage.createAiNudgeEvent({
      nudgeId,
      userId,
      eventType: "dismissed",
      eventAt: new Date().toISOString(),
      metadata: "{}",
    });

    return updated || null;
  }

  async snoozeNudge(nudgeId: string, userId: string, hours: number = 24): Promise<AiNudge | null> {
    const nudge = await this.storage.getAiNudge(nudgeId);
    if (!nudge || nudge.userId !== userId) return null;

    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    
    const updated = await this.storage.updateAiNudge(nudgeId, {
      status: "snoozed",
      snoozedUntil,
      updatedAt: new Date().toISOString(),
    });

    await this.storage.createAiNudgeEvent({
      nudgeId,
      userId,
      eventType: "snoozed",
      eventAt: new Date().toISOString(),
      metadata: JSON.stringify({ snoozedUntil, hours }),
    });

    return updated || null;
  }

  async actionNudge(nudgeId: string, userId: string): Promise<AiNudge | null> {
    const nudge = await this.storage.getAiNudge(nudgeId);
    if (!nudge || nudge.userId !== userId) return null;

    const updated = await this.storage.updateAiNudge(nudgeId, {
      status: "acted",
      updatedAt: new Date().toISOString(),
    });

    await this.storage.createAiNudgeEvent({
      nudgeId,
      userId,
      eventType: "acted",
      eventAt: new Date().toISOString(),
    });

    return updated || null;
  }

  async getActiveNudges(userId: string): Promise<AiNudge[]> {
    await this.generateNudgesForUser(userId);
    
    const allNudges = await this.storage.getActiveAiNudgesForUser(userId);
    
    const now = new Date();
    const activeNudges = allNudges.filter(nudge => {
      if (nudge.status !== "active" && nudge.status !== "snoozed") return false;
      if (nudge.status === "snoozed" && nudge.snoozedUntil) {
        if (new Date(nudge.snoozedUntil) > now) return false;
      }
      return true;
    });

    return activeNudges.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  getStaleLeads(leads: Lead[]): Lead[] {
    const now = new Date();
    return leads.filter(lead => {
      if (lead.status === "converted" || lead.status === "lost") return false;
      
      const lastContactDate = lead.lastContactedAt 
        ? new Date(lead.lastContactedAt) 
        : new Date(lead.createdAt);
      
      const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceContact >= STALE_LEAD_DAYS;
    });
  }
}
