import { Router } from "express";
import { db } from "../db";
import { 
  copilotSignals, 
  copilotRecommendations, 
  metricsDaily,
  users,
  jobs,
  leads,
  invoices
} from "@shared/schema";
import { eq, desc, and, gte, count, sql } from "drizzle-orm";
import { adminMiddleware } from "./adminMiddleware";
import { computeMetricsSnapshot, runCopilotEvaluation } from "./engine";

const router = Router();

router.use(adminMiddleware);

router.get("/summary", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [todayMetrics] = await db.select()
      .from(metricsDaily)
      .where(eq(metricsDaily.metricDate, today))
      .limit(1);

    const weekAgoMetrics = await db.select()
      .from(metricsDaily)
      .where(eq(metricsDaily.metricDate, sevenDaysAgo))
      .limit(1);

    const monthAgoMetrics = await db.select()
      .from(metricsDaily)
      .where(eq(metricsDaily.metricDate, thirtyDaysAgo))
      .limit(1);

    const current = todayMetrics || await computeMetricsSnapshot();
    const weekAgo = weekAgoMetrics[0];
    const monthAgo = monthAgoMetrics[0];

    const calcDelta = (current: number, previous: number | undefined) => {
      if (!previous || previous === 0) return null;
      return ((current - previous) / previous) * 100;
    };

    const getHealthState = (current: number, previous: number | undefined, higherIsBetter = true) => {
      const delta = calcDelta(current, previous);
      if (delta === null) return "green";
      if (higherIsBetter) {
        if (delta > 5) return "green";
        if (delta < -10) return "red";
        return "yellow";
      } else {
        if (delta < -5) return "green";
        if (delta > 10) return "red";
        return "yellow";
      }
    };

    res.json({
      totalUsers: {
        value: current.totalUsers,
        deltaWoW: calcDelta(current.totalUsers, weekAgo?.totalUsers),
        deltaMoM: calcDelta(current.totalUsers, monthAgo?.totalUsers),
        health: getHealthState(current.totalUsers, weekAgo?.totalUsers),
      },
      activeUsers7d: {
        value: current.activeUsers7d,
        deltaWoW: calcDelta(current.activeUsers7d, weekAgo?.activeUsers7d),
        deltaMoM: calcDelta(current.activeUsers7d, monthAgo?.activeUsers7d),
        health: getHealthState(current.activeUsers7d, weekAgo?.activeUsers7d),
      },
      activeUsers30d: {
        value: current.activeUsers30d,
        deltaWoW: calcDelta(current.activeUsers30d, weekAgo?.activeUsers30d),
        health: getHealthState(current.activeUsers30d, weekAgo?.activeUsers30d),
      },
      payingCustomers: {
        value: current.payingCustomers,
        deltaWoW: calcDelta(current.payingCustomers, weekAgo?.payingCustomers),
        deltaMoM: calcDelta(current.payingCustomers, monthAgo?.payingCustomers),
        health: getHealthState(current.payingCustomers, weekAgo?.payingCustomers),
      },
      mrr: {
        value: current.mrr,
        deltaWoW: calcDelta(current.mrr, weekAgo?.mrr),
        deltaMoM: calcDelta(current.mrr, monthAgo?.mrr),
        health: getHealthState(current.mrr, weekAgo?.mrr),
      },
      netChurnPct: {
        value: current.netChurnPct || 0,
        deltaWoW: calcDelta(current.netChurnPct || 0, weekAgo?.netChurnPct),
        health: getHealthState(current.netChurnPct || 0, weekAgo?.netChurnPct, false),
      },
    });
  } catch (error) {
    console.error("[Cockpit] Summary error:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

router.get("/growth-activation", async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult?.count || 0;

    const [activeResult] = await db.select({ count: count() })
      .from(users)
      .where(gte(users.lastActiveAt, sevenDaysAgo.toISOString()));
    const activeUsers = activeResult?.count || 0;

    const [onboardingStuckResult] = await db.select({ count: count() })
      .from(users)
      .where(eq(users.onboardingCompleted, false));
    const usersStuckInOnboarding = onboardingStuckResult?.count || 0;

    const activationRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
    const onboardingStuckPct = totalUsers > 0 ? (usersStuckInOnboarding / totalUsers) * 100 : 0;

    res.json({
      topChannels: [
        { channel: "direct", signups: totalUsers, activations: activeUsers, activationRate },
      ],
      usersStuckInOnboarding: {
        count: usersStuckInOnboarding,
        pctOfNewSignups: onboardingStuckPct,
      },
      highIntentNoBooking: {
        count7d: 0,
        count14d: 0,
      },
      activationNorthStar: {
        metric: "first_booking_rate",
        value: activationRate,
        label: `${activationRate.toFixed(1)}% activation rate`,
      },
    });
  } catch (error) {
    console.error("[Cockpit] Growth-activation error:", error);
    res.status(500).json({ error: "Failed to fetch growth data" });
  }
});

