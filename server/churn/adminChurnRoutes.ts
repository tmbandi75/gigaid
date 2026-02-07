import { Router } from "express";
import { adminMiddleware, AdminRequest } from "../copilot/adminMiddleware";
import { db } from "../db";
import { churnMetrics, retentionActions, retentionPlaybooks, planOverrides, users } from "@shared/schema";
import { eq, and, gte, lte, desc, count, avg, sql } from "drizzle-orm";
import { computeChurnScore, extractSignals } from "./churnScorer";
import { emitCanonicalEvent } from "../copilot/canonicalEvents";
import { sendEmail } from "../sendgrid";

let sendSMS: ((to: string, message: string) => Promise<boolean>) | undefined;
import("../twilio").then((mod) => {
  sendSMS = mod.sendSMS;
}).catch(() => {
  console.warn("[AdminChurn] Twilio module not available, SMS disabled");
});

const router = Router();

router.use(adminMiddleware);

router.get("/overview", async (req, res) => {
  try {
    const latestPerUser = db
      .select({
        userId: churnMetrics.userId,
        maxId: sql<string>`max(${churnMetrics.id})`.as("max_id"),
      })
      .from(churnMetrics)
      .groupBy(churnMetrics.userId)
      .as("latest");

    const distributionRows = await db
      .select({
        tier: churnMetrics.tier,
        cnt: count(),
      })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .groupBy(churnMetrics.tier);

    const distribution: Record<string, number> = { Healthy: 0, Drifting: 0, AtRisk: 0, Critical: 0 };
    for (const row of distributionRows) {
      distribution[row.tier] = row.cnt;
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const trends = await db
      .select({
        date: sql<string>`date(${churnMetrics.computedAt})`.as("d"),
        tier: churnMetrics.tier,
        cnt: count(),
      })
      .from(churnMetrics)
      .where(gte(churnMetrics.computedAt, fourteenDaysAgo))
      .groupBy(sql`date(${churnMetrics.computedAt})`, churnMetrics.tier)
      .orderBy(sql`date(${churnMetrics.computedAt})`);

    const driverRows = await db
      .select({
        avgLastLoginDays: avg(churnMetrics.lastLoginDays),
        avgJobs7d: avg(churnMetrics.jobs7d),
        avgMsgs7d: avg(churnMetrics.msgs7d),
        avgRev30d: avg(churnMetrics.rev30d),
        avgRevDelta: avg(churnMetrics.revDelta),
        avgFailedPayments: avg(churnMetrics.failedPayments),
        avgErrors7d: avg(churnMetrics.errors7d),
        avgBlocks7d: avg(churnMetrics.blocks7d),
        avgLimit95Hits: avg(churnMetrics.limit95Hits),
        avgDowngradeViews: avg(churnMetrics.downgradeViews),
        avgCancelHover: avg(churnMetrics.cancelHover),
      })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .where(sql`${churnMetrics.tier} IN ('AtRisk', 'Critical')`);

    const drivers = driverRows[0];
    const topDrivers = drivers
      ? [
          { signal: "lastLoginDays", avg: Number(drivers.avgLastLoginDays) || 0 },
          { signal: "jobs7d", avg: Number(drivers.avgJobs7d) || 0 },
          { signal: "msgs7d", avg: Number(drivers.avgMsgs7d) || 0 },
          { signal: "rev30d", avg: Number(drivers.avgRev30d) || 0 },
          { signal: "revDelta", avg: Number(drivers.avgRevDelta) || 0 },
          { signal: "failedPayments", avg: Number(drivers.avgFailedPayments) || 0 },
          { signal: "errors7d", avg: Number(drivers.avgErrors7d) || 0 },
          { signal: "blocks7d", avg: Number(drivers.avgBlocks7d) || 0 },
          { signal: "limit95Hits", avg: Number(drivers.avgLimit95Hits) || 0 },
          { signal: "downgradeViews", avg: Number(drivers.avgDowngradeViews) || 0 },
          { signal: "cancelHover", avg: Number(drivers.avgCancelHover) || 0 },
        ].sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg))
      : [];

    res.json({ distribution, trends, topDrivers });
  } catch (error) {
    console.error("[AdminChurn] Overview error:", error);
    res.status(500).json({ error: "Failed to fetch churn overview" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const tier = req.query.tier as string | undefined;
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    const maxScore = req.query.maxScore ? Number(req.query.maxScore) : undefined;
    const noPay14d = req.query.noPay14d === "true" ? true : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const latestPerUser = db
      .select({
        userId: churnMetrics.userId,
        maxId: sql<string>`max(${churnMetrics.id})`.as("max_id"),
      })
      .from(churnMetrics)
      .groupBy(churnMetrics.userId)
      .as("latest");

    const conditions: any[] = [];
    if (tier) conditions.push(eq(churnMetrics.tier, tier));
    if (minScore !== undefined) conditions.push(gte(churnMetrics.score, minScore));
    if (maxScore !== undefined) conditions.push(lte(churnMetrics.score, maxScore));
    if (noPay14d !== undefined) conditions.push(eq(churnMetrics.noPay14d, noPay14d));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ cnt: count() })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .where(whereClause);

    const total = totalResult?.cnt || 0;

    const rows = await db
      .select({
        userId: churnMetrics.userId,
        score: churnMetrics.score,
        tier: churnMetrics.tier,
        lastLoginDays: churnMetrics.lastLoginDays,
        jobs7d: churnMetrics.jobs7d,
        rev30d: churnMetrics.rev30d,
        noPay14d: churnMetrics.noPay14d,
        failedPayments: churnMetrics.failedPayments,
        blocks7d: churnMetrics.blocks7d,
        name: users.name,
        email: users.email,
      })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .leftJoin(users, eq(churnMetrics.userId, users.id))
      .where(whereClause)
      .orderBy(desc(churnMetrics.score))
      .limit(limit)
      .offset(offset);

    const userIds = rows.map((r) => r.userId);
    let lastActions: Record<string, string> = {};
    if (userIds.length > 0) {
      const actionRows = await db
        .select({
          userId: retentionActions.userId,
          maxCreatedAt: sql<string>`max(${retentionActions.createdAt})`.as("max_created"),
        })
        .from(retentionActions)
        .where(sql`${retentionActions.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`,`)})`)
        .groupBy(retentionActions.userId);

      for (const ar of actionRows) {
        lastActions[ar.userId] = ar.maxCreatedAt;
      }
    }

    const usersResult = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      score: r.score,
      tier: r.tier,
      lastLoginDays: r.lastLoginDays,
      jobs7d: r.jobs7d,
      rev30d: r.rev30d,
      noPay14d: r.noPay14d,
      failedPayments: r.failedPayments,
      blocks7d: r.blocks7d,
      lastActionSent: lastActions[r.userId] || null,
    }));

    res.json({ users: usersResult, total, page });
  } catch (error) {
    console.error("[AdminChurn] Users error:", error);
    res.status(500).json({ error: "Failed to fetch churn users" });
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const [userInfo] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        plan: users.plan,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userInfo) {
      return res.status(404).json({ error: "User not found" });
    }

    const [metrics] = await db
      .select()
      .from(churnMetrics)
      .where(eq(churnMetrics.userId, userId))
      .orderBy(desc(churnMetrics.computedAt))
      .limit(1);

    const signals = await extractSignals(userId);
    const scoreBreakdown = computeChurnScore(signals);

    const actionHistory = await db
      .select()
      .from(retentionActions)
      .where(eq(retentionActions.userId, userId))
      .orderBy(desc(retentionActions.createdAt));

    const overrides = await db
      .select()
      .from(planOverrides)
      .where(eq(planOverrides.userId, userId))
      .orderBy(desc(planOverrides.createdAt));

    res.json({
      user: userInfo,
      metrics: metrics || null,
      scoreBreakdown,
      actionHistory,
      planOverrides: overrides,
    });
  } catch (error) {
    console.error("[AdminChurn] User detail error:", error);
    res.status(500).json({ error: "Failed to fetch user churn profile" });
  }
});

