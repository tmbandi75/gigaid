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
  outboundMessages,
  type AdminActionKey
} from "@shared/schema";
import { eq, desc, and, or, ilike, gte, count, sql, isNull, isNotNull, lte } from "drizzle-orm";
import { adminMiddleware, AdminRequest } from "../copilot/adminMiddleware";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

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
    logger.error("[Admin Users] Search error:", error);
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

      case "all_users": {
        const [countResult] = await db.select({ count: count() }).from(users);
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          isPro: users.isPro,
          plan: users.plan,
          onboardingCompleted: users.onboardingCompleted,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "pro_users": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(eq(users.isPro, true));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          isPro: users.isPro,
          plan: users.plan,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.isPro, true))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "free_users": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(eq(users.isPro, false));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          isPro: users.isPro,
          onboardingCompleted: users.onboardingCompleted,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.isPro, false))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "active_7d": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(gte(users.lastActiveAt, sevenDaysAgo));
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
        .where(gte(users.lastActiveAt, sevenDaysAgo))
        .orderBy(desc(users.lastActiveAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "active_30d": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(gte(users.lastActiveAt, thirtyDaysAgo));
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
        .where(gte(users.lastActiveAt, thirtyDaysAgo))
        .orderBy(desc(users.lastActiveAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "comp_access": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(isNotNull(users.compAccessGrantedAt));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          isPro: users.isPro,
          compAccessGrantedAt: users.compAccessGrantedAt,
          compAccessExpiresAt: users.compAccessExpiresAt,
          lastActiveAt: users.lastActiveAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(isNotNull(users.compAccessGrantedAt))
        .orderBy(desc(users.compAccessGrantedAt))
        .limit(limit)
        .offset(offset);
        break;
      }

      case "disabled_accounts": {
        const [countResult] = await db.select({ count: count() })
          .from(users)
          .where(eq(users.isDisabled, true));
        total = countResult?.count || 0;

        results = await db.select({
          id: users.id,
          email: users.email,
          username: users.username,
          name: users.name,
          isDisabled: users.isDisabled,
          disabledAt: users.disabledAt,
          disabledReason: users.disabledReason,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.isDisabled, true))
        .orderBy(desc(users.disabledAt))
        .limit(limit)
        .offset(offset);
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
    logger.error("[Admin Users] Views error:", error);
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
    logger.error("[Admin Users] User detail error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

function safeParseJsonColumn(
  raw: unknown,
  ctx: { endpoint: string; rowId: unknown; column: string },
): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(
      `[Admin Users] ${ctx.endpoint}: failed to JSON.parse ${ctx.column} for row ${String(ctx.rowId)}; returning null`,
      err,
    );
    return null;
  }
}

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
        context: safeParseJsonColumn(e.context, {
          endpoint: "timeline",
          rowId: e.id,
          column: "context",
        }),
      })),
    });
  } catch (error) {
    logger.error("[Admin Users] Timeline error:", error);
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
    logger.error("[Admin Users] Messaging error:", error);
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
    logger.error("[Admin Users] Payments error:", error);
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
        payload: safeParseJsonColumn(a.payload, {
          endpoint: "audit",
          rowId: a.id,
          column: "payload",
        }),
      })),
    });
  } catch (error) {
    logger.error("[Admin Users] Audit error:", error);
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
        logger.info(`[Admin] Webhook retry triggered for user ${userId} - stub implementation`);
        break;
      }

      case "send_one_off_push": {
        logger.info(`[Admin] One-off push sent to user ${userId}: ${payload?.message}`);
        break;
      }

      case "billing_upgrade":
      case "billing_downgrade": {
        const [targetUser] = await db.select({ 
          stripeCustomerId: users.stripeCustomerId,
          stripeSubscriptionId: users.stripeSubscriptionId 
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (!targetUser?.stripeSubscriptionId) {
          return res.status(400).json({ error: "User has no active subscription to modify" });
        }
        
        const newPriceId = payload?.priceId;
        if (!newPriceId) {
          return res.status(400).json({ error: "New price ID is required for plan changes" });
        }
        
        try {
          const stripe = await getUncachableStripeClient();
          const subscription = await stripe.subscriptions.retrieve(targetUser.stripeSubscriptionId);
          
          await stripe.subscriptions.update(targetUser.stripeSubscriptionId, {
            items: [{
              id: subscription.items.data[0].id,
              price: newPriceId,
            }],
            proration_behavior: 'create_prorations',
          });
          
          const newPlan = action_key === "billing_upgrade" ? "upgraded" : "downgraded";
          logger.info(`[Admin] User ${userId} ${newPlan} to price ${newPriceId}`);
        } catch (stripeError: any) {
          logger.error("[Admin] Stripe plan change error:", stripeError);
          return res.status(500).json({ error: `Stripe error: ${stripeError.message}` });
        }
        break;
      }

      case "billing_grant_comp": {
        const compMonths = payload?.months || 1;
        const compEndDate = new Date(Date.now() + compMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
        
        await db.update(users)
          .set({ 
            isPro: true,
            compAccessGrantedAt: now,
            compAccessExpiresAt: compEndDate,
            compAccessGrantedBy: actorUserId,
          })
          .where(eq(users.id, userId));
        
        logger.info(`[Admin] Granted ${compMonths} month(s) comp access to user ${userId}`);
        break;
      }

      case "billing_revoke_comp": {
        await db.update(users)
          .set({ 
            isPro: false,
            compAccessRevokedAt: now,
            compAccessRevokedBy: actorUserId,
          })
          .where(eq(users.id, userId));
        
        logger.info(`[Admin] Revoked comp access for user ${userId}`);
        break;
      }

      case "billing_pause": {
        const [targetUser] = await db.select({ 
          stripeSubscriptionId: users.stripeSubscriptionId 
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (!targetUser?.stripeSubscriptionId) {
          return res.status(400).json({ error: "User has no active subscription to pause" });
        }
        
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.subscriptions.update(targetUser.stripeSubscriptionId, {
            pause_collection: {
              behavior: 'void',
            },
          });
          logger.info(`[Admin] Paused subscription for user ${userId}`);
        } catch (stripeError: any) {
          logger.error("[Admin] Stripe pause error:", stripeError);
          return res.status(500).json({ error: `Stripe error: ${stripeError.message}` });
        }
        break;
      }

      case "billing_resume": {
        const [targetUser] = await db.select({ 
          stripeSubscriptionId: users.stripeSubscriptionId 
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (!targetUser?.stripeSubscriptionId) {
          return res.status(400).json({ error: "User has no subscription to resume" });
        }
        
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.subscriptions.update(targetUser.stripeSubscriptionId, {
            pause_collection: null,
          });
          logger.info(`[Admin] Resumed subscription for user ${userId}`);
        } catch (stripeError: any) {
          logger.error("[Admin] Stripe resume error:", stripeError);
          return res.status(500).json({ error: `Stripe error: ${stripeError.message}` });
        }
        break;
      }

      case "billing_cancel": {
        const [targetUser] = await db.select({ 
          stripeSubscriptionId: users.stripeSubscriptionId 
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (!targetUser?.stripeSubscriptionId) {
          return res.status(400).json({ error: "User has no subscription to cancel" });
        }
        
        const cancelImmediately = payload?.immediate === true;
        
        try {
          const stripe = await getUncachableStripeClient();
          if (cancelImmediately) {
            await stripe.subscriptions.cancel(targetUser.stripeSubscriptionId);
          } else {
            await stripe.subscriptions.update(targetUser.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
          }
          logger.info(`[Admin] Cancelled subscription for user ${userId} (immediate: ${cancelImmediately})`);
        } catch (stripeError: any) {
          logger.error("[Admin] Stripe cancel error:", stripeError);
          return res.status(500).json({ error: `Stripe error: ${stripeError.message}` });
        }
        break;
      }

      case "billing_apply_credit": {
        const [targetUser] = await db.select({ 
          stripeCustomerId: users.stripeCustomerId 
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (!targetUser?.stripeCustomerId) {
          return res.status(400).json({ error: "User has no Stripe customer record" });
        }
        
        const creditAmountCents = payload?.amountCents;
        if (!creditAmountCents || creditAmountCents <= 0) {
          return res.status(400).json({ error: "Credit amount (in cents) is required and must be positive" });
        }
        
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.customers.update(targetUser.stripeCustomerId, {
            balance: -Math.abs(creditAmountCents),
          });
          logger.info(`[Admin] Applied $${(creditAmountCents / 100).toFixed(2)} credit to user ${userId}`);
        } catch (stripeError: any) {
          logger.error("[Admin] Stripe credit error:", stripeError);
          return res.status(500).json({ error: `Stripe error: ${stripeError.message}` });
        }
        break;
      }

      case "billing_refund": {
        const chargeId = payload?.chargeId;
        const refundAmountCents = payload?.amountCents;
        
        if (!chargeId) {
          return res.status(400).json({ error: "Charge ID is required for refunds" });
        }
        
        try {
          const stripe = await getUncachableStripeClient();
          const refundParams: any = { charge: chargeId };
          if (refundAmountCents && refundAmountCents > 0) {
            refundParams.amount = refundAmountCents;
          }
          
          await stripe.refunds.create(refundParams);
          logger.info(`[Admin] Refunded charge ${chargeId} for user ${userId}`);
        } catch (stripeError: any) {
          logger.error("[Admin] Stripe refund error:", stripeError);
          return res.status(500).json({ error: `Stripe error: ${stripeError.message}` });
        }
        break;
      }

      case "account_disable": {
        await db.update(users)
          .set({ 
            isDisabled: true,
            disabledAt: now,
            disabledBy: actorUserId,
            disabledReason: reason.trim(),
          })
          .where(eq(users.id, userId));
        logger.info(`[Admin] Disabled account for user ${userId}`);
        break;
      }

      case "account_enable": {
        await db.update(users)
          .set({ 
            isDisabled: false,
            enabledAt: now,
            enabledBy: actorUserId,
          })
          .where(eq(users.id, userId));
        logger.info(`[Admin] Enabled account for user ${userId}`);
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
    logger.error("[Admin Users] Action error:", error);
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

router.post("/:userId/notes", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { note } = req.body;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return res.status(400).json({ error: "Note is required" });
    }

    const [user] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const actorUserId = req.adminUserId;
    const now = new Date().toISOString();

    const [newNote] = await db.insert(userAdminNotes).values({
      createdAt: now,
      actorUserId,
      targetUserId: userId,
      note: note.trim(),
    }).returning();

    await db.insert(adminActionAudit).values({
      createdAt: now,
      actorUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "add_note",
      reason: "Admin added note",
      payload: JSON.stringify({ noteId: newNote.id }),
      source: "admin_ui",
    });

    res.json({ note: newNote });
  } catch (error) {
    logger.error("[Admin Users] Add note error:", error);
    res.status(500).json({ error: "Failed to add note" });
  }
});

router.get("/:userId/notes", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notes = await db.select()
      .from(userAdminNotes)
      .where(eq(userAdminNotes.targetUserId, userId))
      .orderBy(desc(userAdminNotes.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ notes });
  } catch (error) {
    logger.error("[Admin Users] Get notes error:", error);
    res.status(500).json({ error: "Failed to get notes" });
  }
});

router.post("/:userId/flag", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return res.status(400).json({ error: "Reason is required" });
    }

    const [user] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [existingFlag] = await db.select()
      .from(userFlags)
      .where(and(eq(userFlags.userId, userId), isNull(userFlags.unflaggedAt)))
      .limit(1);

    if (existingFlag) {
      return res.status(400).json({ error: "User is already flagged" });
    }

    const actorUserId = req.adminUserId;
    const now = new Date().toISOString();

    const [newFlag] = await db.insert(userFlags).values({
      userId,
      flaggedAt: now,
      flaggedBy: actorUserId,
      reason: reason.trim(),
    }).returning();

    await db.insert(adminActionAudit).values({
      createdAt: now,
      actorUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "user_flagged",
      reason: reason.trim(),
      payload: JSON.stringify({ flagId: newFlag.id, action: "flagged" }),
      source: "admin_ui",
    });

    res.json({ flag: newFlag });
  } catch (error) {
    logger.error("[Admin Users] Flag user error:", error);
    res.status(500).json({ error: "Failed to flag user" });
  }
});

router.delete("/:userId/flag", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const [existingFlag] = await db.select()
      .from(userFlags)
      .where(and(eq(userFlags.userId, userId), isNull(userFlags.unflaggedAt)))
      .limit(1);

    if (!existingFlag) {
      return res.status(404).json({ error: "No active flag found for user" });
    }

    const actorUserId = req.adminUserId;
    const now = new Date().toISOString();

    await db.update(userFlags)
      .set({ unflaggedAt: now, unflaggedBy: actorUserId })
      .where(eq(userFlags.id, existingFlag.id));

    await db.insert(adminActionAudit).values({
      createdAt: now,
      actorUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "user_flagged",
      reason: "Flag removed",
      payload: JSON.stringify({ flagId: existingFlag.id, action: "unflagged" }),
      source: "admin_ui",
    });

    res.json({ success: true });
  } catch (error) {
    logger.error("[Admin Users] Unflag user error:", error);
    res.status(500).json({ error: "Failed to unflag user" });
  }
});

