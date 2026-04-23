import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, leads, jobs, invoices, eventsCanonical, metricsDaily, adminActionAudit } from "@shared/schema";
import { eq, sql, desc, and, gte, lte, isNull, isNotNull, count } from "drizzle-orm";
import { adminMiddleware, AdminRequest, requireRole } from "../copilot/adminMiddleware";
import { logger } from "../lib/logger";
import { Plan, PLAN_PRICES_CENTS } from "@shared/plans";

const router = Router();

router.get("/user/:userId/timeline", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const timelineResult = await db.execute(sql`
      WITH combined_events AS (
        SELECT 
          'event' as type,
          occurred_at as timestamp,
          event_name as name,
          source,
          context as extra,
          NULL as actor_id
        FROM events_canonical
        WHERE user_id = ${userId}
        
        UNION ALL
        
        SELECT 
          'admin_action' as type,
          created_at as timestamp,
          action_key as name,
          'admin' as source,
          payload as extra,
          actor_user_id as actor_id
        FROM admin_action_audit
        WHERE target_user_id = ${userId}
      )
      SELECT * FROM combined_events
      ORDER BY timestamp DESC
      LIMIT ${limit + 1}
      OFFSET ${offset}
    `);

    const rows = timelineResult.rows as any[];
    const hasMore = rows.length > limit;
    const timeline = rows.slice(0, limit).map(r => ({
      type: r.type,
      timestamp: r.timestamp,
      name: r.name,
      source: r.source,
      actorId: r.actor_id,
      context: r.extra ? (typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra) : null,
    }));

    res.json({ timeline, hasMore });
  } catch (error) {
    logger.error("[Analytics] Error fetching user timeline:", error);
    res.status(500).json({ error: "Failed to fetch user timeline" });
  }
});

router.get("/revenue", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const [dailyMetrics, planDistribution, mrrByPlan] = await Promise.all([
      db.select()
        .from(metricsDaily)
        .where(gte(metricsDaily.metricDate, startDateStr))
        .orderBy(desc(metricsDaily.metricDate))
        .limit(days),
      
      db.select({
        plan: users.plan,
        count: count(),
      })
        .from(users)
        .where(isNull(users.deletedAt))
        .groupBy(users.plan),

      db.execute(sql`
        SELECT 
          plan,
          COUNT(*) as customers,
          COUNT(*) * CASE 
            WHEN plan = 'pro' THEN ${PLAN_PRICES_CENTS[Plan.PRO]}
            WHEN plan = 'pro_plus' THEN ${PLAN_PRICES_CENTS[Plan.PRO_PLUS]}
            WHEN plan = 'business' THEN ${PLAN_PRICES_CENTS[Plan.BUSINESS]}
            ELSE 0
          END as mrr_cents
        FROM users
        WHERE deleted_at IS NULL 
          AND stripe_subscription_id IS NOT NULL
          AND plan != 'free'
        GROUP BY plan
      `),
    ]);

    const latestMetrics = dailyMetrics[0] || null;
    const mrrByPlanRows = mrrByPlan.rows as any[];
    const totalMrr = mrrByPlanRows.reduce((sum, r) => sum + (r.mrr_cents || 0), 0);
    
    res.json({
      summary: {
        mrr: latestMetrics?.mrr || totalMrr,
        payingCustomers: latestMetrics?.payingCustomers || 0,
        netChurnPct: latestMetrics?.netChurnPct || 0,
        revenueAtRisk: latestMetrics?.revenueAtRisk || 0,
      },
      dailyMetrics: dailyMetrics.map(m => ({
        date: m.metricDate,
        mrr: m.mrr,
        payingCustomers: m.payingCustomers,
        newUsers: m.newUsersToday,
        churnedUsers: m.churnedUsers7d,
      })),
      planDistribution: planDistribution.map(p => ({
        plan: p.plan || "free",
        count: Number(p.count),
      })),
      mrrByPlan: mrrByPlanRows.map(r => ({
        plan: r.plan,
        customers: Number(r.customers),
        mrr: Number(r.mrr_cents) / 100,
      })),
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching revenue data:", error);
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
});

router.get("/cohorts", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const cohortData = await db.execute(sql`
      WITH user_cohorts AS (
        SELECT 
          id,
          LEFT(created_at, 7) as cohort_month,
          plan,
          stripe_subscription_id,
          first_payment_received_at
        FROM users
        WHERE deleted_at IS NULL
          AND created_at IS NOT NULL
          AND LENGTH(created_at) >= 7
      )
      SELECT 
        cohort_month,
        COUNT(*) as total_signups,
        COUNT(stripe_subscription_id) as converted_to_paid,
        COUNT(first_payment_received_at) as received_payment,
        ROUND(COUNT(stripe_subscription_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as conversion_rate
      FROM user_cohorts
      WHERE cohort_month IS NOT NULL
      GROUP BY cohort_month
      ORDER BY cohort_month DESC
      LIMIT 12
    `);

    res.json({ cohorts: cohortData.rows });
  } catch (error) {
    logger.error("[Analytics] Error fetching cohort data:", error);
    res.status(500).json({ error: "Failed to fetch cohort data" });
  }
});