router.post("/action", async (req, res) => {
  try {
    const { userId, actionType, channel, notes } = req.body;
    const adminReq = req as AdminRequest;
    const adminUserId = adminReq.adminUserId || "system";

    if (!userId || !actionType || !channel) {
      return res.status(400).json({ error: "userId, actionType, and channel are required" });
    }

    const validActions = ["Nudge", "Trial", "Credit", "FounderSave", "LiteModeEnable", "FollowUpWizard", "Other"];
    const validChannels = ["InApp", "Email", "SMS"];

    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: `Invalid actionType. Must be one of: ${validActions.join(", ")}` });
    }
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: `Invalid channel. Must be one of: ${validChannels.join(", ")}` });
    }

    const timestamp = Date.now();
    const idempotencyKey = `${userId}:manual:${actionType}:${timestamp}`;

    const [latestMetrics] = await db
      .select({ tier: churnMetrics.tier })
      .from(churnMetrics)
      .where(eq(churnMetrics.userId, userId))
      .orderBy(desc(churnMetrics.computedAt))
      .limit(1);

    const tier = latestMetrics?.tier || "Unknown";

    const [actionRecord] = await db
      .insert(retentionActions)
      .values({
        userId,
        tier,
        actionType,
        channel,
        payload: JSON.stringify({ notes, triggeredBy: adminUserId }),
        status: "Queued",
        idempotencyKey,
      })
      .returning();

    if (actionType === "Trial") {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(planOverrides).values({
        userId,
        overrideType: "pro_trial",
        expiresAt,
        createdBy: adminUserId,
      });
    } else if (actionType === "Credit") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(planOverrides).values({
        userId,
        overrideType: "free_month",
        expiresAt,
        createdBy: adminUserId,
      });
    }

    let sendStatus = "Sent";
    let sendError: string | undefined;

    try {
      if (channel === "InApp") {
        await emitCanonicalEvent({
          eventName: "retention_manual_action",
          userId,
          context: { actionType, notes, triggeredBy: adminUserId },
          source: "system",
        });
      } else if (channel === "Email") {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.email) {
          sendStatus = "Failed";
          sendError = "User has no email address";
        } else {
          const result = await sendEmail({
            to: user.email,
            subject: `GigAid: ${actionType} action`,
            text: notes || `A ${actionType} action has been triggered for your account.`,
          });
          if (!result) {
            sendStatus = "Failed";
            sendError = "Email send failed";
          }
        }
      } else if (channel === "SMS") {
        if (!sendSMS) {
          sendStatus = "Failed";
          sendError = "SMS not available";
        } else {
          const [user] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
          if (!user?.phone) {
            sendStatus = "Failed";
            sendError = "User has no phone number";
          } else {
            const result = await sendSMS(user.phone, notes || `GigAid: A ${actionType} action has been triggered for your account.`);
            if (!result) {
              sendStatus = "Failed";
              sendError = "SMS send failed";
            }
          }
        }
      }
    } catch (err: any) {
      sendStatus = "Failed";
      sendError = err.message || "Send failed";
    }

    await db
      .update(retentionActions)
      .set({
        status: sendStatus,
        sentAt: sendStatus === "Sent" ? new Date().toISOString() : null,
        error: sendError || null,
      })
      .where(eq(retentionActions.id, actionRecord.id));

    const [updatedAction] = await db
      .select()
      .from(retentionActions)
      .where(eq(retentionActions.id, actionRecord.id))
      .limit(1);

    res.json(updatedAction);
  } catch (error) {
    console.error("[AdminChurn] Action error:", error);
    res.status(500).json({ error: "Failed to create retention action" });
  }
});

