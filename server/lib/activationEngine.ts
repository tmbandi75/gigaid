import { db } from "../db";
import { users, invoices } from "@shared/schema";
import { eq, count, inArray, and } from "drizzle-orm";
import { storage } from "../storage";
import { markReferralActivated } from "./growth/referralService";

export interface ActivationStatus {
  servicesDone: boolean;
  pricingDone: boolean;
  paymentsDone: boolean;
  linkDone: boolean;
  quoteDone: boolean;
  completedAt: string | null;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  isFullyActivated: boolean;
}

const TOTAL_STEPS = 5;

export async function evaluateAndUpdateActivation(userId: string): Promise<ActivationStatus> {
  const user = await storage.getUser(userId);
  if (!user) {
    return {
      servicesDone: false,
      pricingDone: false,
      paymentsDone: false,
      linkDone: false,
      quoteDone: false,
      completedAt: null,
      completedSteps: 0,
      totalSteps: TOTAL_STEPS,
      percentComplete: 0,
      isFullyActivated: false,
    };
  }

  const servicesDone = Array.isArray(user.services) && user.services.length >= 1;
  const pricingDone = typeof user.defaultPrice === "number" && user.defaultPrice > 0;
  const paymentsDone = user.stripeConnectStatus === "active";
  const linkDone = user.publicProfileEnabled === true && !!user.publicProfileSlug;

  const [invoiceCountResult] = await db
    .select({ value: count() })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), inArray(invoices.status, ["sent", "paid"])));
  const quoteDone = (invoiceCountResult?.value ?? 0) >= 1;

  const isFullyActivated = servicesDone && pricingDone && paymentsDone && linkDone && quoteDone;

  const completedSteps = [servicesDone, pricingDone, paymentsDone, linkDone, quoteDone].filter(Boolean).length;
  const percentComplete = Math.round((completedSteps / TOTAL_STEPS) * 100);

  const changed =
    user.activationServicesDone !== servicesDone ||
    user.activationPricingDone !== pricingDone ||
    user.activationPaymentsDone !== paymentsDone ||
    user.activationLinkDone !== linkDone ||
    user.activationQuoteDone !== quoteDone;

  let completedAt = user.activationCompletedAt || null;

  if (changed || (isFullyActivated && !completedAt)) {
    const updates: Record<string, any> = {
      activationServicesDone: servicesDone,
      activationPricingDone: pricingDone,
      activationPaymentsDone: paymentsDone,
      activationLinkDone: linkDone,
      activationQuoteDone: quoteDone,
    };

    if (isFullyActivated && !completedAt) {
      completedAt = new Date().toISOString();
      updates.activationCompletedAt = completedAt;

      markReferralActivated(userId).catch(() => {});
    }

    await storage.updateUser(userId, updates);
  }

  return {
    servicesDone,
    pricingDone,
    paymentsDone,
    linkDone,
    quoteDone,
    completedAt,
    completedSteps,
    totalSteps: TOTAL_STEPS,
    percentComplete,
    isFullyActivated,
  };
}

export interface BackfillResult {
  totalUsers: number;
  processed: number;
  updated: number;
  alreadyActivated: number;
  errors: number;
}

export async function backfillAllActivation(): Promise<BackfillResult> {
  const allUsers = await storage.getAllUsers();
  const result: BackfillResult = {
    totalUsers: allUsers.length,
    processed: 0,
    updated: 0,
    alreadyActivated: 0,
    errors: 0,
  };

  for (const user of allUsers) {
    try {
      if (user.activationCompletedAt) {
        result.alreadyActivated++;
        result.processed++;
        continue;
      }

      const status = await evaluateAndUpdateActivation(user.id);
      result.processed++;

      if (status.completedSteps > 0 || status.isFullyActivated) {
        result.updated++;
      }
      if (status.isFullyActivated) {
        result.alreadyActivated++;
      }
    } catch (err) {
      console.error(`[Activation Backfill] Failed for user ${user.id}:`, err);
      result.errors++;
      result.processed++;
    }
  }

  return result;
}
