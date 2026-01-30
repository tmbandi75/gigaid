import { Router } from "express";
import { db } from "../db";
import { admins, adminActionAudit, users, type AdminRole } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { adminMiddleware, requireRole, canManageAdmins, clearAdminCache, type AdminRequest } from "../copilot/adminMiddleware";

const router = Router();

// Get current admin info (requires any admin role)
router.get("/me", adminMiddleware, async (req, res) => {
  try {
    const adminReq = req as AdminRequest;
    const userId = adminReq.adminUserId || (req as any).userId;
    const userEmail = (req as any).userEmail;

    // Check if admin exists in database
    const [dbAdmin] = await db.select()
      .from(admins)
      .where(eq(admins.userId, userId))
      .limit(1);

    if (dbAdmin) {
      // Update last login
      await db.update(admins)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(admins.id, dbAdmin.id));

      return res.json({
        id: dbAdmin.id,
        userId: dbAdmin.userId,
        email: dbAdmin.email,
        role: dbAdmin.role as AdminRole,
        isActive: dbAdmin.isActive,
        createdAt: dbAdmin.createdAt,
        lastLoginAt: new Date().toISOString(),
      });
    }

    // Bootstrap admin (not in DB yet)
    res.json({
      userId,
      email: userEmail || "admin@gigaid.ai",
      role: adminReq.adminRole || "super_admin",
      isBootstrap: true,
    });
  } catch (error) {
    console.error("[Admin Auth] Error getting admin:", error);
    res.status(500).json({ error: "Failed to get admin info" });
  }
});

// List all admins (super_admin only)
router.get("/list", requireRole("super_admin"), async (req, res) => {
  try {
    const adminList = await db.select({
      id: admins.id,
      userId: admins.userId,
      email: admins.email,
      role: admins.role,
      createdAt: admins.createdAt,
      createdBy: admins.createdBy,
      lastLoginAt: admins.lastLoginAt,
      isActive: admins.isActive,
    })
    .from(admins)
    .orderBy(desc(admins.createdAt));

    res.json({ admins: adminList });
  } catch (error) {
    console.error("[Admin Auth] Error listing admins:", error);
    res.status(500).json({ error: "Failed to list admins" });
  }
});

// Create new admin (super_admin only)
router.post("/create", requireRole("super_admin"), async (req, res) => {
  try {
    const adminReq = req as AdminRequest;
    const { userId, email, role } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email are required" });
    }

    const validRoles: AdminRole[] = ["super_admin", "admin", "read_only"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    // Check if admin already exists
    const [existing] = await db.select()
      .from(admins)
      .where(eq(admins.userId, userId))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: "Admin with this userId already exists" });
    }

    // Check if user exists
    const [user] = await db.select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const now = new Date().toISOString();

    // Create admin
    const [newAdmin] = await db.insert(admins).values({
      userId,
      email: email || user.email,
      role: role || "read_only",
      createdAt: now,
      createdBy: adminReq.adminUserId,
      isActive: true,
    }).returning();

    // Audit log
    await db.insert(adminActionAudit).values({
      createdAt: now,
      actorUserId: adminReq.adminUserId || "system",
      targetUserId: userId,
      actionKey: "admin_created",
      reason: `Created admin with role: ${role || "read_only"}`,
      payload: JSON.stringify({ role: role || "read_only" }),
      source: "admin_ui",
    });

    clearAdminCache(userId);

    res.json({ admin: newAdmin });
  } catch (error) {
    console.error("[Admin Auth] Error creating admin:", error);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

// Update admin role (super_admin only)
router.patch("/:adminId", requireRole("super_admin"), async (req, res) => {
  try {
    const adminReq = req as AdminRequest;
    const { adminId } = req.params;
    const { role, isActive } = req.body;

    const validRoles: AdminRole[] = ["super_admin", "admin", "read_only"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const [existingAdmin] = await db.select()
      .from(admins)
      .where(eq(admins.id, adminId))
      .limit(1);

    if (!existingAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const updates: any = {};
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(admins)
      .set(updates)
      .where(eq(admins.id, adminId))
      .returning();

    const now = new Date().toISOString();

    // Audit log
    await db.insert(adminActionAudit).values({
      createdAt: now,
      actorUserId: adminReq.adminUserId || "system",
      targetUserId: existingAdmin.userId,
      actionKey: isActive === false ? "admin_deactivated" : "admin_updated",
      reason: `Updated admin: ${JSON.stringify(updates)}`,
      payload: JSON.stringify({ before: existingAdmin, after: updated }),
      source: "admin_ui",
    });

    if (existingAdmin.userId) {
      clearAdminCache(existingAdmin.userId);
    }

    res.json({ admin: updated });
  } catch (error) {
    console.error("[Admin Auth] Error updating admin:", error);
    res.status(500).json({ error: "Failed to update admin" });
  }
});

export default router;