router.get("/report.json", async (req, res) => {
  try {
    const latestPerUser = db
      .select({
        userId: churnMetrics.userId,
        maxId: sql<string>`max(${churnMetrics.id})`.as("max_id"),
      })
      .from(churnMetrics)
      .groupBy(churnMetrics.userId)
      .as("latest");

    const tierCounts = await db
      .select({
        tier: churnMetrics.tier,
        cnt: count(),
      })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .groupBy(churnMetrics.tier);

    const distribution: Record<string, number> = { Healthy: 0, Drifting: 0, AtRisk: 0, Critical: 0 };
    for (const row of tierCounts) {
      distribution[row.tier] = row.cnt;
    }

    const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00.000Z";

    const actionsByStatus = await db
      .select({
        status: retentionActions.status,
        cnt: count(),
      })
      .from(retentionActions)
      .where(gte(retentionActions.createdAt, todayStart))
      .groupBy(retentionActions.status);

    const [failuresToday] = await db
      .select({ cnt: count() })
      .from(retentionActions)
      .where(and(gte(retentionActions.createdAt, todayStart), eq(retentionActions.status, "Failed")));

    const driverRows = await db
      .select({
        avgLastLoginDays: avg(churnMetrics.lastLoginDays),
        avgJobs7d: avg(churnMetrics.jobs7d),
        avgMsgs7d: avg(churnMetrics.msgs7d),
        avgRev30d: avg(churnMetrics.rev30d),
        avgRevDelta: avg(churnMetrics.revDelta),
        avgFailedPayments: avg(churnMetrics.failedPayments),
        avgErrors7d: avg(churnMetrics.errors7d),
        avgBlocks7d: avg(churnMetrics.blocks7d),
      })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .where(sql`${churnMetrics.tier} IN ('AtRisk', 'Critical')`);

    const drivers = driverRows[0];
    const topDrivers = drivers
      ? Object.entries(drivers).map(([key, val]) => ({
          signal: key.replace("avg", "").charAt(0).toLowerCase() + key.replace("avg", "").slice(1),
          avg: Number(val) || 0,
        }))
      : [];

    const criticalSample = await db
      .select({
        userId: churnMetrics.userId,
        score: churnMetrics.score,
        lastLoginDays: churnMetrics.lastLoginDays,
        jobs7d: churnMetrics.jobs7d,
        rev30d: churnMetrics.rev30d,
        noPay14d: churnMetrics.noPay14d,
        failedPayments: churnMetrics.failedPayments,
        blocks7d: churnMetrics.blocks7d,
        name: users.name,
        email: users.email,
      })
      .from(churnMetrics)
      .innerJoin(latestPerUser, eq(churnMetrics.id, latestPerUser.maxId))
      .leftJoin(users, eq(churnMetrics.userId, users.id))
      .where(eq(churnMetrics.tier, "Critical"))
      .orderBy(desc(churnMetrics.score))
      .limit(10);

    res.json({
      generatedAt: new Date().toISOString(),
      distribution,
      actionsSentToday: actionsByStatus.reduce((acc, r) => {
        acc[r.status] = r.cnt;
        return acc;
      }, {} as Record<string, number>),
      failuresToday: failuresToday?.cnt || 0,
      topDrivers,
      criticalSample,
    });
  } catch (error) {
    console.error("[AdminChurn] Report error:", error);
    res.status(500).json({ error: "Failed to generate churn report" });
  }
});

