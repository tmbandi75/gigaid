/**
 * No Silent Completion Background Enforcer
 * 
 * This scheduled task is a SAFETY NET for the No Silent Completion feature.
 * It catches any completed jobs that somehow slipped through without a resolution
 * (e.g., due to race conditions, API bypass, or legacy data).
 * 
 * Runs hourly and generates HIGH-PRIORITY, NON-DISMISSABLE nudges for:
 * - Jobs with status = 'completed'
 * - Completed over 24 hours ago
 * - No job_resolution record exists
 * 
 * These nudges have priority 100 and cannot be dismissed - user MUST resolve.
 */

import { storage } from "./storage";
import type { Job, InsertAiNudge } from "@shared/schema";

const NUDGE_TYPE = "job_unresolved_payment";
const NUDGE_PRIORITY = 100; // Maximum priority - cannot be bypassed

/**
 * Check if a job qualifies for background enforcement
 * 
 * IMPORTANT: The background enforcer is a SAFETY NET for legacy data and edge cases.
 * The UI modal and API guard handle new completions in real-time.
 * 
 * We use the authoritative completedAt timestamp when available:
 * 1. If completedAt exists, check if it's more than 24 hours ago
 * 2. For legacy jobs without completedAt, use conservative heuristics
 * 
 * This ensures we only enforce on truly stale unresolved jobs.
 */
function shouldEnforceJob(job: Job): boolean {
  const now = Date.now();
  const GRACE_PERIOD_HOURS = 24;
  const msInHour = 60 * 60 * 1000;
  
  // BEST CASE: We have the authoritative completedAt timestamp
  if (job.completedAt) {
    const completedTime = new Date(job.completedAt).getTime();
    const hoursSinceCompleted = (now - completedTime) / msInHour;
    return hoursSinceCompleted >= GRACE_PERIOD_HOURS;
  }
  
  // FALLBACK for legacy jobs without completedAt:
  // Use very conservative heuristics to avoid false positives
  // 
  // IMPORTANT: Jobs without completedAt are legacy data. We must ensure they
  // have been in completed state long enough before enforcement.
  
  // If paidAt is recent (within 48h for legacy jobs), skip - might have just been completed
  if (job.paidAt) {
    const paidTime = new Date(job.paidAt).getTime();
    const hoursSincePaid = (now - paidTime) / msInHour;
    // Use 48h for legacy jobs since paidAt might be close to actual completion
    if (hoursSincePaid < GRACE_PERIOD_HOURS * 2) {
      return false;
    }
  }
  
  // For legacy jobs without completedAt: require ALL of the following:
  // 1. Created more than 72 hours ago (extra buffer for safety)
  // 2. Scheduled date in the past by at least 48h
  // This is VERY conservative to avoid false positives on legacy data
  const LEGACY_BUFFER_HOURS = 72;
  
  const createdTime = job.createdAt ? new Date(job.createdAt).getTime() : now;
  const hoursSinceCreation = (now - createdTime) / msInHour;
  
  if (hoursSinceCreation < LEGACY_BUFFER_HOURS) {
    return false;
  }
  
  // Must have a valid scheduled date that's in the past by at least 48h
  if (!job.scheduledDate) {
    // No scheduled date - can't determine completion timing, skip
    return false;
  }
  
  try {
    const scheduledTime = new Date(job.scheduledDate).getTime();
    const hoursSinceScheduled = (now - scheduledTime) / msInHour;
    if (hoursSinceScheduled < GRACE_PERIOD_HOURS * 2) {
      return false;
    }
  } catch {
    // Invalid date - be extra conservative and skip
    return false;
  }
  
  return true;
}

/**
 * Generate enforcement nudge for an unresolved completed job
 */
function createUnresolvedPaymentNudge(job: Job, userId: string): InsertAiNudge {
  const today = new Date().toISOString().split("T")[0];
  const dedupeKey = `${userId}:job:${job.id}:${NUDGE_TYPE}:${today}`;
  
  const priceStr = job.price ? `$${(job.price / 100).toFixed(0)}` : "Unknown";
  
  return {
    userId,
    entityType: "job",
    entityId: job.id,
    nudgeType: NUDGE_TYPE,
    priority: NUDGE_PRIORITY,
    status: "active",
    createdAt: new Date().toISOString(),
    explainText: `${priceStr} job completed but unresolved. Choose: invoice, record payment, or waive.`,
    actionPayload: JSON.stringify({
      jobId: job.id,
      jobTitle: job.title,
      clientName: job.clientName,
      clientPhone: job.clientPhone,
      price: job.price,
      serviceType: job.serviceType,
      // Mark this nudge as non-dismissable
      dismissable: false,
      // Actions user can take
      actions: [
        { type: "create_invoice", label: "Create Invoice" },
        { type: "mark_paid", label: "Mark as Paid" },
        { type: "waive", label: "No Invoice Needed" },
      ],
    }),
    dedupeKey,
    confidence: 100,
  };
}

