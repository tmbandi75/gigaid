import { storage } from "./storage";
import type { 
  Lead, Job, Invoice, User,
  StallDetection, InsertStallDetection,
  NextAction, InsertNextAction,
  StallType, StallEntityType, NextActionType
} from "@shared/schema";

// ============================================================
// NEXT BEST ACTION ENGINE - v1
// Detects stalls, generates one recommended action, executes with restraint
// ============================================================

const HOURS_IN_MS = 60 * 60 * 1000;

// Stall detection thresholds (in hours)
const STALL_THRESHOLDS = {
  lead: {
    noResponseHours: 24,
    viewedNoResponseHours: 12,
  },
  job: {
    overdueHours: 2,
  },
  invoice: {
    draftAgingHours: 24,
    sentUnpaidHours: 72,
    viewedUnpaidHours: 24,
  },
};

// Action expiry (24 hours for most recommendations)
const ACTION_EXPIRY_HOURS = 24;

// Auto-execution constraints
const AUTO_EXECUTION = {
  cooldownHours: 48, // Max 1 auto message per entity per 48 hours
  userInactivityHours: 6, // Only auto-execute if user hasn't acted in 6 hours
};

interface StallCandidate {
  entityType: StallEntityType;
  entityId: string;
  userId: string;
  stallType: StallType;
  moneyAtRisk: number;
  confidence: number;
}

interface ActionRecommendation {
  recommendedAction: NextActionType;
  reason: string;
  autoExecutable: boolean;
}

// ============================================================
// STEP 1: STALL DETECTION
// ============================================================

export async function detectLeadStalls(leads: Lead[]): Promise<StallCandidate[]> {
  const now = Date.now();
  const candidates: StallCandidate[] = [];

  for (const lead of leads) {
    // Skip leads that are already converted, cold, or lost
    if (lead.status === "cold" || lead.status === "lost" || lead.convertedAt) {
      continue;
    }

    // Check for stall conditions
    const createdAt = new Date(lead.createdAt).getTime();
    const lastContactedAt = lead.lastContactedAt ? new Date(lead.lastContactedAt).getTime() : null;
    const responseCopiedAt = lead.responseCopiedAt ? new Date(lead.responseCopiedAt).getTime() : null;

    // Lead is new or contacted, no outbound action in 24 hours
    if (lead.status === "new" || lead.status === "response_sent") {
      const lastActionTime = lastContactedAt || responseCopiedAt || createdAt;
      const hoursSinceAction = (now - lastActionTime) / HOURS_IN_MS;

      if (hoursSinceAction >= STALL_THRESHOLDS.lead.noResponseHours) {
        candidates.push({
          entityType: "lead",
          entityId: lead.id,
          userId: lead.userId,
          stallType: "no_response",
          moneyAtRisk: 0, // Leads don't have direct $ value yet
          confidence: Math.min(0.9, 0.5 + (hoursSinceAction / 48) * 0.4),
        });
      }
    }
  }

  return candidates;
}

export async function detectJobStalls(jobs: Job[]): Promise<StallCandidate[]> {
  const now = Date.now();
  const candidates: StallCandidate[] = [];

  for (const job of jobs) {
    // Only check scheduled jobs that haven't been updated
    if (job.status !== "scheduled") {
      continue;
    }

    // Parse scheduled date and time
    const scheduledDateTime = parseScheduledDateTime(job.scheduledDate, job.scheduledTime);
    if (!scheduledDateTime) continue;

    const hoursSinceScheduled = (now - scheduledDateTime) / HOURS_IN_MS;

    // Job is overdue (scheduled time passed by 2+ hours, no status update)
    if (hoursSinceScheduled >= STALL_THRESHOLDS.job.overdueHours) {
      candidates.push({
        entityType: "job",
        entityId: job.id,
        userId: job.userId,
        stallType: "overdue",
        moneyAtRisk: job.price || 0,
        confidence: Math.min(0.95, 0.6 + (hoursSinceScheduled / 24) * 0.35),
      });
    }
  }

  return candidates;
}

export async function detectInvoiceStalls(invoices: Invoice[]): Promise<StallCandidate[]> {
  const now = Date.now();
  const candidates: StallCandidate[] = [];

  for (const invoice of invoices) {
    // Skip paid invoices
    if (invoice.status === "paid") {
      continue;
    }

    const createdAt = new Date(invoice.createdAt).getTime();
    const sentAt = invoice.sentAt ? new Date(invoice.sentAt).getTime() : null;

    // Draft invoices aging (created > 24 hours ago, still draft)
    if (invoice.status === "draft") {
      const hoursSinceCreated = (now - createdAt) / HOURS_IN_MS;
      if (hoursSinceCreated >= STALL_THRESHOLDS.invoice.draftAgingHours) {
        candidates.push({
          entityType: "invoice",
          entityId: invoice.id,
          userId: invoice.userId,
          stallType: "draft_aging",
          moneyAtRisk: invoice.amount || 0,
          confidence: Math.min(0.85, 0.5 + (hoursSinceCreated / 72) * 0.35),
        });
      }
    }

    // Sent invoices unpaid (sent > 72 hours ago)
    if (invoice.status === "sent" && sentAt) {
      const hoursSinceSent = (now - sentAt) / HOURS_IN_MS;
      if (hoursSinceSent >= STALL_THRESHOLDS.invoice.sentUnpaidHours) {
        candidates.push({
          entityType: "invoice",
          entityId: invoice.id,
          userId: invoice.userId,
          stallType: "idle",
          moneyAtRisk: invoice.amount || 0,
          confidence: Math.min(0.9, 0.6 + (hoursSinceSent / 168) * 0.3),
        });
      }
    }
  }

  return candidates;
}

