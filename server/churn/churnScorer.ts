import { db } from "../db";
import { users, jobs, jobPayments, smsMessages, eventsCanonical } from "@shared/schema";
import { eq, and, gte, sql, count, sum } from "drizzle-orm";

export interface ChurnSignals {
  lastLoginDays: number;
  jobs7d: number;
  msgs7d: number;
  rev30d: number;
  revDelta: number;
  noPay14d: boolean;
  failedPayments: number;
  errors7d: number;
  blocks7d: number;
  limit95Hits: number;
  downgradeViews: number;
  cancelHover: number;
}

export type ChurnTier = "Healthy" | "Drifting" | "AtRisk" | "Critical";

export interface ChurnScoreBreakdown {
  activity: number;
  revenue: number;
  friction: number;
  intent: number;
  total: number;
  tier: ChurnTier;
}

export function getTier(score: number): ChurnTier {
  if (score <= 30) return "Healthy";
  if (score <= 50) return "Drifting";
  if (score <= 70) return "AtRisk";
  return "Critical";
}

export function computeChurnScore(signals: ChurnSignals): ChurnScoreBreakdown {
  let loginScore: number;
  if (signals.lastLoginDays <= 1) loginScore = 0;
  else if (signals.lastLoginDays <= 3) loginScore = 5;
  else if (signals.lastLoginDays <= 6) loginScore = 12;
  else if (signals.lastLoginDays <= 10) loginScore = 18;
  else if (signals.lastLoginDays <= 14) loginScore = 22;
  else loginScore = 25;

  let jobsScore: number;
  if (signals.jobs7d >= 3) jobsScore = 0;
  else if (signals.jobs7d === 2) jobsScore = 5;
  else if (signals.jobs7d === 1) jobsScore = 10;
  else jobsScore = 15;

  let msgsScore: number;
  if (signals.msgs7d >= 10) msgsScore = 0;
  else if (signals.msgs7d >= 5) msgsScore = 3;
  else if (signals.msgs7d >= 1) msgsScore = 7;
  else msgsScore = 10;

  const activity = Math.min(loginScore + jobsScore + msgsScore, 50);

  let revDeltaScore: number;
  if (signals.revDelta >= 0) revDeltaScore = 0;
  else if (signals.revDelta >= -50) revDeltaScore = 5;
  else if (signals.revDelta >= -200) revDeltaScore = 10;
  else revDeltaScore = 15;

  const noPayScore = signals.noPay14d ? 10 : 0;

  let failedScore: number;
  if (signals.failedPayments === 0) failedScore = 0;
  else if (signals.failedPayments === 1) failedScore = 2;
  else if (signals.failedPayments === 2) failedScore = 4;
  else failedScore = 5;

  const revenue = Math.min(revDeltaScore + noPayScore + failedScore, 30);

  let errorsScore: number;
  if (signals.errors7d === 0) errorsScore = 0;
  else if (signals.errors7d <= 2) errorsScore = 3;
  else if (signals.errors7d <= 5) errorsScore = 6;
  else errorsScore = 8;

  let blocksScore: number;
  if (signals.blocks7d === 0) blocksScore = 0;
  else if (signals.blocks7d === 1) blocksScore = 2;
  else if (signals.blocks7d <= 3) blocksScore = 4;
  else blocksScore = 6;

  const supportTicketsScore = 0;

  const friction = Math.min(errorsScore + blocksScore + supportTicketsScore, 20);

  let limitScore: number;
  if (signals.limit95Hits === 0) limitScore = 0;
  else if (signals.limit95Hits === 1) limitScore = 2;
  else limitScore = 4;

  let downgradeScore: number;
  if (signals.downgradeViews === 0) downgradeScore = 0;
  else if (signals.downgradeViews === 1) downgradeScore = 2;
  else downgradeScore = 3;

  let cancelScore: number;
  if (signals.cancelHover === 0) cancelScore = 0;
  else if (signals.cancelHover === 1) cancelScore = 2;
  else cancelScore = 3;

  const intent = Math.min(limitScore + downgradeScore + cancelScore, 10);

  const total = activity + revenue + friction + intent;
  const tier = getTier(total);

  return { activity, revenue, friction, intent, total, tier };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function extractSignals(userId: string): Promise<ChurnSignals> {
  const now = new Date();
  const iso7d = daysAgo(7);
  const iso14d = daysAgo(14);
  const iso30d = daysAgo(30);
  const iso60d = daysAgo(60);

  const [userRow] = await db
    .select({ lastActiveAt: users.lastActiveAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let lastLoginDays = 999;
  if (userRow?.lastActiveAt) {
    const lastActive = new Date(userRow.lastActiveAt);
    lastLoginDays = Math.max(0, Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const [jobsResult] = await db
    .select({ value: count() })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, iso7d)));

  const jobs7d = jobsResult?.value ?? 0;

  const [msgsResult] = await db
    .select({ value: count() })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.userId, userId),
        eq(smsMessages.direction, "outbound"),
        gte(smsMessages.createdAt, iso7d)
      )
    );

  const msgs7d = msgsResult?.value ?? 0;

  const [rev30dResult] = await db
    .select({ value: sum(jobPayments.amount) })
    .from(jobPayments)
    .where(
      and(
        eq(jobPayments.userId, userId),
        sql`${jobPayments.status} IN ('paid', 'confirmed')`,
        gte(jobPayments.paidAt, iso30d)
      )
    );

  const rev30d = Number(rev30dResult?.value ?? 0);

  const [revPrev30dResult] = await db
    .select({ value: sum(jobPayments.amount) })
    .from(jobPayments)
    .where(
      and(
        eq(jobPayments.userId, userId),
        sql`${jobPayments.status} IN ('paid', 'confirmed')`,
        gte(jobPayments.paidAt, iso60d),
        sql`${jobPayments.paidAt} < ${iso30d}`
      )
    );

  const revPrev30d = Number(revPrev30dResult?.value ?? 0);
  const revDelta = rev30d - revPrev30d;

  const [noPay14dResult] = await db
    .select({ value: count() })
    .from(jobPayments)
    .where(
      and(
        eq(jobPayments.userId, userId),
        sql`${jobPayments.status} IN ('paid', 'confirmed')`,
        gte(jobPayments.paidAt, iso14d)
      )
    );

  const noPay14d = (noPay14dResult?.value ?? 0) === 0;

  const [failedResult] = await db
    .select({ value: count() })
    .from(jobPayments)
    .where(
      and(
        eq(jobPayments.userId, userId),
        eq(jobPayments.status, "failed"),
        gte(jobPayments.createdAt, iso30d)
      )
    );

  const failedPayments = failedResult?.value ?? 0;

  const [errorsResult] = await db
    .select({ value: count() })
    .from(eventsCanonical)
    .where(
      and(
        eq(eventsCanonical.userId, userId),
        eq(eventsCanonical.eventName, "app_error"),
        gte(eventsCanonical.occurredAt, iso7d)
      )
    );

  const errors7d = errorsResult?.value ?? 0;

  const [blocksResult] = await db
    .select({ value: count() })
    .from(eventsCanonical)
    .where(
      and(
        eq(eventsCanonical.userId, userId),
        eq(eventsCanonical.eventName, "paywall_block"),
        gte(eventsCanonical.occurredAt, iso7d)
      )
    );

  const blocks7d = blocksResult?.value ?? 0;

  const [limitResult] = await db
    .select({ value: count() })
    .from(eventsCanonical)
    .where(
      and(
        eq(eventsCanonical.userId, userId),
        eq(eventsCanonical.eventName, "limit_95_hit"),
        gte(eventsCanonical.occurredAt, iso14d)
      )
    );

  const limit95Hits = limitResult?.value ?? 0;

  const [downgradeResult] = await db
    .select({ value: count() })
    .from(eventsCanonical)
    .where(
      and(
        eq(eventsCanonical.userId, userId),
        eq(eventsCanonical.eventName, "downgrade_view"),
        gte(eventsCanonical.occurredAt, iso14d)
      )
    );

  const downgradeViews = downgradeResult?.value ?? 0;

  const [cancelResult] = await db
    .select({ value: count() })
    .from(eventsCanonical)
    .where(
      and(
        eq(eventsCanonical.userId, userId),
        eq(eventsCanonical.eventName, "cancel_hover"),
        gte(eventsCanonical.occurredAt, iso14d)
      )
    );

  const cancelHover = cancelResult?.value ?? 0;

  return {
    lastLoginDays,
    jobs7d,
    msgs7d,
    rev30d,
    revDelta,
    noPay14d,
    failedPayments,
    errors7d,
    blocks7d,
    limit95Hits,
    downgradeViews,
    cancelHover,
  };
}
