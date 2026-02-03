import { storage } from "./storage";

/**
 * Account Deletion Scheduler
 * 
 * Handles the multi-stage account deletion process:
 * - Day 0-30: Account disabled, data hidden but recoverable
 * - Day 30-150: Account archived, minimal data retained
 * - Day 150+: Permanent deletion
 * 
 * Runs daily to check for accounts that need to progress to the next stage.
 */

async function processAccountDeletions() {
  try {
    console.log("[AccountDeletion] Checking for accounts to process...");
    
    const now = new Date();
    
    // Get all users with pending_deletion status
    const users = await storage.getAllUsers();
    const pendingDeletionUsers = users.filter(
      (u) => u.accountStatus === "pending_deletion" && u.scheduledDeletionAt
    );
    
    if (pendingDeletionUsers.length === 0) {
      console.log("[AccountDeletion] No accounts pending deletion");
      return;
    }

    console.log(`[AccountDeletion] Found ${pendingDeletionUsers.length} accounts pending deletion`);

    for (const user of pendingDeletionUsers) {
      try {
        // scheduledDeletionAt is set to cancellationRequestedAt + 30 days
        // So scheduledDeletionAt represents the end of the 30-day recovery window
        const scheduledDate = new Date(user.scheduledDeletionAt!);
        const cancellationDate = user.cancellationRequestedAt 
          ? new Date(user.cancellationRequestedAt)
          : new Date(scheduledDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const daysSinceCancellation = Math.floor(
          (now.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Timeline:
        // Day 0-30: Recovery window (user can undo, account disabled)
        // Day 30-150: Archive period (data retained but account inaccessible)
        // Day 150+: Permanent deletion

        if (daysSinceCancellation < 30) {
          // Still in recovery window - no action needed
          console.log(
            `[AccountDeletion] User ${user.id} is in recovery window (day ${daysSinceCancellation}/30)`
          );
        } else if (daysSinceCancellation < 150) {
          // In archive period - data retained, account inaccessible
          console.log(
            `[AccountDeletion] User ${user.id} is in archive period (day ${daysSinceCancellation}/150)`
          );
        } else {
          // Past 150 days - mark for permanent deletion
          console.log(
            `[AccountDeletion] User ${user.id} is past 150-day retention (day ${daysSinceCancellation}). Marking as deleted.`
          );
          
          // Update status to deleted - actual data purge is a separate, careful operation
          await storage.updateUser(user.id, {
            accountStatus: "deleted",
            deletedAt: now.toISOString(),
          });
          
          console.log(`[AccountDeletion] User ${user.id} marked as deleted`);
        }
      } catch (error) {
        console.error(`[AccountDeletion] Error processing user ${user.id}:`, error);
      }
    }

    console.log("[AccountDeletion] Processing complete");
  } catch (error) {
    console.error("[AccountDeletion] Error in scheduler:", error);
  }
}

export function startAccountDeletionScheduler() {
  console.log("[AccountDeletion] Starting account deletion scheduler (checks daily at midnight)");
  
  // Run immediately on startup
  processAccountDeletions();
  
  // Run daily at midnight UTC
  const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(processAccountDeletions, checkInterval);
}
