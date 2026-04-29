import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, leads, jobs, invoices, eventsCanonical, metricsDaily, adminActionAudit, bookingPages, bookingPageEvents, outboundMessages, outboundMessageEvents } from "@shared/schema";
import { eq, sql, desc, and, gte, lte, isNull, isNotNull, count } from "drizzle-orm";
import { adminMiddleware, AdminRequest, requireRole } from "../copilot/adminMiddleware";
import { logger } from "../lib/logger";
import { Plan, PLAN_PRICES_CENTS } from "@shared/plans";
import { safeParseJsonColumn } from "./jsonColumn";

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
      context: safeParseJsonColumn(r.extra, {
        endpoint: "analytics_user_timeline",
        rowId: r.timestamp,
        column: "extra",
      }),
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

// First Booking funnel: aggregates the journey of pre-generated booking
// pages (created by the Growth Engine and unclaimed by default) into a
// classic funnel: pages generated → viewed → claimed → link shared →
// first invoice paid by the converted user. Per-category breakdown lets
// us tell which acquisition cohorts (e.g. "moving" vs "cleaning") are
// converting vs stuck mid-funnel.
//
// Time filter applies to the page's `created_at` so that "last 7d" means
// "of the pages we generated in the last 7 days, how many made it through
// each step". Conversion (paid invoice) checks any paid invoice owned by
// the claimer — a claimed user only ever shows up here once because the
// claim flow creates a brand-new user, so the first paid invoice for that
// user is the first invoice paid attributable to this acquisition page.

function parseFunnelWindowDays(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 30;
  const value = String(raw).toLowerCase();
  if (value === "all" || value === "0") return null;
  const n = parseInt(value, 10);
  if (Number.isFinite(n) && n > 0 && n <= 365 * 5) return n;
  return 30;
}