// Impersonate user - returns read-only view of user's data (no actual session created)
router.get("/:userId/impersonate", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const [targetUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's jobs
    const userJobs = await db.select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.createdAt))
      .limit(20);

    // Get user's leads
    const userLeads = await db.select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(desc(leads.createdAt))
      .limit(20);

    // Get user's invoices
    const userInvoices = await db.select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt))
      .limit(20);

    // Log the impersonation action
    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "impersonate_view",
      reason: "Admin viewed user data in impersonation mode",
      payload: null,
      source: "admin_ui",
    });

    res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        name: targetUser.name,
        phone: targetUser.phone,
        isPro: targetUser.isPro,
        plan: targetUser.plan,
        onboardingCompleted: targetUser.onboardingCompleted,
        onboardingStep: targetUser.onboardingStep,
        createdAt: targetUser.createdAt,
        lastActiveAt: targetUser.lastActiveAt,
        stripeCustomerId: targetUser.stripeCustomerId,
        stripeSubscriptionId: targetUser.stripeSubscriptionId,
      },
      jobs: userJobs.map(j => ({
        id: j.id,
        title: j.title,
        status: j.status,
        scheduledDate: j.scheduledDate,
        price: j.price,
        createdAt: j.createdAt,
      })),
      leads: userLeads.map(l => ({
        id: l.id,
        clientName: l.clientName,
        status: l.status,
        score: l.score,
        createdAt: l.createdAt,
      })),
      invoices: userInvoices.map(i => ({
        id: i.id,
        status: i.status,
        amount: i.amount,
        sentAt: i.sentAt,
        createdAt: i.createdAt,
      })),
      isReadOnly: true,
      viewedBy: req.adminUserId,
      viewedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Admin Users] Impersonate error:", error);
    res.status(500).json({ error: "Failed to load user view" });
  }
});

