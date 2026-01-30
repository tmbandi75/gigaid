import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, jobs, leads, invoices, admins, adminAuditLogs, adminNotes } from "@shared/schema";
import { eq, desc, asc, sql, like, or, and, count, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

const ADMIN_JWT_SECRET = process.env.APP_JWT_SECRET;
const GIGAID_ADMIN_API_KEY = process.env.GIGAID_ADMIN_API_KEY;

if (!ADMIN_JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error("[FATAL] APP_JWT_SECRET is required in production for admin authentication");
}

// ============================================================================
// TYPES
// ============================================================================

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AdminRequest extends Request {
  admin?: AdminUser;
  isApiKeyAuth?: boolean;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

async function adminAuthMiddleware(req: AdminRequest, res: Response, next: NextFunction) {
  // DEV ONLY - bypass authentication for development/testing
  if (process.env.NODE_ENV !== 'production') {
    req.admin = {
      id: 'dev-admin',
      email: 'admin@gigaid.ai',
      name: 'Dev Admin',
      role: 'super_admin'
    };
    req.isApiKeyAuth = true;
    return next();
  }

  const authHeader = req.headers.authorization;
  
  // Check API key auth first (for Retool)
  if (authHeader?.startsWith('Bearer ') && GIGAID_ADMIN_API_KEY) {
    const token = authHeader.slice(7);
    if (token === GIGAID_ADMIN_API_KEY) {
      req.admin = {
        id: 'api-admin',
        email: 'api@gigaid.ai',
        name: 'API Admin',
        role: 'super_admin'
      };
      req.isApiKeyAuth = true;
      return next();
    }
  }

  // Check JWT auth (only if secret is configured)
  if (authHeader?.startsWith('Bearer ') && ADMIN_JWT_SECRET) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: string };
      const [admin] = await db.select().from(admins).where(eq(admins.id, decoded.adminId)).limit(1);
      
      if (admin && admin.enabled) {
        req.admin = {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        };
        return next();
      }
    } catch (error) {
      // Invalid token
    }
  }

  res.status(401).json({ error: "Unauthorized - Admin authentication required" });
}

function requireRole(...roles: string[]) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ error: `Forbidden - Requires one of: ${roles.join(', ')}` });
    }
    
    next();
  };
}

