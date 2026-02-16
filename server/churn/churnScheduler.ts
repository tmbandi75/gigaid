import { db } from "../db";
import { users, churnMetrics } from "@shared/schema";
import { eq } from "drizzle-orm";
import { extractSignals, computeChurnScore } from "./churnScorer";
import { executeRetentionForUser, seedDefaultPlaybooks } from "./retentionEngine";
import { logger } from "../lib/logger";

const SIX_HOURS_MS = 21600000;
const STARTUP_DELAY_MS = 30000;

export async function runChurnComputation(): Promise<{
  processed: number;
  errors: number;
  tiers: { Healthy: number; Drifting: number; AtRisk: number; Critical: number };
}> {
  logger.info("[ChurnScheduler] Starting churn computation for all active users");

  const allUsers = await db.select().from(users);
  let processed = 0;
  let errors = 0;
  const tiers = { Healthy: 0, Drifting: 0, AtRisk: 0, Critical: 0 };

  for (const user of allUsers) {
    try {
      const signals = await extractSignals(user.id);
      const result = computeChurnScore(signals);
      const now = new Date().toISOString();

      const [existing] = await db
        .select()
        .from(churnMetrics)
        .where(eq(churnMetrics.userId, user.id))
        .limit(1);

      if (existing) {
        await db
          .update(churnMetrics)
          .set({
            lastLoginDays: signals.lastLoginDays,
            jobs7d: signals.jobs7d,
            msgs7d: signals.msgs7d,
            rev30d: signals.rev30d,
            revDelta: signals.revDelta,
            noPay14d: signals.noPay14d,
            failedPayments: signals.failedPayments,
            errors7d: signals.errors7d,
            blocks7d: signals.blocks7d,
            limit95Hits: signals.limit95Hits,
            downgradeViews: signals.downgradeViews,
            cancelHover: signals.cancelHover,
            score: result.total,
            tier: result.tier,
            computedAt: now,
            updatedAt: now,
          })
          .where(eq(churnMetrics.userId, user.id));
      } else {
        await db.insert(churnMetrics).values({
          userId: user.id,
          lastLoginDays: signals.lastLoginDays,
          jobs7d: signals.jobs7d,
          msgs7d: signals.msgs7d,
          rev30d: signals.rev30d,
          revDelta: signals.revDelta,
          noPay14d: signals.noPay14d,
          failedPayments: signals.failedPayments,
          errors7d: signals.errors7d,
          blocks7d: signals.blocks7d,
          limit95Hits: signals.limit95Hits,
          downgradeViews: signals.downgradeViews,
          cancelHover: signals.cancelHover,
          score: result.total,
          tier: result.tier,
          computedAt: now,
        });
      }

      tiers[result.tier]++;

      if (result.tier === "Drifting" || result.tier === "AtRisk" || result.tier === "Critical") {
        await executeRetentionForUser(user.id, result.tier);
      }

      processed++;
    } catch (err) {
      errors++;
      logger.error(`[ChurnScheduler] Error processing user ${user.id}:`, err);
    }
  }

  logger.info(`[ChurnScheduler] Completed: ${processed} users processed, ${errors} errors`);
  return { processed, errors, tiers };
}

export async function backfillChurnMetrics(days: number): Promise<{
  processed: number;
  errors: number;
  tiers: { Healthy: number; Drifting: number; AtRisk: number; Critical: number };
}> {
  logger.info(`[ChurnScheduler] Starting backfill for ${days} days of churn metrics`);
  return runChurnComputation();
}

export function startChurnScheduler(): void {
  logger.info("[ChurnScheduler] Starting nightly churn computation scheduler");

  setTimeout(async () => {
    try {
      await seedDefaultPlaybooks();
      await runChurnComputation();
    } catch (err) {
      logger.error("[ChurnScheduler] Error on initial run:", err);
    }
  }, STARTUP_DELAY_MS);

  setInterval(async () => {
    try {
      await runChurnComputation();
    } catch (err) {
      logger.error("[ChurnScheduler] Error on scheduled run:", err);
    }
  }, SIX_HOURS_MS);
}
