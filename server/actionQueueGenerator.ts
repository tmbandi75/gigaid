import { IStorage } from "./storage";
import type { ActionQueueItem, InsertActionQueueItem, Lead, Job, Invoice } from "@shared/schema";

interface ActionItem {
  sourceType: "lead" | "job" | "invoice";
  sourceId: string;
  actionType: string;
  title: string;
  subtitle: string;
  explainText: string;
  priorityScore: number;
  dueAt?: string;
  ctaPrimaryLabel: string;
  ctaPrimaryAction: Record<string, unknown>;
  ctaSecondaryLabel?: string;
  ctaSecondaryAction?: Record<string, unknown>;
}

export class ActionQueueGenerator {
  constructor(private storage: IStorage) {}

  async generateQueue(userId: string): Promise<ActionQueueItem[]> {
    await this.storage.clearActionQueue(userId);
    
    const [leads, jobs, invoices] = await Promise.all([
      this.storage.getLeads(userId),
      this.storage.getJobs(userId),
      this.storage.getInvoices(userId),
    ]);

    const jobsWithInvoices = new Set(invoices.filter(i => i.jobId).map(i => i.jobId));

    const actions: ActionItem[] = [];

    actions.push(...this.generateLeadActions(leads));
    actions.push(...this.generateJobActions(jobs, jobsWithInvoices));
    actions.push(...this.generateInvoiceActions(invoices));

    actions.sort((a, b) => b.priorityScore - a.priorityScore);

    // Max 25 open items as per spec
    const limitedActions = actions.slice(0, 25);

    const items: ActionQueueItem[] = [];
    for (const action of limitedActions) {
      const dedupeKey = `${action.sourceType}:${action.sourceId}:${action.actionType}`;
      
      const existing = await this.storage.getActionQueueItemByDedupeKey(dedupeKey);
      if (existing) continue;

      const insert: InsertActionQueueItem = {
        userId,
        sourceType: action.sourceType,
        sourceId: action.sourceId,
        actionType: action.actionType,
        title: action.title,
        subtitle: action.subtitle,
        explainText: action.explainText,
        priorityScore: action.priorityScore,
        dueAt: action.dueAt,
        ctaPrimaryLabel: action.ctaPrimaryLabel,
        ctaPrimaryAction: JSON.stringify(action.ctaPrimaryAction),
        ctaSecondaryLabel: action.ctaSecondaryLabel,
        ctaSecondaryAction: action.ctaSecondaryAction ? JSON.stringify(action.ctaSecondaryAction) : undefined,
        dedupeKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const item = await this.storage.createActionQueueItem(insert);
      items.push(item);
    }

    return items;
  }

  private generateLeadActions(leads: Lead[]): ActionItem[] {
    const actions: ActionItem[] = [];
    const now = new Date();

    for (const lead of leads) {
      if (lead.status === "lost" || lead.status === "won") continue;

      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const score = lead.score || 0;

      if (lead.status === "new") {
        let priority = 80;
        if (daysSinceCreated === 0) priority = 95;
        else if (daysSinceCreated === 1) priority = 90;
        else if (daysSinceCreated <= 3) priority = 85;
        else if (daysSinceCreated > 7) priority = 60;

        actions.push({
          sourceType: "lead",
          sourceId: lead.id,
          actionType: "respond_to_lead",
          title: `Respond to ${lead.clientName}`,
          subtitle: score > 0 ? `Score: ${score} - ${lead.serviceType}` : lead.serviceType,
          explainText: daysSinceCreated === 0 
            ? "Fresh lead - responding within 5 minutes increases win rate by 78%"
            : `Lead is ${daysSinceCreated} day${daysSinceCreated > 1 ? 's' : ''} old`,
          priorityScore: priority,
          ctaPrimaryLabel: "Send Message",
          ctaPrimaryAction: { route: `/leads/${lead.id}`, action: "message" },
          ctaSecondaryLabel: "View Details",
          ctaSecondaryAction: { route: `/leads/${lead.id}` },
        });
      }

      if (lead.status === "contacted" && daysSinceCreated >= 3) {
        actions.push({
          sourceType: "lead",
          sourceId: lead.id,
          actionType: "follow_up_lead",
          title: `Follow up with ${lead.clientName}`,
          subtitle: lead.serviceType,
          explainText: "No response in 3+ days - a gentle follow-up can recover 40% of stalled leads",
          priorityScore: 75,
          ctaPrimaryLabel: "Follow Up",
          ctaPrimaryAction: { route: `/leads/${lead.id}`, action: "follow_up" },
        });
      }

      if (lead.status === "quoted" && daysSinceCreated >= 2) {
        const quoteAge = daysSinceCreated;
        let priority = 82;
        if (quoteAge >= 7) priority = 70;

        actions.push({
          sourceType: "lead",
          sourceId: lead.id,
          actionType: "chase_quote",
          title: `Chase quote for ${lead.clientName}`,
          subtitle: lead.serviceType,
          explainText: `Quote sent ${quoteAge} days ago - checking in shows you care`,
          priorityScore: priority,
          ctaPrimaryLabel: "Send Reminder",
          ctaPrimaryAction: { route: `/leads/${lead.id}`, action: "remind" },
        });
      }
    }

    return actions;
  }

  private generateJobActions(jobs: Job[], jobsWithInvoices: Set<string | null>): ActionItem[] {
    const actions: ActionItem[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const job of jobs) {
      if (job.status === "cancelled") continue;

      const jobDate = job.scheduledDate;
      const amount = job.price || 0;

      if (job.status === "scheduled" && jobDate === today) {
        actions.push({
          sourceType: "job",
          sourceId: job.id,
          actionType: "start_job",
          title: `Start: ${job.title}`,
          subtitle: `${job.clientName || 'Client'} - Today${job.scheduledTime ? ` at ${job.scheduledTime}` : ''}`,
          explainText: "Job scheduled for today - mark as in progress when you arrive",
          priorityScore: 100,
          dueAt: job.scheduledTime ? `${today}T${job.scheduledTime}` : today,
          ctaPrimaryLabel: "Start Job",
          ctaPrimaryAction: { route: `/jobs/${job.id}`, action: "start" },
          ctaSecondaryLabel: "View Details",
          ctaSecondaryAction: { route: `/jobs/${job.id}` },
        });
      }

      if (job.status === "in_progress") {
        actions.push({
          sourceType: "job",
          sourceId: job.id,
          actionType: "complete_job",
          title: `Complete: ${job.title}`,
          subtitle: job.clientName || 'Client',
          explainText: "Job in progress - mark complete and get paid when finished",
          priorityScore: 95,
          ctaPrimaryLabel: "Complete Job",
          ctaPrimaryAction: { route: `/jobs/${job.id}`, action: "complete" },
        });
      }

      if (job.status === "completed" && !jobsWithInvoices.has(job.id)) {
        const completedDate = job.completedAt ? new Date(job.completedAt) : now;
        const daysSinceCompleted = Math.floor(
          (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        let priority = 88;
        if (daysSinceCompleted > 3) priority = 75;
        if (daysSinceCompleted > 7) priority = 65;

        actions.push({
          sourceType: "job",
          sourceId: job.id,
          actionType: "create_invoice",
          title: `Invoice: ${job.title}`,
          subtitle: amount > 0 ? `$${amount.toLocaleString()} to collect` : (job.clientName || 'Client'),
          explainText: daysSinceCompleted === 0 
            ? "Job just completed - send invoice while client is happy"
            : `Completed ${daysSinceCompleted} days ago - invoice ASAP`,
          priorityScore: priority,
          ctaPrimaryLabel: "Create Invoice",
          ctaPrimaryAction: { route: `/jobs/${job.id}`, action: "invoice" },
        });
      }
    }

    return actions;
  }

  private generateInvoiceActions(invoices: Invoice[]): ActionItem[] {
    const actions: ActionItem[] = [];
    const now = new Date();

    for (const invoice of invoices) {
      if (invoice.status === "paid" || invoice.status === "cancelled") continue;

      const amount = invoice.amount || 0;
      const sentDate = invoice.sentAt ? new Date(invoice.sentAt) : null;
      const daysSinceSent = sentDate 
        ? Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)) 
        : 0;

      if (invoice.status === "sent" && daysSinceSent >= 7) {
        let priority = 85;
        if (daysSinceSent >= 14) priority = 92;
        else if (daysSinceSent >= 10) priority = 90;

        actions.push({
          sourceType: "invoice",
          sourceId: invoice.id,
          actionType: "chase_overdue",
          title: `Chase: Invoice #${invoice.invoiceNumber}`,
          subtitle: `$${amount.toLocaleString()} - sent ${daysSinceSent} days ago`,
          explainText: daysSinceSent >= 14
            ? "2+ weeks since sent - consider a phone call"
            : `Sent ${daysSinceSent} days ago - a friendly reminder works`,
          priorityScore: priority,
          ctaPrimaryLabel: "Send Reminder",
          ctaPrimaryAction: { route: `/invoices/${invoice.id}`, action: "remind" },
          ctaSecondaryLabel: "Mark Paid",
          ctaSecondaryAction: { route: `/invoices/${invoice.id}`, action: "paid" },
        });
      } else if (invoice.status === "sent" && daysSinceSent >= 3 && daysSinceSent < 7) {
        actions.push({
          sourceType: "invoice",
          sourceId: invoice.id,
          actionType: "follow_up_invoice",
          title: `Follow up: Invoice #${invoice.invoiceNumber}`,
          subtitle: `$${amount.toLocaleString()} - ${daysSinceSent} days since sent`,
          explainText: "Invoice sent a few days ago - a gentle heads-up can speed things up",
          priorityScore: 78,
          ctaPrimaryLabel: "Send Reminder",
          ctaPrimaryAction: { route: `/invoices/${invoice.id}`, action: "remind" },
        });
      }

      if (invoice.status === "draft") {
        const createdDate = new Date(invoice.createdAt);
        const daysSinceCreated = Math.floor(
          (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        let priority = 70;
        if (daysSinceCreated > 3) priority = 60;

        actions.push({
          sourceType: "invoice",
          sourceId: invoice.id,
          actionType: "send_draft",
          title: `Send: Invoice #${invoice.invoiceNumber}`,
          subtitle: `$${amount.toLocaleString()} draft`,
          explainText: daysSinceCreated === 0
            ? "Draft created today - send it while fresh"
            : `Draft waiting ${daysSinceCreated} days - finish and send`,
          priorityScore: priority,
          ctaPrimaryLabel: "Review & Send",
          ctaPrimaryAction: { route: `/invoices/${invoice.id}`, action: "send" },
        });
      }
    }

    return actions;
  }
}
