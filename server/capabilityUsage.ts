import { storage } from "./storage";
import { shouldResetWindow } from "@shared/capabilities/usageTracking";
import type { Plan, Capability } from "@shared/capabilities/plans";
import type { CapabilityUsage } from "@shared/schema";

/**
 * Read a capability's usage and, if the rolling window has elapsed, reset
 * it to zero before returning. This makes monthly/weekly limits actually
 * roll over without needing a background job.
 */
export async function readCapabilityUsage(
  userId: string,
  plan: Plan,
  capability: Capability
): Promise<number> {
  const record = await storage.getCapabilityUsage(userId, capability);
  if (!record) return 0;
  if (shouldResetWindow(plan, capability, record.windowStart ?? undefined)) {
    await storage.resetCapabilityUsage(userId, capability);
    return 0;
  }
  return record.usageCount ?? 0;
}

/**
 * Read every capability usage record for a user, applying window resets
 * where appropriate. Returns a map of capability -> current usage count.
 */
export async function readAllCapabilityUsage(
  userId: string,
  plan: Plan
): Promise<Map<string, number>> {
  const all: CapabilityUsage[] = await storage.getAllCapabilityUsage(userId);
  const result = new Map<string, number>();
  for (const record of all) {
    if (
      shouldResetWindow(
        plan,
        record.capability as Capability,
        record.windowStart ?? undefined
      )
    ) {
      await storage.resetCapabilityUsage(userId, record.capability);
      result.set(record.capability, 0);
    } else {
      result.set(record.capability, record.usageCount ?? 0);
    }
  }
  return result;
}
