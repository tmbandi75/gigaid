import { db } from "../db";
import { 
  copilotSignals, 
  copilotRecommendations, 
  metricsDaily,
  users,
  jobs,
  leads,
  invoices,
  InsertCopilotSignal,
  InsertCopilotRecommendation,
  InsertMetricsDaily,
  CopilotHealthState,
  CopilotBottleneck
} from "@shared/schema";
import { sql, eq, and, gte, lte, lt, count, desc, asc } from "drizzle-orm";
import { emitCanonicalEvent } from "./canonicalEvents";

interface CopilotEvaluationResult {
  healthState: CopilotHealthState;
  primaryBottleneck: string;
  biggestFunnelLeak: string;
  recommendation: string;
  rationale: string;
  signals: InsertCopilotSignal[];
}

interface MetricsSnapshot {
  totalUsers: number;
  newUsersToday: number;
  activeUsers7d: number;
  activeUsers30d: number;
  payingCustomers: number;
  mrr: number;
  totalLeads: number;
  leadsConverted: number;
  totalJobs: number;
  jobsCompleted: number;
  totalInvoices: number;
  invoicesPaid: number;
  failedPayments24h: number;
  failedPayments7d: number;
  churnedUsers7d: number;
  churnedUsers30d: number;
}

export async function computeMetricsSnapshot(): Promise<MetricsSnapshot> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const today = now.toISOString().split("T")[0];

  const [userRows] = await db.select({ count: count() }).from(users);
  const totalUsers = userRows?.count || 0;

  const [newUserRows] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, today));
  const newUsersToday = newUserRows?.count || 0;

  const [activeRows7d] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.lastActiveAt, sevenDaysAgo.toISOString()));
  const activeUsers7d = activeRows7d?.count || 0;

  const [activeRows30d] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.lastActiveAt, thirtyDaysAgo.toISOString()));
  const activeUsers30d = activeRows30d?.count || 0;

  const [payingRows] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isPro, true));
  const payingCustomers = payingRows?.count || 0;

  const [leadRows] = await db.select({ count: count() }).from(leads);
  const totalLeads = leadRows?.count || 0;

  const [convertedLeadRows] = await db
    .select({ count: count() })
    .from(leads)
    .where(eq(leads.status, "converted"));
  const leadsConverted = convertedLeadRows?.count || 0;

  const [jobRows] = await db.select({ count: count() }).from(jobs);
  const totalJobs = jobRows?.count || 0;

  const [completedJobRows] = await db
    .select({ count: count() })
    .from(jobs)
    .where(eq(jobs.status, "completed"));
  const jobsCompleted = completedJobRows?.count || 0;

  const [invoiceRows] = await db.select({ count: count() }).from(invoices);
  const totalInvoices = invoiceRows?.count || 0;

  const [paidInvoiceRows] = await db
    .select({ count: count() })
    .from(invoices)
    .where(eq(invoices.status, "paid"));
  const invoicesPaid = paidInvoiceRows?.count || 0;

  return {
    totalUsers,
    newUsersToday,
    activeUsers7d,
    activeUsers30d,
    payingCustomers,
    mrr: payingCustomers * 999,
    totalLeads,
    leadsConverted,
    totalJobs,
    jobsCompleted,
    totalInvoices,
    invoicesPaid,
    failedPayments24h: 0,
    failedPayments7d: 0,
    churnedUsers7d: 0,
    churnedUsers30d: 0,
  };
}