router.get("/funnels", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    const funnelData = await db.execute(sql`
      WITH recent_users AS (
        SELECT 
          id,
          created_at,
          public_profile_enabled,
          booking_link_created_at,
          booking_link_shared_at,
          first_paid_booking_at,
          first_payment_received_at,
          stripe_subscription_id
        FROM users
        WHERE deleted_at IS NULL
          AND created_at >= ${startDateStr}
      )
      SELECT 
        COUNT(*) as total_signups,
        COUNT(CASE WHEN public_profile_enabled = true THEN 1 END) as enabled_profile,
        COUNT(booking_link_created_at) as created_booking_link,
        COUNT(booking_link_shared_at) as shared_booking_link,
        COUNT(first_paid_booking_at) as received_booking,
        COUNT(first_payment_received_at) as received_payment,
        COUNT(stripe_subscription_id) as subscribed
      FROM recent_users
    `);

    const leadToJobData = await db.execute(sql`
      WITH recent_leads AS (
        SELECT 
          l.id,
          l.status,
          l.created_at,
          j.id as job_id
        FROM leads l
        LEFT JOIN jobs j ON j.lead_id = l.id
        WHERE l.created_at >= ${startDateStr}
      )
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'quoted' THEN 1 END) as quoted,
        COUNT(CASE WHEN status = 'converted' OR job_id IS NOT NULL THEN 1 END) as converted
      FROM recent_leads
    `);

    const jobToPaymentData = await db.execute(sql`
      WITH recent_jobs AS (
        SELECT 
          j.id,
          j.status,
          j.created_at,
          i.id as invoice_id,
          i.status as invoice_status
        FROM jobs j
        LEFT JOIN invoices i ON i.job_id = j.id
        WHERE j.created_at >= ${startDateStr}
      )
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(invoice_id) as invoiced,
        COUNT(CASE WHEN invoice_status = 'paid' THEN 1 END) as paid
      FROM recent_jobs
    `);

    const funnel = (funnelData.rows as any[])[0] || {};
    const leadFunnel = (leadToJobData.rows as any[])[0] || {};
    const jobFunnel = (jobToPaymentData.rows as any[])[0] || {};

    res.json({
      signupToPayment: {
        signups: Number(funnel.total_signups || 0),
        enabledProfile: Number(funnel.enabled_profile || 0),
        createdBookingLink: Number(funnel.created_booking_link || 0),
        sharedBookingLink: Number(funnel.shared_booking_link || 0),
        receivedBooking: Number(funnel.received_booking || 0),
        receivedPayment: Number(funnel.received_payment || 0),
        subscribed: Number(funnel.subscribed || 0),
      },
      leadToJob: {
        totalLeads: Number(leadFunnel.total_leads || 0),
        contacted: Number(leadFunnel.contacted || 0),
        quoted: Number(leadFunnel.quoted || 0),
        converted: Number(leadFunnel.converted || 0),
      },
      jobToPayment: {
        totalJobs: Number(jobFunnel.total_jobs || 0),
        scheduled: Number(jobFunnel.scheduled || 0),
        inProgress: Number(jobFunnel.in_progress || 0),
        completed: Number(jobFunnel.completed || 0),
        invoiced: Number(jobFunnel.invoiced || 0),
        paid: Number(jobFunnel.paid || 0),
      },
      period: `Last ${days} days`,
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching funnel data:", error);
    res.status(500).json({ error: "Failed to fetch funnel data" });
  }
});

router.get("/ltv", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const ltvData = await db.execute(sql`
      WITH user_revenue AS (
        SELECT 
          u.id,
          u.plan,
          u.created_at,
          u.stripe_subscription_id,
          EXTRACT(MONTH FROM AGE(NOW(), TO_TIMESTAMP(u.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'))) as months_active,
          CASE 
            WHEN u.plan = 'pro' THEN ${PLAN_PRICES_CENTS[Plan.PRO]}
            WHEN u.plan = 'pro_plus' THEN ${PLAN_PRICES_CENTS[Plan.PRO_PLUS]}
            WHEN u.plan = 'business' THEN ${PLAN_PRICES_CENTS[Plan.BUSINESS]}
            ELSE 0
          END as monthly_value_cents
        FROM users u
        WHERE u.deleted_at IS NULL
          AND u.stripe_subscription_id IS NOT NULL
      )
      SELECT 
        plan,
        COUNT(*) as customers,
        AVG(months_active) as avg_lifetime_months,
        AVG(monthly_value_cents * GREATEST(months_active, 1)) as avg_ltv_cents
      FROM user_revenue
      WHERE plan != 'free'
      GROUP BY plan
    `);

    res.json({
      ltvByPlan: (ltvData.rows as any[]).map(r => ({
        plan: r.plan,
        customers: Number(r.customers),
        avgLifetimeMonths: Number(r.avg_lifetime_months || 0).toFixed(1),
        avgLtv: (Number(r.avg_ltv_cents || 0) / 100).toFixed(2),
      })),
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching LTV data:", error);
    res.status(500).json({ error: "Failed to fetch LTV data" });
  }
});

// A/B test report: views and claims per unclaimed-page headline variant.
// Source: booking_page_events. We aggregate views (page_viewed) and claims
// (page_claimed) keyed on the variant column, then compute claim-through rate.
router.get("/booking-page-variants", adminMiddleware, async (_req: AdminRequest, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(variant, 'unassigned') AS variant,
        SUM(CASE WHEN type = 'page_viewed' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN type = 'page_claimed' THEN 1 ELSE 0 END) AS claims,
        COUNT(DISTINCT CASE WHEN type = 'page_viewed' THEN page_id END) AS unique_pages_viewed
      FROM booking_page_events
      GROUP BY COALESCE(variant, 'unassigned')
      ORDER BY views DESC
    `);

    const rows = (result.rows as any[]).map((r) => {
      const views = Number(r.views || 0);
      const claims = Number(r.claims || 0);
      return {
        variant: r.variant as string,
        views,
        claims,
        uniquePagesViewed: Number(r.unique_pages_viewed || 0),
        claimRate: views > 0 ? Number((claims / views).toFixed(4)) : 0,
      };
    });

    res.json({ variants: rows });
  } catch (error) {
    logger.error("[Analytics] Error fetching booking page variant report:", error);
    res.status(500).json({ error: "Failed to fetch booking page variant report" });
  }
});

export default router;
