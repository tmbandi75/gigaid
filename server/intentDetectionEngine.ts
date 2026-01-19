import { storage } from "./storage";
import type { 
  Lead, Job, Invoice, User,
  IntentSignal, ReadyAction,
  IntentSignalType
} from "@shared/schema";

const HOURS_IN_MS = 60 * 60 * 1000;
const DAYS_IN_MS = 24 * HOURS_IN_MS;

const TIME_CUE_PATTERNS = [
  /\btomorrow\b/i,
  /\btoday\b/i,
  /\bnext\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bthis\s+(week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(\d{1,2})\s*(am|pm)\b/i,
  /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
  /\b(morning|afternoon|evening)\b/i,
  /\basap\b/i,
  /\bsoon\b/i,
  /\bwhen\s+can\s+you\b/i,
  /\bwhat\s+time\b/i,
  /\bschedule\b/i,
  /\bbook\b/i,
  /\bavailable\b/i,
];

const PRICE_CUE_PATTERNS = [
  /\bhow\s+much\b/i,
  /\bestimate\b/i,
  /\bquote\b/i,
  /\bcost\b/i,
  /\bprice\b/i,
  /\$\s*\d+/,
  /\brate\b/i,
  /\bcharging\b/i,
  /\bwhat\s+do\s+you\s+charge\b/i,
  /\bbudget\b/i,
  /\bpay\b/i,
];

export function detectTimeCue(text: string): string | null {
  for (const pattern of TIME_CUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

export function detectPriceCue(text: string): string | null {
  for (const pattern of PRICE_CUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

export async function detectIntentFromInboundMessage(
  userId: string, 
  entityType: "lead" | "job",
  entityId: string,
  messageText: string
): Promise<IntentSignal | null> {
  const now = new Date().toISOString();
  
  const timeCue = detectTimeCue(messageText);
  if (timeCue) {
    return storage.createIntentSignal({
      userId,
      entityType,
      entityId,
      signalType: "time_cue",
      triggerText: timeCue,
      confidence: 0.85,
      detectedAt: now,
      createdAt: now,
    });
  }
  
  const priceCue = detectPriceCue(messageText);
  if (priceCue) {
    return storage.createIntentSignal({
      userId,
      entityType,
      entityId,
      signalType: "price_cue",
      triggerText: priceCue,
      confidence: 0.85,
      detectedAt: now,
      createdAt: now,
    });
  }
  
  return null;
}

export async function detectLeadStatusEngaged(
  userId: string,
  leadId: string
): Promise<IntentSignal> {
  const now = new Date().toISOString();
  return storage.createIntentSignal({
    userId,
    entityType: "lead",
    entityId: leadId,
    signalType: "status_engaged",
    triggerText: "Lead status changed to engaged",
    confidence: 0.9,
    detectedAt: now,
    createdAt: now,
  });
}

export async function detectJobCompleted(
  userId: string,
  jobId: string
): Promise<IntentSignal> {
  const now = new Date().toISOString();
  return storage.createIntentSignal({
    userId,
    entityType: "job",
    entityId: jobId,
    signalType: "job_completed",
    triggerText: "Job marked as completed",
    confidence: 0.95,
    detectedAt: now,
    createdAt: now,
  });
}

export async function detectMultipleResponds(
  userId: string,
  leadId: string,
  tapCount: number
): Promise<IntentSignal | null> {
  if (tapCount < 2) return null;
  
  const now = new Date().toISOString();
  return storage.createIntentSignal({
    userId,
    entityType: "lead",
    entityId: leadId,
    signalType: "multiple_responds",
    triggerText: `User tapped Respond ${tapCount} times`,
    confidence: 0.7 + Math.min(0.25, (tapCount - 2) * 0.05),
    detectedAt: now,
    createdAt: now,
  });
}

async function getLastJobPrice(userId: string): Promise<number | null> {
  const jobs = await storage.getJobs(userId);
  const completedJobs = jobs
    .filter(j => j.status === "completed" && j.price && j.price > 0)
    .sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt;
      const dateB = b.updatedAt || b.createdAt;
      return dateB.localeCompare(dateA);
    });
  
  if (completedJobs.length > 0) {
    return completedJobs[0].price!;
  }
  
  return null;
}

async function getAverageJobPrice(userId: string): Promise<number | null> {
  const jobs = await storage.getJobs(userId);
  const pricedJobs = jobs.filter(j => j.price && j.price > 0);
  
  if (pricedJobs.length === 0) return null;
  
  const total = pricedJobs.reduce((sum, j) => sum + (j.price || 0), 0);
  return Math.round(total / pricedJobs.length);
}

export async function generateReadyActionFromSignal(
  signal: IntentSignal
): Promise<ReadyAction | null> {
  const existingAction = await storage.getActiveReadyActionForEntity(
    signal.entityType,
    signal.entityId
  );
  
  if (existingAction) {
    return null;
  }
  
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * HOURS_IN_MS).toISOString();
  const dueDate = new Date(Date.now() + 7 * DAYS_IN_MS).toISOString().split('T')[0];
  
  let clientName: string | null = null;
  let clientEmail: string | null = null;
  let clientPhone: string | null = null;
  let serviceType: string | null = null;
  let description: string | null = null;
  let estimatedAmount: number | null = null;
  
  if (signal.entityType === "lead") {
    const lead = await storage.getLead(signal.entityId);
    if (!lead) return null;
    
    clientName = lead.clientName;
    clientEmail = lead.clientEmail;
    clientPhone = lead.clientPhone;
    serviceType = lead.serviceType;
    description = lead.description;
  } else if (signal.entityType === "job") {
    const job = await storage.getJob(signal.entityId);
    if (!job) return null;
    
    clientName = job.clientName;
    clientEmail = job.clientEmail;
    clientPhone = job.clientPhone;
    serviceType = job.serviceType;
    description = job.description;
    estimatedAmount = job.price;
  }
  
  if (!estimatedAmount) {
    estimatedAmount = await getLastJobPrice(signal.userId);
  }
  if (!estimatedAmount) {
    estimatedAmount = await getAverageJobPrice(signal.userId);
  }
  
  let headline = "This looks ready to turn into money.";
  let subtext = "Recommended next step: Send invoice + booking link";
  
  if (signal.signalType === "job_completed") {
    headline = "Job done. Time to get paid.";
    subtext = "Invoice ready to send with one tap.";
  } else if (signal.signalType === "price_cue") {
    headline = "They're asking about price.";
    subtext = "Send a quote and lock in the job.";
  } else if (signal.signalType === "time_cue") {
    headline = "They want to schedule.";
    subtext = "Send invoice with booking link.";
  } else if (signal.signalType === "multiple_responds") {
    headline = "You've been working this lead.";
    subtext = "Ready to close? Send invoice now.";
  }
  
  await storage.markIntentSignalProcessed(signal.id);
  
  return storage.createReadyAction({
    userId: signal.userId,
    intentSignalId: signal.id,
    entityType: signal.entityType,
    entityId: signal.entityId,
    actionType: "send_invoice",
    headline,
    subtext,
    ctaLabel: "Send & Get Paid",
    prefilledAmount: estimatedAmount,
    prefilledClientName: clientName,
    prefilledClientEmail: clientEmail,
    prefilledClientPhone: clientPhone,
    prefilledDueDate: dueDate,
    prefilledServiceType: serviceType,
    prefilledDescription: description,
    expiresAt,
    createdAt: now,
  });
}

export async function processUnprocessedSignals(): Promise<void> {
  console.log("[IntentDetection] Processing unprocessed signals...");
  
  try {
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      const signals = await storage.getUnprocessedIntentSignals(user.id);
      
      for (const signal of signals) {
        await generateReadyActionFromSignal(signal);
      }
    }
    
    console.log("[IntentDetection] Processing complete");
  } catch (error) {
    console.error("[IntentDetection] Error processing signals:", error);
  }
}

export async function runAutoFollowUp(): Promise<void> {
  console.log("[IntentDetection] Checking for auto-follow-up...");
  
  try {
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      const actions = await storage.getReadyActions(user.id);
      
      for (const action of actions) {
        if (action.autoFollowUpSent) continue;
        
        const createdAt = new Date(action.createdAt).getTime();
        const hoursSinceCreated = (Date.now() - createdAt) / HOURS_IN_MS;
        
        if (hoursSinceCreated >= 4 && hoursSinceCreated < 24) {
          console.log(`[IntentDetection] Would auto-send follow-up for ${action.entityType} ${action.entityId}`);
          await storage.markReadyActionFollowUpSent(action.id);
        }
      }
    }
    
    console.log("[IntentDetection] Auto-follow-up check complete");
  } catch (error) {
    console.error("[IntentDetection] Error during auto-follow-up:", error);
  }
}

let scanInterval: NodeJS.Timeout | null = null;

export function startIntentDetectionEngine(intervalMinutes: number = 5): void {
  console.log(`[IntentDetection] Starting with ${intervalMinutes} minute interval`);
  
  processUnprocessedSignals();
  
  const intervalMs = intervalMinutes * 60 * 1000;
  scanInterval = setInterval(() => {
    processUnprocessedSignals();
    runAutoFollowUp();
  }, intervalMs);
}

export function stopIntentDetectionEngine(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    console.log("[IntentDetection] Stopped");
  }
}