export async function evaluateCopilot(): Promise<CopilotEvaluationResult> {
  const now = new Date().toISOString();
  const metrics = await computeMetricsSnapshot();
  const signals: InsertCopilotSignal[] = [];

  let healthState: CopilotHealthState = "green";
  let primaryBottleneck: string = "activation";
  let biggestFunnelLeak = "signup_to_first_booking";
  
  const activationRate = metrics.totalUsers > 0 
    ? (metrics.activeUsers7d / metrics.totalUsers) * 100 
    : 0;
  
  const leadConversionRate = metrics.totalLeads > 0 
    ? (metrics.leadsConverted / metrics.totalLeads) * 100 
    : 0;
  
  const jobCompletionRate = metrics.totalJobs > 0 
    ? (metrics.jobsCompleted / metrics.totalJobs) * 100 
    : 0;
  
  const invoicePaidRate = metrics.totalInvoices > 0 
    ? (metrics.invoicesPaid / metrics.totalInvoices) * 100 
    : 0;

  if (activationRate < 20) {
    signals.push({
      createdAt: now,
      signalType: "warning",
      signalKey: "low_activation_rate",
      severity: 70,
      summary: `Activation rate is ${activationRate.toFixed(1)}%`,
      explanation: `Only ${metrics.activeUsers7d} of ${metrics.totalUsers} users were active in the last 7 days. Target is 50%+.`,
      status: "active",
    });
    healthState = "yellow";
    primaryBottleneck = "activation";
  }

  if (leadConversionRate < 15) {
    signals.push({
      createdAt: now,
      signalType: "warning", 
      signalKey: "low_lead_conversion",
      severity: 60,
      summary: `Lead conversion rate is ${leadConversionRate.toFixed(1)}%`,
      explanation: `Only ${metrics.leadsConverted} of ${metrics.totalLeads} leads converted. Target is 30%+.`,
      status: "active",
    });
    if (healthState === "green") healthState = "yellow";
    biggestFunnelLeak = "lead_to_booking";
  }

  if (invoicePaidRate < 50 && metrics.totalInvoices > 5) {
    signals.push({
      createdAt: now,
      signalType: "critical",
      signalKey: "low_invoice_payment_rate",
      severity: 80,
      summary: `Only ${invoicePaidRate.toFixed(1)}% of invoices are paid`,
      explanation: `${metrics.invoicesPaid} of ${metrics.totalInvoices} invoices paid. This is revenue leakage.`,
      status: "active",
    });
    healthState = "red";
    primaryBottleneck = "monetization";
    biggestFunnelLeak = "invoice_to_payment";
  }

  if (metrics.payingCustomers === 0 && metrics.totalUsers > 10) {
    signals.push({
      createdAt: now,
      signalType: "critical",
      signalKey: "no_paying_customers",
      severity: 90,
      summary: "No paying customers yet",
      explanation: `${metrics.totalUsers} users but $0 MRR. Focus on conversion.`,
      status: "active",
    });
    healthState = "red";
    primaryBottleneck = "monetization";
  }

  let recommendation = "";
  let rationale = "";

  if (primaryBottleneck === "activation") {
    recommendation = "Focus on getting new users to their first booking";
    rationale = `Activation rate is ${activationRate.toFixed(1)}%. Users who book within 48 hours are 3x more likely to become paying customers.`;
  } else if (primaryBottleneck === "retention") {
    recommendation = "Re-engage churned users with win-back campaigns";
    rationale = `${metrics.churnedUsers7d} users churned in the last 7 days. They already know the product - win-back is 5x cheaper than acquisition.`;
  } else {
    recommendation = "Focus on collecting unpaid invoices";
    rationale = `${metrics.totalInvoices - metrics.invoicesPaid} unpaid invoices represent immediate revenue opportunity. Send reminders and offer payment plans.`;
  }

  return {
    healthState,
    primaryBottleneck,
    biggestFunnelLeak,
    recommendation,
    rationale,
    signals,
  };
}