function windowStartIso(days: number | null): string | null {
  if (days === null) return null;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

// Cohort filter: this report is about Growth-Engine-generated unclaimed
// booking pages. The `booking_pages` table also stores user-created pages
// (source = 'user_created'), which represent providers' personal booking
// links — they are NOT acquisition pages and would pollute the funnel
// numbers (a `user_created` page is "claimed" the moment it exists, so
// counting it would inflate the claim rate to ~100% and the per-category
// breakdown would be meaningless). By default every funnel query is
// restricted to source = 'growth_engine'. Admins can override the source
// (e.g. to inspect another acquisition channel) via the `source` query
// param, and `source=all` removes the source filter entirely.
const FUNNEL_SOURCE = "growth_engine";

// Sentinel value used by both the `source` and `location` query params to
// mean "do not filter on this column". The frontend renders these as the
// "All" option in each dropdown.
const FUNNEL_FILTER_ALL = "all";

// Resolves the `source` query param. Omitted -> default cohort
// ('growth_engine'). 'all' (case-insensitive) -> no source filter. Any
// other value -> filter to exactly that source. The value is trimmed but
// otherwise passed through unchanged so it matches the source string
// stored in `booking_pages.source` (which is itself lower-case today,
// e.g. 'growth_engine' / 'user_created').
function parseFunnelSource(raw: unknown): string | null {
  if (raw === undefined || raw === null) return FUNNEL_SOURCE;
  const value = String(raw).trim();
  if (value === "") return FUNNEL_SOURCE;
  if (value.toLowerCase() === FUNNEL_FILTER_ALL) return null;
  return value;
}

// Resolves the `location` query param. Omitted or 'all' -> no location
// filter. Any other value -> filter to exactly that location string. We
// preserve the case of the stored value (e.g. "Brooklyn") so admins can
// pick the exact value from the dropdown without guessing capitalization.
function parseFunnelLocation(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  if (value === "") return null;
  if (value.toLowerCase() === FUNNEL_FILTER_ALL) return null;
  return value;
}

router.get("/first-booking-funnel", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseFunnelWindowDays(req.query.days);
    const windowStart = windowStartIso(days);
    const sourceFilter = parseFunnelSource(req.query.source);
    const locationFilter = parseFunnelLocation(req.query.location);

    const result = await db.execute(sql`
      WITH page_event_flags AS (
        SELECT
          p.id,
          COALESCE(NULLIF(p.category, ''), 'uncategorized') AS category,
          COALESCE(NULLIF(p.source, ''), 'unknown') AS source,
          p.claimed,
          p.claimed_by_user_id,
          EXISTS (
            SELECT 1 FROM booking_page_events e
            WHERE e.page_id = p.id AND e.type = 'page_viewed'
          ) AS viewed,
          EXISTS (
            SELECT 1 FROM booking_page_events e
            WHERE e.page_id = p.id AND e.type IN ('link_copied', 'link_shared')
          ) AS shared,
          (
            p.claimed_by_user_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM invoices i
              WHERE i.user_id = p.claimed_by_user_id
                AND i.paid_at IS NOT NULL
            )
          ) AS paid
        FROM booking_pages p
        WHERE (${sourceFilter}::text IS NULL OR p.source = ${sourceFilter})
          AND (${locationFilter}::text IS NULL OR p.location = ${locationFilter})
          AND (${windowStart}::text IS NULL OR p.created_at >= ${windowStart})
      )
      SELECT
        category,
        COUNT(*)::int AS generated,
        SUM(CASE WHEN viewed THEN 1 ELSE 0 END)::int AS viewed,
        SUM(CASE WHEN claimed THEN 1 ELSE 0 END)::int AS claimed,
        SUM(CASE WHEN shared THEN 1 ELSE 0 END)::int AS shared,
        SUM(CASE WHEN paid THEN 1 ELSE 0 END)::int AS paid
      FROM page_event_flags
      GROUP BY category
      ORDER BY generated DESC, category ASC
    `);

    // Populate the source/location dropdowns from the actual data inside
    // the same time window. We deliberately do NOT apply the source or
    // location filters when building these option lists — otherwise the
    // dropdown options would shrink as the user filters and you couldn't
    // switch back to a previously visible value.
    const filterOptions = await db.execute(sql`
      SELECT
        COALESCE(NULLIF(p.source, ''), 'unknown') AS source,
        p.location AS location
      FROM booking_pages p
      WHERE (${windowStart}::text IS NULL OR p.created_at >= ${windowStart})
    `);

    const sourceSet = new Set<string>();
    const locationSet = new Set<string>();
    for (const row of filterOptions.rows as any[]) {
      const src = (row.source as string | null) ?? "unknown";
      sourceSet.add(src);
      const loc = row.location as string | null;
      if (loc && String(loc).trim() !== "") locationSet.add(String(loc));
    }

    const categories = (result.rows as any[]).map((r) => ({
      category: r.category as string,
      generated: Number(r.generated || 0),
      viewed: Number(r.viewed || 0),
      claimed: Number(r.claimed || 0),
      shared: Number(r.shared || 0),
      paid: Number(r.paid || 0),
    }));

    const totals = categories.reduce(
      (acc, row) => ({
        generated: acc.generated + row.generated,
        viewed: acc.viewed + row.viewed,
        claimed: acc.claimed + row.claimed,
        shared: acc.shared + row.shared,
        paid: acc.paid + row.paid,
      }),
      { generated: 0, viewed: 0, claimed: 0, shared: 0, paid: 0 },
    );

    // Daily rollup for the trend chart. For each page we derive the day
    // it first hit each stage (generated = created_at, viewed = first
    // page_viewed event, claimed = claimed_at, shared = first
    // link_copied/link_shared event, paid = first paid invoice for the
    // claimer). Each page contributes at most 1 per stage per day, which
    // matches the per-page binary counting used for `totals` and
    // `categories` above. Cohort filter (source = 'growth_engine') and
    // the time window on `created_at` mirror the aggregate query, so the
    // sum of each series equals its corresponding total.
    const seriesResult = await db.execute(sql`
      WITH page_event_dates AS (
        SELECT
          p.id,
          LEFT(p.created_at, 10) AS generated_day,
          LEFT(p.claimed_at, 10) AS claimed_day,
          (
            SELECT LEFT(MIN(e.created_at), 10) FROM booking_page_events e
            WHERE e.page_id = p.id AND e.type = 'page_viewed'
          ) AS viewed_day,
          (
            SELECT LEFT(MIN(e.created_at), 10) FROM booking_page_events e
            WHERE e.page_id = p.id AND e.type IN ('link_copied', 'link_shared')
          ) AS shared_day,
          CASE WHEN p.claimed_by_user_id IS NOT NULL THEN (
            SELECT LEFT(MIN(i.paid_at), 10) FROM invoices i
            WHERE i.user_id = p.claimed_by_user_id
              AND i.paid_at IS NOT NULL
          ) END AS paid_day
        FROM booking_pages p
        WHERE p.source = ${FUNNEL_SOURCE}
          AND (${windowStart}::text IS NULL OR p.created_at >= ${windowStart})
      )
      SELECT
        day,
        SUM(generated)::int AS generated,
        SUM(viewed)::int AS viewed,
        SUM(claimed)::int AS claimed,
        SUM(shared)::int AS shared,
        SUM(paid)::int AS paid
      FROM (
        SELECT generated_day AS day, 1 AS generated, 0 AS viewed, 0 AS claimed, 0 AS shared, 0 AS paid
          FROM page_event_dates WHERE generated_day IS NOT NULL
        UNION ALL
        SELECT viewed_day AS day, 0, 1, 0, 0, 0
          FROM page_event_dates WHERE viewed_day IS NOT NULL
        UNION ALL
        SELECT claimed_day AS day, 0, 0, 1, 0, 0
          FROM page_event_dates WHERE claimed_day IS NOT NULL
        UNION ALL
        SELECT shared_day AS day, 0, 0, 0, 1, 0
          FROM page_event_dates WHERE shared_day IS NOT NULL
        UNION ALL
        SELECT paid_day AS day, 0, 0, 0, 0, 1
          FROM page_event_dates WHERE paid_day IS NOT NULL
      ) t
      GROUP BY day
      ORDER BY day
    `);

    type DayCounts = {
      generated: number;
      viewed: number;
      claimed: number;
      shared: number;
      paid: number;
    };
    const emptyCounts = (): DayCounts => ({
      generated: 0,
      viewed: 0,
      claimed: 0,
      shared: 0,
      paid: 0,
    });

    const seriesMap = new Map<string, DayCounts>();
    for (const r of seriesResult.rows as any[]) {
      const day = r.day as string | null;
      if (!day) continue;
      seriesMap.set(day, {
        generated: Number(r.generated || 0),
        viewed: Number(r.viewed || 0),
        claimed: Number(r.claimed || 0),
        shared: Number(r.shared || 0),
        paid: Number(r.paid || 0),
      });
    }

    // Determine the chart's continuous date range. For a fixed window
    // (7d / 30d) we anchor to the requested windowStart so the x-axis
    // shows the full period even if some days have no activity. For
    // "all" we anchor to the earliest non-empty day in the result so the
    // chart isn't dominated by an indefinite empty prefix; if there is
    // no data we return an empty series.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    let startStr: string | null = null;
    if (windowStart) {
      startStr = windowStart.slice(0, 10);
    } else if (seriesMap.size > 0) {
      startStr = Array.from(seriesMap.keys()).sort()[0];
    }

    const series: Array<{ date: string } & DayCounts> = [];
    if (startStr) {
      const cursor = new Date(`${startStr}T00:00:00Z`);
      const end = new Date(`${todayStr}T00:00:00Z`);
      // Make sure we always include at least one bucket so the chart
      // component can distinguish "no data yet" from "loading".
      while (cursor.getTime() <= end.getTime()) {
        const key = cursor.toISOString().slice(0, 10);
        const counts = seriesMap.get(key) ?? emptyCounts();
        series.push({ date: key, ...counts });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    res.json({
      window: days === null ? "all" : `${days}d`,
      filters: {
        source: sourceFilter ?? FUNNEL_FILTER_ALL,
        location: locationFilter ?? FUNNEL_FILTER_ALL,
      },
      filterOptions: {
        sources: Array.from(sourceSet).sort((a, b) => a.localeCompare(b)),
        locations: Array.from(locationSet).sort((a, b) => a.localeCompare(b)),
      },
      totals,
      categories,
      series,
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching first-booking funnel:", error);
    res.status(500).json({ error: "Failed to fetch first-booking funnel" });
  }
});

router.get("/first-booking-funnel/pages", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseFunnelWindowDays(req.query.days);
    const windowStart = windowStartIso(days);
    const sourceFilter = parseFunnelSource(req.query.source);
    const locationFilter = parseFunnelLocation(req.query.location);
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);

    const result = await db.execute(sql`
      SELECT
        p.id,
        COALESCE(NULLIF(p.category, ''), 'uncategorized') AS category,
        COALESCE(NULLIF(p.source, ''), 'unknown') AS source,
        p.location,
        p.claimed,
        p.claimed_at,
        p.claimed_by_user_id,
        p.created_at,
        EXISTS (
          SELECT 1 FROM booking_page_events e
          WHERE e.page_id = p.id AND e.type = 'page_viewed'
        ) AS viewed,
        EXISTS (
          SELECT 1 FROM booking_page_events e
          WHERE e.page_id = p.id AND e.type IN ('link_copied', 'link_shared')
        ) AS shared,
        (
          SELECT MIN(i.paid_at) FROM invoices i
          WHERE p.claimed_by_user_id IS NOT NULL
            AND i.user_id = p.claimed_by_user_id
            AND i.paid_at IS NOT NULL
        ) AS first_paid_at
      FROM booking_pages p
      WHERE (${sourceFilter}::text IS NULL OR p.source = ${sourceFilter})
        AND (${locationFilter}::text IS NULL OR p.location = ${locationFilter})
        AND (${windowStart}::text IS NULL OR p.created_at >= ${windowStart})
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `);

    const pages = (result.rows as any[]).map((r) => ({
      id: r.id as string,
      category: r.category as string,
      source: r.source as string,
      location: (r.location as string | null) ?? null,
      claimed: !!r.claimed,
      claimedAt: (r.claimed_at as string | null) ?? null,
      claimedByUserId: (r.claimed_by_user_id as string | null) ?? null,
      createdAt: r.created_at as string,
      viewed: !!r.viewed,
      shared: !!r.shared,
      firstPaidAt: (r.first_paid_at as string | null) ?? null,
    }));

    res.json({
      window: days === null ? "all" : `${days}d`,
      limit,
      pages,
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching first-booking pages list:", error);
    res.status(500).json({ error: "Failed to fetch first-booking pages list" });
  }
});

router.get("/first-booking-funnel/pages/:pageId", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const pageId = req.params.pageId;
    if (!pageId) {
      return res.status(400).json({ error: "Missing pageId" });
    }

    const [page] = await db
      .select()
      .from(bookingPages)
      .where(eq(bookingPages.id, pageId))
      .limit(1);

    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    // Mirror the cohort filter from the aggregate/list endpoints — this
    // detail view is only meaningful for Growth Engine acquisition pages.
    // user_created pages have their own UI elsewhere.
    if (page.source !== FUNNEL_SOURCE) {
      return res.status(404).json({ error: "Page not found" });
    }

    const events = await db
      .select({
        id: bookingPageEvents.id,
        type: bookingPageEvents.type,
        variant: bookingPageEvents.variant,
        metadata: bookingPageEvents.metadata,
        createdAt: bookingPageEvents.createdAt,
      })
      .from(bookingPageEvents)
      .where(eq(bookingPageEvents.pageId, pageId))
      .orderBy(bookingPageEvents.createdAt);

    let claimer: { id: string; name: string | null; email: string | null } | null = null;
    let firstPaidAt: string | null = null;
    let totalPaidInvoices = 0;
    if (page.claimedByUserId) {
      const [u] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, page.claimedByUserId))
        .limit(1);
      if (u) claimer = { id: u.id, name: u.name ?? null, email: u.email ?? null };

      const paidRow = await db.execute(sql`
        SELECT MIN(paid_at) AS first_paid_at, COUNT(*)::int AS total_paid
        FROM invoices
        WHERE user_id = ${page.claimedByUserId}
          AND paid_at IS NOT NULL
      `);
      const row = (paidRow.rows as any[])[0];
      if (row) {
        firstPaidAt = (row.first_paid_at as string | null) ?? null;
        totalPaidInvoices = Number(row.total_paid || 0);
      }
    }

    res.json({
      page: {
        id: page.id,
        category: page.category,
        location: page.location,
        source: page.source,
        phone: page.phone,
        claimed: page.claimed,
        claimedAt: page.claimedAt,
        claimedByUserId: page.claimedByUserId,
        createdAt: page.createdAt,
      },
      claimer,
      firstPaidAt,
      totalPaidInvoices,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        variant: e.variant,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching first-booking page detail:", error);
    res.status(500).json({ error: "Failed to fetch first-booking page detail" });
  }
});

