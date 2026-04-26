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
//
// NOTE on the `unassigned` bucket: prior to the schema rollout that added the
// `variant` column to `booking_page_events`, every row was inserted with a
// NULL variant regardless of which headline the visitor actually saw. Those
// pre-fix rows surface here as the `unassigned` group and MUST be excluded
// when picking an A/B winner — they are not a real arm of the experiment,
// just legacy data with no variant tag. Only compare the four named variants
// (back_and_forth, deposit_first, speed_first, social_proof) against one
// another. New `page_viewed` and `page_claimed` events written after the
// rollout always carry a variant, so the `unassigned` count should stop
// growing once the deploy is live.

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
        // `unassigned` rows pre-date the variant column and should be ignored
        // when comparing A/B arms.
        legacyUntagged: r.variant === "unassigned",
      };
    });

    res.json({
      variants: rows,
      notes: {
        unassigned:
          "Rows tagged 'unassigned' were recorded before the variant column was added to booking_page_events. Exclude them when picking a winner; they cannot be attributed to any headline.",
      },
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching booking page variant report:", error);
    res.status(500).json({ error: "Failed to fetch booking page variant report" });
  }
});

// Booking link share funnel: surfaces the tap → completion → copy funnel and
// breaks it down by surface (`screen` context: plan, leads, jobs, bookings,
// nba). Source events are emitted by the `/api/track/booking-link-share-tap`,
// `/api/track/booking-link-shared`, and `/api/track/booking-link-copied`
// handlers and stored in `events_canonical`.
//
// Note: prior to this report being introduced, completions were only tracked
// once-per-user via `booking_link_shared` (the milestone). Those rows are
// kept for the existing `/funnels` endpoint; this report uses the
// `booking_link_share_completed` event which records every completion with a
// `screen`. Older completions (before the rollout) will not appear here.
router.get("/share-funnel", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();
    // Day bucket boundary used to seed the empty time series. We zero out the
    // hour to keep the per-day buckets aligned with the LEFT(occurred_at, 10)
    // grouping below regardless of the request time of day.
    const seriesStart = new Date(startDate);
    seriesStart.setUTCHours(0, 0, 0, 0);

    const result = await db.execute(sql`
      SELECT
        event_name,
        COALESCE(NULLIF(context::jsonb ->> 'screen', ''), 'unknown') AS screen,
        COALESCE(NULLIF(context::jsonb ->> 'platform', ''), 'unknown') AS platform,
        COALESCE(NULLIF(context::jsonb ->> 'target', ''), 'unknown') AS target,
        LEFT(occurred_at, 10) AS day,
        COUNT(*) AS event_count
      FROM events_canonical
      WHERE event_name IN (
          'booking_link_share_tap',
          'booking_link_share_completed',
          'booking_link_copied'
        )
        AND occurred_at >= ${startDateStr}
      GROUP BY
        event_name,
        COALESCE(NULLIF(context::jsonb ->> 'screen', ''), 'unknown'),
        COALESCE(NULLIF(context::jsonb ->> 'platform', ''), 'unknown'),
        COALESCE(NULLIF(context::jsonb ->> 'target', ''), 'unknown'),
        LEFT(occurred_at, 10)
    `);

    const rows = result.rows as Array<{
      event_name: string;
      screen: string;
      platform: string;
      target: string;
      day: string;
      event_count: string | number;
    }>;

    type Counts = { taps: number; completions: number; copies: number };
    const bySurface = new Map<string, Counts>();
    const byPlatform = new Map<string, Counts>();
    // Targets only meaningfully apply to completions and copies — there
    // is no share destination yet at the "tap" stage. We still maintain
    // a Counts shape for consistency but `taps` will always be 0.
    const byTarget = new Map<string, Counts>();
    const totals: Counts = { taps: 0, completions: 0, copies: 0 };

    const bumpCounts = (bucket: Counts, eventName: string, count: number) => {
      if (eventName === "booking_link_share_tap") bucket.taps += count;
      else if (eventName === "booking_link_share_completed") bucket.completions += count;
      else if (eventName === "booking_link_copied") bucket.copies += count;
    };

    // Build a continuous list of day buckets (YYYY-MM-DD) covering the
    // requested window so the chart has a stable x-axis even on days with no
    // share activity. We compute it inclusively from the bucket-aligned
    // window start through today (UTC).
    const dayBuckets: string[] = [];
    {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const cursor = new Date(seriesStart);
      while (cursor.getTime() <= today.getTime()) {
        dayBuckets.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const makeEmptyDayMap = (): Map<string, Counts> => {
      const m = new Map<string, Counts>();
      for (const d of dayBuckets) m.set(d, { taps: 0, completions: 0, copies: 0 });
      return m;
    };

    // Total per-day series and per-platform per-day series so the frontend
    // can render an aggregate trend or filter to a single platform without a
    // second request.
    const totalsByDay = makeEmptyDayMap();
    const byPlatformByDay = new Map<string, Map<string, Counts>>();

    for (const row of rows) {
      const screen = row.screen || "unknown";
      const platform = row.platform || "unknown";
      const target = row.target || "unknown";
      const day = row.day;
      const count = Number(row.event_count) || 0;

      const surface = bySurface.get(screen) ?? { taps: 0, completions: 0, copies: 0 };
      bumpCounts(surface, row.event_name, count);
      bySurface.set(screen, surface);

      const platformBucket = byPlatform.get(platform) ?? { taps: 0, completions: 0, copies: 0 };
      bumpCounts(platformBucket, row.event_name, count);
      byPlatform.set(platform, platformBucket);

      // Skip taps for the target breakdown — share destinations only
      // exist at the completion/copy stage.
      if (
        row.event_name === "booking_link_share_completed" ||
        row.event_name === "booking_link_copied"
      ) {
        const targetBucket =
          byTarget.get(target) ?? { taps: 0, completions: 0, copies: 0 };
        bumpCounts(targetBucket, row.event_name, count);
        byTarget.set(target, targetBucket);
      }

      bumpCounts(totals, row.event_name, count);

      if (day && totalsByDay.has(day)) {
        bumpCounts(totalsByDay.get(day)!, row.event_name, count);
      }

      if (day) {
        let platformDays = byPlatformByDay.get(platform);
        if (!platformDays) {
          platformDays = makeEmptyDayMap();
          byPlatformByDay.set(platform, platformDays);
        }
        if (platformDays.has(day)) {
          bumpCounts(platformDays.get(day)!, row.event_name, count);
        }
      }
    }

    const tapToCompletionRate =
      totals.taps > 0 ? Number((totals.completions / totals.taps).toFixed(4)) : 0;

    const surfaces = Array.from(bySurface.entries())
      .map(([screen, counts]) => ({
        screen,
        taps: counts.taps,
        completions: counts.completions,
        copies: counts.copies,
        tapToCompletionRate:
          counts.taps > 0 ? Number((counts.completions / counts.taps).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.taps + b.completions + b.copies - (a.taps + a.completions + a.copies));

    const platforms = Array.from(byPlatform.entries())
      .map(([platform, counts]) => ({
        platform,
        taps: counts.taps,
        completions: counts.completions,
        copies: counts.copies,
        tapToCompletionRate:
          counts.taps > 0 ? Number((counts.completions / counts.taps).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.taps + b.completions + b.copies - (a.taps + a.completions + a.copies));

    // Total share destinations recorded so the frontend can show the
    // share of "tagged" completions vs the long-tail "unknown" bucket.
    const totalTaggedCompletions = Array.from(byTarget.entries()).reduce(
      (acc, [, counts]) => acc + counts.completions + counts.copies,
      0,
    );
    const targets = Array.from(byTarget.entries())
      .map(([target, counts]) => {
        const denom = counts.completions + counts.copies;
        return {
          target,
          completions: counts.completions,
          copies: counts.copies,
          shareOfCompletions:
            totalTaggedCompletions > 0
              ? Number((denom / totalTaggedCompletions).toFixed(4))
              : 0,
        };
      })
      .sort(
        (a, b) =>
          b.completions + b.copies - (a.completions + a.copies),
      );

    const series = dayBuckets.map((date) => {
      const counts = totalsByDay.get(date)!;
      return { date, taps: counts.taps, completions: counts.completions, copies: counts.copies };
    });

    const platformSeries: Record<
      string,
      Array<{ date: string; taps: number; completions: number; copies: number }>
    > = {};
    Array.from(byPlatformByDay.entries()).forEach(([platform, dayMap]) => {
      platformSeries[platform] = dayBuckets.map((date) => {
        const counts = dayMap.get(date)!;
        return { date, taps: counts.taps, completions: counts.completions, copies: counts.copies };
      });
    });

    res.json({
      period: `Last ${days} days`,
      totals: {
        taps: totals.taps,
        completions: totals.completions,
        copies: totals.copies,
        tapToCompletionRate,
      },
      surfaces,
      platforms,
      targets,
      series,
      platformSeries,
      notes: {
        taps: "Counts every press of the Share button (server-recorded via /api/track/booking-link-share-tap). On the client this is mirrored as the PostHog `booking_link_share_opened` event — fired on tap regardless of whether the share sheet is confirmed or cancelled. Use this (not `booking_link_shared`) for top-of-funnel share intent in PostHog.",
        completions: "Counts every confirmed share-sheet send OR successful copy fallback that calls /api/track/booking-link-shared. The client mirrors this with the PostHog `booking_link_shared` event, which now only fires after the OS share sheet returns success (or after a successful copy when share isn't available) — cancelled share sheets are no longer counted (Task #98). Older `booking_link_shared` milestone events (one per user) are excluded so the rate is not skewed.",
        copies: "Counts every booking link copy via /api/track/booking-link-copied (also mirrored as PostHog `booking_link_copied`).",
        platforms: "Device platform comes from the `X-Client-Platform` request header (web/ios/android). Events recorded before this breakdown shipped have no platform tag and surface as `unknown`.",
        targets: "Share destination (Messages, Mail, WhatsApp, etc.) comes from the OS share sheet. iOS exposes the UIActivity.ActivityType reverse-DNS string; Android exposes the chosen package name via `Intent.EXTRA_CHOSEN_COMPONENT`. The client normalizes both to the same short token, so `com.whatsapp` and `net.whatsapp.WhatsApp.ShareExtension` both bucket as `whatsapp`. Copy fallbacks bucket as `copy`. Most desktop browsers, older clients, and dismissed share sheets surface as `unknown`.",
        series: "Daily rollup of taps/completions/copies across all surfaces. `platformSeries` provides the same daily rollup faceted per platform so trends can be compared across web/ios/android.",
        historical: "Heads up: this report is unaffected, but raw `booking_link_shared` totals in PostHog before Task #98 (April 2026) are inflated because every Share-button tap was logged as a completion — including cancelled share sheets. When comparing this card to older PostHog dashboards/insights/alerts that key off `booking_link_shared`, expect post-Task-#98 numbers to be lower. Top-of-funnel PostHog reports should be migrated to `booking_link_share_opened`; conversion/completion reports should keep `booking_link_shared` with a note about the semantic change.",
      },
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching share funnel:", error);
    res.status(500).json({ error: "Failed to fetch share funnel" });
  }
});

export default router;
