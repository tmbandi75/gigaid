import {
  calculateExpectedDeposits,
  calculateStripeCharges,
  calculateExpectedTransfers,
  calculateStripeTransfers,
  calculateActiveSubscriptions,
  calculateEntitledPaidUsers,
} from "./reconciliationService";
import { db } from "../db";
import { revenueDriftLogs } from "@shared/schema";
import type { RevenueDriftStatus } from "@shared/schema";
import { logger } from "../lib/logger";

export interface DriftMetric {
  expected: number;
  actual: number;
  delta: number;
}

export interface DriftCheckResult {
  deposits: DriftMetric;
  transfers: DriftMetric;
  subscriptions: DriftMetric;
  status: RevenueDriftStatus;
  ranAt: string;
  startDate: string;
  endDate: string;
}

function classifyDelta(expected: number, actual: number): RevenueDriftStatus {
  if (expected === 0 && actual === 0) return "ok";
  const delta = Math.abs(expected - actual);
  if (delta === 0) return "ok";
  const pct = expected > 0 ? delta / expected : 1;
  if (pct < 0.01) return "warning";
  return "critical";
}

function worstStatus(...statuses: RevenueDriftStatus[]): RevenueDriftStatus {
  if (statuses.includes("critical")) return "critical";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}

export async function runRevenueDriftCheck(
  startDate: string,
  endDate: string,
  triggeredBy: string = "manual"
): Promise<DriftCheckResult> {
  const [expectedDeposits, actualCharges, expectedTransfers, actualTransfers, activeSubscriptions, entitledPaidUsers] =
    await Promise.all([
      calculateExpectedDeposits(startDate, endDate),
      calculateStripeCharges(startDate, endDate),
      calculateExpectedTransfers(startDate, endDate),
      calculateStripeTransfers(startDate, endDate),
      calculateActiveSubscriptions(),
      calculateEntitledPaidUsers(),
    ]);

  const deposits: DriftMetric = {
    expected: expectedDeposits.count,
    actual: actualCharges.count,
    delta: expectedDeposits.count - actualCharges.count,
  };

  const transfers: DriftMetric = {
    expected: expectedTransfers.count,
    actual: actualTransfers.count,
    delta: expectedTransfers.count - actualTransfers.count,
  };

  const subscriptions: DriftMetric = {
    expected: activeSubscriptions.count,
    actual: entitledPaidUsers.count,
    delta: activeSubscriptions.count - entitledPaidUsers.count,
  };

  const depositStatus = classifyDelta(deposits.expected, deposits.actual);
  const transferStatus = classifyDelta(transfers.expected, transfers.actual);
  const subscriptionStatus = classifyDelta(subscriptions.expected, subscriptions.actual);
  const overallStatus = worstStatus(depositStatus, transferStatus, subscriptionStatus);

  const ranAt = new Date().toISOString();

  const result: DriftCheckResult = {
    deposits,
    transfers,
    subscriptions,
    status: overallStatus,
    ranAt,
    startDate,
    endDate,
  };

  try {
    await db.insert(revenueDriftLogs).values({
      ranAt,
      startDate,
      endDate,
      status: overallStatus,
      depositsExpected: deposits.expected,
      depositsActual: deposits.actual,
      depositsDelta: deposits.delta,
      transfersExpected: transfers.expected,
      transfersActual: transfers.actual,
      transfersDelta: transfers.delta,
      subscriptionsExpected: subscriptions.expected,
      subscriptionsActual: subscriptions.actual,
      subscriptionsDelta: subscriptions.delta,
      triggeredBy,
      details: JSON.stringify({
        depositStatus,
        transferStatus,
        subscriptionStatus,
        depositsAmountExpected: expectedDeposits.totalCents,
        depositsAmountActual: actualCharges.totalCents,
        transfersAmountExpected: expectedTransfers.totalCents,
        transfersAmountActual: actualTransfers.totalCents,
      }),
    });
  } catch (err) {
    logger.error("[DriftDetector] Failed to persist drift log:", err);
  }

  if (overallStatus === "critical") {
    logger.error(
      `[DriftDetector] CRITICAL revenue drift detected:`,
      JSON.stringify(result, null, 2)
    );
    // TODO: Hook for Slack/Email alert
    // Example: await sendSlackAlert({ channel: "#revenue-alerts", ...result });
    // Example: await sendEmailAlert({ to: "finance@gigaid.ai", ...result });
  } else if (overallStatus === "warning") {
    logger.warn(
      `[DriftDetector] Revenue drift warning:`,
      JSON.stringify(result, null, 2)
    );
  }

  return result;
}

// Scheduled job stub
// If the project adds a job scheduler (e.g., node-cron, bull), register like:
//
// import cron from "node-cron";
// cron.schedule("0 0 * * *", async () => {
//   const endDate = new Date().toISOString();
//   const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
//   await runRevenueDriftCheck(startDate, endDate, "scheduled");
// });