/**
 * Check a single user's completed jobs for violations
 */
async function enforceForUser(userId: string): Promise<{
  checked: number;
  violations: number;
  nudgesCreated: number;
}> {
  const allJobs = await storage.getJobs(userId);
  const completedJobs = allJobs.filter(j => j.status === "completed");
  
  let violations = 0;
  let nudgesCreated = 0;

  for (const job of completedJobs) {
    // Only enforce on jobs that meet our conservative criteria
    // This gives users time to complete the flow naturally
    if (!shouldEnforceJob(job)) {
      continue;
    }

    // Check if resolution exists
    const resolution = await storage.getJobResolution(job.id);
    if (resolution) {
      // Job is properly resolved - no action needed
      continue;
    }

    // VIOLATION: Completed job without resolution
    violations++;
    console.log(`[NoSilentCompletion] Violation found: Job ${job.id} (${job.title}) for user ${userId}`);

    // Check if we already have an active nudge for this job
    const existingNudges = await storage.getAiNudgesByEntity("job", job.id);
    const activeUnresolvedNudge = existingNudges.find(
      n => n.nudgeType === NUDGE_TYPE && n.status === "active"
    );

    if (activeUnresolvedNudge) {
      // Already has an active nudge - skip
      continue;
    }

    // Create enforcement nudge
    const nudge = createUnresolvedPaymentNudge(job, userId);
    
    // Check for existing nudge with same dedupe key
    const existingByDedupe = await storage.getAiNudgeByDedupeKey(nudge.dedupeKey!);
    if (existingByDedupe) {
      continue;
    }

    const createdNudge = await storage.createAiNudge(nudge);
    await storage.createAiNudgeEvent({
      nudgeId: createdNudge.id,
      userId,
      eventType: "created",
      eventAt: new Date().toISOString(),
    });
    
    nudgesCreated++;
    console.log(`[NoSilentCompletion] Created enforcement nudge for job ${job.id}`);
  }

  return { checked: completedJobs.length, violations, nudgesCreated };
}

/**
 * Main enforcement function - finds and flags unresolved completed jobs for all users
 */
export async function enforceNoSilentCompletion(): Promise<{
  checked: number;
  violations: number;
  nudgesCreated: number;
}> {
  // Check if feature flag is enabled
  const featureFlag = await storage.getFeatureFlag("enforce_no_silent_completion");
  if (!featureFlag?.enabled) {
    console.log("[NoSilentCompletion] Feature flag is OFF - skipping enforcement");
    return { checked: 0, violations: 0, nudgesCreated: 0 };
  }

  console.log("[NoSilentCompletion] Running background enforcement check...");

  // Get all users and check each user's jobs
  const allUsers = await storage.getAllUsers();
  
  let totalChecked = 0;
  let totalViolations = 0;
  let totalNudgesCreated = 0;

  for (const user of allUsers) {
    const result = await enforceForUser(user.id);
    totalChecked += result.checked;
    totalViolations += result.violations;
    totalNudgesCreated += result.nudgesCreated;
  }

  console.log(
    `[NoSilentCompletion] Check complete: ${allUsers.length} users, ${totalChecked} completed jobs, ` +
    `${totalViolations} violations, ${totalNudgesCreated} new nudges created`
  );

  return {
    checked: totalChecked,
    violations: totalViolations,
    nudgesCreated: totalNudgesCreated,
  };
}

/**
 * Start the hourly enforcement scheduler
 */
export function startNoSilentCompletionScheduler(): void {
  const HOUR_MS = 60 * 60 * 1000;
  
  console.log("[NoSilentCompletion] Starting background enforcement scheduler (runs hourly)");
  
  // Run immediately on startup
  setTimeout(() => {
    enforceNoSilentCompletion().catch(err => {
      console.error("[NoSilentCompletion] Error in enforcement check:", err);
    });
  }, 5000); // Wait 5 seconds after startup
  
  // Then run every hour
  setInterval(() => {
    enforceNoSilentCompletion().catch(err => {
      console.error("[NoSilentCompletion] Error in enforcement check:", err);
    });
  }, HOUR_MS);
}
