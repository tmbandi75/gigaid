import { Router } from "express";
import { db } from "../db";
import { adminActionAudit, users } from "@shared/schema";
import { eq, desc, and, gte, lte, ilike, count, sql, or } from "drizzle-orm";
import { adminMiddleware } from "../copilot/adminMiddleware";

const router = Router();

router.use(adminMiddleware);

// List audit logs with filtering
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    // Filters
    const actorUserId = req.query.actorUserId as string;
    const targetUserId = req.query.targetUserId as string;
    const actionKey = req.query.actionKey as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const search = req.query.search as string;

    const conditions = [];

    if (actorUserId) {
      conditions.push(eq(adminActionAudit.actorUserId, actorUserId));
    }
    if (targetUserId) {
      conditions.push(eq(adminActionAudit.targetUserId, targetUserId));
    }
    if (actionKey) {
      conditions.push(eq(adminActionAudit.actionKey, actionKey));
    }
    if (startDate) {
      conditions.push(gte(adminActionAudit.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(adminActionAudit.createdAt, endDate));
    }
    if (search) {
      conditions.push(or(
        ilike(adminActionAudit.reason, `%${search}%`),
        ilike(adminActionAudit.actionKey, `%${search}%`)
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db.select({ count: count() })
      .from(adminActionAudit)
      .where(whereClause);
    const total = countResult?.count || 0;

    // Get logs
    const logs = await db.select({
      id: adminActionAudit.id,
      createdAt: adminActionAudit.createdAt,
      actorUserId: adminActionAudit.actorUserId,
      actorEmail: adminActionAudit.actorEmail,
      targetUserId: adminActionAudit.targetUserId,
      actionKey: adminActionAudit.actionKey,
      reason: adminActionAudit.reason,
      payload: adminActionAudit.payload,
      source: adminActionAudit.source,
    })
    .from(adminActionAudit)
    .where(whereClause)
    .orderBy(desc(adminActionAudit.createdAt))
    .limit(limit)
    .offset(offset);

    // Enrich with user info
    const actorIds = Array.from(new Set(logs.map(l => l.actorUserId).filter(Boolean)));
    const targetIds = Array.from(new Set(logs.map(l => l.targetUserId).filter(Boolean))) as string[];

    const allUserIds = Array.from(new Set([...actorIds, ...targetIds]));
    
    let userMap: Record<string, { email: string; name: string | null }> = {};
    if (allUserIds.length > 0) {
      const userRecords = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(sql`${users.id} = ANY(${allUserIds})`);

      userMap = Object.fromEntries(userRecords.map(u => [u.id, { email: u.email || "", name: u.name }]));
    }

    const enrichedLogs = logs.map(log => ({
      ...log,
      actor: userMap[log.actorUserId] || { email: log.actorEmail || log.actorUserId, name: null },
      target: log.targetUserId ? userMap[log.targetUserId] || { email: log.targetUserId, name: null } : null,
    }));

    res.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Audit Log] List error:", error);
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

// Get unique action keys for filter dropdown
router.get("/action-keys", async (req, res) => {
  try {
    const result = await db.selectDistinct({ actionKey: adminActionAudit.actionKey })
      .from(adminActionAudit)
      .orderBy(adminActionAudit.actionKey);

    res.json({ actionKeys: result.map(r => r.actionKey) });
  } catch (error) {
    console.error("[Audit Log] Action keys error:", error);
    res.status(500).json({ error: "Failed to get action keys" });
  }
});

// Export audit logs as CSV
router.get("/export", async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const actionKey = req.query.actionKey as string;

    const conditions = [];
    if (startDate) conditions.push(gte(adminActionAudit.createdAt, startDate));
    if (endDate) conditions.push(lte(adminActionAudit.createdAt, endDate));
    if (actionKey) conditions.push(eq(adminActionAudit.actionKey, actionKey));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db.select()
      .from(adminActionAudit)
      .where(whereClause)
      .orderBy(desc(adminActionAudit.createdAt))
      .limit(10000); // Max 10k rows for export

    // Generate CSV
    const headers = ["ID", "Timestamp", "Actor User ID", "Actor Email", "Target User ID", "Action", "Reason", "Payload", "Source"];
    const rows = logs.map(log => [
      log.id,
      log.createdAt,
      log.actorUserId,
      log.actorEmail || "",
      log.targetUserId || "",
      log.actionKey,
      `"${(log.reason || "").replace(/"/g, '""')}"`,
      `"${(log.payload || "").replace(/"/g, '""')}"`,
      log.source,
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("[Audit Log] Export error:", error);
    res.status(500).json({ error: "Failed to export audit logs" });
  }
});

// Get single log detail
router.get("/:logId", async (req, res) => {
  try {
    const { logId } = req.params;

    const [log] = await db.select()
      .from(adminActionAudit)
      .where(eq(adminActionAudit.id, logId))
      .limit(1);

    if (!log) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    // Get actor and target user info
    let actor = null;
    let target = null;

    if (log.actorUserId) {
      const [actorUser] = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
      }).from(users).where(eq(users.id, log.actorUserId)).limit(1);
      actor = actorUser || { id: log.actorUserId, email: log.actorEmail, name: null };
    }

    if (log.targetUserId) {
      const [targetUser] = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
      }).from(users).where(eq(users.id, log.targetUserId)).limit(1);
      target = targetUser || { id: log.targetUserId, email: null, name: null };
    }

    res.json({
      ...log,
      actor,
      target,
      payloadParsed: log.payload ? JSON.parse(log.payload) : null,
    });
  } catch (error) {
    console.error("[Audit Log] Detail error:", error);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

export default router;
