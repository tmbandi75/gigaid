import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { admins, type AdminRole } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Fallback admin user IDs for bootstrapping (before admins table is populated)
const BOOTSTRAP_ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "demo-user").split(",").map(s => s.trim());
const BOOTSTRAP_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);

// Cache admin lookups for 5 minutes
const adminCache = new Map<string, { admin: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getAdminFromDb(userId: string): Promise<{ role: AdminRole; isActive: boolean } | null> {
  const cached = adminCache.get(`user:${userId}`);
  if (cached && cached.expires > Date.now()) {
    return cached.admin;
  }

  try {
    const [admin] = await db.select({
      role: admins.role,
      isActive: admins.isActive,
      enabled: admins.enabled,
    })
    .from(admins)
    .where(eq(admins.userId, userId))
    .limit(1);

    if (admin) {
      // Check both isActive and enabled for backwards compatibility
      const active = (admin.isActive !== false) && (admin.enabled !== false);
      adminCache.set(`user:${userId}`, { admin: { role: admin.role as AdminRole, isActive: active }, expires: Date.now() + CACHE_TTL });
      return { role: admin.role as AdminRole, isActive: active };
    }
  } catch (error) {
    console.error("[AdminMiddleware] DB lookup error:", error);
  }

  return null;
}

async function getAdminByEmail(email: string): Promise<{ role: AdminRole; isActive: boolean } | null> {
  const cached = adminCache.get(`email:${email}`);
  if (cached && cached.expires > Date.now()) {
    return cached.admin;
  }

  try {
    const [admin] = await db.select({
      role: admins.role,
      isActive: admins.isActive,
      enabled: admins.enabled,
    })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

    if (admin) {
      const active = (admin.isActive !== false) && (admin.enabled !== false);
      adminCache.set(`email:${email}`, { admin: { role: admin.role as AdminRole, isActive: active }, expires: Date.now() + CACHE_TTL });
      return { role: admin.role as AdminRole, isActive: active };
    }
  } catch (error) {
    console.error("[AdminMiddleware] DB lookup by email error:", error);
  }

  return null;
}

function isBootstrapAdmin(userId: string | undefined, userEmail: string | undefined): boolean {
  if (!userId && !userEmail) return false;
  if (userId && BOOTSTRAP_ADMIN_USER_IDS.includes(userId)) return true;
  if (userEmail && BOOTSTRAP_ADMIN_EMAILS.includes(userEmail)) return true;
  return false;
}

export function isAdminUser(userId: string | undefined, userEmail: string | undefined): boolean {
  return isBootstrapAdmin(userId, userEmail);
}

export interface AdminRequest extends Request {
  adminRole?: AdminRole;
  adminUserId?: string;
  userEmail?: string;
}

// Basic admin middleware - allows any admin role
export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId;
  const userEmail = (req as any).userEmail;

  // Require authenticated identity
  if (!userId && !userEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Check bootstrap admins first (super_admin by default)
  if (isBootstrapAdmin(userId, userEmail)) {
    (req as AdminRequest).adminRole = "super_admin";
    (req as AdminRequest).adminUserId = userId || userEmail;
    (req as AdminRequest).userEmail = userEmail;
    return next();
  }

  // Check database for admin record by userId or email
  if (userId) {
    const dbAdmin = await getAdminFromDb(userId);
    if (dbAdmin && dbAdmin.isActive) {
      (req as AdminRequest).adminRole = dbAdmin.role;
      (req as AdminRequest).adminUserId = userId;
      (req as AdminRequest).userEmail = userEmail;
      return next();
    }
  }

  // Try email-based lookup if userId check failed
  if (userEmail) {
    const dbAdminByEmail = await getAdminByEmail(userEmail);
    if (dbAdminByEmail && dbAdminByEmail.isActive) {
      (req as AdminRequest).adminRole = dbAdminByEmail.role;
      (req as AdminRequest).adminUserId = userId || userEmail;
      (req as AdminRequest).userEmail = userEmail;
      return next();
    }
  }

  res.status(403).json({ error: "Admin access required" });
}

// Middleware that requires specific roles
export function requireRole(...allowedRoles: AdminRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const adminReq = req as AdminRequest;
    
    // If adminRole is already set by previous middleware, check it
    if (adminReq.adminRole) {
      if (allowedRoles.includes(adminReq.adminRole)) {
        return next();
      }
      return res.status(403).json({ error: `Requires one of: ${allowedRoles.join(", ")}` });
    }

    // Otherwise, do full admin check
    const userId = (req as any).userId;
    const userEmail = (req as any).userEmail;

    // Require authenticated identity
    if (!userId && !userEmail) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Bootstrap admins are super_admin
    if (isBootstrapAdmin(userId, userEmail)) {
      adminReq.adminRole = "super_admin";
      adminReq.adminUserId = userId || userEmail;
      if (allowedRoles.includes("super_admin")) {
        return next();
      }
      return res.status(403).json({ error: `Requires one of: ${allowedRoles.join(", ")}` });
    }

    // Check by userId first
    if (userId) {
      const dbAdmin = await getAdminFromDb(userId);
      if (dbAdmin && dbAdmin.isActive && allowedRoles.includes(dbAdmin.role)) {
        adminReq.adminRole = dbAdmin.role;
        adminReq.adminUserId = userId;
        return next();
      }
    }

    // Check by email if userId check failed
    if (userEmail) {
      const dbAdminByEmail = await getAdminByEmail(userEmail);
      if (dbAdminByEmail && dbAdminByEmail.isActive && allowedRoles.includes(dbAdminByEmail.role)) {
        adminReq.adminRole = dbAdminByEmail.role;
        adminReq.adminUserId = userId || userEmail;
        return next();
      }
    }

    res.status(403).json({ error: `Requires one of: ${allowedRoles.join(", ")}` });
  };
}

// Check if role can perform write operations
export function canWrite(role: AdminRole | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

// Check if role can manage other admins
export function canManageAdmins(role: AdminRole | undefined): boolean {
  return role === "super_admin";
}

export function getAdminUserIds(): string[] {
  return BOOTSTRAP_ADMIN_USER_IDS;
}

export function clearAdminCache(userId?: string) {
  if (userId) {
    adminCache.delete(userId);
  } else {
    adminCache.clear();
  }
}