// First-booking email open / click / downstream-conversion report (Task #81).
// Aggregates outbound_messages of types `first_booking_email_2h` and
// `first_booking_email_48h` over the last `days` days (default 30) and joins
// against outbound_message_events to compute open and click rates per touch.
// Downstream first-booking attribution uses jobs.createdAt > sentAt against
// the same userId — a user is considered "first-booking converted" if their
// earliest job was created after the touch was sent.
router.get("/first-booking-emails", adminMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const days = Math.max(1, Math.min(180, parseInt(req.query.days as string) || 30));
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const FIRST_BOOKING_EMAIL_TYPES = ["first_booking_email_2h", "first_booking_email_48h"];

    // Per-touch aggregation. We compute:
    //   sent = COUNT(*) of sent rows
    //   uniqueOpens / uniqueClicks = DISTINCT outbound_message_id with a matching event
    //   opens / clicks = total event count
    //   firstBookingsAfter = users with at least one job created after the touch was sent
    const result = await db.execute(sql`
      WITH sent_touches AS (
        SELECT
          om.id              AS message_id,
          om.user_id         AS user_id,
          om.type            AS touch_type,
          om.sent_at         AS sent_at
        FROM outbound_messages om
        WHERE om.channel = 'email'
          AND om.type IN ('first_booking_email_2h', 'first_booking_email_48h')
          AND om.status = 'sent'
          AND om.sent_at IS NOT NULL
          AND om.sent_at >= ${sinceIso}
      ),
      event_counts AS (
        SELECT
          ome.outbound_message_id,
          ome.message_type,
          COUNT(*) FILTER (WHERE ome.event_type = 'open')          AS opens,
          COUNT(*) FILTER (WHERE ome.event_type = 'click')         AS clicks,
          COUNT(*) FILTER (WHERE ome.event_type = 'delivered')     AS delivereds,
          COUNT(*) FILTER (WHERE ome.event_type = 'bounce')        AS bounces,
          COUNT(*) FILTER (WHERE ome.event_type = 'spamreport')    AS spamreports,
          MAX(CASE WHEN ome.event_type = 'open'  THEN 1 ELSE 0 END) AS any_open,
          MAX(CASE WHEN ome.event_type = 'click' THEN 1 ELSE 0 END) AS any_click
        FROM outbound_message_events ome
        WHERE ome.message_type IN ('first_booking_email_2h', 'first_booking_email_48h')
        GROUP BY ome.outbound_message_id, ome.message_type
      ),
      first_jobs AS (
        SELECT user_id, MIN(created_at) AS first_job_at
        FROM jobs
        WHERE user_id IN (SELECT user_id FROM sent_touches)
        GROUP BY user_id
      )
      SELECT
        s.touch_type,
        COUNT(*)::int                                                          AS sent,
        COALESCE(SUM(ec.delivereds), 0)::int                                   AS delivereds,
        COALESCE(SUM(ec.bounces), 0)::int                                      AS bounces,
        COALESCE(SUM(ec.spamreports), 0)::int                                  AS spamreports,
        COALESCE(SUM(ec.opens), 0)::int                                        AS opens,
        COALESCE(SUM(ec.clicks), 0)::int                                       AS clicks,
        COALESCE(SUM(ec.any_open), 0)::int                                     AS unique_opens,
        COALESCE(SUM(ec.any_click), 0)::int                                    AS unique_clicks,
        SUM(CASE WHEN fj.first_job_at IS NOT NULL AND fj.first_job_at > s.sent_at THEN 1 ELSE 0 END)::int AS first_bookings_after
      FROM sent_touches s
      LEFT JOIN event_counts ec ON ec.outbound_message_id = s.message_id
      LEFT JOIN first_jobs   fj ON fj.user_id            = s.user_id
      GROUP BY s.touch_type
      ORDER BY s.touch_type
    `);

    const touches = (result.rows as any[]).map((r) => {
      const sent = Number(r.sent || 0);
      const uniqueOpens = Number(r.unique_opens || 0);
      const uniqueClicks = Number(r.unique_clicks || 0);
      const firstBookingsAfter = Number(r.first_bookings_after || 0);
      const ratio = (n: number) => (sent > 0 ? +(n / sent * 100).toFixed(2) : 0);
      return {
        touchType: r.touch_type,
        sent,
        delivered: Number(r.delivereds || 0),
        bounces: Number(r.bounces || 0),
        spamReports: Number(r.spamreports || 0),
        opens: Number(r.opens || 0),
        clicks: Number(r.clicks || 0),
        uniqueOpens,
        uniqueClicks,
        openRate: ratio(uniqueOpens),
        clickRate: ratio(uniqueClicks),
        clickToOpenRate: uniqueOpens > 0 ? +((uniqueClicks / uniqueOpens) * 100).toFixed(2) : 0,
        firstBookingsAfter,
        downstreamFirstBookingRate: ratio(firstBookingsAfter),
      };
    });

    // Make sure both touch types always appear in the response (zeroed if no data).
    for (const t of FIRST_BOOKING_EMAIL_TYPES) {
      if (!touches.find((row) => row.touchType === t)) {
        touches.push({
          touchType: t,
          sent: 0,
          delivered: 0,
          bounces: 0,
          spamReports: 0,
          opens: 0,
          clicks: 0,
          uniqueOpens: 0,
          uniqueClicks: 0,
          openRate: 0,
          clickRate: 0,
          clickToOpenRate: 0,
          firstBookingsAfter: 0,
          downstreamFirstBookingRate: 0,
        });
      }
    }
    touches.sort((a, b) => a.touchType.localeCompare(b.touchType));

    res.json({
      windowDays: days,
      since: sinceIso,
      touches,
      notes: {
        openRate:
          "Unique opens divided by sent rows. Counts a recipient at most once per touch.",
        clickRate:
          "Unique clicks (any URL in the email body) divided by sent rows. Counts a recipient at most once per touch.",
        downstreamFirstBookingRate:
          "Share of recipients whose earliest job was created strictly after this touch's sent_at. This is a directional proxy for conversion — it does not prove the touch caused the booking, just that a booking happened afterwards.",
        ingestion:
          "Open and click events are populated by SendGrid's event webhook (POST /api/webhooks/sendgrid/events). If the webhook is not yet configured in SendGrid, sent counts will populate but opens/clicks will be zero.",
      },
    });
  } catch (error) {
    logger.error("[Analytics] Error fetching first-booking email metrics:", error);
    res.status(500).json({ error: "Failed to fetch first-booking email metrics" });
  }
});

export default router;