// Retry failed payment for a user
router.post("/:userId/retry-payment", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { invoiceId } = req.body;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const [targetUser] = await db.select({
      id: users.id,
      stripeCustomerId: users.stripeCustomerId,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!targetUser.stripeCustomerId) {
      return res.status(400).json({ error: "User has no Stripe customer ID" });
    }

    const stripe = await getUncachableStripeClient();

    let retryResult;
    if (invoiceId) {
      // Retry specific invoice. Verify the invoice exists and belongs to the
      // target user's Stripe customer before attempting payment so admins
      // cannot accidentally retry an invoice on the wrong account.
      let existing;
      try {
        existing = await stripe.invoices.retrieve(invoiceId);
      } catch (lookupErr: any) {
        if (lookupErr?.code === "resource_missing" || lookupErr?.statusCode === 404) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        throw lookupErr;
      }
      const invoiceCustomer = typeof existing.customer === "string"
        ? existing.customer
        : existing.customer?.id;
      if (invoiceCustomer !== targetUser.stripeCustomerId) {
        return res.status(404).json({ error: "Invoice does not belong to this user" });
      }
      retryResult = await stripe.invoices.pay(invoiceId);
    } else {
      // Find and retry the latest open/unpaid invoice
      const invoices = await stripe.invoices.list({
        customer: targetUser.stripeCustomerId,
        status: "open",
        limit: 1,
      });

      if (invoices.data.length === 0) {
        return res.status(400).json({ error: "No open invoices found to retry" });
      }

      retryResult = await stripe.invoices.pay(invoices.data[0].id);
    }

    // Log the action
    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "billing_retry_payment",
      reason: "Admin retried failed payment",
      payload: JSON.stringify({ 
        invoiceId: retryResult.id, 
        status: retryResult.status,
        amountDue: retryResult.amount_due,
      }),
      source: "admin_ui",
    });

    res.json({ 
      success: true, 
      invoice: {
        id: retryResult.id,
        status: retryResult.status,
        amountDue: retryResult.amount_due,
        amountPaid: retryResult.amount_paid,
      }
    });
  } catch (error: any) {
    logger.error("[Admin Users] Retry payment error:", error);
    res.status(500).json({ error: error.message || "Failed to retry payment" });
  }
});

