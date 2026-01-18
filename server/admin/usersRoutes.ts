import { Router } from "express";
import { db } from "../db";
import { 
  users,
  jobs,
  leads,
  invoices,
  eventsCanonical,
  adminActionAudit,
  userAdminNotes,
  userFlags,
  messagingSuppression,
  adminActionKeys,
  type AdminActionKey
} from "@shared/schema";
import { eq, desc, and, or, ilike, gte, count, sql, isNull, isNotNull, lte } from "drizzle-orm";
import { adminMiddleware } from "../copilot/adminMiddleware";

const router = Router();

router.use(adminMiddleware);

const ADMIN_RATE_LIMIT_PER_DAY = 20;

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const results = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      phone: users.phone,
      isPro: users.isPro,
      onboardingCompleted: users.onboardingCompleted,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      or(
        ilike(users.email, `%${q}%`),
        ilike(users.username, `%${q}%`),
        ilike(users.id, `%${q}%`),
        ilike(users.phone, `%${q}%`)
      )
    )
    .limit(25);

    res.json({ users: results });
  } catch (error) {
    console.error("[Admin Users] Search error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

router.get("/views", async (req, res) => {
  try {
    const view = req.query.view as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let results: any[] = [];
    let total = 0;

    switch (view) {
      case "onboarding_stalled": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(eq(users.onboardingCompleted, false));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          onboardingStep: users.onboardingStep,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.onboardingCompleted, false))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "high_intent_no_booking": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(and(
            isNotNull(users.publicProfileSlug),
            eq(users.onboardingCompleted, true)
          ));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          publicProfileSlug: users.publicProfileSlug,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(
          isNotNull(users.publicProfileSlug),
          eq(users.onboardingCompleted, true)
        ))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "payment_failed_recent": {
        const failedPaymentUsers = await db.select({
          userId: eventsCanonical.userId,
        })
        .from(eventsCanonical)
        .where(and(
          eq(eventsCanonical.eventName, "payment_failed"),
          gte(eventsCanonical.occurredAt, sevenDaysAgo)
        ))
        .groupBy(eventsCanonical.userId);

        const userIds = failedPaymentUsers.map(u => u.userId).filter(Boolean) as string[];
        
        if (userIds.length > 0) {
          results = await db.select({
            id: users.id,
            email: users.email,
            username: users.username,
            name: users.name,
            isPro: users.isPro,
            lastActiveAt: users.lastActiveAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(sql`${users.id} = ANY(${userIds})`)
          .limit(limit)
          .offset(offset);
        }
        total = userIds.length;
        break;
      }

      case "inactive_7d_paying": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(and(
            eq(users.isPro, true),
            lte(users.lastActiveAt, sevenDaysAgo)
          ));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          isPro: users.isPro,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(
          eq(users.isPro, true),
          lte(users.lastActiveAt, sevenDaysAgo)
        ))
        .orderBy(users.lastActiveAt)
        .limit(limit)
        .offset(offset);
        break;
      }

      case "churned_30d": {
        const churnedUsers = await db.select({
          userId: eventsCanonical.userId,
        })
        .from(eventsCanonical)
        .where(and(
          eq(eventsCanonical.eventName, "subscription_canceled"),
          gte(eventsCanonical.occurredAt, thirtyDaysAgo)
        ))
        .groupBy(eventsCanonical.userId);

        const userIds = churnedUsers.map(u => u.userId).filter(Boolean) as string[];
        
        if (userIds.length > 0) {
          results = await db.select({
            id: users.id,
            email: users.email,
            username: users.username,
            name: users.name,
            isPro: users.isPro,
            lastActiveAt: users.lastActiveAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(sql`${users.id} = ANY(${userIds})`)
          .limit(limit)
          .offset(offset);
        }
        total = userIds.length;
        break;
      }

      default:
        return res.status(400).json({ error: "Invalid view parameter" });
    }

    res.json({
      users: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      view,
    });
  } catch (error) {
    console.error("[Admin Users] Views error:", error);
    res.status(500).json({ error: "Failed to fetch view" });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const from = req.query.from as string;
    const metric = req.query.metric as string;
    const alert = req.query.alert as string;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [jobsResult] = await db.select({ count: count() }).from(jobs).where(eq(jobs.userId, userId));
    const [leadsResult] = await db.select({ count: count() }).from(leads).where(eq(leads.userId, userId));
    const [invoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.userId, userId));
    
    const [completedJobsResult] = await db.select({ count: count() })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), eq(jobs.status, "completed")));

    const [paidInvoicesResult] = await db.select({ count: count() })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, "paid")));

    const [convertedLeadsResult] = await db.select({ count: count() })
      .from(leads)
      .where(and(eq(leads.userId, userId), isNotNull(leads.convertedAt)));

    const [firstJob] = await db.select({ createdAt: jobs.createdAt })
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(jobs.createdAt)
      .limit(1);

    const notes = await db.select()
      .from(userAdminNotes)
      .where(eq(userAdminNotes.targetUserId, userId))
      .orderBy(desc(userAdminNotes.createdAt))
      .limit(10);

    const [activeFlag] = await db.select()
      .from(userFlags)
      .where(and(eq(userFlags.userId, userId), isNull(userFlags.unflaggedAt)))
      .limit(1);

    const [activeSuppression] = await db.select()
      .from(messagingSuppression)
      .where(and(
        eq(messagingSuppression.userId, userId),
        isNull(messagingSuppression.unsuppressedAt),
        gte(messagingSuppression.suppressUntil, new Date().toISOString())
      ))
      .limit(1);

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        phone: user.phone,
        isPro: user.isPro,
        proExpiresAt: user.proExpiresAt,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        publicProfileSlug: user.publicProfileSlug,
        isFlagged: !!activeFlag,
        flagReason: activeFlag?.reason,
        isMessagingSuppressed: !!activeSuppression,
        messagingSuppressedUntil: activeSuppression?.suppressUntil,
      },
      funnelState: {
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep || 0,
        hasBookingLink: !!user.publicProfileSlug,
        leadsReceived: leadsResult?.count || 0,
        leadsConverted: convertedLeadsResult?.count || 0,
        estimatesSent: 0,
        estimatesConfirmed: 0,
        firstBookingAt: firstJob?.createdAt,
        totalJobs: jobsResult?.count || 0,
        completedJobs: completedJobsResult?.count || 0,
        totalInvoices: invoicesResult?.count || 0,
        paidInvoices: paidInvoicesResult?.count || 0,
      },
      notes,
      context: from === "cockpit" ? { from, metric, alert } : null,
    });
  } catch (error) {
    console.error("[Admin Users] User detail error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/:userId/timeline", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await db.select()
      .from(eventsCanonical)
      .where(eq(eventsCanonical.userId, userId))
      .orderBy(desc(eventsCanonical.occurredAt))
      .limit(limit);

    res.json({
      events: events.map(e => ({
        id: e.id,
        eventName: e.eventName,
        occurredAt: e.occurredAt,
        source: e.source,
        context: e.context ? JSON.parse(e.context) : null,
      })),
    });
  } catch (error) {
    console.error("[Admin Users] Timeline error:", error);
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

router.get("/:userId/messaging", async (req, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db.select({
      email: users.email,
      phone: users.phone,
      notifyBySms: users.notifyBySms,
      notifyByEmail: users.notifyByEmail,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const [activeSuppression] = await db.select()
      .from(messagingSuppression)
      .where(and(
        eq(messagingSuppression.userId, userId),
        isNull(messagingSuppression.unsuppressedAt),
        gte(messagingSuppression.suppressUntil, new Date().toISOString())
      ))
      .limit(1);

    res.json({
      customerIo: {
        status: "link_out_only",
        note: "Customer.io integration - use external dashboard",
      },
      oneSignal: {
        pushEnabled: user?.notifyBySms || false,
        status: "link_out_only",
        note: "OneSignal integration - use external dashboard",
      },
      preferences: {
        notifyBySms: user?.notifyBySms ?? true,
        notifyByEmail: user?.notifyByEmail ?? true,
      },
      suppression: activeSuppression ? {
        active: true,
        until: activeSuppression.suppressUntil,
        reason: activeSuppression.reason,
      } : null,
    });
  } catch (error) {
    console.error("[Admin Users] Messaging error:", error);
    res.status(500).json({ error: "Failed to fetch messaging status" });
  }
});

router.get("/:userId/payments", async (req, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db.select({
      isPro: users.isPro,
      proExpiresAt: users.proExpiresAt,
      stripeConnectAccountId: users.stripeConnectAccountId,
      stripeConnectStatus: users.stripeConnectStatus,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const [invoicesTotal] = await db.select({ count: count() })
      .from(invoices)
      .where(eq(invoices.userId, userId));

    const [invoicesPaid] = await db.select({ count: count() })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, "paid")));

    res.json({
      subscription: {
        isPro: user?.isPro || false,
        expiresAt: user?.proExpiresAt,
      },
      stripeConnect: {
        accountId: user?.stripeConnectAccountId,
        status: user?.stripeConnectStatus || "not_connected",
      },
      invoices: {
        total: invoicesTotal?.count || 0,
        paid: invoicesPaid?.count || 0,
      },
      note: "For full payment details, use Stripe Dashboard",
    });
  } catch (error) {
    console.error("[Admin Users] Payments error:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.get("/:userId/audit", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const actions = await db.select()
      .from(adminActionAudit)
      .where(eq(adminActionAudit.targetUserId, userId))
      .orderBy(desc(adminActionAudit.createdAt))
      .limit(limit);

    res.json({
      actions: actions.map(a => ({
        id: a.id,
        createdAt: a.createdAt,
        actorUserId: a.actorUserId,
        actorEmail: a.actorEmail,
        actionKey: a.actionKey,
        reason: a.reason,
        payload: a.payload ? JSON.parse(a.payload) : null,
      })),
    });
  } catch (error) {
    console.error("[Admin Users] Audit error:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.post("/:userId/actions", async (req, res) => {
  try {
    const { userId } = req.params;
    const { action_key, reason, payload } = req.body;
    const actorUserId = (req as any).adminUserId || "demo-user";

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Reason is required for all admin actions" });
    }

    if (!adminActionKeys.includes(action_key)) {
      return res.status(400).json({ 
        error: `Invalid action. Allowed actions: ${adminActionKeys.join(", ")}` 
      });
    }

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (action_key === "send_one_off_push") {
      const today = new Date().toISOString().split("T")[0];
      const [pushCount] = await db.select({ count: count() })
        .from(adminActionAudit)
        .where(and(
          eq(adminActionAudit.actorUserId, actorUserId),
          eq(adminActionAudit.actionKey, "send_one_off_push"),
          gte(adminActionAudit.createdAt, today)
        ));

      if ((pushCount?.count || 0) >= ADMIN_RATE_LIMIT_PER_DAY) {
        return res.status(429).json({ 
          error: `Rate limit exceeded. Maximum ${ADMIN_RATE_LIMIT_PER_DAY} pushes per day.` 
        });
      }
    }

    const now = new Date().toISOString();

    switch (action_key as AdminActionKey) {
      case "user_flagged": {
        await db.insert(userFlags).values({
          userId,
          flaggedAt: now,
          flaggedBy: actorUserId,
          reason: reason.trim(),
        });
        break;
      }

      case "add_note": {
        await db.insert(userAdminNotes).values({
          createdAt: now,
          actorUserId,
          targetUserId: userId,
          note: payload?.note || reason,
        });
        break;
      }

      case "reset_onboarding_state": {
        await db.update(users)
          .set({ 
            onboardingCompleted: false, 
            onboardingStep: 0 
          })
          .where(eq(users.id, userId));
        break;
      }

      case "suppress_messaging": {
        const duration = payload?.duration_hours || 24;
        const suppressUntil = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
        
        await db.insert(messagingSuppression).values({
          userId,
          suppressedAt: now,
          suppressedBy: actorUserId,
          suppressUntil,
          reason: reason.trim(),
        });
        break;
      }

      case "unsuppress_messaging": {
        await db.update(messagingSuppression)
          .set({
            unsuppressedAt: now,
            unsuppressedBy: actorUserId,
          })
          .where(and(
            eq(messagingSuppression.userId, userId),
            isNull(messagingSuppression.unsuppressedAt)
          ));
        break;
      }

      case "trigger_webhook_retry": {
        console.log(`[Admin] Webhook retry triggered for user ${userId} - stub implementation`);
        break;
      }

      case "send_one_off_push": {
        console.log(`[Admin] One-off push sent to user ${userId}: ${payload?.message}`);
        break;
      }
    }

    await db.insert(adminActionAudit).values({
      createdAt: now,
      actorUserId,
      actorEmail: null,
      targetUserId: userId,
      actionKey: action_key,
      reason: reason.trim(),
      payload: payload ? JSON.stringify(payload) : null,
      source: "admin_ui",
    });

    res.json({ success: true, message: `Action '${action_key}' completed and logged.` });
  } catch (error) {
    console.error("[Admin Users] Action error:", error);
    res.status(500).json({ error: "Failed to execute action" });
  }
});

router.get("/links/external", async (req, res) => {
  res.json({
    amplitude: {
      baseUrl: process.env.AMPLITUDE_BASE_URL || "https://app.amplitude.com",
      userUrlTemplate: process.env.AMPLITUDE_USER_URL_TEMPLATE || "https://app.amplitude.com/user/{{USER_ID}}",
    },
    customerIo: {
      baseUrl: process.env.CUSTOMERIO_BASE_URL || "https://fly.customer.io",
      userUrlTemplate: process.env.CUSTOMERIO_USER_URL_TEMPLATE || "https://fly.customer.io/env/{{ENV_ID}}/people/{{USER_ID}}",
    },
    oneSignal: {
      baseUrl: process.env.ONESIGNAL_BASE_URL || "https://app.onesignal.com",
      userUrlTemplate: process.env.ONESIGNAL_USER_URL_TEMPLATE || "https://app.onesignal.com/apps/{{APP_ID}}/users/{{USER_ID}}",
    },
    stripe: {
      baseUrl: process.env.STRIPE_DASHBOARD_BASE_URL || "https://dashboard.stripe.com",
      customerUrlTemplate: "https://dashboard.stripe.com/customers/{{CUSTOMER_ID}}",
    },
  });
});

export default router;