// ============================================================
// STEP 2: ACTION GENERATION
// Priority: Recover money > Advance commitment > Reduce uncertainty > No action
// ============================================================

function generateActionForStall(stall: StallCandidate): ActionRecommendation {
  switch (stall.entityType) {
    case "invoice":
      return generateInvoiceAction(stall);
    case "job":
      return generateJobAction(stall);
    case "lead":
      return generateLeadAction(stall);
    default:
      return { recommendedAction: "no_action", reason: "No action needed", autoExecutable: false };
  }
}

function generateInvoiceAction(stall: StallCandidate): ActionRecommendation {
  switch (stall.stallType) {
    case "draft_aging":
      return {
        recommendedAction: "send_invoice_reminder",
        reason: "Draft invoice over 24h old. Ready to send?",
        autoExecutable: false,
      };
    case "idle":
      return {
        recommendedAction: "send_invoice_reminder",
        reason: "Invoice unpaid for 3+ days. Send reminder?",
        autoExecutable: true, // Can auto-send gentle reminder
      };
    case "viewed_unpaid":
      return {
        recommendedAction: "auto_send_gentle_nudge",
        reason: "Invoice viewed but unpaid. Gentle nudge?",
        autoExecutable: true,
      };
    default:
      return { recommendedAction: "no_action", reason: "No action needed", autoExecutable: false };
  }
}

function generateJobAction(stall: StallCandidate): ActionRecommendation {
  if (stall.stallType === "overdue") {
    return {
      recommendedAction: "suggest_status_update",
      reason: "Job started? Update status to track progress.",
      autoExecutable: false,
    };
  }
  return { recommendedAction: "no_action", reason: "No action needed", autoExecutable: false };
}

function generateLeadAction(stall: StallCandidate): ActionRecommendation {
  if (stall.stallType === "no_response") {
    return {
      recommendedAction: "send_follow_up_text",
      reason: "Lead idle 24h+. Follow up to close?",
      autoExecutable: false, // Don't auto-send to new leads
    };
  }
  return { recommendedAction: "no_action", reason: "No action needed", autoExecutable: false };
}

// ============================================================
// STEP 3: ORCHESTRATION
// ============================================================

export async function runStallDetection(): Promise<void> {
  console.log("[NextBestActionEngine] Starting stall detection scan...");
  
  try {
    // Get all users
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      await detectStallsForUser(user);
    }
    
    console.log("[NextBestActionEngine] Stall detection scan complete");
  } catch (error) {
    console.error("[NextBestActionEngine] Error during stall detection:", error);
  }
}

async function detectStallsForUser(user: User): Promise<void> {
  const userId = user.id;
  
  // Fetch user's data
  const [userLeads, userJobs, userInvoices] = await Promise.all([
    storage.getLeads(userId),
    storage.getJobs(userId),
    storage.getInvoices(userId),
  ]);
  
  // Detect stalls across all entity types
  const [leadStalls, jobStalls, invoiceStalls] = await Promise.all([
    detectLeadStalls(userLeads),
    detectJobStalls(userJobs),
    detectInvoiceStalls(userInvoices),
  ]);
  
  const allStalls = [...leadStalls, ...jobStalls, ...invoiceStalls];
  
  // Process each stall candidate
  for (const stallCandidate of allStalls) {
    await processStallCandidate(stallCandidate);
  }
}

async function processStallCandidate(candidate: StallCandidate): Promise<void> {
  // Check if there's already an active stall for this entity
  const existingStall = await storage.getActiveStallForEntity(
    candidate.entityType, 
    candidate.entityId
  );
  
  // Check if there's already an active action for this entity
  const existingAction = await storage.getActiveNextActionForEntity(
    candidate.entityType,
    candidate.entityId
  );
  
  // Skip if we already have an active recommendation
  if (existingAction) {
    return;
  }
  
  let stallDetection: StallDetection;
  
  if (existingStall) {
    // Update existing stall detection
    stallDetection = existingStall;
    await storage.updateStallDetection(existingStall.id, {
      confidence: candidate.confidence,
      moneyAtRisk: candidate.moneyAtRisk,
    });
  } else {
    // Create new stall detection
    const now = new Date().toISOString();
    stallDetection = await storage.createStallDetection({
      userId: candidate.userId,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      stallType: candidate.stallType,
      moneyAtRisk: candidate.moneyAtRisk,
      confidence: candidate.confidence,
      detectedAt: now,
      createdAt: now,
    });
  }
  
  // Generate action recommendation
  const actionRec = generateActionForStall(candidate);
  
  // Skip if no action recommended
  if (actionRec.recommendedAction === "no_action") {
    return;
  }
  
  // Create the next action
  const expiresAt = new Date(Date.now() + ACTION_EXPIRY_HOURS * HOURS_IN_MS).toISOString();
  const now = new Date().toISOString();
  
  await storage.createNextAction({
    userId: candidate.userId,
    stallDetectionId: stallDetection.id,
    entityType: candidate.entityType,
    entityId: candidate.entityId,
    recommendedAction: actionRec.recommendedAction,
    reason: actionRec.reason,
    autoExecutable: actionRec.autoExecutable,
    expiresAt,
    createdAt: now,
  });
}