function requireWriteAccess() {
  return requireRole('super_admin', 'admin');
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

async function logAdminAction(
  admin: AdminUser,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
  req: Request
) {
  try {
    await db.insert(adminAuditLogs).values({
      adminId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.role,
      action,
      targetType,
      targetId,
      metadata: JSON.stringify(metadata),
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[AdminAudit] Failed to log action:", error);
  }
}

// Apply auth middleware to all routes
router.use(adminAuthMiddleware);

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

router.post("/auth/login", async (req: AdminRequest, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    
    if (!admin || !admin.enabled) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await db.update(admins)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(admins.id, admin.id));

    if (!ADMIN_JWT_SECRET) {
      return res.status(500).json({ error: "Admin authentication not configured" });
    }

    const token = jwt.sign({ adminId: admin.id }, ADMIN_JWT_SECRET, { expiresIn: '8h' });

    await logAdminAction(
      { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      'auth.login',
      'admin',
      admin.id,
      {},
      req
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("[Admin Auth] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", async (req: AdminRequest, res: Response) => {
  res.json({ admin: req.admin });
});

// ============================================================================
// DASHBOARD METRICS
// ============================================================================

router.get("/dashboard", async (req: AdminRequest, res: Response) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get user counts
    const [totalUsersResult] = await db.select({ count: count() }).from(users).where(isNull(users.deletedAt));
    const totalUsers = totalUsersResult?.count || 0;

    const [activeUsers7d] = await db.select({ count: count() })
      .from(users)
      .where(and(
        isNull(users.deletedAt),
        sql`${users.lastActiveAt} >= ${sevenDaysAgo}`
      ));

    const [activeUsers30d] = await db.select({ count: count() })
      .from(users)
      .where(and(
        isNull(users.deletedAt),
        sql`${users.lastActiveAt} >= ${thirtyDaysAgo}`
      ));

    const [payingUsers] = await db.select({ count: count() })
      .from(users)
      .where(and(
        isNull(users.deletedAt),
        sql`${users.plan} != 'free'`
      ));

    const [suspendedUsers] = await db.select({ count: count() })
      .from(users)
      .where(eq(users.suspended, true));

    const [usersInOnboarding] = await db.select({ count: count() })
      .from(users)
      .where(and(
        isNull(users.deletedAt),
        eq(users.onboardingCompleted, false)
      ));

    // Get job/lead counts
    const [totalJobs] = await db.select({ count: count() }).from(jobs);
    const [totalLeads] = await db.select({ count: count() }).from(leads);
    const [totalInvoices] = await db.select({ count: count() }).from(invoices);

    res.json({
      users: {
        total: totalUsers,
        active7d: activeUsers7d?.count || 0,
        active30d: activeUsers30d?.count || 0,
        paying: payingUsers?.count || 0,
        suspended: suspendedUsers?.count || 0,
        inOnboarding: usersInOnboarding?.count || 0
      },
      activity: {
        totalJobs: totalJobs?.count || 0,
        totalLeads: totalLeads?.count || 0,
        totalInvoices: totalInvoices?.count || 0
      },
      systemHealth: {
        status: 'healthy',
        dbConnected: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[Admin Dashboard] Error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

router.get("/users", async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      plan,
      suspended,
      onboardingState,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions: any[] = [isNull(users.deletedAt)];

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          like(users.name, searchTerm),
          like(users.email, searchTerm),
          like(users.phone, searchTerm),
          like(users.id, searchTerm)
        )
      );
    }

    if (plan && typeof plan === 'string') {
      conditions.push(eq(users.plan, plan));
    }

    if (suspended === 'true') {
      conditions.push(eq(users.suspended, true));
    } else if (suspended === 'false') {
      conditions.push(eq(users.suspended, false));
    }

    if (onboardingState && typeof onboardingState === 'string') {
      conditions.push(eq(users.onboardingState, onboardingState));
    }

    // Get total count
    const [totalResult] = await db.select({ count: count() })
      .from(users)
      .where(and(...conditions));
    const total = totalResult?.count || 0;

    // Get users
    const orderColumn = sortBy === 'email' ? users.email 
      : sortBy === 'name' ? users.name
      : sortBy === 'lastActiveAt' ? users.lastActiveAt
      : users.createdAt;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    const userList = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      plan: users.plan,
      suspended: users.suspended,
      onboardingState: users.onboardingState,
      onboardingCompleted: users.onboardingCompleted,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
      stripeConnectStatus: users.stripeConnectStatus
    })
      .from(users)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(limitNum)
      .offset(offset);

    res.json({
      users: userList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("[Admin Users] List error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get stats
    const [jobStats] = await db.select({ 
      total: count(),
      completed: sql<number>`count(*) filter (where status = 'completed')`
    }).from(jobs).where(eq(jobs.userId, id));

    const [leadStats] = await db.select({ count: count() }).from(leads).where(eq(leads.userId, id));
    const [invoiceStats] = await db.select({ count: count() }).from(invoices).where(eq(invoices.userId, id));

    // Get admin notes
    const notes = await db.select()
      .from(adminNotes)
      .where(eq(adminNotes.userId, id))
      .orderBy(desc(adminNotes.createdAt))
      .limit(10);

    // Get recent audit logs for this user
    const auditLogs = await db.select()
      .from(adminAuditLogs)
      .where(and(
        eq(adminAuditLogs.targetType, 'user'),
        eq(adminAuditLogs.targetId, id)
      ))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(20);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.photo,
        businessName: user.businessName,
        services: user.services,
        plan: user.plan,
        isPro: user.isPro,
        suspended: user.suspended,
        suspendedAt: user.suspendedAt,
        suspendedBy: user.suspendedBy,
        suspendedReason: user.suspendedReason,
        onboardingState: user.onboardingState,
        onboardingStep: user.onboardingStep,
        onboardingCompleted: user.onboardingCompleted,
        stripeConnectStatus: user.stripeConnectStatus,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        deletedAt: user.deletedAt
      },
      stats: {
        jobs: {
          total: jobStats?.total || 0,
          completed: jobStats?.completed || 0
        },
        leads: leadStats?.count || 0,
        invoices: invoiceStats?.count || 0
      },
      notes,
      auditLogs
    });
  } catch (error) {
    console.error("[Admin Users] Detail error:", error);
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

// ============================================================================
// USER ACTIONS
// ============================================================================

router.post("/users/:id/suspend", requireRole('super_admin', 'admin'), async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.suspended) {
      return res.status(400).json({ error: "User is already suspended" });
    }

    await db.update(users)
      .set({
        suspended: true,
        suspendedAt: new Date().toISOString(),
        suspendedBy: req.admin!.email,
        suspendedReason: reason || 'Admin action'
      })
      .where(eq(users.id, id));

    await logAdminAction(
      req.admin!,
      'user.suspend',
      'user',
      id,
      { reason, previousState: { suspended: false } },
      req
    );

    res.json({ success: true, message: "User suspended successfully" });
  } catch (error) {
    console.error("[Admin Users] Suspend error:", error);
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

router.post("/users/:id/reactivate", requireRole('super_admin', 'admin'), async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.suspended) {
      return res.status(400).json({ error: "User is not suspended" });
    }

    await db.update(users)
      .set({
        suspended: false,
        suspendedAt: null,
        suspendedBy: null,
        suspendedReason: null
      })
      .where(eq(users.id, id));

    await logAdminAction(
      req.admin!,
      'user.reactivate',
      'user',
      id,
      { reason, previousState: { suspended: true, suspendedReason: user.suspendedReason } },
      req
    );

    res.json({ success: true, message: "User reactivated successfully" });
  } catch (error) {
    console.error("[Admin Users] Reactivate error:", error);
    res.status(500).json({ error: "Failed to reactivate user" });
  }
});

router.post("/users/:id/reset-onboarding", requireRole('super_admin', 'admin'), async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const previousState = {
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      onboardingState: user.onboardingState
    };

    await db.update(users)
      .set({
        onboardingCompleted: false,
        onboardingStep: 0,
        onboardingState: 'not_started'
      })
      .where(eq(users.id, id));

    await logAdminAction(
      req.admin!,
      'user.reset_onboarding',
      'user',
      id,
      { previousState },
      req
    );

    res.json({ success: true, message: "Onboarding reset successfully" });
  } catch (error) {
    console.error("[Admin Users] Reset onboarding error:", error);
    res.status(500).json({ error: "Failed to reset onboarding" });
  }
});

// ============================================================================
// ADMIN NOTES
// ============================================================================

router.post("/users/:id/notes", requireRole('super_admin', 'admin'), async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [note] = await db.insert(adminNotes)
      .values({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        userId: id,
        content: content.trim(),
        createdAt: new Date().toISOString()
      })
      .returning();

    await logAdminAction(
      req.admin!,
      'user.add_note',
      'user',
      id,
      { noteId: note.id },
      req
    );

    res.json({ success: true, note });
  } catch (error) {
    console.error("[Admin Notes] Add error:", error);
    res.status(500).json({ error: "Failed to add note" });
  }
});

