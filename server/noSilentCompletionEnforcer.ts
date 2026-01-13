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
 * Check if a job was completed more than the specified hours ago
 */
function completedMoreThanHoursAgo(job: Job, hours: number): boolean {
  // Jobs don't have a completedAt field, so we use updatedAt or createdAt as proxy
  // When status changes to completed, the job is updated
  const jobDate = job.createdAt;
  if (!jobDate) return false;
  
  const then = new Date(jobDate).getTime();
  const now = Date.now();
  return now - then >= hours * 60 * 60 * 1000;
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
 * Main enforcement function - finds and flags unresolved completed jobs
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

  // Get all users (we need to check each user's jobs)
  // For now, use demo-user since that's our primary user
  const userId = "demo-user";
  
  const allJobs = await storage.getJobs(userId);
  const completedJobs = allJobs.filter(j => j.status === "completed");
  
  let violations = 0;
  let nudgesCreated = 0;

  for (const job of completedJobs) {
    // Only enforce on jobs completed more than 24 hours ago
    // This gives users time to complete the flow naturally
    if (!completedMoreThanHoursAgo(job, 24)) {
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
    console.log(`[NoSilentCompletion] Violation found: Job ${job.id} (${job.title})`);

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

    await storage.createAiNudge(nudge);
    await storage.createAiNudgeEvent({
      nudgeId: nudge.dedupeKey!,
      userId,
      eventType: "created",
      eventAt: new Date().toISOString(),
    });
    
    nudgesCreated++;
    console.log(`[NoSilentCompletion] Created enforcement nudge for job ${job.id}`);
  }

  console.log(
    `[NoSilentCompletion] Check complete: ${completedJobs.length} completed jobs, ` +
    `${violations} violations, ${nudgesCreated} new nudges created`
  );

  return {
    checked: completedJobs.length,
    violations,
    nudgesCreated,
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