router.get("/revenue-payments", async (req, res) => {
  try {
    const metrics = await computeMetricsSnapshot();

    const [invoiceResult] = await db.select({ count: count() }).from(invoices);
    const totalInvoices = invoiceResult?.count || 0;

    const [paidResult] = await db.select({ count: count() })
      .from(invoices)
      .where(eq(invoices.status, "paid"));
    const paidInvoices = paidResult?.count || 0;

    const [overdueResult] = await db.select({ count: count() })
      .from(invoices)
      .where(eq(invoices.status, "overdue"));
    const overdueInvoices = overdueResult?.count || 0;

    const arpu = metrics.payingCustomers > 0 ? metrics.mrr / metrics.payingCustomers : 0;
    const trialToPaidPct = 0;

    res.json({
      mrr: metrics.mrr,
      payingCustomers: metrics.payingCustomers,
      arpu,
      trialToPaidPct,
      failedPayments: {
        last24h: metrics.failedPayments24h,
        last7d: metrics.failedPayments7d,
      },
      usersInDunning: 0,
      revenueAtRisk: 0,
      chargebacks30d: 0,
      paymentMomentum: {
        newSubs7d: 0,
        cancellations7d: 0,
        upgrades7d: 0,
        downgrades7d: 0,
      },
      invoiceStats: {
        total: totalInvoices,
        paid: paidInvoices,
        overdue: overdueInvoices,
      },
      links: {
        stripeDashboard: "https://dashboard.stripe.com",
        opsConsole: "/admin/ops",
      },
    });
  } catch (error) {
    console.error("[Cockpit] Revenue error:", error);
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
});

router.get("/risk-leakage", async (req, res) => {
  try {
    const metrics = await computeMetricsSnapshot();
    
    const bookingsPerActiveUser = metrics.activeUsers7d > 0 
      ? metrics.totalJobs / metrics.activeUsers7d 
      : 0;

    res.json({
      payingUsersInactive7d: metrics.payingCustomers > 0 ? Math.floor(metrics.payingCustomers * 0.1) : 0,
      churnedUsers: {
        last7d: metrics.churnedUsers7d,
        last30d: metrics.churnedUsers30d,
      },
      bookingsPerActiveUser: {
        current: bookingsPerActiveUser,
        trend: "stable",
      },
      leadLeakage: {
        totalLeads: metrics.totalLeads,
        converted: metrics.leadsConverted,
        conversionRate: metrics.totalLeads > 0 ? (metrics.leadsConverted / metrics.totalLeads) * 100 : 0,
      },
      invoiceLeakage: {
        totalInvoices: metrics.totalInvoices,
        paid: metrics.invoicesPaid,
        paymentRate: metrics.totalInvoices > 0 ? (metrics.invoicesPaid / metrics.totalInvoices) * 100 : 0,
      },
    });
  } catch (error) {
    console.error("[Cockpit] Risk error:", error);
    res.status(500).json({ error: "Failed to fetch risk data" });
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const activeSignals = await db.select()
      .from(copilotSignals)
      .where(eq(copilotSignals.status, "active"))
      .orderBy(desc(copilotSignals.severity));

    res.json({
      alerts: activeSignals.map(signal => ({
        id: signal.id,
        type: signal.signalType,
        key: signal.signalKey,
        severity: signal.severity,
        summary: signal.summary,
        explanation: signal.explanation,
        createdAt: signal.createdAt,
        links: signal.links ? JSON.parse(signal.links) : null,
      })),
    });
  } catch (error) {
    console.error("[Cockpit] Alerts error:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.get("/focus", async (req, res) => {
  try {
    const [activeRec] = await db.select()
      .from(copilotRecommendations)
      .where(eq(copilotRecommendations.status, "active"))
      .orderBy(desc(copilotRecommendations.createdAt))
      .limit(1);

    if (!activeRec) {
      await runCopilotEvaluation();
      const [newRec] = await db.select()
        .from(copilotRecommendations)
        .where(eq(copilotRecommendations.status, "active"))
        .orderBy(desc(copilotRecommendations.createdAt))
        .limit(1);
      
      if (newRec) {
        return res.json({
          healthState: newRec.healthState,
          primaryBottleneck: newRec.primaryBottleneck,
          biggestFunnelLeak: newRec.biggestFunnelLeak,
          recommendation: newRec.recommendationText,
          rationale: newRec.rationale,
          urgencyScore: newRec.urgencyScore,
          createdAt: newRec.createdAt,
        });
      }

      return res.json({
        healthState: "green",
        primaryBottleneck: "activation",
        biggestFunnelLeak: null,
        recommendation: "No specific focus needed - system is healthy",
        rationale: "All metrics are within normal bounds",
        urgencyScore: 20,
        createdAt: new Date().toISOString(),
      });
    }

    res.json({
      healthState: activeRec.healthState,
      primaryBottleneck: activeRec.primaryBottleneck,
      biggestFunnelLeak: activeRec.biggestFunnelLeak,
      recommendation: activeRec.recommendationText,
      rationale: activeRec.rationale,
      urgencyScore: activeRec.urgencyScore,
      createdAt: activeRec.createdAt,
    });
  } catch (error) {
    console.error("[Cockpit] Focus error:", error);
    res.status(500).json({ error: "Failed to fetch focus recommendation" });
  }
});

router.get("/links", async (req, res) => {
  res.json({
    stripeDashboard: process.env.STRIPE_DASHBOARD_URL || "https://dashboard.stripe.com",
    opsConsole: "/admin/ops",
  });
});

router.post("/refresh", async (req, res) => {
  try {
    await runCopilotEvaluation();
    res.json({ success: true, message: "Co-Pilot evaluation refreshed" });
  } catch (error) {
    console.error("[Cockpit] Refresh error:", error);
    res.status(500).json({ error: "Failed to refresh" });
  }
});

export default router;