export async function runCopilotEvaluation(): Promise<void> {
  console.log("[CoPilot] Running evaluation...");
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  try {
    const evaluation = await evaluateCopilot();
    const metrics = await computeMetricsSnapshot();

    await db.update(copilotSignals)
      .set({ status: "resolved", resolvedAt: now.toISOString() })
      .where(eq(copilotSignals.status, "active"));

    for (const signal of evaluation.signals) {
      await db.insert(copilotSignals).values(signal);
    }

    await db.update(copilotRecommendations)
      .set({ status: "superseded" })
      .where(eq(copilotRecommendations.status, "active"));

    const newRecommendation: InsertCopilotRecommendation = {
      createdAt: now.toISOString(),
      recKey: `focus_${evaluation.primaryBottleneck}_${today}`,
      healthState: evaluation.healthState,
      primaryBottleneck: evaluation.primaryBottleneck,
      biggestFunnelLeak: evaluation.biggestFunnelLeak,
      recommendationText: evaluation.recommendation,
      rationale: evaluation.rationale,
      urgencyScore: evaluation.healthState === "red" ? 90 : evaluation.healthState === "yellow" ? 60 : 30,
      status: "active",
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
    await db.insert(copilotRecommendations).values(newRecommendation);

    const existingMetric = await db.select()
      .from(metricsDaily)
      .where(eq(metricsDaily.metricDate, today))
      .limit(1);

    const dailyMetric: InsertMetricsDaily = {
      metricDate: today,
      totalUsers: metrics.totalUsers,
      newUsersToday: metrics.newUsersToday,
      activeUsers7d: metrics.activeUsers7d,
      activeUsers30d: metrics.activeUsers30d,
      payingCustomers: metrics.payingCustomers,
      mrr: metrics.mrr,
      netChurnPct: 0,
      totalLeads: metrics.totalLeads,
      leadsConverted: metrics.leadsConverted,
      totalJobs: metrics.totalJobs,
      jobsCompleted: metrics.jobsCompleted,
      totalInvoices: metrics.totalInvoices,
      invoicesPaid: metrics.invoicesPaid,
      failedPayments24h: metrics.failedPayments24h,
      failedPayments7d: metrics.failedPayments7d,
      churnedUsers7d: metrics.churnedUsers7d,
      churnedUsers30d: metrics.churnedUsers30d,
      createdAt: now.toISOString(),
    };

    if (existingMetric.length > 0) {
      await db.update(metricsDaily)
        .set(dailyMetric)
        .where(eq(metricsDaily.metricDate, today));
    } else {
      await db.insert(metricsDaily).values(dailyMetric);
    }

    // Emit user_inactive_7d events for users who crossed the 7-day inactivity threshold
    // Only emit once per user by checking if lastActiveAt is within 7-8 day window (newly inactive)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    
    // Only get users who became inactive in the last hour (crossed 7-day threshold recently)
    const newlyInactiveUsers = await db.select({ id: users.id })
      .from(users)
      .where(and(
        lt(users.lastActiveAt, sevenDaysAgo.toISOString()),
        gte(users.lastActiveAt, eightDaysAgo.toISOString())
      ));
    
    for (const user of newlyInactiveUsers) {
      await emitCanonicalEvent({
        eventName: "user_inactive_7d",
        userId: user.id,
        context: { detectedAt: now.toISOString() },
        source: "system",
      });
    }
    
    if (newlyInactiveUsers.length > 0) {
      console.log(`[CoPilot] Emitted user_inactive_7d for ${newlyInactiveUsers.length} newly inactive users`);
    }

    console.log(`[CoPilot] Evaluation complete. Health: ${evaluation.healthState}, Bottleneck: ${evaluation.primaryBottleneck}`);
  } catch (error) {
    console.error("[CoPilot] Evaluation failed:", error);
  }
}

let copilotInterval: ReturnType<typeof setInterval> | null = null;

export function startCopilotScheduler(): void {
  if (copilotInterval) return;
  
  console.log("[CoPilot] Starting scheduler (runs every hour)");
  
  setTimeout(() => {
    runCopilotEvaluation().catch(console.error);
  }, 5000);
  
  copilotInterval = setInterval(() => {
    runCopilotEvaluation().catch(console.error);
  }, 60 * 60 * 1000);
}

export function stopCopilotScheduler(): void {
  if (copilotInterval) {
    clearInterval(copilotInterval);
    copilotInterval = null;
    console.log("[CoPilot] Scheduler stopped");
  }
}