router.get("/playbooks", async (req, res) => {
  try {
    const playbooks = await db
      .select()
      .from(retentionPlaybooks)
      .orderBy(retentionPlaybooks.tier, retentionPlaybooks.priority);

    res.json(playbooks);
  } catch (error) {
    console.error("[AdminChurn] Playbooks list error:", error);
    res.status(500).json({ error: "Failed to fetch playbooks" });
  }
});

router.put("/playbooks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, priority, delayHours, templateKey } = req.body;

    const updates: Record<string, any> = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (priority !== undefined) updates.priority = priority;
    if (delayHours !== undefined) updates.delayHours = delayHours;
    if (templateKey !== undefined) updates.templateKey = templateKey;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const [updated] = await db
      .update(retentionPlaybooks)
      .set(updates)
      .where(eq(retentionPlaybooks.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Playbook not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("[AdminChurn] Playbook update error:", error);
    res.status(500).json({ error: "Failed to update playbook" });
  }
});

router.post("/playbooks", async (req, res) => {
  try {
    const { tier, priority, actionType, channel, templateKey, delayHours, enabled } = req.body;

    if (!tier || !actionType || !channel || !templateKey) {
      return res.status(400).json({ error: "tier, actionType, channel, and templateKey are required" });
    }

    const [playbook] = await db
      .insert(retentionPlaybooks)
      .values({
        tier,
        priority: priority || 0,
        actionType,
        channel,
        templateKey,
        delayHours: delayHours || 0,
        enabled: enabled !== undefined ? enabled : true,
      })
      .returning();

    res.status(201).json(playbook);
  } catch (error) {
    console.error("[AdminChurn] Playbook create error:", error);
    res.status(500).json({ error: "Failed to create playbook" });
  }
});

router.delete("/playbooks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(retentionPlaybooks)
      .where(eq(retentionPlaybooks.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Playbook not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[AdminChurn] Playbook delete error:", error);
    res.status(500).json({ error: "Failed to delete playbook" });
  }
});

export default router;