// Get user's failed invoices
router.get("/:userId/failed-invoices", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;

    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }

    const [targetUser] = await db.select({
      stripeCustomerId: users.stripeCustomerId,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser?.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const stripe = await getUncachableStripeClient();
    
    // Get open and past_due invoices
    const [openInvoices, pastDueInvoices] = await Promise.all([
      stripe.invoices.list({
        customer: targetUser.stripeCustomerId,
        status: "open",
        limit: 10,
      }),
      stripe.invoices.list({
        customer: targetUser.stripeCustomerId,
        status: "uncollectible",
        limit: 10,
      }),
    ]);

    const allInvoices = [...openInvoices.data, ...pastDueInvoices.data].map(inv => ({
      id: inv.id,
      status: inv.status,
      amountDue: inv.amount_due,
      amountPaid: inv.amount_paid,
      created: new Date(inv.created * 1000).toISOString(),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      attemptCount: inv.attempt_count,
      lastAttempt: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000).toISOString() : null,
    }));

    await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: req.adminUserId,
      actorEmail: req.userEmail || null,
      targetUserId: userId,
      actionKey: "billing_view_failed_invoices",
      reason: "Admin viewed failed invoices",
      payload: JSON.stringify({ count: allInvoices.length }),
      source: "admin_ui",
    });

    res.json({ invoices: allInvoices });
  } catch (error) {
    logger.error("[Admin Users] Failed invoices error:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// Outbound message log for a single user (last N entries with status & failureReason).
router.get("/:userId/outbound-messages", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt((req.query.limit as string) || "25", 10) || 25, 200);

    const rows = await db
      .select({
        id: outboundMessages.id,
        channel: outboundMessages.channel,
        type: outboundMessages.type,
        status: outboundMessages.status,
        toAddress: outboundMessages.toAddress,
        scheduledFor: outboundMessages.scheduledFor,
        sentAt: outboundMessages.sentAt,
        canceledAt: outboundMessages.canceledAt,
        failureReason: outboundMessages.failureReason,
        createdAt: outboundMessages.createdAt,
        updatedAt: outboundMessages.updatedAt,
      })
      .from(outboundMessages)
      .where(eq(outboundMessages.userId, userId))
      .orderBy(desc(outboundMessages.createdAt))
      .limit(limit);

    res.json({ messages: rows });
  } catch (error) {
    logger.error("[Admin Users] Outbound messages error:", error);
    res.status(500).json({ error: "Failed to fetch outbound messages" });
  }
});

export default router;