// ============================================================
// AUTO-EXECUTION (STEP 3 - Execute with Restraint)
// ============================================================

export async function runAutoExecution(): Promise<void> {
  console.log("[NextBestActionEngine] Starting auto-execution check...");
  
  try {
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      await checkAutoExecutionForUser(user);
    }
    
    console.log("[NextBestActionEngine] Auto-execution check complete");
  } catch (error) {
    console.error("[NextBestActionEngine] Error during auto-execution:", error);
  }
}

async function checkAutoExecutionForUser(user: User): Promise<void> {
  // Check user's last activity
  const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  const hoursSinceActive = (Date.now() - lastActiveAt) / HOURS_IN_MS;
  
  // Only auto-execute if user hasn't been active in 6 hours
  if (hoursSinceActive < AUTO_EXECUTION.userInactivityHours) {
    return;
  }
  
  // Get all auto-executable actions for this user
  const actions = await storage.getNextActions(user.id);
  const autoExecutableActions = actions.filter(a => a.autoExecutable);
  
  for (const action of autoExecutableActions) {
    await attemptAutoExecution(action, user);
  }
}

async function attemptAutoExecution(action: NextAction, user: User): Promise<void> {
  // Check cooldown - no more than 1 auto message per entity per 48 hours
  const lastExecution = await storage.getLastAutoExecutionForEntity(
    action.entityType,
    action.entityId
  );
  
  if (lastExecution) {
    const hoursSinceExecution = (Date.now() - new Date(lastExecution.executedAt).getTime()) / HOURS_IN_MS;
    if (hoursSinceExecution < AUTO_EXECUTION.cooldownHours) {
      return; // Still in cooldown
    }
  }
  
  // Execute based on action type
  // For now, we'll just mark it as auto-executed and log
  // In a full implementation, this would send SMS/email
  console.log(`[NextBestActionEngine] Would auto-execute: ${action.recommendedAction} for ${action.entityType} ${action.entityId}`);
  
  // Mark action as auto-executed
  await storage.updateNextAction(action.id, {
    autoExecutedAt: new Date().toISOString(),
  });
  
  // Log the execution
  await storage.createAutoExecutionLog({
    userId: user.id,
    nextActionId: action.id,
    entityType: action.entityType,
    entityId: action.entityId,
    actionType: action.recommendedAction,
    messageContent: null, // Would contain actual message content
    deliveryChannel: null, // Would be 'sms' or 'email'
    executedAt: new Date().toISOString(),
    success: true,
  });
}

// ============================================================
// SCHEDULER
// ============================================================

let scanInterval: NodeJS.Timeout | null = null;

export function startNextBestActionEngine(intervalMinutes: number = 15): void {
  console.log(`[NextBestActionEngine] Starting with ${intervalMinutes} minute interval`);
  
  // Run immediately on start
  runStallDetection();
  runAutoExecution();
  
  // Schedule recurring runs
  const intervalMs = intervalMinutes * 60 * 1000;
  scanInterval = setInterval(() => {
    runStallDetection();
    runAutoExecution();
  }, intervalMs);
}

export function stopNextBestActionEngine(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    console.log("[NextBestActionEngine] Stopped");
  }
}

// ============================================================
// HELPERS
// ============================================================

function parseScheduledDateTime(dateStr: string, timeStr: string): number | null {
  try {
    // Handle various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    // Parse time (expecting "HH:MM" or "HH:MM AM/PM")
    const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeParts) return null;
    
    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const ampm = timeParts[3]?.toUpperCase();
    
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  } catch {
    return null;
  }
}

// ============================================================
// API HELPERS (for routes.ts)
// ============================================================

export async function getNextActionsForUser(userId: string): Promise<NextAction[]> {
  return storage.getNextActions(userId);
}

export async function actOnAction(actionId: string): Promise<NextAction | undefined> {
  const action = await storage.getNextAction(actionId);
  if (!action) return undefined;
  
  // Mark the action as acted upon
  const updatedAction = await storage.actOnNextAction(actionId);
  
  // Resolve the associated stall
  if (action.stallDetectionId) {
    await storage.resolveStallDetection(action.stallDetectionId);
  }
  
  return updatedAction;
}

export async function dismissAction(actionId: string): Promise<NextAction | undefined> {
  return storage.dismissNextAction(actionId);
}