router.get("/users/:id/notes", async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const notes = await db.select()
      .from(adminNotes)
      .where(eq(adminNotes.userId, id))
      .orderBy(desc(adminNotes.createdAt));

    res.json({ notes });
  } catch (error) {
    console.error("[Admin Notes] List error:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

router.get("/audit-logs", async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      action,
      targetType,
      adminId
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    if (action && typeof action === 'string') {
      conditions.push(like(adminAuditLogs.action, `%${action}%`));
    }

    if (targetType && typeof targetType === 'string') {
      conditions.push(eq(adminAuditLogs.targetType, targetType));
    }

    if (adminId && typeof adminId === 'string') {
      conditions.push(eq(adminAuditLogs.adminId, adminId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() })
      .from(adminAuditLogs)
      .where(whereClause);
    const total = totalResult?.count || 0;

    const logs = await db.select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("[Admin Audit] List error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/users/:id/audit-logs", async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const logs = await db.select()
      .from(adminAuditLogs)
      .where(and(
        eq(adminAuditLogs.targetType, 'user'),
        eq(adminAuditLogs.targetId, id)
      ))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(100);

    res.json({ logs });
  } catch (error) {
    console.error("[Admin Audit] User logs error:", error);
    res.status(500).json({ error: "Failed to fetch user audit logs" });
  }
});

export default router;
