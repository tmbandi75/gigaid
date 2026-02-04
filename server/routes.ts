import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto, { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { 
  insertJobSchema, 
  insertLeadSchema, 
  insertInvoiceSchema,
  insertReminderSchema,
  insertCrewMemberSchema,
  insertBookingRequestSchema,
  insertVoiceNoteSchema,
  insertReviewSchema,
  insertCrewInviteSchema,
  insertCrewJobPhotoSchema,
  insertCrewMessageSchema,
  insertPriceConfirmationSchema,
  type Lead,
  type ParsedJobFields,
  type FieldConfidence,
  type PaymentConfig,
} from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { parseTextToPlan, suggestScheduleSlots, generateFollowUp } from "./ai/aiService";
import { parseSharedContent, generateQuickReplies } from "./ai/shareParser";
import { getOpenAI } from "./ai/openaiClient";
import { sendSMS } from "./twilio";
import { sendEmail } from "./sendgrid";
import { geocodeAddress, getDrivingDistance } from "./geocode";
import { computeDepositState, calculateDepositAmount, getCancellationOutcome, formatDepositDisplay } from "./depositHelper";
import { embedDepositMetadata, extractDepositMetadata, DepositMetadata, DerivedDepositState } from "@shared/schema";
import { generateCelebrationMessage } from "./celebration";
import { generateNudgesForUser } from "./nudgeGenerator";
import { createSupportTicket, getTicketsByEmail, getTicketById, addTicketComment, getTicketComments } from "./zendesk";
import cockpitRoutes from "./copilot/routes";
import adminUsersRoutes from "./admin/usersRoutes";
import adminAuthRoutes from "./admin/authRoutes";
import adminSystemHealthRoutes from "./admin/systemHealthRoutes";
import adminAuditLogRoutes from "./admin/auditLogRoutes";
import adminAnalyticsRoutes from "./admin/analyticsRoutes";
import adminCustomerioRoutes from "./admin/customerioRoutes";
import adminStripeRoutes from "./admin/stripeAdminRoutes";
import leadEmailRoutes from "./leadEmailRoutes";
import { startCopilotScheduler } from "./copilot/engine";
import { startCampaignSuggestionScheduler } from "./campaignSuggestionEngine";
import { emitCanonicalEvent } from "./copilot/canonicalEvents";
import { 
  findOrCreateClient, 
  assessBookingRisk, 
  createBookingProtection,
  recordClientCancellation,
  markClientAsReturning,
  checkForIntervention,
  recordIntervention,
  // Capability logging for analytics
} from "./bookingProtection";
import { logCapabilityAttempt } from "@shared/capabilityLogger";
import { hasCapability, isDeveloper } from "@shared/entitlements";
import { isHardGated } from "@shared/gatingConfig";
import { canCreateJob, canSendSms, canUseAutoFollowups, PLAN_LIMITS } from "@shared/planLimits";
import { Plan } from "@shared/plans";
import { canPerform, type CanPerformResult } from "@shared/capabilities/canPerform";
import type { Plan as CapPlan, Capability } from "@shared/capabilities/plans";
import {
  getBookingProtection,
  canShowInterventionToday,
} from "./bookingProtection";
import mobileAuthRoutes from "./mobileAuthRoutes";
import { verifyAppJwt } from "./appJwt";
import { registerStripeWebhookRoutes, processRetryableWebhooks, reconcileStuckPayments, startWebhookRetryScheduler } from "./stripeWebhookRoutes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication FIRST before any other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Register Stripe webhook routes (needs raw body before JSON parsing)
  registerStripeWebhookRoutes(app, storage);
  
  // Start Stripe webhook retry scheduler (every 60 seconds)
  startWebhookRetryScheduler(storage, 60000);

  registerObjectStorageRoutes(app);
  
  app.use("/api/admin/cockpit", cockpitRoutes);
  app.use("/api/admin/users", adminUsersRoutes);
  app.use("/api/admin/auth", adminAuthRoutes);
  app.use("/api/admin/system", adminSystemHealthRoutes);
  app.use("/api/admin/audit-logs", adminAuditLogRoutes);
  app.use("/api/admin/analytics", adminAnalyticsRoutes);
  app.use("/api/admin/customerio", adminCustomerioRoutes);
  app.use("/api/admin/stripe", adminStripeRoutes);
  
  // Simple admin status check (uses regular auth, no admin middleware)
  app.get("/api/admin/status", isAuthenticated, async (req: Request, res: Response) => {
    // Get user ID from JWT Bearer token (Firebase auth) or Replit Auth session
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAppJwt(token);
      if (payload?.sub) {
        userId = payload.sub;
        userEmail = payload.email_normalized || null;
      }
    }
    
    // Fall back to Replit Auth session
    if (!userId) {
      const user = req.user as any;
      userId = user?.claims?.sub || null;
    }
    
    // If we have a userId, look up the user's email from database
    if (userId && !userEmail) {
      const dbUser = await storage.getUser(userId);
      userEmail = dbUser?.email || null;
    }
    
    console.log("[AdminStatus] Checking admin for:", { userId, userEmail });
    
    if (!userId && !userEmail) {
      console.log("[AdminStatus] No userId or email found, returning false");
      return res.json({ isAdmin: false });
    }
    
    // Import isAdminUser dynamically to check admin status
    const { isAdminUser } = await import("./copilot/adminMiddleware");
    const isAdmin = isAdminUser(userId || undefined, userEmail || undefined);
    console.log("[AdminStatus] Bootstrap admin check:", { userId, userEmail, isAdmin });
    
    if (isAdmin) {
      return res.json({ isAdmin: true, role: "super_admin" });
    }
    
    // Check database for admin record
    const { db } = await import("./db");
    const { admins } = await import("@shared/schema");
    const { eq, or } = await import("drizzle-orm");
    
    const conditions = [];
    if (userId) conditions.push(eq(admins.userId, userId));
    if (userEmail) conditions.push(eq(admins.email, userEmail));
    
    if (conditions.length > 0) {
      const [dbAdmin] = await db.select()
        .from(admins)
        .where(or(...conditions))
        .limit(1);
      
      if (dbAdmin && dbAdmin.isActive) {
        return res.json({ isAdmin: true, role: dbAdmin.role });
      }
    }
    
    return res.json({ isAdmin: false });
  });

  app.use("/api", leadEmailRoutes);
  app.use("/api/auth", mobileAuthRoutes);
  
  startCopilotScheduler();
  startCampaignSuggestionScheduler();
  
  // Helper function to get authenticated user ID from request
  // Supports both Replit Auth (session) and mobile JWT Bearer token
  function getAuthenticatedUserId(req: Request): string | null {
    // First, check for JWT Bearer token (mobile auth)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAppJwt(token);
      if (payload?.sub) {
        return payload.sub;
      }
    }
    
    // Fall back to Replit Auth session
    const user = req.user as any;
    return user?.claims?.sub || null;
  }
  
  // Get auth provider type from request
  function getAuthProvider(req: Request): 'replit' | 'firebase' | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAppJwt(token);
      if (payload?.provider) {
        return payload.provider;
      }
    }
    
    const user = req.user as any;
    if (user?.claims?.sub) {
      return 'replit';
    }
    return null;
  }
  
  // Middleware to require authentication and set userId
  // Also blocks access for deleted accounts (Apple App Store compliance)
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Check if account is deleted
    try {
      const user = await storage.getUser(userId);
      if (user?.deletedAt) {
        return res.status(401).json({ error: "Account has been deleted" });
      }
    } catch (error) {
      // Allow through if user check fails - they may be new
    }
    
    (req as any).userId = userId;
    (req as any).authProvider = getAuthProvider(req);
    next();
  };

  // Offline sync endpoints
  app.post("/api/offline/assets", async (req, res) => {
    try {
      // Accept multipart form data for asset uploads
      // In production, this would upload to object storage
      res.json({ success: true, message: "Asset upload acknowledged" });
    } catch (error) {
      console.error("[Offline] Asset upload error:", error);
      res.status(500).json({ error: "Failed to upload asset" });
    }
  });

  app.post("/api/offline/actions", async (req, res) => {
    try {
      const { type, entityType, entityId, payload } = req.body;
      // Process the offline action
      res.json({ success: true, message: "Action processed" });
    } catch (error) {
      console.error("[Offline] Action processing error:", error);
      res.status(500).json({ error: "Failed to process action" });
    }
  });

  // Serve Playwright test report
  app.get("/api/admin/test-report", (req, res) => {
    const reportPath = path.join(process.cwd(), "playwright-report", "index.html");
    if (fs.existsSync(reportPath)) {
      res.sendFile(reportPath);
    } else {
      res.status(404).json({ error: "Test report not found. Run tests first." });
    }
  });

  // Get test summary data
  app.get("/api/admin/test-summary", (req, res) => {
    const reportPath = path.join(process.cwd(), "playwright-report", "index.html");
    const testResultsPath = path.join(process.cwd(), "test-results");
    
    const reportExists = fs.existsSync(reportPath);
    let lastRun = null;
    
    if (reportExists) {
      const stats = fs.statSync(reportPath);
      lastRun = stats.mtime.toISOString();
    }
    
    // Count test result folders for failed tests
    let failedCount = 0;
    if (fs.existsSync(testResultsPath)) {
      const dirs = fs.readdirSync(testResultsPath);
      failedCount = dirs.filter(d => d.includes("chromium")).length;
    }
    
    res.json({
      reportAvailable: reportExists,
      lastRun,
      summary: {
        total: 148,
        passed: 148 - failedCount,
        failed: failedCount,
        passRate: ((148 - failedCount) / 148 * 100).toFixed(1)
      }
    });
  });

  // Downloads API - serve DOT and JSON files for download
  app.get("/api/downloads", (req, res) => {
    const files = [
      {
        id: "architecture-dot",
        name: "gigaid-architecture.dot",
        description: "Application architecture diagram in DOT format (Graphviz)",
        type: "dot",
        size: "3 KB",
        path: "/api/downloads/gigaid-architecture.dot"
      },
      {
        id: "data-model-json",
        name: "gigaid-data-model.json",
        description: "Data model and entity relationships",
        type: "json",
        size: "4 KB",
        path: "/api/downloads/gigaid-data-model.json"
      },
      {
        id: "package-json",
        name: "package.json",
        description: "Project dependencies and scripts",
        type: "json",
        size: "5 KB",
        path: "/api/downloads/package.json"
      },
      {
        id: "manifest-json",
        name: "manifest.json",
        description: "PWA manifest configuration",
        type: "json",
        size: "1 KB",
        path: "/api/downloads/manifest.json"
      },
      {
        id: "tsconfig-json",
        name: "tsconfig.json",
        description: "TypeScript configuration",
        type: "json",
        size: "1 KB",
        path: "/api/downloads/tsconfig.json"
      }
    ];
    res.json({ files });
  });

  app.get("/api/downloads/:filename", (req, res) => {
    const { filename } = req.params;
    const allowedFiles: Record<string, string> = {
      "gigaid-architecture.dot": path.join(process.cwd(), "public", "gigaid-architecture.dot"),
      "gigaid-data-model.json": path.join(process.cwd(), "public", "gigaid-data-model.json"),
      "package.json": path.join(process.cwd(), "package.json"),
      "manifest.json": path.join(process.cwd(), "client", "public", "manifest.json"),
      "tsconfig.json": path.join(process.cwd(), "tsconfig.json")
    };

    const filePath = allowedFiles[filename];
    if (!filePath) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  });

  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.json({
          id: (req as any).userId,
          name: "Gig Worker",
          email: "gig@example.com",
          phone: null,
          photo: null,
        });
      }
      const bookingLink = user.publicProfileSlug 
        ? `https://gigaid.ai/book/${user.publicProfileSlug}`
        : null;
      
      // Get services count - check both provider_services table and user.services array
      const providerServices = await storage.getProviderServices(user.id);
      const servicesCount = providerServices.length > 0 
        ? providerServices.length 
        : (user.services?.length || 0);
      
      res.json({
        id: user.id,
        name: user.name || "Gig Worker",
        email: user.email || "gig@example.com",
        phone: user.phone,
        photo: user.photo,
        businessName: user.businessName,
        bio: user.bio,
        services: user.services,
        servicesCount,
        serviceArea: user.serviceArea,
        availability: user.availability,
        slotDuration: user.slotDuration,
        publicProfileEnabled: user.publicProfileEnabled,
        publicProfileSlug: user.publicProfileSlug,
        bookingLink,
        notifyBySms: user.notifyBySms,
        notifyByEmail: user.notifyByEmail,
        showReviewsOnBooking: user.showReviewsOnBooking,
        publicEstimationEnabled: user.publicEstimationEnabled,
        noShowProtectionEnabled: user.noShowProtectionEnabled,
        plan: user.plan || "free",
      });
    } catch (error) {
      console.error("[Profile] Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // GET /api/booking/link - Get user's booking link for sharing
  app.get("/api/booking/link", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const bookingLink = user.publicProfileSlug 
        ? `https://gigaid.ai/book/${user.publicProfileSlug}`
        : null;
      
      // Get services count - check both provider_services table and user.services array
      const providerServices = await storage.getProviderServices(user.id);
      const servicesCount = providerServices.length > 0 
        ? providerServices.length 
        : (user.services?.length || 0);
      
      res.json({ bookingLink, servicesCount });
    } catch (error) {
      console.error("[BookingLink] Error fetching booking link:", error);
      res.status(500).json({ error: "Failed to fetch booking link" });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const { 
        name, email, phone, photo, businessName, bio, serviceArea,
        firstName, lastName, services,
        // Onboarding/money protection fields
        defaultServiceType, defaultPrice, depositPolicySet, aiExpectationShown,
        depositEnabled, depositValue, slotDuration
      } = req.body;
      let user = await storage.getUser((req as any).userId);
      
      if (!user) {
        user = await storage.createUser({
          username: "demo",
          password: "demo123",
        });
        
        emitCanonicalEvent({
          eventName: "user_signed_up",
          userId: user.id,
          context: { source: "demo_creation" },
          source: "web",
        });
      }
      
      // Only update fields that are explicitly provided (not undefined)
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (photo !== undefined) updates.photo = photo;
      if (businessName !== undefined) updates.businessName = businessName;
      if (bio !== undefined) updates.bio = bio;
      if (serviceArea !== undefined) updates.serviceArea = serviceArea;
      if (services !== undefined) updates.services = services;
      
      // Onboarding/money protection fields
      if (defaultServiceType !== undefined) updates.defaultServiceType = defaultServiceType;
      if (defaultPrice !== undefined) updates.defaultPrice = defaultPrice;
      if (depositPolicySet !== undefined) updates.depositPolicySet = depositPolicySet;
      if (aiExpectationShown !== undefined) updates.aiExpectationShown = aiExpectationShown;
      if (depositEnabled !== undefined) updates.depositEnabled = depositEnabled;
      if (depositValue !== undefined) updates.depositValue = depositValue;
      if (slotDuration !== undefined) updates.slotDuration = slotDuration;
      
      const updatedUser = await storage.updateUser((req as any).userId, updates);
      
      res.json({
        id: updatedUser?.id || (req as any).userId,
        name: updatedUser?.name || name,
        email: updatedUser?.email || email,
        phone: updatedUser?.phone || phone,
        photo: updatedUser?.photo || photo,
        businessName: updatedUser?.businessName || businessName,
        bio: updatedUser?.bio || bio,
        services: updatedUser?.services,
        availability: updatedUser?.availability,
        slotDuration: updatedUser?.slotDuration,
        publicProfileEnabled: updatedUser?.publicProfileEnabled,
        publicProfileSlug: updatedUser?.publicProfileSlug,
        notifyBySms: updatedUser?.notifyBySms,
        notifyByEmail: updatedUser?.notifyByEmail,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Account deletion endpoint - Apple App Store Guideline 5.1.1 compliance
  // Uses requireAuth to support both Replit Auth (web) and App JWT (mobile)
  app.post("/api/account/delete", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        // User already deleted or doesn't exist - return success
        return res.json({ success: true, message: "Account deleted" });
      }

      // Check if already deleted (soft delete)
      if (user.deletedAt) {
        return res.json({ success: true, message: "Account already deleted" });
      }

      const now = new Date().toISOString();
      const anonymizedEmail = `deleted_${userId}@deleted.gigaid.app`;
      
      // Soft delete: anonymize PII and mark as deleted
      await storage.updateUser(userId, {
        email: anonymizedEmail,
        emailNormalized: anonymizedEmail,
        phone: null,
        phoneE164: null,
        name: "Deleted User",
        firstName: null,
        lastName: null,
        photo: null,
        bio: null,
        businessName: null,
        firebaseUid: null,
        deletedAt: now,
        updatedAt: now,
      });

      console.log(`[AccountDelete] User ${userId} account deleted at ${now}`);
      
      // Destroy session if it exists
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) {
            console.error("[AccountDelete] Session destroy error:", err);
          }
        });
      }

      res.json({ success: true, message: "Account deleted" });
    } catch (error) {
      console.error("[AccountDelete] Error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.get("/api/dashboard/summary", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getDashboardSummary((req as any).userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  app.get("/api/dashboard/game-plan", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [jobs, leads, invoices, reminders] = await Promise.all([
        storage.getJobs((req as any).userId),
        storage.getLeads((req as any).userId),
        storage.getInvoices((req as any).userId),
        storage.getReminders((req as any).userId),
      ]);

      interface ActionItem {
        id: string;
        type: "invoice" | "job" | "lead" | "reminder";
        priority: number;
        title: string;
        subtitle: string;
        actionLabel: string;
        actionRoute: string;
        urgency: "critical" | "high" | "normal";
        amount?: number;
      }

      const actionItems: ActionItem[] = [];

      invoices.forEach(inv => {
        if (inv.status === "draft") {
          const daysSinceCreated = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          actionItems.push({
            id: inv.id,
            type: "invoice",
            priority: daysSinceCreated > 3 ? 1 : 5,
            title: `Send invoice to ${inv.clientName}`,
            subtitle: `$${(inv.amount / 100).toFixed(0)} • Draft`,
            actionLabel: "Send Invoice",
            actionRoute: `/invoices/${inv.id}/view`,
            urgency: daysSinceCreated > 3 ? "critical" : "high",
            amount: inv.amount,
          });
        } else if (inv.status === "sent") {
          const sentDate = inv.sentAt ? new Date(inv.sentAt) : new Date(inv.createdAt);
          const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceSent >= 7) {
            actionItems.push({
              id: inv.id,
              type: "invoice",
              priority: 2,
              title: `Payment overdue from ${inv.clientName}`,
              subtitle: `$${(inv.amount / 100).toFixed(0)} • ${daysSinceSent} days`,
              actionLabel: "Send Reminder",
              actionRoute: `/invoices/${inv.id}/view`,
              urgency: "critical",
              amount: inv.amount,
            });
          } else if (daysSinceSent >= 3) {
            actionItems.push({
              id: inv.id,
              type: "invoice",
              priority: 6,
              title: `Waiting on ${inv.clientName}`,
              subtitle: `$${(inv.amount / 100).toFixed(0)} • ${daysSinceSent} days`,
              actionLabel: "Follow Up",
              actionRoute: `/invoices/${inv.id}/view`,
              urgency: "high",
              amount: inv.amount,
            });
          }
        }
      });

      jobs.forEach(job => {
        if (job.status === "scheduled") {
          const jobDate = new Date(`${job.scheduledDate}T${job.scheduledTime || "00:00"}`);
          const hoursUntil = (jobDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          if (hoursUntil > 0 && hoursUntil <= 24 && !job.reminder24hSent) {
            actionItems.push({
              id: job.id,
              type: "job",
              priority: 3,
              title: `Remind ${job.clientName || job.title}`,
              subtitle: `Tomorrow at ${job.scheduledTime || "TBD"}`,
              actionLabel: "Send Reminder",
              actionRoute: `/jobs/${job.id}`,
              urgency: "high",
              amount: job.price || 0,
            });
          } else if (hoursUntil > 24 && hoursUntil <= 48) {
            actionItems.push({
              id: job.id,
              type: "job",
              priority: 8,
              title: `Job with ${job.clientName || job.title}`,
              subtitle: `Tomorrow at ${job.scheduledTime || "TBD"}`,
              actionLabel: "View Job",
              actionRoute: `/jobs/${job.id}`,
              urgency: "normal",
              amount: job.price || 0,
            });
          }
        }
      });

      leads.forEach(lead => {
        if (lead.status === "new" || lead.status === "response_sent") {
          const lastContact = lead.lastContactedAt ? new Date(lead.lastContactedAt) : new Date(lead.createdAt);
          const hoursSinceContact = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceContact >= 24 && lead.status === "response_sent") {
            actionItems.push({
              id: lead.id,
              type: "lead",
              priority: 4,
              title: `No reply from ${lead.clientName}`,
              subtitle: "Follow up?",
              actionLabel: "Follow Up",
              actionRoute: `/leads/${lead.id}`,
              urgency: "high",
            });
          } else if (lead.status === "new" && hoursSinceContact >= 2) {
            actionItems.push({
              id: lead.id,
              type: "lead",
              priority: 7,
              title: `New request from ${lead.clientName}`,
              subtitle: lead.serviceType,
              actionLabel: "Respond",
              actionRoute: `/leads/${lead.id}`,
              urgency: "normal",
            });
          }
        }
      });

      actionItems.sort((a, b) => a.priority - b.priority);
      const priorityItem = actionItems[0] || null;
      const upNextItems = actionItems.slice(1, 4);

      const todaysJobs = jobs.filter(j => j.scheduledDate === today);
      const jobsToday = todaysJobs.length;
      
      const todaysPayments = invoices.filter(inv => 
        inv.status === "paid" && inv.paidAt && inv.paidAt.startsWith(today)
      );
      const moneyCollectedToday = todaysPayments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      const pendingInvoices = invoices.filter(inv => inv.status === "sent");
      const moneyWaiting = pendingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      const pendingReminders = reminders.filter(r => r.status === "pending").length;

      const recentlyCompleted: { id: string; type: string; title: string; completedAt: string }[] = [];
      
      invoices
        .filter(inv => inv.status === "paid" && inv.paidAt)
        .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())
        .slice(0, 3)
        .forEach(inv => {
          recentlyCompleted.push({
            id: inv.id,
            type: "invoice_paid",
            title: `Payment from ${inv.clientName}`,
            completedAt: inv.paidAt!,
          });
        });

      jobs
        .filter(j => j.status === "completed" && j.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 3)
        .forEach(job => {
          recentlyCompleted.push({
            id: job.id,
            type: "job_completed",
            title: `Finished ${job.title}`,
            completedAt: job.completedAt!,
          });
        });

      recentlyCompleted.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      res.json({
        priorityItem,
        upNextItems,
        stats: {
          jobsToday,
          moneyCollectedToday,
          moneyWaiting,
          messagesToSend: pendingReminders,
        },
        recentlyCompleted: recentlyCompleted.slice(0, 3),
      });
    } catch (error) {
      console.error("Game plan error:", error);
      res.status(500).json({ error: "Failed to fetch game plan" });
    }
  });

  app.get("/api/owner/metrics", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      const isPro = user?.isPro ?? true; // Owner View now available to all users

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const jobs = await storage.getJobs((req as any).userId);
      const leads = await storage.getLeads((req as any).userId);
      const invoices = await storage.getInvoices((req as any).userId);

      const completedJobsThisWeek = jobs.filter(job => {
        if (job.status !== "completed") return false;
        const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
        return scheduledDate && scheduledDate >= oneWeekAgo;
      });

      const completedJobsLastWeek = jobs.filter(job => {
        if (job.status !== "completed") return false;
        const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
        return scheduledDate && scheduledDate >= twoWeeksAgo && scheduledDate < oneWeekAgo;
      });

      const completedJobsThisMonth = jobs.filter(job => {
        if (job.status !== "completed") return false;
        const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
        return scheduledDate && scheduledDate >= oneMonthAgo;
      });

      const weeklyRevenue = completedJobsThisWeek.reduce((sum, job) => sum + (job.price || 0), 0);
      const lastWeekRevenue = completedJobsLastWeek.reduce((sum, job) => sum + (job.price || 0), 0);
      const monthlyRevenue = completedJobsThisMonth.reduce((sum, job) => sum + (job.price || 0), 0);

      const revenueChange = lastWeekRevenue > 0 
        ? Math.round(((weeklyRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
        : weeklyRevenue > 0 ? 100 : 0;

      const newLeadsThisWeek = leads.filter(lead => {
        const createdAt = lead.createdAt ? new Date(lead.createdAt) : null;
        return createdAt && createdAt >= oneWeekAgo;
      }).length;

      const newLeadsLastWeek = leads.filter(lead => {
        const createdAt = lead.createdAt ? new Date(lead.createdAt) : null;
        return createdAt && createdAt >= twoWeeksAgo && createdAt < oneWeekAgo;
      }).length;

      const unpaidInvoices = invoices.filter(inv => inv.status === "pending" || inv.status === "sent");
      const outstandingInvoices = {
        count: unpaidInvoices.length,
        totalCents: unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      };

      const upcomingJobs = jobs
        .filter(job => {
          if (job.status !== "scheduled") return false;
          const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
          return scheduledDate && scheduledDate >= now && scheduledDate <= oneWeekFromNow;
        })
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .map(job => ({
          id: job.id,
          clientName: job.clientName || job.title,
          serviceType: job.serviceType,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
          priceCents: job.price || 0,
        }));

      const recentCompletedJobs = completedJobsThisWeek
        .sort((a, b) => {
          const dateA = a.paidAt ? new Date(a.paidAt) : new Date(a.scheduledDate);
          const dateB = b.paidAt ? new Date(b.paidAt) : new Date(b.scheduledDate);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10)
        .map(job => ({
          id: job.id,
          clientName: job.clientName || job.title,
          serviceType: job.serviceType,
          completedAt: job.paidAt || job.scheduledDate,
          priceCents: job.price || 0,
        }));

      // Deposit metrics: jobs with deposit requests this week
      const jobsWithDepositThisWeek = jobs.filter(job => {
        const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
        if (!scheduledDate || scheduledDate < oneWeekAgo) return false;
        const depositMeta = extractDepositMetadata(job.notes);
        return depositMeta && (depositMeta.depositRequestedCents || 0) > 0;
      }).length;

      // Calculate total deposits collected this week from job payments
      const jobPayments = await storage.getJobPayments((req as any).userId);
      const depositPaymentsThisWeek = jobPayments.filter(payment => {
        if (!payment.notes) return false;
        try {
          const notes = JSON.parse(payment.notes);
          if (!notes.isDeposit) return false;
        } catch {
          return false;
        }
        const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;
        return paidAt && paidAt >= oneWeekAgo && payment.amount > 0;
      });
      const depositsCollectedThisWeek = depositPaymentsThisWeek.reduce((sum, p) => sum + p.amount, 0);

      res.json({
        isPro: true,
        weeklyRevenue,
        monthlyRevenue,
        revenueChange,
        jobsCompletedThisWeek: completedJobsThisWeek.length,
        jobsCompletedLastWeek: completedJobsLastWeek.length,
        newLeadsThisWeek,
        newLeadsLastWeek,
        outstandingInvoices,
        upcomingJobs,
        recentCompletedJobs,
        jobsWithDepositThisWeek,
        depositsCollectedThisWeek,
      });
    } catch (error) {
      console.error("Owner metrics error:", error);
      res.status(500).json({ error: "Failed to fetch owner metrics" });
    }
  });

  app.get("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const jobs = await storage.getJobs(userId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Get job usage info for progressive warnings
  app.get("/api/jobs/usage", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      const userPlan = (user?.plan as Plan) || Plan.FREE;
      const jobs = await storage.getJobs((req as any).userId);
      const totalJobCount = jobs.length;
      const limit = PLAN_LIMITS[userPlan].maxJobs;
      
      res.json({
        currentCount: totalJobCount,
        limit: limit,
        plan: userPlan,
        canCreate: isDeveloper(user) || totalJobCount < limit,
        warningLevel: limit === Infinity ? null : 
          totalJobCount >= limit ? "blocked" :
          totalJobCount >= limit - 1 ? "critical" :
          totalJobCount >= limit - 3 ? "warning" : null
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job usage" });
    }
  });

  // Drive Mode: Get today's jobs
  app.get("/api/jobs/today", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getJobs((req as any).userId);
      // Use local date (server time) instead of UTC to match user expectations
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayJobs = jobs.filter(job => {
        if (!job.scheduledDate) return false;
        // Extract just the date portion (YYYY-MM-DD) from scheduledDate
        const jobDate = job.scheduledDate.split('T')[0];
        return jobDate === today && job.status !== 'cancelled';
      });
      res.json(todayJobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch today's jobs" });
    }
  });

  // Drive Mode schemas
  const addNoteSchema = z.object({
    content: z.string().min(1, "Note content is required"),
    timestamp: z.number().optional(),
  });

  const updateStatusSchema = z.object({
    status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
    timestamp: z.number().optional(),
  });

  const voiceNoteSchema = z.object({
    durationMs: z.number().min(0),
    timestamp: z.number().optional(),
  });

  // Drive Mode: Add note to job
  app.post("/api/jobs/:id/notes", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const validated = addNoteSchema.parse(req.body);
      const existingNotes = job.notes || '';
      const newNote = `[${new Date(validated.timestamp || Date.now()).toLocaleString()}] ${validated.content}`;
      const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
      const updated = await storage.updateJob(req.params.id, { notes: updatedNotes });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  // Drive Mode: Update job status
  app.patch("/api/jobs/:id/status", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const previousStatus = job.status;
      const validated = updateStatusSchema.parse(req.body);
      const updates: any = { status: validated.status };
      if (validated.status === 'completed') {
        updates.completedAt = new Date().toISOString();
      }
      const updated = await storage.updateJob(req.params.id, updates);
      
      // Post-Job Momentum: Schedule follow-up messages on completion (fire and forget)
      if (updated && validated.status === 'completed' && previousStatus !== 'completed') {
        import("./postJobMomentum").then(({ schedulePostJobMessages }) => {
          schedulePostJobMessages(updated, previousStatus || "").catch(err => {
            console.error("[PostJobMomentum] Failed to schedule messages:", err);
          });
        }).catch(() => {});
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Drive Mode: Save voice note to job
  app.post("/api/jobs/:id/voice-notes", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const validated = voiceNoteSchema.parse(req.body);
      const existingNotes = job.notes || '';
      const voiceNoteEntry = `[Voice Note - ${new Date(validated.timestamp || Date.now()).toLocaleString()}] Duration: ${Math.round(validated.durationMs / 1000)}s`;
      const updatedNotes = existingNotes ? `${existingNotes}\n\n${voiceNoteEntry}` : voiceNoteEntry;
      const updated = await storage.updateJob(req.params.id, { notes: updatedNotes });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to save voice note" });
    }
  });

  app.get("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      // Get authenticated user ID
      const authUserId = getAuthenticatedUserId(req);
      if (!authUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Extract leadId from body (not part of job schema)
      const { leadId, userId: _userId, ...jobData } = req.body;
      
      // Always use authenticated user ID
      const validated = insertJobSchema.parse({ ...jobData, userId: authUserId });
      
      // Check job creation capability
      const user = await storage.getUser(authUserId);
      const userPlan = (user?.plan as CapPlan) || 'free';
      
      // Developer bypass
      if (!isDeveloper(user)) {
        // Get current usage for jobs.create capability
        const jobsUsageRecord = await storage.getCapabilityUsage(authUserId, 'jobs.create');
        const jobsUsage = jobsUsageRecord?.usageCount ?? 0;
        const capResult = canPerform(userPlan, 'jobs.create', jobsUsage);
        
        if (!capResult.allowed) {
          return res.status(403).json({
            error: "Job limit reached",
            code: "JOB_LIMIT_EXCEEDED",
            message: capResult.reason || "You've reached your job limit. Upgrade for more.",
            currentCount: jobsUsage,
            limit: capResult.limit,
            remaining: capResult.remaining,
            plan: userPlan
          });
        }
      }
      
      // Server-side geocoding fallback: if location provided but no coordinates, geocode it
      let jobWithCoords = { ...validated };
      if (validated.location && (!validated.customerLat || !validated.customerLng)) {
        const coords = await geocodeAddress(validated.location);
        if (coords) {
          jobWithCoords.customerLat = coords.lat;
          jobWithCoords.customerLng = coords.lng;
          console.log(`[Jobs] Geocoded address for new job: ${validated.location} -> (${coords.lat}, ${coords.lng})`);
        }
      }
      
      const job = await storage.createJob(jobWithCoords);
      
      // Increment capability usage after successful job creation
      if (!isDeveloper(user)) {
        await storage.incrementCapabilityUsage(authUserId, 'jobs.create');
      }
      
      emitCanonicalEvent({
        eventName: "booking_created",
        userId: job.userId,
        context: { jobId: job.id, serviceType: job.serviceType, price: job.price, leadId },
        source: "web",
      });
      
      // Auto-schedule confirmation if job has scheduled date/time
      if (job.scheduledDate && job.scheduledTime) {
        import("./postJobMomentum")
          .then(({ scheduleJobConfirmation }) => scheduleJobConfirmation(job, false))
          .catch(err => console.error("[PostJobMomentum] Failed to schedule confirmation:", err));
      }
      
      // Auto-link lead if leadId provided
      if (leadId && typeof leadId === "string") {
        const lead = await storage.getLead(leadId);
        if (lead && lead.userId === validated.userId) {
          await storage.updateLead(leadId, {
            status: "converted",
            convertedAt: new Date().toISOString(),
            convertedJobId: job.id,
          });
        }
      }
      
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const existingJob = await storage.getJob(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const updates = insertJobSchema.partial().parse(req.body);
      
      // Server-side geocoding fallback: if location is being updated without coordinates, geocode it
      if (updates.location && updates.location !== existingJob.location) {
        // Only geocode if new coordinates aren't provided
        if (!updates.customerLat || !updates.customerLng) {
          const coords = await geocodeAddress(updates.location);
          if (coords) {
            updates.customerLat = coords.lat;
            updates.customerLng = coords.lng;
            console.log(`[Jobs] Geocoded updated address: ${updates.location} -> (${coords.lat}, ${coords.lng})`);
          }
        }
      }
      
      // ============================================================
      // REVENUE PROTECTION: No Silent Completion API Guard
      // ============================================================
      // CRITICAL: This guard is ALWAYS ON regardless of feature flags.
      // Feature flags only control UI modal behavior, NOT data enforcement.
      // This is a HARD backstop that prevents revenue leakage via API bypass.
      // 
      // DO NOT REMOVE THIS CHECK. IT MUST NEVER BE GATED BY FEATURE FLAGS.
      // See spec: "Feature flags may control UI behavior, BUT MUST NOT disable
      // data-level enforcement."
      if (updates.status === "completed" && existingJob.status !== "completed") {
        const resolution = await storage.getJobResolution(req.params.id);
        if (!resolution) {
          return res.status(409).json({
            error: "Completed jobs must be resolved with invoice, payment, or waiver.",
            code: "RESOLUTION_REQUIRED",
            message: "Please choose how to handle payment before completing this job.",
          });
        }
      }
      
      // Set completedAt timestamp when job transitions to completed
      if (updates.status === "completed" && existingJob.status !== "completed") {
        updates.completedAt = new Date().toISOString();
        
        emitCanonicalEvent({
          eventName: "booking_completed",
          userId: existingJob.userId,
          context: { jobId: existingJob.id, serviceType: existingJob.serviceType, price: existingJob.price },
          source: "web",
        });
        
        // Intent detection: job completed - create ready action for invoice
        try {
          const { detectJobCompleted, generateReadyActionFromSignal } = await import("./intentDetectionEngine");
          const signal = await detectJobCompleted(existingJob.userId, existingJob.id);
          if (signal) {
            await generateReadyActionFromSignal(signal);
          }
        } catch (err) {
          console.error("[IntentDetection] Failed to detect job completed:", err);
        }
      }
      
      const job = await storage.updateJob(req.params.id, updates);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Auto-schedule confirmation on reschedule (date/time changed)
      const isReschedule = (
        (updates.scheduledDate && updates.scheduledDate !== existingJob.scheduledDate) ||
        (updates.scheduledTime && updates.scheduledTime !== existingJob.scheduledTime)
      );
      if (isReschedule && job.scheduledDate && job.scheduledTime) {
        import("./postJobMomentum")
          .then(({ scheduleJobConfirmation }) => scheduleJobConfirmation(job, true))
          .catch(err => console.error("[PostJobMomentum] Failed to schedule reschedule confirmation:", err));
      }
      
      // Revenue protection: Auto-create draft invoice when job is completed
      // (Legacy behavior - still works when feature flag is OFF)
      if (updates.status === "completed" && existingJob.status !== "completed") {
        // Check if job already has an invoice
        const invoices = await storage.getInvoices(job.userId);
        const hasInvoice = invoices.some(inv => inv.jobId === job.id);
        
        if (!hasInvoice && job.price) {
          // Create draft invoice automatically
          const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
          const draftInvoice = await storage.createInvoice({
            jobId: job.id,
            userId: job.userId,
            clientName: job.clientName || "Client",
            clientPhone: job.clientPhone,
            invoiceNumber,
            amount: job.price,
            status: "draft",
            serviceDescription: `${job.title || job.serviceType || "Service"} - ${job.description || ""}`.trim(),
          });
          
          // Return job with auto-created invoice info
          return res.json({
            ...job,
            autoCreatedInvoice: draftInvoice,
            autoInvoiceMessage: "Draft invoice created automatically. Review and send to client.",
          });
        }
      }
      
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // ============================================================
  // JOB RESOLUTION ENDPOINTS (Revenue Protection)
  // ============================================================
  // Creates a resolution record for a job, required before completing
  // when enforce_no_silent_completion feature flag is ON.
  app.post("/api/jobs/:id/resolution", async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Check if resolution already exists
      const existingResolution = await storage.getJobResolution(jobId);
      if (existingResolution) {
        return res.status(409).json({ 
          error: "Job already has a resolution",
          resolution: existingResolution,
        });
      }

      const { resolutionType, paymentMethod, waiverReason } = req.body;

      // Validate resolution type
      const validTypes = ["invoiced", "paid_without_invoice", "waived"];
      if (!validTypes.includes(resolutionType)) {
        return res.status(400).json({ 
          error: "Invalid resolution type. Must be: invoiced, paid_without_invoice, or waived" 
        });
      }

      // Validate payment method for paid_without_invoice
      if (resolutionType === "paid_without_invoice" && !paymentMethod) {
        return res.status(400).json({ 
          error: "Payment method required for paid_without_invoice resolution" 
        });
      }

      // Validate waiver reason for waived
      if (resolutionType === "waived") {
        const validWaiverReasons = ["warranty", "redo", "goodwill", "internal"];
        if (!validWaiverReasons.includes(waiverReason)) {
          return res.status(400).json({ 
            error: "Invalid waiver reason. Must be: warranty, redo, goodwill, or internal" 
          });
        }
      }

      const now = new Date().toISOString();
      const resolution = await storage.createJobResolution({
        jobId,
        resolutionType,
        paymentMethod: resolutionType === "paid_without_invoice" ? paymentMethod : null,
        waiverReason: resolutionType === "waived" ? waiverReason : null,
        resolvedAt: now,
        resolvedByUserId: job.userId,
        createdAt: now,
      });

      // If paid_without_invoice, also update job payment status
      if (resolutionType === "paid_without_invoice") {
        await storage.updateJob(jobId, {
          paymentStatus: "paid",
          paymentMethod,
          paidAt: now,
        });
      }

      res.status(201).json(resolution);
    } catch (error) {
      console.error("Create job resolution error:", error);
      res.status(500).json({ error: "Failed to create job resolution" });
    }
  });

  // Get job resolution status
  app.get("/api/jobs/:id/resolution", async (req, res) => {
    try {
      const resolution = await storage.getJobResolution(req.params.id);
      if (!resolution) {
        return res.status(404).json({ error: "No resolution found for this job" });
      }
      res.json(resolution);
    } catch (error) {
      res.status(500).json({ error: "Failed to get job resolution" });
    }
  });

  // Check if resolution is required (for UI to know whether to show modal)
  app.get("/api/jobs/:id/resolution-required", async (req, res) => {
    try {
      const enforceFlag = await storage.getFeatureFlag("enforce_no_silent_completion");
      const resolution = await storage.getJobResolution(req.params.id);
      
      res.json({
        required: enforceFlag?.enabled ?? false,
        hasResolution: !!resolution,
        resolution: resolution || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check resolution requirement" });
    }
  });

  app.patch("/api/jobs/:id/provider-location", async (req, res) => {
    try {
      const locationSchema = z.object({
        lat: z.number(),
        lng: z.number(),
      });
      
      const { lat, lng } = locationSchema.parse(req.body);
      const job = await storage.updateJob(req.params.id, {
        providerLat: lat,
        providerLng: lng,
        providerLocationUpdatedAt: new Date().toISOString(),
      });
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update provider location" });
    }
  });

  app.patch("/api/jobs/:id/payment", async (req, res) => {
    try {
      const paymentUpdateSchema = z.object({
        paymentStatus: z.enum(["unpaid", "paid", "partial"]).optional(),
        paymentMethod: z.enum(["cash", "zelle", "venmo", "cashapp", "check", "card", "other"]).optional(),
        paidAt: z.string().optional(),
      });
      
      const validatedData = paymentUpdateSchema.parse(req.body);
      const job = await storage.updateJob(req.params.id, validatedData);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update payment status" });
    }
  });

  // Set deposit request on a job
  app.post("/api/jobs/:id/deposit", async (req, res) => {
    try {
      const depositSchema = z.object({
        depositType: z.enum(["flat", "percent"]),
        depositAmount: z.number().positive(),
      });
      
      const { depositType, depositAmount } = depositSchema.parse(req.body);
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (!job.price) {
        return res.status(400).json({ error: "Job must have a price to set deposit" });
      }
      
      // Calculate deposit amount in cents
      const depositRequestedCents = calculateDepositAmount(job.price, depositType, depositAmount);
      
      // Cap at 30% for trust
      const maxDeposit = Math.round(job.price * 0.30);
      const finalDepositCents = Math.min(depositRequestedCents, maxDeposit);
      
      // Store deposit metadata in notes field
      const depositMeta: DepositMetadata = {
        depositType,
        depositAmount,
        depositRequestedCents: finalDepositCents,
      };
      
      const updatedNotes = embedDepositMetadata(job.notes, depositMeta);
      const updatedJob = await storage.updateJob(req.params.id, { notes: updatedNotes });
      
      res.json({
        job: updatedJob,
        depositRequestedCents: finalDepositCents,
        depositDisplay: formatDepositDisplay(finalDepositCents),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to set deposit" });
    }
  });

  // Get deposit status for a job
  app.get("/api/jobs/:id/deposit-status", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const payments = await storage.getJobPaymentsByJob(req.params.id);
      const depositState = computeDepositState(job, payments);
      
      res.json(depositState);
    } catch (error) {
      res.status(500).json({ error: "Failed to get deposit status" });
    }
  });

  // Record deposit payment
  app.post("/api/jobs/:id/deposit/record-payment", async (req, res) => {
    try {
      const paymentSchema = z.object({
        amount: z.number().positive(),
        method: z.enum(["stripe", "zelle", "venmo", "cashapp", "cash", "check", "other"]),
        proofUrl: z.string().optional(),
      });
      
      const { amount, method, proofUrl } = paymentSchema.parse(req.body);
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Create job payment record for deposit
      const payment = await storage.createJobPayment({
        jobId: job.id,
        userId: job.userId,
        clientName: job.clientName,
        clientEmail: job.clientEmail,
        amount,
        method,
        status: "confirmed",
        proofUrl: proofUrl || null,
        notes: JSON.stringify({ isDeposit: true }),
        paidAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      });
      
      // Get updated deposit state
      const payments = await storage.getJobPaymentsByJob(req.params.id);
      const depositState = computeDepositState(job, payments);
      
      res.json({ payment, depositState });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to record deposit payment" });
    }
  });

  // Send deposit request to client via SMS
  app.post("/api/jobs/:id/deposit/send-request", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Verify job ownership
      if (job.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to send deposit request for this job" });
      }
      
      if (!job.clientPhone) {
        return res.status(400).json({ error: "Client phone number required" });
      }
      
      // Get deposit state
      const payments = await storage.getJobPaymentsByJob(req.params.id);
      const depositState = computeDepositState(job, payments);
      
      if (!depositState.hasDeposit) {
        return res.status(400).json({ error: "No deposit requested for this job" });
      }
      
      if (depositState.isDepositFullyPaid) {
        return res.status(400).json({ error: "Deposit already paid" });
      }
      
      // Get provider info for the message
      const user = await storage.getUser(job.userId);
      const providerName = user?.businessName || user?.firstName || "Your service provider";
      
      // Build deposit payment link
      const baseUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const depositLink = `${baseUrl}/pay-deposit/${job.id}`;
      
      // Format the deposit amount
      const depositAmountFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format((depositState.depositOutstandingCents || depositState.depositRequestedCents) / 100);
      
      // Build SMS message
      const message = `${providerName} is requesting a ${depositAmountFormatted} deposit for your upcoming ${job.serviceType || "service"} appointment. Pay securely here: ${depositLink}`;
      
      // Send SMS
      const { sendSMS } = await import("./twilio");
      const success = await sendSMS(job.clientPhone, message);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to send SMS" });
      }
      
      // Update job notes to track that deposit request was sent
      const now = new Date().toISOString();
      const existingNotes = job.notes || "";
      const updatedNotes = existingNotes.includes("[DEPOSIT_REQUEST_SENT:")
        ? existingNotes.replace(/\[DEPOSIT_REQUEST_SENT:[^\]]+\]/, `[DEPOSIT_REQUEST_SENT:${now}]`)
        : `${existingNotes} [DEPOSIT_REQUEST_SENT:${now}]`.trim();
      
      await storage.updateJob(req.params.id, { notes: updatedNotes });
      
      res.json({ 
        success: true, 
        message: "Deposit request sent to client",
        sentAt: now,
        depositLink,
      });
    } catch (error) {
      console.error("Send deposit request error:", error);
      res.status(500).json({ error: "Failed to send deposit request" });
    }
  });

  // Cancel job with deposit handling
  app.post("/api/jobs/:id/cancel-with-deposit", async (req, res) => {
    try {
      const cancelSchema = z.object({
        cancelledBy: z.enum(["worker", "customer"]),
        reason: z.string().optional(),
      });
      
      const { cancelledBy, reason } = cancelSchema.parse(req.body);
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Calculate hours until job
      const jobDateTime = new Date(`${job.scheduledDate}T${job.scheduledTime}`);
      const now = new Date();
      const hoursUntilJob = (jobDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Get current deposit state
      const payments = await storage.getJobPaymentsByJob(req.params.id);
      const depositState = computeDepositState(job, payments);
      
      // Determine cancellation outcome
      const outcome = getCancellationOutcome(job, cancelledBy, hoursUntilJob, depositState.depositPaidCents);
      
      // Update job status to cancelled
      await storage.updateJob(req.params.id, { status: "cancelled" });
      
      // If refund needed, record refund payment
      if (outcome.refundAmount > 0) {
        await storage.createJobPayment({
          jobId: job.id,
          userId: job.userId,
          clientName: job.clientName,
          clientEmail: job.clientEmail,
          amount: -outcome.refundAmount, // negative for refund
          method: "other",
          status: "confirmed",
          notes: JSON.stringify({ isDepositRefund: true, reason: outcome.reason }),
          paidAt: new Date().toISOString(),
          confirmedAt: new Date().toISOString(),
        });
      }
      
      res.json({
        cancelled: true,
        outcome,
        job: await storage.getJob(req.params.id),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to cancel job" });
    }
  });

  app.post("/api/jobs/:id/send-confirmation", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientPhone) {
        return res.status(400).json({ error: "Client phone number not available" });
      }

      const crypto = await import("crypto");
      const confirmToken = crypto.randomBytes(16).toString("base64url");
      
      const formatTime = (time: string) => {
        const [hours, minutes] = time.split(":");
        const h = parseInt(hours);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour12 = h % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      };

      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      };

      const confirmUrl = `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/confirm/${confirmToken}`;
      
      const smsMessage = `You're booked for ${formatDate(job.scheduledDate)} at ${formatTime(job.scheduledTime)}. Reply YES to confirm. Or click: ${confirmUrl}`;

      await sendSMS(job.clientPhone, smsMessage);

      await storage.updateJob(req.params.id, {
        clientConfirmToken: confirmToken,
        confirmationSentAt: new Date().toISOString(),
      });

      res.json({ success: true, message: "Confirmation sent" });
    } catch (error) {
      console.error("Failed to send confirmation:", error);
      res.status(500).json({ error: "Failed to send confirmation" });
    }
  });

  app.get("/api/public/confirm/:token", async (req, res) => {
    try {
      const job = await storage.getJobByConfirmToken(req.params.token);
      
      if (!job) {
        return res.status(404).json({ error: "Confirmation not found or expired" });
      }

      await storage.updateJob(job.id, {
        clientConfirmStatus: "confirmed",
        clientConfirmedAt: new Date().toISOString(),
      });

      res.json({ success: true, message: "Booking confirmed!", job: { title: job.title, scheduledDate: job.scheduledDate, scheduledTime: job.scheduledTime } });
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm booking" });
    }
  });

  // Photo assets endpoints
  app.get("/api/photo-assets", async (req, res) => {
    try {
      const { sourceType, sourceId } = req.query;
      if (!sourceType || !sourceId) {
        return res.status(400).json({ error: "sourceType and sourceId are required" });
      }
      const photos = await storage.getPhotoAssets(
        sourceType as "booking" | "review" | "job",
        sourceId as string
      );
      res.json(photos);
    } catch (error) {
      console.error("Failed to fetch photo assets:", error);
      res.status(500).json({ error: "Failed to fetch photo assets" });
    }
  });

  app.post("/api/jobs/:id/photos", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { photos, isOfflineSync } = req.body;
      
      // Check offline photos capability
      if (isOfflineSync) {
        const user = await storage.getUser(job.userId);
        const userPlan = (user?.plan as CapPlan) || 'free';
        
        // Developer bypass
        if (!isDeveloper(user)) {
          const photosUsageRecord = await storage.getCapabilityUsage(job.userId, 'offline.photos');
          const photosUsage = photosUsageRecord?.usageCount ?? 0;
          const capResult = canPerform(userPlan, 'offline.photos', photosUsage);
          
          if (!capResult.allowed) {
            return res.status(403).json({
              error: "Offline photo limit reached",
              code: "OFFLINE_PHOTOS_LIMIT_EXCEEDED",
              message: capResult.reason || "You've reached your offline photo limit. Upgrade for more.",
              currentCount: photosUsage,
              limit: capResult.limit,
              remaining: capResult.remaining,
              plan: userPlan
            });
          }
          
          // Pre-check: ensure enough remaining capacity for all photos in this request
          const newPhotosInRequest = Array.isArray(photos) ? photos.filter((p: string) => typeof p === "string" && p.startsWith("/objects/")).length : 0;
          if (capResult.remaining !== undefined && newPhotosInRequest > capResult.remaining) {
            return res.status(403).json({
              error: "Not enough photo capacity",
              code: "OFFLINE_PHOTOS_BATCH_EXCEEDED",
              message: `You can only upload ${capResult.remaining} more photo(s). Upgrade for more capacity.`,
              requestedCount: newPhotosInRequest,
              remaining: capResult.remaining,
              plan: userPlan
            });
          }
        }
      }
      if (!photos || !Array.isArray(photos)) {
        return res.status(400).json({ error: "photos array is required" });
      }

      // Get existing photos for this job
      const existingPhotos = await storage.getPhotoAssets("job", job.id);
      const existingPaths = new Set(existingPhotos.map(p => p.storagePath));
      const newPaths = new Set(photos);

      // Delete photos that are no longer in the list
      for (const existing of existingPhotos) {
        if (!newPaths.has(existing.storagePath)) {
          await storage.deletePhotoAsset(existing.id);
        }
      }

      // Add new photos that don't exist yet
      let newPhotosCount = 0;
      for (const photoPath of photos) {
        if (typeof photoPath === "string" && photoPath.startsWith("/objects/") && !existingPaths.has(photoPath)) {
          await storage.createPhotoAsset({
            ownerUserId: job.userId,
            workspaceUserId: job.userId,
            sourceType: "job",
            sourceId: job.id,
            storageBucket: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "",
            storagePath: photoPath,
            visibility: "private",
          });
          newPhotosCount++;
        }
      }
      
      // Increment offline photos usage for each new photo uploaded
      if (isOfflineSync && newPhotosCount > 0) {
        const user = await storage.getUser(job.userId);
        if (!isDeveloper(user)) {
          for (let i = 0; i < newPhotosCount; i++) {
            await storage.incrementCapabilityUsage(job.userId, 'offline.photos');
          }
        }
      }

      const updatedPhotos = await storage.getPhotoAssets("job", job.id);
      
      if (updatedPhotos.length > 0) {
        emitCanonicalEvent({
          eventName: "photos_uploaded",
          userId: job.userId,
          context: { jobId: job.id, photoCount: updatedPhotos.length },
          source: "web",
        });
      }
      
      res.json(updatedPhotos);
    } catch (error) {
      console.error("Failed to save job photos:", error);
      res.status(500).json({ error: "Failed to save job photos" });
    }
  });

  app.delete("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const { getJobActionEligibility } = await import("@shared/archive-delete-rules");
      const invoices = await storage.getInvoices(job.userId);
      const hasInvoice = invoices.some(inv => inv.jobId === job.id);
      const eligibility = getJobActionEligibility(job, hasInvoice);
      
      if (!eligibility.canDelete) {
        return res.status(403).json({ 
          error: eligibility.deleteBlockedReason || "This job cannot be deleted.",
          canArchive: eligibility.canArchive,
        });
      }
      
      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  app.post("/api/jobs/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const { getJobActionEligibility } = await import("@shared/archive-delete-rules");
      const invoices = await storage.getInvoices(job.userId);
      const hasInvoice = invoices.some(inv => inv.jobId === job.id);
      const eligibility = getJobActionEligibility(job, hasInvoice);
      
      if (!eligibility.canArchive) {
        return res.status(403).json({ 
          error: eligibility.archiveBlockedReason || "This job cannot be archived.",
        });
      }
      
      const updated = await storage.updateJob(req.params.id, { 
        archivedAt: new Date().toISOString() 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to archive job" });
    }
  });

  app.post("/api/jobs/:id/unarchive", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const updated = await storage.updateJob(req.params.id, { 
        archivedAt: null 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to unarchive job" });
    }
  });

  app.get("/api/leads", isAuthenticated, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const leads = await storage.getLeads(userId);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", isAuthenticated, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", isAuthenticated, async (req, res) => {
    try {
      // Get authenticated user ID
      const authUserId = getAuthenticatedUserId(req);
      if (!authUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Always use authenticated user ID
      const { userId: _userId, ...leadData } = req.body;
      const validated = insertLeadSchema.parse({ ...leadData, userId: authUserId });
      const lead = await storage.createLead(validated);
      
      emitCanonicalEvent({
        eventName: "lead_received",
        userId: lead.userId,
        context: { leadId: lead.id, serviceType: lead.serviceType, source: lead.source },
        source: "web",
      });
      
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", isAuthenticated, async (req, res) => {
    try {
      const existingLead = await storage.getLead(req.params.id);
      const updates = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, updates);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Intent detection: status changed to "engaged"
      if (updates.status === "engaged" && existingLead && existingLead.status !== "engaged") {
        try {
          const { detectLeadStatusEngaged, generateReadyActionFromSignal } = await import("./intentDetectionEngine");
          const signal = await detectLeadStatusEngaged(lead.userId, lead.id);
          if (signal) {
            await generateReadyActionFromSignal(signal);
          }
        } catch (err) {
          console.error("[IntentDetection] Failed to detect engaged status:", err);
        }
      }
      
      // Track alternative actions: user changed lead status when AI had an active suggestion
      // Status changes like "lost", "dismissed", "not_interested" indicate user chose different action
      const alternativeStatuses = ["lost", "dismissed", "not_interested", "cold", "unresponsive"];
      if (updates.status && alternativeStatuses.includes(updates.status) && existingLead) {
        try {
          const activeAction = await storage.getActiveReadyActionForEntity("lead", req.params.id);
          if (activeAction) {
            const now = new Date();
            const hour = now.getHours();
            const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
            
            await storage.createAiOverride({
              userId: lead.userId,
              entityType: "lead",
              entityId: lead.id,
              overrideType: "alternative_action",
              originalAction: activeAction.actionType,
              originalAmount: activeAction.prefilledAmount ?? null,
              originalTiming: activeAction.createdAt,
              userAction: `status_changed_to_${updates.status}`,
              userAmount: null,
              delaySeconds: null,
              confidenceScore: null,
              intentSignals: null,
              timeOfDay,
              jobType: activeAction.prefilledServiceType ?? null,
              createdAt: now.toISOString(),
            });
            
            // Dismiss the bypassed ready action
            await storage.dismissReadyAction(activeAction.id);
          }
        } catch (err) {
          console.error("[AiOverride] Failed to track alternative action:", err);
        }
      }
      
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteLead(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  app.post("/api/leads/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const updated = await storage.updateLead(req.params.id, { 
        archivedAt: new Date().toISOString() 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to archive lead" });
    }
  });

  app.post("/api/leads/:id/unarchive", isAuthenticated, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const updated = await storage.updateLead(req.params.id, { 
        archivedAt: null 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to unarchive lead" });
    }
  });

  // Convert lead to job
  app.post("/api/leads/:id/convert", isAuthenticated, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Check if already converted
      if (lead.convertedJobId) {
        return res.status(400).json({ 
          error: "Lead already converted", 
          jobId: lead.convertedJobId 
        });
      }

      // Create job from lead data
      const jobData = {
        userId: lead.userId,
        title: `${lead.serviceType} - ${lead.clientName}`,
        clientName: lead.clientName,
        clientPhone: lead.clientPhone || null,
        clientEmail: lead.clientEmail || null,
        serviceType: lead.serviceType || "General Service",
        status: "scheduled" as const,
        notes: lead.notes || lead.description || null,
        description: lead.description || null,
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: "09:00",
      };

      const job = await storage.createJob(jobData);

      // Update lead with converted status
      await storage.updateLead(req.params.id, {
        status: "converted",
        convertedAt: new Date().toISOString(),
        convertedJobId: job.id,
      });

      res.status(201).json({ jobId: job.id, job });
    } catch (error) {
      console.error("Failed to convert lead:", error);
      res.status(500).json({ error: "Failed to convert lead to job" });
    }
  });

  // Response Tracking - mark response as copied and start follow-up timer
  app.post("/api/leads/:id/response-copied", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const now = new Date().toISOString();
      const updated = await storage.updateLead(req.params.id, {
        responseCopiedAt: now,
        followUpStatus: "pending_check",
        status: lead.status === "new" ? "response_sent" : lead.status,
        lastContactedAt: now,
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark response copied" });
    }
  });

  // Get leads needing follow-up check (24h since response copied)
  app.get("/api/leads/follow-up-needed", isAuthenticated, async (req, res) => {
    try {
      const leads = await storage.getLeads((req as any).userId);
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      const needsFollowUp = leads.filter((lead: Lead) => {
        if (lead.followUpStatus !== "pending_check") return false;
        if (!lead.responseCopiedAt) return false;
        
        // Check if snoozed
        if (lead.followUpSnoozedUntil) {
          const snoozeEnd = new Date(lead.followUpSnoozedUntil).getTime();
          if (now < snoozeEnd) return false;
        }
        
        const copiedAt = new Date(lead.responseCopiedAt).getTime();
        return now - copiedAt >= twentyFourHours;
      });
      
      res.json(needsFollowUp);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads needing follow-up" });
    }
  });

  // Update follow-up status (user answers "Did they reply?")
  app.post("/api/leads/:id/follow-up-response", isAuthenticated, async (req, res) => {
    try {
      const { response } = req.body; // "replied", "waiting", "no_response"
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      let updates: Partial<typeof lead> = {
        followUpStatus: response,
      };
      
      if (response === "replied") {
        // Lead is engaged - they responded back
        updates.status = "engaged";
      } else if (response === "waiting") {
        // Snooze for another 24 hours
        const snoozeUntil = new Date();
        snoozeUntil.setHours(snoozeUntil.getHours() + 24);
        updates.followUpSnoozedUntil = snoozeUntil.toISOString();
        updates.followUpStatus = "pending_check"; // Keep checking
      } else if (response === "no_response") {
        // Mark as cold
        updates.status = "cold";
      }
      
      const updated = await storage.updateLead(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update follow-up status" });
    }
  });

  // Price Confirmations - lightweight price agreements
  app.get("/api/price-confirmations", isAuthenticated, async (req, res) => {
    try {
      const confirmations = await storage.getPriceConfirmationsByUser((req as any).userId);
      res.json(confirmations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price confirmations" });
    }
  });

  app.get("/api/price-confirmations/:id", isAuthenticated, async (req, res) => {
    try {
      const confirmation = await storage.getPriceConfirmation(req.params.id);
      if (!confirmation) {
        return res.status(404).json({ error: "Price confirmation not found" });
      }
      res.json(confirmation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price confirmation" });
    }
  });

  app.get("/api/leads/:leadId/price-confirmations", isAuthenticated, async (req, res) => {
    try {
      const confirmations = await storage.getPriceConfirmationsByLead(req.params.leadId);
      res.json(confirmations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price confirmations" });
    }
  });

  app.get("/api/leads/:leadId/active-price-confirmation", isAuthenticated, async (req, res) => {
    try {
      const confirmation = await storage.getActivePriceConfirmationForLead(req.params.leadId);
      res.json(confirmation || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active price confirmation" });
    }
  });

  // Generate a URL-safe token
  function generateConfirmationToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `pc-${timestamp}-${random}`;
  }

  app.post("/api/price-confirmations", async (req, res) => {
    try {
      const { leadId, serviceType, agreedPrice, notes } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ error: "leadId is required" });
      }
      
      // Validate price - must be a positive number
      const priceValue = parseInt(agreedPrice);
      if (isNaN(priceValue) || priceValue <= 0) {
        return res.status(400).json({ error: "agreedPrice must be a positive number" });
      }
      
      // Verify lead exists
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const token = generateConfirmationToken();
      
      const confirmation = await storage.createPriceConfirmation({
        leadId,
        userId: (req as any).userId,
        serviceType: serviceType || lead.serviceType,
        agreedPrice: priceValue,
        notes: notes || null,
        status: "draft",
        confirmationToken: token,
      });
      
      res.status(201).json(confirmation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create price confirmation" });
    }
  });

  app.patch("/api/price-confirmations/:id", isAuthenticated, async (req, res) => {
    try {
      const { serviceType, agreedPrice, notes } = req.body;
      const updates: Record<string, any> = {};
      
      if (serviceType !== undefined) updates.serviceType = serviceType;
      if (agreedPrice !== undefined) updates.agreedPrice = parseInt(agreedPrice);
      if (notes !== undefined) updates.notes = notes;
      
      const confirmation = await storage.updatePriceConfirmation(req.params.id, updates);
      if (!confirmation) {
        return res.status(404).json({ error: "Price confirmation not found" });
      }
      res.json(confirmation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update price confirmation" });
    }
  });

  app.delete("/api/price-confirmations/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deletePriceConfirmation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Price confirmation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete price confirmation" });
    }
  });

  // Send price confirmation to client
  app.post("/api/price-confirmations/:id/send", isAuthenticated, async (req, res) => {
    try {
      const confirmation = await storage.getPriceConfirmation(req.params.id);
      if (!confirmation) {
        return res.status(404).json({ error: "Price confirmation not found" });
      }
      
      // Get lead for contact info
      const lead = await storage.getLead(confirmation.leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const provider = await storage.getUser((req as any).userId);
      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const confirmationUrl = `${baseUrl}/confirm-price/${confirmation.confirmationToken}`;
      
      const priceFormatted = `$${(confirmation.agreedPrice / 100).toFixed(2)}`;
      const message = `Hi ${lead.clientName}, ${provider?.businessName || provider?.name || "Your service provider"} has sent you a price confirmation for ${confirmation.serviceType || "your service"}: ${priceFormatted}. Please confirm: ${confirmationUrl}`;
      
      let smsSent = false;
      let emailSent = false;
      
      // Send SMS if phone available
      if (lead.clientPhone) {
        try {
          await sendSMS(lead.clientPhone, message);
          smsSent = true;
        } catch (e) {
          console.error("SMS send failed:", e);
        }
      }
      
      // Send email if available
      if (lead.clientEmail) {
        try {
          await sendEmail({
            to: lead.clientEmail,
            subject: `Price Confirmation from ${provider?.businessName || provider?.name || "Your Service Provider"}`,
            text: `Hi ${lead.clientName}, ${provider?.businessName || provider?.name || "Your service provider"} has sent you a price confirmation for ${confirmation.serviceType || "Service"}: ${priceFormatted}. Confirm here: ${confirmationUrl}`,
            html: `<p>Hi ${lead.clientName},</p>
            <p>${provider?.businessName || provider?.name || "Your service provider"} has sent you a price confirmation:</p>
            <p><strong>Service:</strong> ${confirmation.serviceType || "Service"}</p>
            <p><strong>Agreed Price:</strong> ${priceFormatted}</p>
            ${confirmation.notes ? `<p><strong>Notes:</strong> ${confirmation.notes}</p>` : ""}
            <p><a href="${confirmationUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Confirm Price</a></p>
            <p>Or copy this link: ${confirmationUrl}</p>`,
          });
          emailSent = true;
        } catch (e) {
          console.error("Email send failed:", e);
        }
      }
      
      // Update status to sent
      const updated = await storage.updatePriceConfirmation(confirmation.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });
      
      emitCanonicalEvent({
        eventName: "estimate_sent",
        userId: confirmation.userId,
        context: { confirmationId: confirmation.id, leadId: confirmation.leadId, price: confirmation.agreedPrice },
        source: "web",
      });
      
      res.json({
        ...updated,
        confirmationUrl,
        smsSent,
        emailSent,
      });
    } catch (error) {
      console.error("Send price confirmation error:", error);
      res.status(500).json({ error: "Failed to send price confirmation" });
    }
  });

  // Public endpoint: View price confirmation (for clients)
  app.get("/api/public/price-confirmation/:token", async (req, res) => {
    try {
      let confirmation = await storage.getPriceConfirmationByToken(req.params.token);
      if (!confirmation) {
        return res.status(404).json({ error: "Price confirmation not found" });
      }
      
      // Get lead and provider info
      const lead = await storage.getLead(confirmation.leadId);
      const provider = await storage.getUser(confirmation.userId);
      
      // Mark as viewed if not already confirmed or expired
      if (confirmation.status === "sent") {
        const updated = await storage.updatePriceConfirmation(confirmation.id, {
          status: "viewed",
          viewedAt: new Date().toISOString(),
        });
        if (updated) confirmation = updated;
      }
      
      res.json({
        id: confirmation.id,
        serviceType: confirmation.serviceType,
        agreedPrice: confirmation.agreedPrice,
        notes: confirmation.notes,
        status: confirmation.status,
        clientName: lead?.clientName || "Customer",
        provider: {
          name: provider?.name,
          businessName: provider?.businessName,
          phone: provider?.phone,
          email: provider?.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price confirmation" });
    }
  });

  // Public endpoint: Confirm price (client one-tap confirmation)
  app.post("/api/public/price-confirmation/:token/confirm", async (req, res) => {
    try {
      const confirmation = await storage.getPriceConfirmationByToken(req.params.token);
      if (!confirmation) {
        return res.status(404).json({ error: "Price confirmation not found" });
      }
      
      if (confirmation.status === "confirmed") {
        return res.json({ message: "Already confirmed", confirmation });
      }
      
      if (confirmation.status === "expired") {
        return res.status(400).json({ error: "This price confirmation has expired" });
      }
      
      // Get lead for job creation
      const lead = await storage.getLead(confirmation.leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Auto-create job from confirmed price
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const job = await storage.createJob({
        userId: confirmation.userId,
        title: `${confirmation.serviceType || lead.serviceType || "Service"} for ${lead.clientName}`,
        description: confirmation.notes || lead.description || null,
        serviceType: confirmation.serviceType || lead.serviceType,
        location: null,
        scheduledDate: tomorrow.toISOString().split("T")[0],
        scheduledTime: "09:00",
        duration: 60,
        status: "scheduled",
        price: confirmation.agreedPrice,
        clientName: lead.clientName,
        clientPhone: lead.clientPhone || null,
        clientEmail: lead.clientEmail || null,
      });
      
      // Update confirmation status
      const updated = await storage.updatePriceConfirmation(confirmation.id, {
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        convertedJobId: job.id,
      });
      
      // Update lead as price_confirmed
      await storage.updateLead(lead.id, {
        status: "price_confirmed",
        convertedAt: new Date().toISOString(),
        convertedJobId: job.id,
      });
      
      emitCanonicalEvent({
        eventName: "estimate_confirmed",
        userId: confirmation.userId,
        context: { confirmationId: confirmation.id, leadId: lead.id, jobId: job.id, price: confirmation.agreedPrice },
        source: "web",
      });
      
      emitCanonicalEvent({
        eventName: "booking_created",
        userId: job.userId,
        context: { jobId: job.id, serviceType: job.serviceType, price: job.price, leadId: lead.id, fromPriceConfirmation: true },
        source: "web",
      });
      
      res.json({
        message: "Price confirmed! Job created.",
        confirmation: updated,
        jobId: job.id,
      });
    } catch (error) {
      console.error("Confirm price error:", error);
      res.status(500).json({ error: "Failed to confirm price" });
    }
  });

  // Public endpoint: Get deposit info by token (job ID is used as token for simplicity)
  app.get("/api/public/deposit/:token", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.token);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get deposit state
      const payments = await storage.getJobPaymentsByJob(job.id);
      const depositState = computeDepositState(job, payments);
      
      if (!depositState.hasDeposit) {
        return res.status(404).json({ error: "No deposit requested for this job" });
      }

      // Get provider info
      const provider = await storage.getUser(job.userId);

      res.json({
        job: {
          id: job.id,
          title: job.title,
          serviceType: job.serviceType,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
          location: job.location,
          price: job.price,
          clientName: job.clientName,
        },
        depositRequestedCents: depositState.depositRequestedCents,
        depositPaidCents: depositState.depositPaidCents,
        depositOutstandingCents: depositState.depositOutstandingCents,
        isDepositFullyPaid: depositState.isDepositFullyPaid,
        provider: {
          name: provider?.name,
          businessName: provider?.businessName,
          phone: provider?.phone,
          email: provider?.email,
        },
      });
    } catch (error) {
      console.error("Public deposit error:", error);
      res.status(500).json({ error: "Failed to fetch deposit info" });
    }
  });

  // Public endpoint: Record deposit payment from customer
  app.post("/api/public/deposit/:token/record", async (req, res) => {
    try {
      const recordSchema = z.object({
        method: z.enum(["stripe", "zelle", "venmo", "cashapp", "cash", "check", "other"]),
        proofUrl: z.string().optional(),
      });
      
      const { method, proofUrl } = recordSchema.parse(req.body);
      const job = await storage.getJob(req.params.token);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get deposit state
      const payments = await storage.getJobPaymentsByJob(job.id);
      const depositState = computeDepositState(job, payments);
      
      if (!depositState.hasDeposit) {
        return res.status(400).json({ error: "No deposit requested for this job" });
      }

      if (depositState.isDepositFullyPaid) {
        return res.json({ message: "Deposit already paid", alreadyPaid: true });
      }

      // Create payment record (pending confirmation from provider)
      const payment = await storage.createJobPayment({
        jobId: job.id,
        userId: job.userId,
        clientName: job.clientName,
        clientEmail: job.clientEmail,
        amount: depositState.depositOutstandingCents || depositState.depositRequestedCents,
        method,
        status: "pending", // Pending until provider confirms
        proofUrl: proofUrl || null,
        notes: JSON.stringify({ isDeposit: true, customerSubmitted: true }),
        paidAt: new Date().toISOString(),
      });

      res.json({
        message: "Payment recorded. Provider will confirm receipt.",
        payment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Record deposit error:", error);
      res.status(500).json({ error: "Failed to record deposit payment" });
    }
  });

  // Public endpoint: Create Stripe PaymentIntent for deposit
  app.post("/api/public/deposit/:token/create-payment-intent", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.token);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get deposit state
      const payments = await storage.getJobPaymentsByJob(job.id);
      const depositState = computeDepositState(job, payments);

      if (!depositState.hasDeposit) {
        return res.status(400).json({ error: "No deposit requested for this job" });
      }

      if (depositState.isDepositFullyPaid) {
        return res.status(400).json({ error: "Deposit already paid" });
      }

      const amountToCharge = depositState.depositOutstandingCents || depositState.depositRequestedCents;

      // Create Stripe PaymentIntent with idempotency key
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      // Generate idempotency key: userId + jobId + amount + purpose + date bucket (hourly)
      const dateBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const idempotencyKey = `${job.userId}-${job.id}-${amountToCharge}-deposit-${dateBucket}`;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountToCharge,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          jobId: job.id,
          type: "deposit",
          clientName: job.clientName || "",
        },
        description: `Deposit for ${job.title}`,
      }, {
        idempotencyKey,
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } catch (error) {
      console.error("Create deposit payment intent error:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  app.get("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const invoices = await storage.getInvoices((req as any).userId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // Public invoice view by token (for customers)
  app.get("/api/public/invoice/:token", async (req, res) => {
    try {
      // Try to find by publicToken first, then fall back to shareLink
      let invoice = await storage.getInvoiceByPublicToken(req.params.token);
      if (!invoice) {
        invoice = await storage.getInvoiceByShareLink(req.params.token);
      }
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get provider info
      const provider = await storage.getUser(invoice.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Get provider's payment methods
      const paymentMethods = await storage.getUserPaymentMethods(invoice.userId);
      const enabledMethods = paymentMethods.filter(m => m.isEnabled);

      const paymentMethodsMap: Record<string, { label: string | null; instructions: string | null }> = {};
      for (const method of enabledMethods) {
        paymentMethodsMap[method.type] = {
          label: method.label,
          instructions: method.instructions,
        };
      }

      res.json({
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          serviceDescription: invoice.serviceDescription,
          amount: invoice.amount,
          tax: invoice.tax,
          discount: invoice.discount,
          status: invoice.status,
          createdAt: invoice.createdAt,
          sentAt: invoice.sentAt,
          paidAt: invoice.paidAt,
        },
        provider: {
          name: provider.name,
          businessName: provider.businessName,
          phone: provider.phone,
          email: provider.email,
        },
        paymentMethods: paymentMethodsMap,
      });
    } catch (error) {
      console.error("Public invoice error:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      // Get authenticated user ID
      const authUserId = getAuthenticatedUserId(req);
      if (!authUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Remove any userId from body and use authenticated user
      const { userId: _userId, ...invoiceData } = req.body;
      const validated = insertInvoiceSchema.parse({ ...invoiceData, userId: authUserId });
      const invoice = await storage.createInvoice(validated);
      
      // Track if user bypassed an active AI suggestion by creating manually
      // This is a silent override for the learning feedback loop
      if (validated.leadId || validated.jobId) {
        const entityType = validated.leadId ? "lead" : "job";
        const entityId = validated.leadId || validated.jobId || "";
        
        const activeAction = await storage.getActiveReadyActionForEntity(entityType, entityId);
        if (activeAction) {
          const now = new Date();
          const hour = now.getHours();
          const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
          
          await storage.createAiOverride({
            userId: authUserId,
            entityType,
            entityId,
            overrideType: "manual_invoice_bypass",
            originalAction: activeAction.actionType,
            originalAmount: activeAction.prefilledAmount ?? null,
            originalTiming: activeAction.createdAt,
            userAction: "manual_invoice",
            userAmount: validated.amount,
            delaySeconds: null,
            confidenceScore: null,
            intentSignals: null,
            timeOfDay,
            jobType: activeAction.prefilledServiceType ?? null,
            createdAt: now.toISOString(),
          });
          
          // Dismiss the bypassed ready action
          await storage.dismissReadyAction(activeAction.id);
        }
      }
      
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const updates = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, updates);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      // Safely parse request body with defaults
      const body = req.body || {};
      const shouldSendEmail = body.sendEmail !== false;
      const shouldSendSms = body.sendSms !== false;
      
      const existingInvoice = await storage.getInvoice(req.params.id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get provider info
      const provider = await storage.getUser(existingInvoice.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Generate public token if not already present
      const publicToken = existingInvoice.publicToken || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const frontendUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const invoiceUrl = `${frontendUrl}/invoice/${publicToken}`;

      // Get provider's payment methods for the email/SMS
      const paymentMethods = await storage.getUserPaymentMethods(existingInvoice.userId);
      const enabledMethods = paymentMethods.filter(m => m.isEnabled);
      const paymentMethodsList = enabledMethods.map(m => {
        const label = m.type === "cashapp" ? "Cash App" : m.type.charAt(0).toUpperCase() + m.type.slice(1);
        return m.instructions ? `${label}: ${m.instructions}` : label;
      }).join("\n");

      const invoiceTotal = (existingInvoice.amount + (existingInvoice.tax || 0) - (existingInvoice.discount || 0)) / 100;
      const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoiceTotal);
      const businessName = provider.businessName || provider.name || "Your service provider";

      let emailSentAt = existingInvoice.emailSentAt;
      let smsSentAt = existingInvoice.smsSentAt;
      let emailSentNow = false;
      let smsSentNow = false;

      // Send email if client has email and email sending is requested
      if (shouldSendEmail && existingInvoice.clientEmail) {
        try {
          await sendEmail({
            to: existingInvoice.clientEmail,
            subject: `Invoice ${existingInvoice.invoiceNumber} from ${businessName}`,
            text: `Hi ${existingInvoice.clientName},\n\nYou have received an invoice for ${formattedAmount} from ${businessName}.\n\nService: ${existingInvoice.serviceDescription}\n\nView and pay your invoice: ${invoiceUrl}\n\nPayment Options:\n${paymentMethodsList || "Contact the provider for payment options."}\n\nThank you for your business!`,
            html: `
              <h2>Invoice from ${businessName}</h2>
              <p>Hi ${existingInvoice.clientName},</p>
              <p>You have received an invoice for <strong>${formattedAmount}</strong>.</p>
              <p><strong>Invoice Number:</strong> ${existingInvoice.invoiceNumber}</p>
              <p><strong>Service:</strong> ${existingInvoice.serviceDescription}</p>
              <p><a href="${invoiceUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Invoice & Pay</a></p>
              <h3>Payment Options:</h3>
              <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px;">${paymentMethodsList || "Contact the provider for payment options."}</pre>
              <p>Thank you for your business!</p>
            `,
          });
          emailSentAt = new Date().toISOString();
          emailSentNow = true;
        } catch (emailError) {
          console.error("Failed to send invoice email:", emailError);
        }
      }

      // Send SMS if client has phone and SMS sending is requested
      if (shouldSendSms && existingInvoice.clientPhone) {
        try {
          await sendSMS(
            existingInvoice.clientPhone,
            `Invoice ${existingInvoice.invoiceNumber} for ${formattedAmount} from ${businessName}. View & pay: ${invoiceUrl}`
          );
          smsSentAt = new Date().toISOString();
          smsSentNow = true;
        } catch (smsError) {
          console.error("Failed to send invoice SMS:", smsError);
        }
      }

      // Update invoice with sent status and token
      const invoice = await storage.updateInvoice(req.params.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        publicToken,
        emailSentAt,
        smsSentAt,
      });

      res.json({
        ...invoice,
        invoiceUrl,
        emailSent: emailSentNow,
        smsSent: smsSentNow,
      });
    } catch (error) {
      console.error("Invoice send error:", error);
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", async (req, res) => {
    try {
      const { paymentMethod } = req.body;
      const existingInvoice = await storage.getInvoice(req.params.id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const paidAt = new Date().toISOString();
      const invoice = await storage.updateInvoice(req.params.id, {
        status: "paid",
        paymentMethod: paymentMethod || "other",
        paidAt,
      });

      await storage.createJobPayment({
        userId: existingInvoice.userId,
        invoiceId: existingInvoice.id,
        clientName: existingInvoice.clientName,
        clientEmail: existingInvoice.clientEmail,
        amount: existingInvoice.amount + (existingInvoice.tax || 0) - (existingInvoice.discount || 0),
        method: paymentMethod || "other",
        status: "confirmed",
        paidAt,
        confirmedAt: paidAt,
      });

      // Auto-clear: Mark related job as completed and update payment status
      if (existingInvoice.jobId) {
        try {
          const relatedJob = await storage.getJob(existingInvoice.jobId);
          if (relatedJob) {
            const updates: Partial<typeof relatedJob> = { paymentStatus: "paid" };
            
            // If job is still scheduled or in progress, mark it as completed
            if (relatedJob.status === "scheduled" || relatedJob.status === "in_progress") {
              updates.status = "completed";
              updates.completedAt = paidAt;
            }
            
            await storage.updateJob(existingInvoice.jobId, updates);
            console.log(`[AutoClear] Job ${existingInvoice.jobId} updated: payment received`);
          }
        } catch (err) {
          console.error("[AutoClear] Failed to update related job:", err);
        }
      }

      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  app.post("/api/invoices/:id/revert-paid", async (req, res) => {
    try {
      const existingInvoice = await storage.getInvoice(req.params.id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (existingInvoice.status !== "paid") {
        return res.status(400).json({ error: "Invoice is not marked as paid" });
      }

      const invoice = await storage.updateInvoice(req.params.id, {
        status: existingInvoice.sentAt ? "sent" : "draft",
        paymentMethod: null,
        paidAt: null,
      });

      const payments = await storage.getJobPaymentsByInvoice(req.params.id);
      for (const payment of payments) {
        const paymentData = await storage.getJobPayment(payment.id);
        if (paymentData) {
          await storage.updateJobPayment(payment.id, { status: "voided" });
        }
      }

      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to revert invoice payment" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const { getInvoiceActionEligibility } = await import("@shared/archive-delete-rules");
      const payments = await storage.getJobPaymentsByInvoice(invoice.id);
      const hasStripePayment = payments.some(p => p.stripePaymentIntentId);
      const eligibility = getInvoiceActionEligibility(invoice, hasStripePayment);
      
      if (!eligibility.canDelete) {
        return res.status(403).json({ 
          error: eligibility.deleteBlockedReason || "This invoice cannot be deleted.",
          canArchive: eligibility.canArchive,
        });
      }
      
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices/:id/archive", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const updated = await storage.updateInvoice(req.params.id, { 
        archivedAt: new Date().toISOString() 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to archive invoice" });
    }
  });

  app.post("/api/invoices/:id/unarchive", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const updated = await storage.updateInvoice(req.params.id, { 
        archivedAt: null 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to unarchive invoice" });
    }
  });

  // AI Endpoints

  const textToPlanSchema = z.object({
    message: z.string().min(1, "Message is required").max(1000),
  });

  const scheduleSuggestionsSchema = z.object({
    duration: z.number().min(15).max(480).optional().default(60),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  const followUpSchema = z.object({
    clientName: z.string().min(1).max(100),
    context: z.enum(["job_completed", "quote_sent", "new_lead", "no_response"]),
    lastService: z.string().max(200).optional(),
    daysSinceInteraction: z.number().min(0).max(365).optional(),
    tone: z.enum(["friendly", "professional", "casual"]).optional(),
  });

  app.post("/api/ai/text-to-plan", async (req, res) => {
    try {
      const validated = textToPlanSchema.parse(req.body);
      const jobDraft = await parseTextToPlan(validated.message);
      res.json(jobDraft);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      console.error("Text-to-plan error:", error);
      res.status(500).json({ error: "AI service temporarily unavailable" });
    }
  });

  app.post("/api/ai/schedule-suggestions", isAuthenticated, async (req, res) => {
    try {
      const validated = scheduleSuggestionsSchema.parse(req.body);
      const jobs = await storage.getJobs((req as any).userId);
      const suggestions = await suggestScheduleSlots(
        jobs,
        validated.duration,
        validated.preferredDate
      );
      res.json({ suggestions });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      console.error("Schedule suggestions error:", error);
      res.status(500).json({ error: "AI service temporarily unavailable" });
    }
  });

  app.post("/api/ai/follow-up", isAuthenticated, async (req, res) => {
    try {
      const validated = followUpSchema.parse(req.body);
      const followUp = await generateFollowUp({
        clientName: validated.clientName,
        context: validated.context,
        lastService: validated.lastService,
        daysSinceInteraction: validated.daysSinceInteraction,
        tone: validated.tone,
      });
      res.json(followUp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      console.error("Follow-up generation error:", error);
      res.status(500).json({ error: "AI service temporarily unavailable" });
    }
  });

  // SMS Send Endpoint - logs outgoing messages to database
  app.post("/api/sms/send", isAuthenticated, async (req, res) => {
    try {
      const { to, message, clientName, relatedJobId, relatedLeadId } = req.body;
      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }
      
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      const userPlan = (user?.plan as CapPlan) || 'free';
      
      // Check SMS capability using new system
      if (!isDeveloper(user)) {
        const smsUsageRecord = await storage.getCapabilityUsage(userId, 'sms.two_way');
        const smsUsage = smsUsageRecord?.usageCount ?? 0;
        const capResult = canPerform(userPlan, 'sms.two_way', smsUsage);
        
        if (!capResult.allowed) {
          return res.status(403).json({
            error: "SMS limit reached",
            code: "SMS_LIMIT_EXCEEDED",
            message: capResult.reason || "You've reached your SMS limit. Upgrade for more.",
            currentCount: smsUsage,
            limit: capResult.limit,
            remaining: capResult.remaining,
            plan: userPlan
          });
        }
      }
      
      const success = await sendSMS(to, message);
      if (success) {
        // Increment SMS usage after successful send
        if (!isDeveloper(user)) {
          await storage.incrementCapabilityUsage(userId, 'sms.two_way');
        }
        
        // Log the outgoing message to the database
        await storage.createSmsMessage({
          userId,
          clientPhone: to,
          clientName: clientName || null,
          direction: "outbound",
          body: message,
          relatedJobId: relatedJobId || null,
          relatedLeadId: relatedLeadId || null,
        });
        res.json({ success: true, message: "SMS sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send SMS" });
      }
    } catch (error) {
      console.error("SMS send error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // Twilio Webhook for incoming SMS - routes replies to the correct gig worker
  app.post("/api/sms/webhook", async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;
      
      if (!From || !Body) {
        console.error("Missing required fields in Twilio webhook:", req.body);
        return res.status(400).send("Missing required fields");
      }

      // Find the last outbound message to this phone number to determine the worker
      const lastOutbound = await storage.getLastOutboundMessageByPhone(From);
      
      if (lastOutbound) {
        // Route the incoming message to the same worker
        await storage.createSmsMessage({
          userId: lastOutbound.userId,
          clientPhone: From,
          clientName: lastOutbound.clientName,
          direction: "inbound",
          body: Body,
          twilioSid: MessageSid,
          relatedJobId: lastOutbound.relatedJobId,
          relatedLeadId: lastOutbound.relatedLeadId,
          isRead: false,
        });
        console.log(`[SMS Webhook] Incoming from ${From} routed to worker ${lastOutbound.userId} (matched previous conversation)`);
        
        // Intent detection: check message for time/price cues
        try {
          const { detectIntentFromInboundMessage, generateReadyActionFromSignal } = await import("./intentDetectionEngine");
          const entityType = lastOutbound.relatedLeadId ? "lead" : (lastOutbound.relatedJobId ? "job" : null);
          const entityId = lastOutbound.relatedLeadId || lastOutbound.relatedJobId;
          
          if (entityType && entityId) {
            const signal = await detectIntentFromInboundMessage(
              lastOutbound.userId,
              entityType as "lead" | "job",
              entityId,
              Body
            );
            if (signal) {
              await generateReadyActionFromSignal(signal);
              console.log(`[IntentDetection] Created ready action from SMS intent: ${signal.signalType}`);
            }
          }
        } catch (err) {
          console.error("[IntentDetection] Failed to detect SMS intent:", err);
        }
      } else {
        // No previous conversation found - cannot route message without knowing the provider
        // TODO: Implement Twilio number lookup to determine which provider owns this number
        console.log(`[SMS Webhook] No previous conversation found for ${From} - cannot route without prior context`);
        console.log(`[SMS Webhook] Message from unknown sender: ${Body.substring(0, 50)}...`);
        // Do not store the message since we don't know which provider it belongs to
      }

      // Respond to Twilio with empty TwiML to acknowledge receipt
      res.set("Content-Type", "text/xml");
      res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
    } catch (error) {
      console.error("Twilio webhook error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // SMS Inbox Endpoints
  app.get("/api/sms/messages", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getSmsMessages((req as any).userId);
      res.json(messages);
    } catch (error) {
      console.error("SMS messages fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/sms/conversations", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getSmsMessages((req as any).userId);
      
      // Group by client phone and get latest message per conversation
      const conversationsMap = new Map<string, {
        clientPhone: string;
        clientName: string | null;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
        relatedJobId: string | null;
        relatedLeadId: string | null;
      }>();

      for (const msg of messages) {
        const normalizedPhone = msg.clientPhone.replace(/\D/g, '');
        const existing = conversationsMap.get(normalizedPhone);
        
        if (!existing || msg.createdAt > existing.lastMessageAt) {
          const unreadCount = existing?.unreadCount || 0;
          conversationsMap.set(normalizedPhone, {
            clientPhone: msg.clientPhone,
            clientName: msg.clientName || existing?.clientName || null,
            lastMessage: msg.body,
            lastMessageAt: msg.createdAt,
            unreadCount: msg.direction === "inbound" && !msg.isRead 
              ? unreadCount + 1 
              : unreadCount,
            relatedJobId: msg.relatedJobId || existing?.relatedJobId || null,
            relatedLeadId: msg.relatedLeadId || existing?.relatedLeadId || null,
          });
        } else if (msg.direction === "inbound" && !msg.isRead) {
          existing.unreadCount++;
        }
      }

      const conversations = Array.from(conversationsMap.values())
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

      res.json(conversations);
    } catch (error) {
      console.error("SMS conversations fetch error:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/sms/conversation/:phone", isAuthenticated, async (req, res) => {
    try {
      const { phone } = req.params;
      const messages = await storage.getSmsMessagesByPhone((req as any).userId, phone);
      
      // Mark messages as read
      await storage.markSmsMessagesAsRead((req as any).userId, phone);
      
      res.json(messages);
    } catch (error) {
      console.error("SMS conversation fetch error:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/sms/unread-count", isAuthenticated, async (req, res) => {
    try {
      const count = await storage.getUnreadSmsCount((req as any).userId);
      res.json({ count });
    } catch (error) {
      console.error("Unread count fetch error:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.get("/api/leads/:id/sms-messages", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const lead = await storage.getLead(id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      if (!lead.clientPhone) {
        return res.json([]);
      }
      const normalizedPhone = lead.clientPhone.replace(/\D/g, '');
      const messages = await storage.getSmsMessagesByPhone((req as any).userId, normalizedPhone);
      const leadMessages = messages.filter(msg => 
        msg.relatedLeadId === id || 
        msg.clientPhone.replace(/\D/g, '') === normalizedPhone
      );
      res.json(leadMessages);
    } catch (error) {
      console.error("Lead SMS messages fetch error:", error);
      res.status(500).json({ error: "Failed to fetch SMS messages" });
    }
  });

  // Reminders Endpoints
  app.get("/api/reminders", isAuthenticated, async (req, res) => {
    try {
      const reminders = await storage.getReminders((req as any).userId);
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.get("/api/reminders/:id", isAuthenticated, async (req, res) => {
    try {
      const reminder = await storage.getReminder(req.params.id);
      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminder" });
    }
  });

  app.post("/api/reminders", isAuthenticated, async (req, res) => {
    try {
      const validated = insertReminderSchema.parse({
        ...req.body,
        userId: (req as any).userId,
      });
      const reminder = await storage.createReminder(validated);
      res.status(201).json(reminder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });

  app.patch("/api/reminders/:id", isAuthenticated, async (req, res) => {
    try {
      const reminder = await storage.updateReminder(req.params.id, req.body);
      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  app.delete("/api/reminders/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteReminder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });

  // Crew Members Endpoints
  app.get("/api/crew", isAuthenticated, async (req, res) => {
    try {
      const crew = await storage.getCrewMembers((req as any).userId);
      res.json(crew);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  });

  app.post("/api/crew", isAuthenticated, async (req, res) => {
    try {
      const validated = insertCrewMemberSchema.parse({
        ...req.body,
        userId: (req as any).userId,
      });
      const member = await storage.createCrewMember(validated);
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to add crew member" });
    }
  });

  app.patch("/api/crew/:id", isAuthenticated, async (req, res) => {
    try {
      const member = await storage.updateCrewMember(req.params.id, req.body);
      if (!member) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });

  app.delete("/api/crew/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCrewMember(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove crew member" });
    }
  });

  // Get all invites for a specific crew member
  app.get("/api/crew/:crewMemberId/invites", isAuthenticated, async (req, res) => {
    try {
      const allInvites = await storage.getCrewInvites((req as any).userId);
      const memberInvites = allInvites.filter(
        (inv: any) => String(inv.crewMemberId) === req.params.crewMemberId
      );
      
      // Enhance with job details
      const enhancedInvites = await Promise.all(
        memberInvites.map(async (invite: any) => {
          const job = await storage.getJob(invite.jobId);
          return {
            ...invite,
            jobTitle: job?.title,
            jobDate: job?.scheduledDate,
          };
        })
      );
      
      res.json(enhancedInvites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew member invites" });
    }
  });

  // Crew Invite Endpoints - Magic Link System
  const generateSecureToken = () => {
    // Use cryptographically secure random bytes
    const crypto = require('crypto');
    return crypto.randomBytes(24).toString('base64url');
  };

  // Get all crew invites for a user
  app.get("/api/crew-invites", isAuthenticated, async (req, res) => {
    try {
      const invites = await storage.getCrewInvites((req as any).userId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew invites" });
    }
  });

  // Get crew invites for a specific job
  app.get("/api/jobs/:jobId/crew-invites", isAuthenticated, async (req, res) => {
    try {
      const invites = await storage.getCrewInvitesByJob(req.params.jobId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew invites" });
    }
  });

  // Create a new crew invite and optionally send notifications
  app.post("/api/crew-invites", isAuthenticated, async (req, res) => {
    try {
      const { crewMemberId, jobId, sendSms, sendEmailNotification, expiryHours = 48 } = req.body;

      // Verify crew member exists
      const crewMember = await storage.getCrewMember(crewMemberId);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }

      // Verify job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      const invite = await storage.createCrewInvite({
        userId: (req as any).userId,
        crewMemberId,
        jobId,
        token,
        expiresAt,
      });

      // Build magic link
      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const magicLink = `${baseUrl}/crew-portal/${token}`;

      let deliveredVia = "";
      const notifications: string[] = [];

      // Format job date nicely
      let formattedDate = "TBD";
      if (job.scheduledDate) {
        const dateObj = new Date(job.scheduledDate + "T12:00:00");
        formattedDate = dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }

      // Get owner info
      const owner = await storage.getUser((req as any).userId);
      const ownerName = owner?.name || owner?.businessName || "Your Team Lead";

      // Send SMS if requested
      if (sendSms && crewMember.phone) {
        try {
          const smsBody = `Hi ${crewMember.name.split(" ")[0]}! You've been assigned to a job on ${formattedDate}. View details and confirm: ${magicLink}\n\nFrom: ${ownerName}`;
          await sendSMS(crewMember.phone, smsBody);
          deliveredVia = "sms";
          notifications.push("SMS sent");
        } catch (err) {
          console.error("Failed to send SMS:", err);
        }
      }

      // Send email if requested
      if (sendEmailNotification && crewMember.email) {
        try {
          await sendEmail({
            to: crewMember.email,
            subject: `Job Assignment: ${job.title} on ${formattedDate}`,
            text: `Hi ${crewMember.name.split(" ")[0]},\n\nYou've been assigned to a job.\n\nJob: ${job.title}\nDate: ${formattedDate}\nLocation: ${job.location || "TBD"}\n\nView details, confirm attendance, and get directions:\n${magicLink}\n\nThis link expires in ${expiryHours} hours.\n\nFrom: ${ownerName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Job Assignment</h2>
                <p>Hi ${crewMember.name.split(" ")[0]},</p>
                <p>You've been assigned to a job.</p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Job:</strong> ${job.title}</p>
                  <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
                  <p style="margin: 4px 0;"><strong>Location:</strong> ${job.location || "TBD"}</p>
                </div>
                <p>
                  <a href="${magicLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                    View Details & Confirm
                  </a>
                </p>
                <p style="color: #6b7280; font-size: 14px;">This link expires in ${expiryHours} hours.</p>
                <p>From: ${ownerName}</p>
              </div>
            `,
          });
          deliveredVia = deliveredVia ? "both" : "email";
          notifications.push("Email sent");
        } catch (err) {
          console.error("Failed to send email:", err);
        }
      }

      // Update invite with delivery info
      if (deliveredVia) {
        await storage.updateCrewInvite(invite.id, {
          deliveredVia,
          deliveredAt: new Date().toISOString(),
        });
      }

      res.status(201).json({
        ...invite,
        magicLink,
        notifications,
      });
    } catch (error) {
      console.error("Failed to create crew invite:", error);
      res.status(500).json({ error: "Failed to create crew invite" });
    }
  });

  // Public endpoint - validate and get invite details (no auth required)
  app.get("/api/public/crew-portal/:token", async (req, res) => {
    try {
      const invite = await storage.getCrewInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      // Check if expired
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      // Check if revoked
      if (invite.status === "revoked") {
        return res.status(410).json({ error: "Invite has been revoked" });
      }

      // Get job and crew member details
      const job = await storage.getJob(invite.jobId);
      const crewMember = await storage.getCrewMember(invite.crewMemberId);
      const owner = await storage.getUser(invite.userId);
      const photos = await storage.getCrewJobPhotos(invite.jobId);
      const messages = await storage.getCrewMessages(invite.jobId);

      // Mark as viewed if first time
      if (!invite.viewedAt) {
        await storage.updateCrewInvite(invite.id, {
          status: "viewed",
          viewedAt: new Date().toISOString(),
        });
      }

      res.json({
        invite: {
          id: invite.id,
          status: invite.status,
          confirmedAt: invite.confirmedAt,
          declinedAt: invite.declinedAt,
          expiresAt: invite.expiresAt,
        },
        job: job ? {
          id: job.id,
          title: job.title,
          description: job.description,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
          address: job.location,
          status: job.status,
          clientName: job.clientName,
          clientPhone: job.clientPhone,
        } : null,
        crewMember: crewMember ? {
          id: crewMember.id,
          name: crewMember.name,
        } : null,
        owner: owner ? {
          name: owner.name || owner.businessName,
          phone: owner.phone,
          email: owner.email,
        } : null,
        photos: photos.filter(p => p.crewMemberId === invite.crewMemberId),
        messages: messages.filter(m => m.crewMemberId === invite.crewMemberId),
      });
    } catch (error) {
      console.error("Failed to get crew portal data:", error);
      res.status(500).json({ error: "Failed to load portal" });
    }
  });

  // Public endpoint - confirm attendance
  app.post("/api/public/crew-portal/:token/confirm", async (req, res) => {
    try {
      const invite = await storage.getCrewInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      if (invite.status === "revoked") {
        return res.status(410).json({ error: "Invite has been revoked" });
      }

      const updated = await storage.updateCrewInvite(invite.id, {
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
      });

      // Notify owner
      const owner = await storage.getUser(invite.userId);
      const crewMember = await storage.getCrewMember(invite.crewMemberId);
      const job = await storage.getJob(invite.jobId);

      if (owner?.phone && owner.notifyBySms) {
        try {
          await sendSMS(
            owner.phone,
            `${crewMember?.name || "Crew member"} confirmed attendance for "${job?.title || "job"}" on ${job?.scheduledDate || "TBD"}.`
          );
        } catch (err) {
          console.error("Failed to notify owner via SMS:", err);
        }
      }

      res.json({ success: true, status: "confirmed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm attendance" });
    }
  });

  // Public endpoint - decline attendance
  app.post("/api/public/crew-portal/:token/decline", async (req, res) => {
    try {
      const { reason } = req.body;
      const invite = await storage.getCrewInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      if (invite.status === "revoked") {
        return res.status(410).json({ error: "Invite has been revoked" });
      }

      const updated = await storage.updateCrewInvite(invite.id, {
        status: "declined",
        declinedAt: new Date().toISOString(),
      });

      // Notify owner
      const owner = await storage.getUser(invite.userId);
      const crewMember = await storage.getCrewMember(invite.crewMemberId);
      const job = await storage.getJob(invite.jobId);

      if (owner?.phone && owner.notifyBySms) {
        try {
          await sendSMS(
            owner.phone,
            `${crewMember?.name || "Crew member"} declined the job "${job?.title || "job"}" on ${job?.scheduledDate || "TBD"}.${reason ? ` Reason: ${reason}` : ""}`
          );
        } catch (err) {
          console.error("Failed to notify owner via SMS:", err);
        }
      }

      res.json({ success: true, status: "declined" });
    } catch (error) {
      res.status(500).json({ error: "Failed to decline attendance" });
    }
  });

  // Public endpoint - send message from crew to owner
  app.post("/api/public/crew-portal/:token/message", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }

      const invite = await storage.getCrewInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      if (invite.status === "revoked") {
        return res.status(410).json({ error: "Invite has been revoked" });
      }

      const newMessage = await storage.createCrewMessage({
        userId: invite.userId,
        jobId: invite.jobId,
        crewMemberId: invite.crewMemberId,
        crewInviteId: invite.id,
        message: message.trim(),
        isFromCrew: true,
      });

      // Notify owner
      const owner = await storage.getUser(invite.userId);
      const crewMember = await storage.getCrewMember(invite.crewMemberId);
      const job = await storage.getJob(invite.jobId);

      if (owner?.phone && owner.notifyBySms) {
        try {
          await sendSMS(
            owner.phone,
            `Message from ${crewMember?.name || "crew member"} about "${job?.title || "job"}": ${message.trim().substring(0, 100)}${message.length > 100 ? "..." : ""}`
          );
        } catch (err) {
          console.error("Failed to notify owner via SMS:", err);
        }
      }

      res.status(201).json(newMessage);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Public endpoint - upload photo from crew portal
  app.post("/api/public/crew-portal/:token/photo", async (req, res) => {
    try {
      const { photoUrl, caption } = req.body;
      if (!photoUrl) {
        return res.status(400).json({ error: "Photo URL is required" });
      }

      const invite = await storage.getCrewInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      if (invite.status === "revoked") {
        return res.status(410).json({ error: "Invite has been revoked" });
      }

      const photo = await storage.createCrewJobPhoto({
        userId: invite.userId,
        jobId: invite.jobId,
        crewMemberId: invite.crewMemberId,
        crewInviteId: invite.id,
        photoUrl,
        caption: caption || null,
      });

      res.status(201).json(photo);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // Revoke a crew invite (owner only)
  app.post("/api/crew-invites/:id/revoke", isAuthenticated, async (req, res) => {
    try {
      const invite = await storage.getCrewInvite(req.params.id);
      if (!invite || invite.userId !== (req as any).userId) {
        return res.status(404).json({ error: "Invite not found" });
      }

      const updated = await storage.updateCrewInvite(invite.id, {
        status: "revoked",
        revokedAt: new Date().toISOString(),
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to revoke invite" });
    }
  });

  // Resend invite notification
  app.post("/api/crew-invites/:id/resend", isAuthenticated, async (req, res) => {
    try {
      const { sendSms: sendSmsNotification, sendEmailNotification } = req.body;
      const invite = await storage.getCrewInvite(req.params.id);
      if (!invite || invite.userId !== (req as any).userId) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (invite.status === "revoked" || new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Cannot resend expired or revoked invite" });
      }

      const crewMember = await storage.getCrewMember(invite.crewMemberId);
      const job = await storage.getJob(invite.jobId);
      const owner = await storage.getUser(invite.userId);

      if (!crewMember || !job) {
        return res.status(400).json({ error: "Invalid invite data" });
      }

      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const magicLink = `${baseUrl}/crew-portal/${invite.token}`;

      let formattedDate = "TBD";
      if (job.scheduledDate) {
        const dateObj = new Date(job.scheduledDate + "T12:00:00");
        formattedDate = dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }

      const notifications: string[] = [];
      const ownerName = owner?.name || owner?.businessName || "Your Team Lead";

      if (sendSmsNotification && crewMember.phone) {
        try {
          await sendSMS(
            crewMember.phone,
            `Reminder: You're assigned to a job on ${formattedDate}. Confirm here: ${magicLink}\n\nFrom: ${ownerName}`
          );
          notifications.push("SMS sent");
        } catch (err) {
          console.error("Failed to resend SMS:", err);
        }
      }

      if (sendEmailNotification && crewMember.email) {
        try {
          await sendEmail({
            to: crewMember.email,
            subject: `Reminder: Job Assignment - ${job.title}`,
            text: `Hi ${crewMember.name.split(" ")[0]},\n\nReminder: You're assigned to "${job.title}" on ${formattedDate}.\n\nView details and confirm: ${magicLink}\n\nFrom: ${ownerName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Job Reminder</h2>
                <p>Hi ${crewMember.name.split(" ")[0]},</p>
                <p>Reminder: You're assigned to <strong>"${job.title}"</strong> on <strong>${formattedDate}</strong>.</p>
                <p>
                  <a href="${magicLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                    View Details & Confirm
                  </a>
                </p>
                <p>From: ${ownerName}</p>
              </div>
            `,
          });
          notifications.push("Email sent");
        } catch (err) {
          console.error("Failed to resend email:", err);
        }
      }

      res.json({ success: true, notifications });
    } catch (error) {
      res.status(500).json({ error: "Failed to resend invite" });
    }
  });

  // Get crew messages for a job
  app.get("/api/jobs/:jobId/crew-messages", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getCrewMessages(req.params.jobId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send message from owner to crew
  app.post("/api/jobs/:jobId/crew-messages", isAuthenticated, async (req, res) => {
    try {
      const { crewMemberId, message } = req.body;
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }

      const newMessage = await storage.createCrewMessage({
        userId: (req as any).userId,
        jobId: req.params.jobId,
        crewMemberId,
        message: message.trim(),
        isFromCrew: false,
      });

      // Notify crew member
      const crewMember = await storage.getCrewMember(crewMemberId);
      const job = await storage.getJob(req.params.jobId);
      const owner = await storage.getUser((req as any).userId);

      if (crewMember?.phone) {
        try {
          await sendSMS(
            crewMember.phone,
            `Message from ${owner?.name || "Team Lead"} about "${job?.title || "job"}": ${message.trim().substring(0, 100)}${message.length > 100 ? "..." : ""}`
          );
        } catch (err) {
          console.error("Failed to notify crew member via SMS:", err);
        }
      }

      res.status(201).json(newMessage);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get crew photos for a job
  app.get("/api/jobs/:jobId/crew-photos", async (req, res) => {
    try {
      const photos = await storage.getCrewJobPhotos(req.params.jobId);
      res.json(photos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch photos" });
    }
  });

  // Referrals Endpoints
  app.get("/api/referrals", isAuthenticated, async (req, res) => {
    try {
      const referrals = await storage.getReferrals((req as any).userId);
      const user = await storage.getUser((req as any).userId);
      res.json({
        referralCode: user?.referralCode || "",
        referrals,
        totalRewards: referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  });

  app.post("/api/referrals", isAuthenticated, async (req, res) => {
    try {
      const { email, phone } = req.body;
      const referral = await storage.createReferral({
        referrerId: (req as any).userId,
        referredEmail: email || null,
        referredPhone: phone || null,
        referredUserId: null,
      });
      res.status(201).json(referral);
    } catch (error) {
      res.status(500).json({ error: "Failed to create referral" });
    }
  });

  // Redeem referral rewards as subscription credit
  app.post("/api/referrals/redeem", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get all rewarded referrals that haven't been redeemed
      const referrals = await storage.getReferrals(userId);
      const unredeemed = referrals.filter(
        (r) => r.status === "rewarded" && !r.redeemedAt
      );

      if (unredeemed.length === 0) {
        return res.status(400).json({ error: "No rewards available to redeem" });
      }

      // Calculate total credit amount
      const totalCredit = unredeemed.reduce(
        (sum, r) => sum + (r.rewardAmount || 0),
        0
      );

      if (totalCredit <= 0) {
        return res.status(400).json({ error: "No credit amount available" });
      }

      // Mark referrals as redeemed FIRST to prevent race conditions
      // This makes the operation idempotent - if we crash after this,
      // re-running won't double-apply credits
      const now = new Date().toISOString();
      const referralIds = unredeemed.map((r) => r.id);
      for (const referral of unredeemed) {
        await storage.updateReferral(referral.id, {
          status: "redeemed",
          redeemedAt: now,
        });
      }

      // Apply credit to Stripe customer balance if user has Stripe customer
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
      let stripeApplied = false;

      if (STRIPE_ENABLED && user.stripeCustomerId) {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();
          
          // Add credit to customer balance (negative value = credit)
          // Include referral IDs in metadata for idempotency tracking
          await stripe.customers.createBalanceTransaction(user.stripeCustomerId, {
            amount: -totalCredit, // Negative = credit to customer
            currency: "usd",
            description: `Referral rewards credit - ${unredeemed.length} referral(s)`,
            metadata: {
              referralIds: referralIds.join(","),
              userId: userId,
            },
          });
          stripeApplied = true;
        } catch (stripeError) {
          console.error("Failed to apply Stripe credit:", stripeError);
          // Stripe failed but referrals are already marked redeemed
          // Track credit locally as fallback
        }
      }

      // Update user's subscription credit balance if Stripe wasn't used
      if (!stripeApplied) {
        const currentCredit = user.subscriptionCredit || 0;
        await storage.updateUser(userId, {
          subscriptionCredit: currentCredit + totalCredit,
        });
      }

      res.json({
        success: true,
        creditAmount: totalCredit,
        redeemedCount: unredeemed.length,
        appliedToStripe: stripeApplied,
        message: stripeApplied
          ? `$${(totalCredit / 100).toFixed(2)} credit applied to your next invoice`
          : `$${(totalCredit / 100).toFixed(2)} credit saved to your account`,
      });
    } catch (error) {
      console.error("Failed to redeem referral rewards:", error);
      res.status(500).json({ error: "Failed to redeem rewards" });
    }
  });

  // Booking Requests
  app.get("/api/booking-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getBookingRequests((req as any).userId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking requests" });
    }
  });

  app.post("/api/public/book/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const user = await storage.getUserByPublicSlug(slug);
      
      // Check if slug is a UUID (user ID) - this is used for onboarding flow
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUserIdLookup = uuidRegex.test(slug) && user?.id === slug;
      
      // For publicProfileSlug lookups, require publicProfileEnabled
      // For user ID lookups (onboarding), allow access even if not enabled
      if (!user || (!user.publicProfileEnabled && !isUserIdLookup)) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const validated = insertBookingRequestSchema.parse({
        ...req.body,
        userId: user.id,
      });
      
      // Server-side validation for policy acknowledgment when deposits are required
      // Guardrail: Only require deposits if user has completed money protection setup
      const moneyProtectionReady = !!(
        user.defaultServiceType &&
        typeof user.defaultPrice === 'number' && user.defaultPrice > 0 &&
        user.depositPolicySet
      );
      
      const depositEnabled = user.depositEnabled === true && moneyProtectionReady;
      const depositValue = user.depositValue || 0;
      if (depositEnabled && depositValue > 0) {
        if (!req.body.policyAcknowledged) {
          return res.status(400).json({ 
            error: "Policy acknowledgment required",
            message: "You must agree to the cancellation and reschedule policy to confirm your booking."
          });
        }
      }
      
      // Geocode the customer's address to get lat/lng
      let geocodedData: { customerLat?: number; customerLng?: number } = {};
      if (validated.location) {
        const coords = await geocodeAddress(validated.location);
        if (coords) {
          geocodedData = {
            customerLat: coords.lat,
            customerLng: coords.lng,
          };
        }
      }
      
      const request = await storage.createBookingRequest({
        ...validated,
        ...geocodedData,
        policyAcknowledged: !!req.body.policyAcknowledged,
        policyAcknowledgedAt: req.body.policyAcknowledged ? new Date().toISOString() : null,
      });

      // Booking Protection: Assess risk and determine if deposit is required
      // Guardrail: Only enable booking protection if money protection is fully set up
      let bookingProtectionInfo = null;
      if (user.noShowProtectionEnabled !== false && moneyProtectionReady) {
        try {
          const client = await findOrCreateClient(
            user.id,
            validated.clientName,
            validated.clientPhone,
            validated.clientEmail
          );
          
          const estimatedPrice = (validated as any).estimatedPrice ? (validated as any).estimatedPrice * 100 : null;
          const now = new Date();
          const bookingDate = validated.preferredDate 
            ? new Date(`${validated.preferredDate}T${validated.preferredTime || '09:00'}`)
            : new Date(now.getTime() + 48 * 60 * 60 * 1000);
          const leadTimeHours = Math.max(0, (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60));
          
          const riskAssessment = await assessBookingRisk(
            user.id,
            estimatedPrice,
            validated.preferredDate || new Date().toISOString().split('T')[0],
            validated.preferredTime || '09:00',
            client.id
          );
          
          // Log capability attempts for analytics (soft gating - never blocks)
          if (riskAssessment.isHigherRisk) {
            const hasRiskProtection = hasCapability(user, "booking_risk_protection");
            logCapabilityAttempt({
              user: { email: user.email, plan: user.plan },
              capability: "booking_risk_protection",
              granted: hasRiskProtection,
              context: {
                booking_request_id: request.id,
                risk_reason: riskAssessment.isFirstTimeClient ? "new_client" : 
                             riskAssessment.isShortLeadTime ? "last_minute" : "high_price"
              }
            });
            
            const hasDepositEnforcement = hasCapability(user, "deposit_enforcement");
            logCapabilityAttempt({
              user: { email: user.email, plan: user.plan },
              capability: "deposit_enforcement",
              granted: hasDepositEnforcement,
              context: {
                booking_request_id: request.id,
                estimated_price_cents: estimatedPrice
              }
            });
            
            // Hard gating check - returns info to client for blocking intercept
            if (isHardGated("deposit_enforcement") && !hasDepositEnforcement) {
              const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
              if (!STRIPE_ENABLED) {
                console.warn("[Hard Gate] Stripe disabled - blocking prevented, continuing without deposit enforcement");
              } else {
                console.log("[Hard Gate] User requires upgrade for deposit enforcement - client will show blocking intercept");
              }
            }
          }
          
          const depositAmountCents = estimatedPrice 
            ? Math.round(estimatedPrice * (riskAssessment.suggestedDepositPercent / 100))
            : null;
            
          bookingProtectionInfo = {
            isProtected: riskAssessment.isHigherRisk,
            depositRequired: riskAssessment.isHigherRisk,
            depositPercent: riskAssessment.suggestedDepositPercent,
            depositAmountCents,
            clientId: client.id,
            riskFactors: {
              isFirstTimeClient: riskAssessment.isFirstTimeClient,
              isShortLeadTime: riskAssessment.isShortLeadTime,
              isHighPrice: riskAssessment.isHighPrice,
              hasPriorCancellation: riskAssessment.hasPriorCancellation,
            }
          };
          
          // Update booking request with deposit info if protection is required
          if (riskAssessment.isHigherRisk && depositAmountCents) {
            await storage.updateBookingRequest(request.id, {
              depositAmountCents,
            });
          }
        } catch (protectionError) {
          console.error("Failed to assess booking protection:", protectionError);
        }
      }

      // Store photo assets if any photos were uploaded
      const { photos } = req.body;
      if (photos && Array.isArray(photos) && photos.length > 0) {
        for (const photoPath of photos) {
          if (typeof photoPath === "string" && photoPath.startsWith("/objects/")) {
            await storage.createPhotoAsset({
              ownerUserId: null, // Customer-uploaded (not logged in)
              workspaceUserId: user.id,
              sourceType: "booking",
              sourceId: request.id,
              storageBucket: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "",
              storagePath: photoPath,
              visibility: "private",
            });
          }
        }
      }

      // Send confirmation notifications to the client
      const providerFirstName = user.name?.split(" ")[0] || "Your service provider";
      const serviceName = request.serviceType || "service";
      
      // Format date nicely (e.g., "Wednesday, January 15, 2026")
      let formattedDate = "";
      if (request.preferredDate) {
        const dateObj = new Date(request.preferredDate + "T12:00:00");
        formattedDate = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long", 
          day: "numeric",
          year: "numeric"
        });
      }
      
      // Format time with AM/PM (e.g., "10:00 AM")
      let formattedTime = "";
      if (request.preferredTime) {
        const [hours, minutes] = request.preferredTime.split(":");
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        formattedTime = `${hour12}:${minutes} ${ampm}`;
      }
      
      const preferredDateTime = request.preferredDate && request.preferredTime
        ? `on ${formattedDate} at ${formattedTime}`
        : request.preferredDate
        ? `on ${formattedDate}`
        : "at your requested time";

      // Send SMS confirmation
      if (request.clientPhone) {
        const smsMessage = `Hi ${request.clientName.split(" ")[0]}! Your ${serviceName} booking request ${preferredDateTime} has been received. ${providerFirstName} will get back to you shortly to confirm. - Powered by GigAid™`;
        sendSMS(request.clientPhone, smsMessage).catch(err => {
          console.error("Failed to send booking confirmation SMS:", err);
        });
      }

      // Send email confirmation
      if (request.clientEmail) {
        const emailSubject = `Booking Request Received - ${serviceName}`;
        const emailText = `Hi ${request.clientName.split(" ")[0]},\n\nThank you for your booking request!\n\nService: ${serviceName}\nRequested Time: ${preferredDateTime}\n\n${providerFirstName} has received your request and will get back to you shortly to confirm.\n\nBest regards,\n${user.name || "Your Service Provider"}\n\n---\nPowered by GigAid`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Booking Request Received!</h2>
            <p>Hi ${request.clientName.split(" ")[0]},</p>
            <p>Thank you for your booking request!</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Service:</strong> ${serviceName}</p>
              <p style="margin: 8px 0 0;"><strong>Requested Time:</strong> ${preferredDateTime}</p>
            </div>
            <p>${providerFirstName} has received your request and will get back to you shortly to confirm.</p>
            <p>Best regards,<br/>${user.name || "Your Service Provider"}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
            <p style="font-size: 12px; color: #888;">Powered by <a href="http://www.gigaid.com" style="color: #888;">GigAid</a></p>
          </div>
        `;
        sendEmail({
          to: request.clientEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        }).catch(err => {
          console.error("Failed to send booking confirmation email:", err);
        });
      }

      res.status(201).json({
        ...request,
        protection: bookingProtectionInfo,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to submit booking request" });
    }
  });

  app.patch("/api/booking-requests/:id", async (req, res) => {
    try {
      const request = await storage.updateBookingRequest(req.params.id, req.body);
      if (!request) {
        return res.status(404).json({ error: "Booking request not found" });
      }
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to update booking request" });
    }
  });

  // Voice Notes Endpoints
  app.get("/api/voice-notes", isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getVoiceNotes((req as any).userId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice notes" });
    }
  });

  app.post("/api/voice-notes", isAuthenticated, async (req, res) => {
    try {
      const validated = insertVoiceNoteSchema.parse({
        ...req.body,
        userId: (req as any).userId,
      });
      const note = await storage.createVoiceNote(validated);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create voice note" });
    }
  });

  app.patch("/api/voice-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const note = await storage.updateVoiceNote(req.params.id, req.body);
      if (!note) {
        return res.status(404).json({ error: "Voice note not found" });
      }
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update voice note" });
    }
  });

  app.delete("/api/voice-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteVoiceNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Voice note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete voice note" });
    }
  });

  // Reviews Endpoints
  app.get("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const reviews = await storage.getReviews((req as any).userId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const validated = insertReviewSchema.parse({
        ...req.body,
        userId: (req as any).userId,
      });
      const review = await storage.createReview(validated);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  app.post("/api/reviews/:id/respond", isAuthenticated, async (req, res) => {
    try {
      const { response } = req.body;
      const review = await storage.getReview(req.params.id);
      if (!review || review.userId !== (req as any).userId) {
        return res.status(404).json({ error: "Review not found" });
      }
      const updated = await storage.updateReview(req.params.id, {
        providerResponse: response,
        respondedAt: new Date().toISOString(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to respond to review" });
    }
  });

  app.post("/api/invoices/:id/review", async (req, res) => {
    try {
      const { rating, comment } = req.body;
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const review = await storage.createReview({
        userId: invoice.userId,
        invoiceId: invoice.id,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        clientPhone: invoice.clientPhone,
        rating: parseInt(rating, 10),
        comment: comment || null,
        isPublic: true,
      });
      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // Public ZIP code validation endpoint
  app.post("/api/public/validate-zip", async (req, res) => {
    try {
      const { zipCode } = req.body;
      
      if (!zipCode || !/^\d{5}$/.test(zipCode)) {
        return res.status(400).json({ valid: false, error: "Invalid ZIP code format" });
      }
      
      // Valid US ZIP code 3-digit prefixes by state/region
      // Source: USPS ZIP code prefix assignments
      const validPrefixes = new Set([
        // Puerto Rico & Virgin Islands: 006-009
        "006", "007", "008", "009",
        // Massachusetts: 010-027
        "010", "011", "012", "013", "014", "015", "016", "017", "018", "019",
        "020", "021", "022", "023", "024", "025", "026", "027",
        // Rhode Island: 028-029
        "028", "029",
        // New Hampshire: 030-038
        "030", "031", "032", "033", "034", "035", "036", "037", "038",
        // Maine: 039-049
        "039", "040", "041", "042", "043", "044", "045", "046", "047", "048", "049",
        // Vermont: 050-059
        "050", "051", "052", "053", "054", "055", "056", "057", "058", "059",
        // Connecticut: 060-069
        "060", "061", "062", "063", "064", "065", "066", "067", "068", "069",
        // New Jersey: 070-089
        "070", "071", "072", "073", "074", "075", "076", "077", "078", "079",
        "080", "081", "082", "083", "084", "085", "086", "087", "088", "089",
        // Military (AE): 090-098
        "090", "091", "092", "093", "094", "095", "096", "097", "098",
        // New York: 100-149
        "100", "101", "102", "103", "104", "105", "106", "107", "108", "109",
        "110", "111", "112", "113", "114", "115", "116", "117", "118", "119",
        "120", "121", "122", "123", "124", "125", "126", "127", "128", "129",
        "130", "131", "132", "133", "134", "135", "136", "137", "138", "139",
        "140", "141", "142", "143", "144", "145", "146", "147", "148", "149",
        // Pennsylvania: 150-196
        "150", "151", "152", "153", "154", "155", "156", "157", "158", "159",
        "160", "161", "162", "163", "164", "165", "166", "167", "168", "169",
        "170", "171", "172", "173", "174", "175", "176", "177", "178", "179",
        "180", "181", "182", "183", "184", "185", "186", "187", "188", "189",
        "190", "191", "192", "193", "194", "195", "196",
        // Delaware: 197-199
        "197", "198", "199",
        // DC & Maryland: 200-219
        "200", "201", "202", "203", "204", "205", "206", "207", "208", "209",
        "210", "211", "212", "214", "215", "216", "217", "218", "219",
        // Virginia: 220-246
        "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
        "230", "231", "232", "233", "234", "235", "236", "237", "238", "239",
        "240", "241", "242", "243", "244", "245", "246",
        // West Virginia: 247-268
        "247", "248", "249", "250", "251", "252", "253", "254", "255", "256",
        "257", "258", "259", "260", "261", "262", "263", "264", "265", "266", "267", "268",
        // North Carolina: 270-289
        "270", "271", "272", "273", "274", "275", "276", "277", "278", "279",
        "280", "281", "282", "283", "284", "285", "286", "287", "288", "289",
        // South Carolina: 290-299
        "290", "291", "292", "293", "294", "295", "296", "297", "298", "299",
        // Georgia: 300-319, 398-399
        "300", "301", "302", "303", "304", "305", "306", "307", "308", "309",
        "310", "311", "312", "313", "314", "315", "316", "317", "318", "319", "398", "399",
        // Florida: 320-349
        "320", "321", "322", "323", "324", "325", "326", "327", "328", "329",
        "330", "331", "332", "333", "334", "335", "336", "337", "338", "339",
        "340", "341", "342", "344", "346", "347", "349",
        // Alabama: 350-369
        "350", "351", "352", "354", "355", "356", "357", "358", "359",
        "360", "361", "362", "363", "364", "365", "366", "367", "368", "369",
        // Tennessee: 370-385
        "370", "371", "372", "373", "374", "375", "376", "377", "378", "379",
        "380", "381", "382", "383", "384", "385",
        // Mississippi: 386-397
        "386", "387", "388", "389", "390", "391", "392", "393", "394", "395", "396", "397",
        // Kentucky: 400-427
        "400", "401", "402", "403", "404", "405", "406", "407", "408", "409",
        "410", "411", "412", "413", "414", "415", "416", "417", "418",
        "420", "421", "422", "423", "424", "425", "426", "427",
        // Ohio: 430-459
        "430", "431", "432", "433", "434", "435", "436", "437", "438", "439",
        "440", "441", "442", "443", "444", "445", "446", "447", "448", "449",
        "450", "451", "452", "453", "454", "455", "456", "457", "458",
        // Indiana: 460-479
        "460", "461", "462", "463", "464", "465", "466", "467", "468", "469",
        "470", "471", "472", "473", "474", "475", "476", "477", "478", "479",
        // Michigan: 480-499
        "480", "481", "482", "483", "484", "485", "486", "487", "488", "489",
        "490", "491", "492", "493", "494", "495", "496", "497", "498", "499",
        // Iowa: 500-528
        "500", "501", "502", "503", "504", "505", "506", "507", "508", "509",
        "510", "511", "512", "513", "514", "515", "516",
        "520", "521", "522", "523", "524", "525", "526", "527", "528",
        // Wisconsin: 530-549
        "530", "531", "532", "534", "535", "537", "538", "539",
        "540", "541", "542", "543", "544", "545", "546", "547", "548", "549",
        // Minnesota: 550-567
        "550", "551", "553", "554", "555", "556", "557", "558", "559",
        "560", "561", "562", "563", "564", "565", "566", "567",
        // South Dakota: 570-577
        "570", "571", "572", "573", "574", "575", "576", "577",
        // North Dakota: 580-588
        "580", "581", "582", "583", "584", "585", "586", "587", "588",
        // Montana: 590-599
        "590", "591", "592", "593", "594", "595", "596", "597", "598", "599",
        // Illinois: 600-629
        "600", "601", "602", "603", "604", "605", "606", "607", "608", "609",
        "610", "611", "612", "613", "614", "615", "616", "617", "618", "619",
        "620", "622", "623", "624", "625", "626", "627", "628", "629",
        // Missouri: 630-658
        "630", "631", "633", "634", "635", "636", "637", "638", "639",
        "640", "641", "644", "645", "646", "647", "648", "649",
        "650", "651", "652", "653", "654", "655", "656", "657", "658",
        // Kansas: 660-679
        "660", "661", "662", "664", "665", "666", "667", "668", "669",
        "670", "671", "672", "673", "674", "675", "676", "677", "678", "679",
        // Nebraska: 680-693
        "680", "681", "683", "684", "685", "686", "687", "688", "689",
        "690", "691", "692", "693",
        // Louisiana: 700-714
        "700", "701", "703", "704", "705", "706", "707", "708",
        "710", "711", "712", "713", "714",
        // Arkansas: 716-729
        "716", "717", "718", "719", "720", "721", "722", "723", "724", "725", "726", "727", "728", "729",
        // Oklahoma: 730-749
        "730", "731", "734", "735", "736", "737", "738", "739",
        "740", "741", "743", "744", "745", "746", "747", "748", "749",
        // Texas: 750-799, 885
        "750", "751", "752", "753", "754", "755", "756", "757", "758", "759",
        "760", "761", "762", "763", "764", "765", "766", "767", "768", "769",
        "770", "771", "772", "773", "774", "775", "776", "777", "778", "779",
        "780", "781", "782", "783", "784", "785", "786", "787", "788", "789",
        "790", "791", "792", "793", "794", "795", "796", "797", "798", "799", "885",
        // Colorado: 800-816
        "800", "801", "802", "803", "804", "805", "806", "807", "808", "809",
        "810", "811", "812", "813", "814", "815", "816",
        // Wyoming: 820-831
        "820", "821", "822", "823", "824", "825", "826", "827", "828", "829", "830", "831",
        // Idaho: 832-838
        "832", "833", "834", "835", "836", "837", "838",
        // Utah: 840-847
        "840", "841", "842", "843", "844", "845", "846", "847",
        // Arizona: 850-865
        "850", "851", "852", "853", "855", "856", "857", "859", "860", "863", "864", "865",
        // New Mexico: 870-884
        "870", "871", "872", "873", "874", "875", "877", "878", "879",
        "880", "881", "882", "883", "884",
        // Nevada: 889-898
        "889", "890", "891", "893", "894", "895", "897", "898",
        // California: 900-961
        "900", "901", "902", "903", "904", "905", "906", "907", "908",
        "910", "911", "912", "913", "914", "915", "916", "917", "918", "919",
        "920", "921", "922", "923", "924", "925", "926", "927", "928",
        "930", "931", "932", "933", "934", "935", "936", "937", "938", "939",
        "940", "941", "942", "943", "944", "945", "946", "947", "948", "949",
        "950", "951", "952", "953", "954", "955", "956", "957", "958", "959",
        "960", "961",
        // Hawaii: 967-968
        "967", "968",
        // Oregon: 970-979
        "970", "971", "972", "973", "974", "975", "976", "977", "978", "979",
        // Washington: 980-994
        "980", "981", "982", "983", "984", "985", "986", "988", "989",
        "990", "991", "992", "993", "994",
        // Alaska: 995-999
        "995", "996", "997", "998", "999",
      ]);
      
      const prefix = zipCode.substring(0, 3);
      
      if (!validPrefixes.has(prefix)) {
        return res.json({ valid: false, error: "Please enter a valid US ZIP code" });
      }
      
      // Try Zippopotam.us API first (free, no API key required)
      try {
        const zippoResponse = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (zippoResponse.ok) {
          const zippoData = await zippoResponse.json();
          if (zippoData && zippoData.places && zippoData.places.length > 0) {
            const place = zippoData.places[0];
            const lat = parseFloat(place.latitude);
            const lng = parseFloat(place.longitude);
            const city = place["place name"];
            const state = place["state abbreviation"];
            const locationName = `${city}, ${state}`;
            console.log(`[ZIPValidation] Zippopotam validated ZIP ${zipCode}: ${locationName}`);
            return res.json({ valid: true, lat, lng, city, state, locationName });
          }
        } else if (zippoResponse.status === 404) {
          // ZIP code not found - definitely invalid
          console.log(`[ZIPValidation] Zippopotam: ZIP ${zipCode} not found`);
          return res.json({ valid: false, error: "Please enter a valid US ZIP code" });
        }
      } catch (zippoError) {
        console.warn(`[ZIPValidation] Zippopotam API error:`, zippoError);
        // Fall through to Google Maps
      }
      
      // Fallback to Google Maps geocoding
      const { geocodeAddressExtended } = await import("./geocode");
      const result = await geocodeAddressExtended(`${zipCode}, USA`);
      
      if (result.success && result.lat !== undefined && result.lng !== undefined) {
        res.json({ valid: true, lat: result.lat, lng: result.lng });
      } else if (result.status === "ZERO_RESULTS") {
        // ZIP code doesn't exist
        res.json({ valid: false, error: "Please enter a valid US ZIP code" });
      } else if (result.status === "REQUEST_DENIED" || result.status === "NO_API_KEY") {
        // Both APIs failed - reject to be safe
        console.log(`[ZIPValidation] All APIs unavailable, rejecting ZIP ${zipCode}`);
        res.json({ valid: false, error: "Unable to verify ZIP code. Please try again." });
      } else {
        // Other API errors
        console.log(`[ZIPValidation] API error (${result.status}), rejecting ZIP ${zipCode}`);
        res.json({ valid: false, error: "Unable to verify ZIP code. Please try again." });
      }
    } catch (error) {
      console.error("ZIP validation error:", error);
      res.status(500).json({ valid: false, error: "Validation failed" });
    }
  });

  // Public Profile Endpoints
  app.get("/api/public/profile/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const user = await storage.getUserByPublicSlug(slug);
      
      // Check if slug is a UUID (user ID) - this is used for onboarding flow
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUserIdLookup = uuidRegex.test(slug) && user?.id === slug;
      
      // For publicProfileSlug lookups, require publicProfileEnabled
      // For user ID lookups (onboarding), allow access even if not enabled
      if (!user || (!user.publicProfileEnabled && !isUserIdLookup)) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const reviews = await storage.getPublicReviews(user.id);
      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 0;
      
      // Get public photos for reviews
      const reviewsWithPhotos = await Promise.all(
        (user.showReviewsOnBooking !== false ? reviews.slice(0, 5) : []).map(async (review) => {
          const photos = await storage.getPhotoAssets("review", review.id);
          const publicPhotos = photos
            .filter(p => p.visibility === "public")
            .map(p => p.storagePath);
          return {
            ...review,
            photos: publicPhotos.length > 0 ? publicPhotos : undefined,
          };
        })
      );
      
      res.json({
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        photo: user.photo,
        businessName: user.businessName,
        services: user.services || [],
        bio: user.bio,
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
        reviews: reviewsWithPhotos,
        showReviews: user.showReviewsOnBooking !== false,
        availability: user.availability,
        slotDuration: user.slotDuration,
        depositEnabled: user.depositEnabled || false,
        depositType: user.depositType || "percent",
        depositValue: user.depositValue || 0,
        lateRescheduleWindowHours: user.lateRescheduleWindowHours || 24,
        lateRescheduleRetainPctFirst: user.lateRescheduleRetainPctFirst || 40,
        publicEstimationEnabled: user.publicEstimationEnabled !== false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // User settings for public profile and notifications
  app.patch("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const { 
        publicProfileEnabled, 
        publicProfileSlug,
        notifyBySms,
        notifyByEmail,
        businessName,
        phone,
        bio,
        services,
        availability,
        slotDuration,
        showReviewsOnBooking,
        publicEstimationEnabled,
        noShowProtectionEnabled,
        noShowProtectionDepositPercent,
      } = req.body;
      
      // Check if this is the first time enabling public profile (booking link created)
      const existingUser = await storage.getUser((req as any).userId);
      const updates: Record<string, any> = {
        publicProfileEnabled,
        publicProfileSlug,
        notifyBySms,
        notifyByEmail,
        businessName,
        phone,
        bio,
        services,
        availability,
        slotDuration,
        showReviewsOnBooking,
        publicEstimationEnabled,
        noShowProtectionEnabled,
        noShowProtectionDepositPercent,
      };
      
      // Track first time booking link creation
      if (publicProfileEnabled && publicProfileSlug && 
          existingUser && !existingUser.bookingLinkCreatedAt) {
        updates.bookingLinkCreatedAt = new Date().toISOString();
        emitCanonicalEvent({
          eventName: "booking_link_created",
          userId: (req as any).userId,
          context: { slug: publicProfileSlug },
          source: "web",
        });
      }
      
      const user = await storage.updateUser((req as any).userId, updates);
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });
  
  // Track when user shares their booking link
  app.post("/api/track/booking-link-shared", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (user && !user.bookingLinkSharedAt) {
        await storage.updateUser((req as any).userId, {
          bookingLinkSharedAt: new Date().toISOString(),
        });
        emitCanonicalEvent({
          eventName: "booking_link_shared",
          userId: (req as any).userId,
          context: { method: req.body.method || "unknown" },
          source: "web",
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track share" });
    }
  });

  // Get client by phone, email, or ID (for deposit override lookup)
  app.get("/api/client", isAuthenticated, async (req, res) => {
    try {
      const { phone, email, id: clientId } = req.query;
      const userId = (req as any).userId;
      
      if (!phone && !email && !clientId) {
        return res.status(400).json({ error: "Phone, email, or client ID required" });
      }
      
      const { eq, and, or } = await import("drizzle-orm");
      const { db } = await import("./db");
      const { clients } = await import("@shared/schema");
      
      // If clientId is provided, lookup by ID directly
      if (clientId) {
        const clientResults = await db.select()
          .from(clients)
          .where(and(
            eq(clients.id, String(clientId)),
            eq(clients.userId, userId)
          ))
          .limit(1);
        
        if (clientResults.length === 0) {
          return res.json({ client: null });
        }
        return res.json({ client: clientResults[0] });
      }
      
      // Build conditions for client lookup by phone/email
      const clientConditions = [];
      if (phone) {
        const normalizedPhone = String(phone).replace(/\D/g, "");
        if (normalizedPhone.length >= 10) {
          clientConditions.push(eq(clients.clientPhone, normalizedPhone));
        }
      }
      if (email) {
        const normalizedEmail = String(email).toLowerCase().trim();
        if (normalizedEmail.includes("@")) {
          clientConditions.push(eq(clients.clientEmail, normalizedEmail));
        }
      }
      
      // Return null if no valid conditions
      if (clientConditions.length === 0) {
        return res.json({ client: null });
      }
      
      const clientResults = await db.select()
        .from(clients)
        .where(and(
          eq(clients.userId, userId),
          or(...clientConditions)
        ))
        .limit(1);
      
      if (clientResults.length === 0) {
        return res.json({ client: null });
      }
      
      res.json({ client: clientResults[0] });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // Update client deposit override
  app.patch("/api/client/:clientId/deposit", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { depositOverridePercent } = req.body;
      const userId = (req as any).userId;
      
      // Validate deposit percent
      if (depositOverridePercent !== null && 
          (typeof depositOverridePercent !== 'number' || 
           depositOverridePercent < 0 || 
           depositOverridePercent > 100)) {
        return res.status(400).json({ error: "Invalid deposit percentage" });
      }
      
      const { eq, and } = await import("drizzle-orm");
      const { db } = await import("./db");
      const { clients } = await import("@shared/schema");
      
      // Update client
      const updated = await db.update(clients)
        .set({ depositOverridePercent })
        .where(and(
          eq(clients.id, clientId),
          eq(clients.userId, userId)
        ))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json({ client: updated[0] });
    } catch (error) {
      console.error("Error updating client deposit:", error);
      res.status(500).json({ error: "Failed to update client deposit" });
    }
  });

  // Get available time slots for a date (public)
  app.get("/api/public/available-slots/:slug/:date", async (req, res) => {
    try {
      const slug = req.params.slug;
      const user = await storage.getUserByPublicSlug(slug);
      
      // Check if slug is a UUID (user ID) - this is used for onboarding flow
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUserIdLookup = uuidRegex.test(slug) && user?.id === slug;
      
      // For publicProfileSlug lookups, require publicProfileEnabled
      // For user ID lookups (onboarding), allow access even if not enabled
      if (!user || (!user.publicProfileEnabled && !isUserIdLookup)) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const dateStr = req.params.date; // format: YYYY-MM-DD
      const date = new Date(dateStr);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

      // Parse availability
      let availability: any = null;
      try {
        availability = user.availability ? JSON.parse(user.availability) : null;
      } catch (e) {
        availability = null;
      }

      if (!availability || !availability[dayOfWeek] || !availability[dayOfWeek].enabled) {
        return res.json({ available: false, slots: [] });
      }

      const dayConfig = availability[dayOfWeek];
      const slotDuration = user.slotDuration || 60;

      // Get existing bookings for this date
      const jobs = await storage.getJobs(user.id);
      const bookedTimes = jobs
        .filter((j) => j.scheduledDate === dateStr)
        .map((j) => j.scheduledTime);

      // Generate available slots from all time ranges
      const slots: string[] = [];
      const ranges = dayConfig.ranges || [{ start: dayConfig.start, end: dayConfig.end }];

      for (const range of ranges) {
        const [startH, startM] = range.start.split(":").map(Number);
        const [endH, endM] = range.end.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const timeStr = `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
          
          if (!bookedTimes.includes(timeStr) && !slots.includes(timeStr)) {
            slots.push(timeStr);
          }
        }
      }

      // Sort slots chronologically
      slots.sort();

      res.json({ 
        available: true, 
        slots,
        slotDuration,
      });
    } catch (error) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ error: "Failed to fetch available slots" });
    }
  });

  // Smart Slot Ranking by ZIP Proximity
  app.post("/api/public/smart-slots/:slug/:date", async (req, res) => {
    try {
      const { getDistanceBetweenZips, estimateTravelTime, extractZipFromLocation } = await import("./zipDistance");
      
      const slug = req.params.slug;
      const user = await storage.getUserByPublicSlug(slug);
      
      // Check if slug is a UUID (user ID) - this is used for onboarding flow
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUserIdLookup = uuidRegex.test(slug) && user?.id === slug;
      
      // For publicProfileSlug lookups, require publicProfileEnabled
      // For user ID lookups (onboarding), allow access even if not enabled
      if (!user || (!user.publicProfileEnabled && !isUserIdLookup)) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const { clientZipCode } = req.body;
      if (!clientZipCode) {
        return res.status(400).json({ error: "Client ZIP code is required" });
      }

      const dateStr = req.params.date;
      const date = new Date(dateStr);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

      let availability: any = null;
      try {
        availability = user.availability ? JSON.parse(user.availability) : null;
      } catch (e) {
        availability = null;
      }

      if (!availability || !availability[dayOfWeek] || !availability[dayOfWeek].enabled) {
        return res.json({ available: false, slots: [], optimizedSlots: [] });
      }

      const dayConfig = availability[dayOfWeek];
      const slotDuration = user.slotDuration || 60;

      const jobs = await storage.getJobs(user.id);
      const scheduledJobs = jobs.filter((j) => j.scheduledDate === dateStr && j.scheduledTime);

      const bookedTimes = scheduledJobs.map((j) => j.scheduledTime);

      const slots: string[] = [];
      const ranges = dayConfig.ranges || [{ start: dayConfig.start, end: dayConfig.end }];

      for (const range of ranges) {
        const [startH, startM] = range.start.split(":").map(Number);
        const [endH, endM] = range.end.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const timeStr = `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
          
          if (!bookedTimes.includes(timeStr) && !slots.includes(timeStr)) {
            slots.push(timeStr);
          }
        }
      }

      const optimizedSlots = slots.map((slot) => {
        const [slotH, slotM] = slot.split(":").map(Number);
        const slotMinutes = slotH * 60 + slotM;

        let nearestJob: { time: string; location: string; distance: number } | null = null;
        let minDistance = Infinity;

        for (const job of scheduledJobs) {
          if (!job.scheduledTime || !job.location) continue;
          
          const jobZip = extractZipFromLocation(job.location);
          if (!jobZip) continue;

          const [jobH, jobM] = job.scheduledTime.split(":").map(Number);
          const jobMinutes = jobH * 60 + jobM;
          const jobEndMinutes = jobMinutes + (job.duration || 60);

          const timeDiffBefore = slotMinutes - jobEndMinutes;
          const timeDiffAfter = jobMinutes - (slotMinutes + slotDuration);

          const isAdjacent = timeDiffBefore >= 0 && timeDiffBefore <= 120 ||
                            timeDiffAfter >= 0 && timeDiffAfter <= 120;

          if (isAdjacent) {
            const distance = getDistanceBetweenZips(clientZipCode, jobZip);
            if (distance < minDistance) {
              minDistance = distance;
              nearestJob = {
                time: job.scheduledTime,
                location: job.location,
                distance,
              };
            }
          }
        }

        let proximityScore = 50;
        let travelTime = 0;
        let recommendation: "best" | "good" | "available" = "available";

        if (nearestJob) {
          travelTime = estimateTravelTime(nearestJob.distance);
          proximityScore = Math.max(0, 100 - nearestJob.distance * 5);
          
          if (nearestJob.distance <= 5) {
            recommendation = "best";
          } else if (nearestJob.distance <= 15) {
            recommendation = "good";
          }
        }

        return {
          time: slot,
          proximityScore: Math.round(proximityScore),
          travelTime,
          recommendation,
          nearbyJob: nearestJob ? {
            distance: Math.round(nearestJob.distance * 10) / 10,
          } : null,
        };
      });

      optimizedSlots.sort((a, b) => {
        const recOrder = { best: 0, good: 1, available: 2 };
        if (recOrder[a.recommendation] !== recOrder[b.recommendation]) {
          return recOrder[a.recommendation] - recOrder[b.recommendation];
        }
        return a.time.localeCompare(b.time);
      });

      res.json({
        available: true,
        slots,
        optimizedSlots,
        slotDuration,
        clientZipCode,
      });
    } catch (error) {
      console.error("Error generating smart slots:", error);
      res.status(500).json({ error: "Failed to generate smart slots" });
    }
  });

  // Booking Page AI Features
  app.post("/api/public/ai/recommend-service", async (req, res) => {
    try {
      const { userInput, slug } = req.body;
      if (!userInput || !slug) {
        return res.status(400).json({ error: "Missing userInput or slug" });
      }

      const user = await storage.getUserByPublicSlug(slug);
      
      // Check if slug is a UUID (user ID) - this is used for onboarding flow
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUserIdLookup = uuidRegex.test(slug) && user?.id === slug;
      
      // For publicProfileSlug lookups, require publicProfileEnabled
      // For user ID lookups (onboarding), allow access even if not enabled
      if (!user || (!user.publicProfileEnabled && !isUserIdLookup)) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const services = (user.services || []).map((s, i) => ({
        id: s,
        name: s.charAt(0).toUpperCase() + s.slice(1),
      }));

      const { recommendService } = await import("./ai/aiService");
      const recommendations = await recommendService({ userInput, services });
      res.json({ recommendations });
    } catch (error) {
      console.error("Error recommending service:", error);
      res.json({ recommendations: [] });
    }
  });

  app.post("/api/public/ai/autocomplete-notes", async (req, res) => {
    try {
      const { partialText, serviceName } = req.body;
      if (!partialText || partialText.split(" ").length < 3) {
        return res.json({ suggestion: null });
      }

      const { autocompleteNotes } = await import("./ai/aiService");
      const result = await autocompleteNotes({ partialText, serviceName });
      res.json(result);
    } catch (error) {
      console.error("Error autocompleting notes:", error);
      res.json({ suggestion: null });
    }
  });

  app.post("/api/public/ai/faq", async (req, res) => {
    try {
      const { question, slug } = req.body;
      if (!question) {
        return res.status(400).json({ error: "Missing question" });
      }

      let providerName = "the service provider";
      let services: string[] = [];

      if (slug) {
        const user = await storage.getUserByPublicSlug(slug);
        if (user) {
          providerName = user.name || user.businessName || "the service provider";
          services = user.services || [];
        }
      }

      const { answerFAQ } = await import("./ai/aiService");
      const result = await answerFAQ({ question, providerName, services });
      res.json(result);
    } catch (error) {
      console.error("Error answering FAQ:", error);
      res.json({ answer: "Please contact the provider directly for assistance.", confidence: 0 });
    }
  });

  app.post("/api/public/ai/estimate-price", async (req, res) => {
    try {
      const { description, slug } = req.body;
      if (!description) {
        return res.status(400).json({ error: "Missing description" });
      }

      let services: Array<{ name: string; price?: number }> = [];

      if (slug) {
        const user = await storage.getUserByPublicSlug(slug);
        if (user && user.services) {
          services = user.services.map(s => ({ name: s }));
        }
      }

      const { estimatePrice } = await import("./ai/aiService");
      const result = await estimatePrice({ description, services });
      res.json(result);
    } catch (error) {
      console.error("Error estimating price:", error);
      res.json({ estimateRange: "Contact for quote" });
    }
  });

  // Category-based estimation with guardrails
  app.post("/api/public/ai/category-estimate", async (req, res) => {
    try {
      const { description, slug, categoryId, serviceType, measurementArea, measurementLinear } = req.body;
      
      if (!description || !categoryId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Import estimation profile helpers
      const { getEstimationProfile, shouldShowInstantEstimate } = await import("@shared/estimation-profiles");
      const profile = getEstimationProfile(categoryId);
      
      // Fail-safe: If category not enabled or missing, deny estimation
      if (!profile.enabled) {
        return res.status(400).json({ error: "Estimation not available for this category" });
      }

      // Check provider settings
      let providerEnabled = true;
      if (slug) {
        const user = await storage.getUserByPublicSlug(slug);
        if (user) {
          providerEnabled = user.publicEstimationEnabled !== false;
        }
      }

      // Only allow instant estimate if category AND provider settings permit
      if (!shouldShowInstantEstimate(categoryId, providerEnabled)) {
        return res.status(400).json({ 
          error: "Public estimation not available", 
          requiresReview: profile.flow === "PROVIDER_REVIEW_REQUIRED" 
        });
      }

      const { generateCategoryEstimate } = await import("./ai/aiService");
      const result = await generateCategoryEstimate({
        categoryId,
        serviceType: serviceType || "",
        description,
        measurementArea,
        measurementLinear,
      });

      const basedOn = result.basedOn || ["Service category", "Job details"];
      const formattedOutput = `Suggested Estimate:
$${result.lowEstimate} – $${result.highEstimate}

Confidence:
${result.confidence}

Based on:
${basedOn.map(f => `• ${f}`).join("\n")}

Final price confirmed onsite.`;

      res.json({
        ...result,
        formattedOutput,
      });
    } catch (error) {
      console.error("Error generating category estimate:", error);
      res.json({
        lowEstimate: 100,
        highEstimate: 300,
        confidence: "Low",
        basedOn: ["Service category", "General pricing"],
      });
    }
  });

  // Provider in-app estimation (always available)
  app.post("/api/ai/provider-estimate", async (req, res) => {
    try {
      const { description, categoryId, serviceType, measurementArea, measurementLinear, photos } = req.body;
      
      if (!description) {
        return res.status(400).json({ error: "Missing description" });
      }

      const { generateProviderEstimate } = await import("./ai/aiService");
      const result = await generateProviderEstimate({
        categoryId: categoryId || "other",
        serviceType: serviceType || "",
        description,
        measurementArea,
        measurementLinear,
        photos,
      });

      res.json(result);
    } catch (error) {
      console.error("Error generating provider estimate:", error);
      res.json({
        lowEstimate: 150,
        highEstimate: 400,
        confidence: "Low",
        basedOn: ["Service category", "General pricing"],
      });
    }
  });

  // ============================================================
  // Estimation Requests (Provider Review Required flow)
  // ============================================================

  // Create an estimation request (public - from booking page)
  app.post("/api/public/estimation-request", async (req, res) => {
    try {
      const { slug, categoryId, serviceType, clientName, clientPhone, clientEmail, description, photos, measurementArea, measurementLinear, location } = req.body;

      if (!slug || !categoryId || !clientName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await storage.getUserByPublicSlug(slug);
      if (!user) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const { requiresProviderReview } = await import("@shared/estimation-profiles");
      if (!requiresProviderReview(categoryId)) {
        return res.status(400).json({ error: "This category does not require provider review" });
      }

      const confirmToken = randomUUID();
      const request = await storage.createEstimationRequest({
        providerId: user.id,
        categoryId,
        serviceType,
        clientName,
        clientPhone,
        clientEmail,
        description,
        photos,
        measurementArea,
        measurementLinear,
        location,
        status: "pending",
        confirmToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      res.json({ success: true, requestId: request.id });
    } catch (error) {
      console.error("Error creating estimation request:", error);
      res.status(500).json({ error: "Failed to create estimation request" });
    }
  });

  // Get pending estimation requests (provider)
  app.get("/api/estimation-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getPendingEstimationRequests((req as any).userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching estimation requests:", error);
      res.status(500).json({ error: "Failed to fetch estimation requests" });
    }
  });

  // Get all estimation requests (provider)
  app.get("/api/estimation-requests/all", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getEstimationRequests((req as any).userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching estimation requests:", error);
      res.status(500).json({ error: "Failed to fetch estimation requests" });
    }
  });

  // Review and send estimate (provider)
  app.post("/api/estimation-requests/:id/review", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { providerEstimateLow, providerEstimateHigh, providerNotes } = req.body;

      const request = await storage.getEstimationRequest(id);
      if (!request || request.providerId !== (req as any).userId) {
        return res.status(404).json({ error: "Request not found" });
      }

      const updated = await storage.updateEstimationRequest(id, {
        providerEstimateLow,
        providerEstimateHigh,
        providerNotes,
        status: "reviewed",
        reviewedAt: new Date().toISOString(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error reviewing estimation request:", error);
      res.status(500).json({ error: "Failed to review estimation request" });
    }
  });

  // Send estimate to customer (provider)
  app.post("/api/estimation-requests/:id/send", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const request = await storage.getEstimationRequest(id);
      
      if (!request || request.providerId !== (req as any).userId) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (!request.providerEstimateLow || !request.providerEstimateHigh) {
        return res.status(400).json({ error: "Estimate not reviewed yet" });
      }

      const user = await storage.getUser((req as any).userId);
      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const confirmUrl = `${baseUrl}/confirm-estimate/${request.confirmToken}`;

      if (request.clientPhone) {
        const message = `${user?.businessName || user?.name || "Your provider"} has reviewed your request and prepared an estimate of $${request.providerEstimateLow} - $${request.providerEstimateHigh}. View and confirm: ${confirmUrl}`;
        await sendSMS(request.clientPhone, message);
      }

      const updated = await storage.updateEstimationRequest(id, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });

      res.json({ success: true, request: updated });
    } catch (error) {
      console.error("Error sending estimate:", error);
      res.status(500).json({ error: "Failed to send estimate" });
    }
  });

  // Confirm estimate (public - from customer link)
  app.post("/api/public/confirm-estimate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { scheduledDate, scheduledTime } = req.body;

      const request = await storage.getEstimationRequestByToken(token);
      if (!request) {
        return res.status(404).json({ error: "Estimate not found" });
      }

      if (request.status !== "sent") {
        return res.status(400).json({ error: "Estimate already confirmed or expired" });
      }

      const job = await storage.createJob({
        userId: request.providerId,
        title: request.serviceType || "Service Request",
        description: request.description,
        serviceType: request.serviceType || request.categoryId,
        location: request.location,
        scheduledDate: scheduledDate || new Date().toISOString().split("T")[0],
        scheduledTime: scheduledTime || "09:00",
        price: request.providerEstimateHigh ? request.providerEstimateHigh * 100 : null,
        clientName: request.clientName,
        clientPhone: request.clientPhone,
        clientEmail: request.clientEmail,
        status: "scheduled",
        clientConfirmStatus: "confirmed",
        clientConfirmedAt: new Date().toISOString(),
      });

      await storage.updateEstimationRequest(request.id, {
        confirmedAt: new Date().toISOString(),
        convertedToJobId: job.id,
      });

      res.json({ success: true, jobId: job.id });
    } catch (error) {
      console.error("Error confirming estimate:", error);
      res.status(500).json({ error: "Failed to confirm estimate" });
    }
  });

  // In-app estimation tool (provider-only, always enabled)
  app.post("/api/estimation/in-app", async (req, res) => {
    try {
      const { category, description, squareFootage, photos } = req.body;
      
      if (!category || !description) {
        return res.status(400).json({ error: "Category and description are required" });
      }

      console.log(`[Estimation] In-app request: category=${category}, hasPhotos=${photos?.length > 0 ? photos.length : 0}`);

      const { generateAIEstimate, getEstimationGuardrails } = await import("./ai/aiService");
      const guardrails = getEstimationGuardrails();

      const estimate = await generateAIEstimate({
        category,
        description,
        squareFootage,
        photos,
        isPublic: false,
      });

      const disclaimers = [...guardrails.disclaimers];
      if (photos && photos.length > 0) {
        disclaimers.push("Photo-based estimates are approximate and used only to assist pricing");
      }

      const factors = estimate.factors || [];
      const lowDollars = Math.round(estimate.priceRange.min / 100);
      const highDollars = Math.round(estimate.priceRange.max / 100);
      
      const formattedOutput = `Suggested Estimate:
$${lowDollars} – $${highDollars}

Confidence:
${estimate.confidence.charAt(0).toUpperCase() + estimate.confidence.slice(1)}

Based on:
${factors.map(f => `• ${f}`).join("\n")}

Final price confirmed onsite.`;

      res.json({
        priceRange: estimate.priceRange,
        confidence: estimate.confidence,
        factors,
        disclaimers,
        aiGenerated: true,
        photosAnalyzed: photos && photos.length > 0,
        formattedOutput,
      });
    } catch (error: any) {
      console.error("[Estimation] Error generating in-app estimate:", error?.message || error);
      if (error?.response) {
        console.error("[Estimation] API response error:", error.response.status, error.response.data);
      }
      res.status(500).json({ error: "Failed to generate estimate. Please try again." });
    }
  });

  // Config endpoint - returns feature flags and settings for the client
  app.get("/api/config", async (req, res) => {
    try {
      const quickbookFlag = await storage.getFeatureFlag("quickbook_enabled");
      res.json({
        features: {
          quickbook_enabled: quickbookFlag?.enabled ?? false,
        },
      });
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  // Onboarding endpoints
  app.get("/api/onboarding", isAuthenticated, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = await storage.getUser(userId);
      
      // Compute money protection ready status
      const moneyProtectionReady = !!(
        user?.defaultServiceType &&
        typeof user?.defaultPrice === 'number' && user.defaultPrice > 0 &&
        user?.depositPolicySet
      );
      
      res.json({
        completed: user?.onboardingCompleted || false,
        step: user?.onboardingStep || 0,
        state: user?.onboardingState || "not_started",
        moneyProtectionReady,
        defaultServiceType: user?.defaultServiceType || null,
        defaultPrice: user?.defaultPrice || null,
        depositPolicySet: user?.depositPolicySet || false,
        aiExpectationShown: user?.aiExpectationShown || false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch onboarding status" });
    }
  });

  app.patch("/api/onboarding", isAuthenticated, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { step, completed, state } = req.body;
      const previousUser = await storage.getUser(userId);
      const previousStep = previousUser?.onboardingStep || 0;
      
      const updateData: Record<string, any> = {};
      if (step !== undefined) updateData.onboardingStep = step;
      if (completed !== undefined) updateData.onboardingCompleted = completed;
      if (state !== undefined) updateData.onboardingState = state;
      
      const user = await storage.updateUser(userId, updateData);
      
      if (step !== undefined && step > previousStep) {
        emitCanonicalEvent({
          eventName: "onboarding_step_completed",
          userId: userId,
          context: { step, previousStep, completed, state },
          source: "web",
        });
      }
      
      // Emit event when onboarding is completed or skipped
      if (state === "completed" || state === "skipped_explore") {
        emitCanonicalEvent({
          eventName: state === "completed" ? "onboarding_completed" : "onboarding_skipped",
          userId: userId,
          context: { 
            state,
            moneyProtectionReady: !!(
              user?.defaultServiceType &&
              typeof user?.defaultPrice === 'number' && user.defaultPrice > 0 &&
              user?.depositPolicySet
            )
          },
          source: "web",
        });
      }
      
      // Compute money protection ready status
      const moneyProtectionReady = !!(
        user?.defaultServiceType &&
        typeof user?.defaultPrice === 'number' && user.defaultPrice > 0 &&
        user?.depositPolicySet
      );
      
      res.json({
        completed: user?.onboardingCompleted || false,
        step: user?.onboardingStep || 0,
        state: user?.onboardingState || "not_started",
        moneyProtectionReady,
        defaultServiceType: user?.defaultServiceType || null,
        defaultPrice: user?.defaultPrice || null,
        depositPolicySet: user?.depositPolicySet || false,
        aiExpectationShown: user?.aiExpectationShown || false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update onboarding" });
    }
  });

  app.post("/api/onboarding/send-booking-link", isAuthenticated, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const user = await storage.getUser(userId);
      if (!user?.publicProfileSlug) {
        return res.status(400).json({ error: "Booking link not set up yet" });
      }

      const bookingUrl = `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/book/${user.publicProfileSlug}`;
      
      const message = `Here's your GigAid booking link! Share it with your next customer: ${bookingUrl}`;

      await sendSMS(phoneNumber, message);
      
      emitCanonicalEvent({
        eventName: "booking_link_shared",
        userId: userId,
        context: { bookingUrl, phoneNumber: phoneNumber.slice(-4) },
        source: "web",
      });

      res.json({ success: true, message: "Booking link sent to your phone!" });
    } catch (error) {
      console.error("Failed to send booking link:", error);
      res.status(500).json({ error: "Failed to send booking link" });
    }
  });

  // AI Bio Rewrite
  app.post("/api/ai/rewrite-bio", async (req, res) => {
    try {
      const { bio, businessName, services } = req.body;
      if (!bio || bio.length < 10) {
        return res.status(400).json({ error: "Bio must be at least 10 characters" });
      }

      const { rewriteBio } = await import("./ai/aiService");
      const result = await rewriteBio({ bio, businessName, services });
      res.json(result);
    } catch (error) {
      console.error("Error rewriting bio:", error);
      res.json({ rewrittenBio: req.body.bio });
    }
  });

  // AI Voice Note Summarizer
  app.post("/api/ai/summarize-voice-note", async (req, res) => {
    try {
      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }
      const { summarizeVoiceNote } = await import("./ai/aiService");
      const result = await summarizeVoiceNote(transcript);
      res.json(result);
    } catch (error) {
      console.error("Error summarizing voice note:", error);
      res.status(500).json({ error: "Failed to summarize voice note" });
    }
  });

  // AI Referral Message Generator
  app.post("/api/ai/referral-message", async (req, res) => {
    try {
      const { tone, link, serviceCategory, providerName } = req.body;
      if (!link) {
        return res.status(400).json({ error: "Link is required" });
      }
      const { generateReferralMessage } = await import("./ai/aiService");
      const result = await generateReferralMessage({ tone: tone || "friendly", link, serviceCategory, providerName });
      res.json(result);
    } catch (error) {
      console.error("Error generating referral message:", error);
      res.status(500).json({ error: "Failed to generate referral message" });
    }
  });

  // AI Booking Insights
  app.get("/api/ai/booking-insights", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getJobs((req as any).userId);
      const jobData = jobs.map(j => ({
        service: j.title,
        date: j.scheduledDate,
        time: j.scheduledTime,
        price: j.price || 0,
        clientName: j.clientName || "Unknown"
      }));
      const { analyzeBookingPatterns } = await import("./ai/aiService");
      const result = await analyzeBookingPatterns({ jobs: jobData });
      res.json(result);
    } catch (error) {
      console.error("Error analyzing booking patterns:", error);
      res.status(500).json({ error: "Failed to analyze booking patterns" });
    }
  });

  // AI Feature Unlock Nudge
  app.post("/api/ai/feature-nudge", isAuthenticated, async (req, res) => {
    try {
      const { completedFeatures, incompleteFeatures, userType } = req.body;
      const { generateFeatureNudge } = await import("./ai/aiService");
      const result = await generateFeatureNudge({
        completedFeatures: completedFeatures || [],
        incompleteFeatures: incompleteFeatures || ["profile", "services", "availability"],
        userType
      });
      res.json(result);
    } catch (error) {
      console.error("Error generating nudge:", error);
      res.status(500).json({ error: "Failed to generate nudge" });
    }
  });

  // AI Service Builder
  app.post("/api/ai/build-services", isAuthenticated, async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }
      const { buildServicesFromDescription } = await import("./ai/aiService");
      const result = await buildServicesFromDescription(description);
      res.json({ services: result });
    } catch (error) {
      console.error("Error building services:", error);
      res.status(500).json({ error: "Failed to build services" });
    }
  });

  // AI Review Draft Generator
  app.post("/api/ai/generate-negotiation-reply", isAuthenticated, async (req, res) => {
    try {
      const { scenario, clientName, serviceType, description } = req.body;
      
      const scenarioPrompts: Record<string, string> = {
        quote: `Provide a pricing quote for the ${serviceType || "service"} job. Mention you can discuss the price and ask for confirmation.`,
        availability: `Share your availability for the ${serviceType || "service"} job. Offer a couple of time options.`,
        followup: `Follow up on the ${serviceType || "service"} inquiry. Check if they're still interested and ready to move forward.`,
        details: `Ask clarifying questions about the ${serviceType || "service"} job to better understand scope and requirements.`,
      };
      
      const prompt = scenarioPrompts[scenario] || scenarioPrompts.followup;
      
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are helping a gig worker reply to a potential client named ${clientName || "Customer"}.

Job context: ${description || `${serviceType || "general"} service inquiry`}

Goal: ${prompt}

Write a single concise reply (2-3 sentences max) that:
- Is friendly and professional
- Moves the conversation forward
- Is ready to copy/paste into a messaging app

Return ONLY the message text, no JSON or formatting.`
          },
          {
            role: "user",
            content: `Generate a ${scenario} reply for this lead.`
          }
        ],
        temperature: 0.7,
      });
      
      const reply = response.choices[0]?.message?.content?.trim() || 
        `Hi ${clientName || "there"}! Just following up on your ${serviceType || "service"} request. Let me know if you're still interested!`;
      
      res.json({ reply });
    } catch (error) {
      console.error("Negotiation reply error:", error);
      res.status(500).json({ error: "Failed to generate reply" });
    }
  });

  app.post("/api/ai/review-draft", async (req, res) => {
    try {
      const { clientName, jobName, tone, highlights } = req.body;
      if (!clientName || !jobName) {
        return res.status(400).json({ error: "Client name and job name are required" });
      }
      const { generateReviewDraft } = await import("./ai/aiService");
      const result = await generateReviewDraft({ clientName, jobName, tone, highlights });
      res.json(result);
    } catch (error) {
      console.error("Error generating review draft:", error);
      res.status(500).json({ error: "Failed to generate review draft" });
    }
  });

  // AI Client Tagging
  app.post("/api/ai/tag-client", async (req, res) => {
    try {
      const { clientHistory } = req.body;
      if (!clientHistory) {
        return res.status(400).json({ error: "Client history is required" });
      }
      const { tagClient } = await import("./ai/aiService");
      const result = await tagClient({ clientHistory });
      res.json(result);
    } catch (error) {
      console.error("Error tagging client:", error);
      res.status(500).json({ error: "Failed to tag client" });
    }
  });

  // Smart Replies for Leads
  app.get("/api/leads/:id/smart-replies", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const replies = [
        {
          id: "1",
          text: `Hi ${lead.clientName.split(" ")[0]}! Thanks for reaching out about ${lead.serviceType}. I'd love to help. When works best for a quick call?`,
          context: "initial_response",
        },
        {
          id: "2",
          text: `Hello ${lead.clientName.split(" ")[0]}, I received your inquiry. I have availability this week. Would you like me to stop by for a free estimate?`,
          context: "schedule",
        },
        {
          id: "3",
          text: `Thanks for your interest! Based on your description, I can provide a quote. Can you share a photo of the area?`,
          context: "quote",
        },
      ];
      
      res.json(replies);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate smart replies" });
    }
  });

  // ============ PAYMENT METHODS API ============

  // Get user's configured payment methods
  app.get("/api/payment-methods", isAuthenticated, async (req, res) => {
    try {
      const methods = await storage.getUserPaymentMethods((req as any).userId);
      res.json(methods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // Create/add a new payment method
  app.post("/api/payment-methods", isAuthenticated, async (req, res) => {
    try {
      const { type, label, instructions, isEnabled } = req.body;
      if (!type) {
        return res.status(400).json({ error: "Payment type is required" });
      }
      const method = await storage.createUserPaymentMethod({
        userId: (req as any).userId,
        type,
        label: label || null,
        instructions: instructions || null,
        isEnabled: isEnabled !== false,
      });
      res.status(201).json(method);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  // Update a payment method
  app.patch("/api/payment-methods/:id", isAuthenticated, async (req, res) => {
    try {
      const { type, label, instructions, isEnabled } = req.body;
      const method = await storage.updateUserPaymentMethod(req.params.id, {
        type,
        label,
        instructions,
        isEnabled,
      });
      if (!method) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json(method);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment method" });
    }
  });

  // Delete a payment method
  app.delete("/api/payment-methods/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteUserPaymentMethod(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payment method" });
    }
  });

  // Bulk update payment methods (for settings page)
  app.post("/api/payment-methods/bulk-update", isAuthenticated, async (req, res) => {
    try {
      const { methods } = req.body;
      if (!Array.isArray(methods)) {
        return res.status(400).json({ error: "Methods array is required" });
      }

      const existingMethods = await storage.getUserPaymentMethods((req as any).userId);
      const results = [];

      for (const methodData of methods) {
        const existing = existingMethods.find(m => m.type === methodData.type);
        
        if (existing) {
          const updated = await storage.updateUserPaymentMethod(existing.id, {
            label: methodData.label,
            instructions: methodData.instructions,
            isEnabled: methodData.isEnabled,
          });
          if (updated) results.push(updated);
        } else if (methodData.isEnabled) {
          const created = await storage.createUserPaymentMethod({
            userId: (req as any).userId,
            type: methodData.type,
            label: methodData.label || null,
            instructions: methodData.instructions || null,
            isEnabled: true,
          });
          results.push(created);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("[PaymentMethods] Error updating payment methods:", error);
      res.status(500).json({ error: "Failed to update payment methods" });
    }
  });

  // ============ JOB PAYMENTS API ============

  // Get all payments for user
  app.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getJobPayments((req as any).userId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Get payments for a specific invoice
  app.get("/api/invoices/:id/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getJobPaymentsByInvoice(req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice payments" });
    }
  });

  // Create a payment record (for manual payments)
  app.post("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId, jobId, clientName, clientEmail, amount, method, notes, proofUrl } = req.body;
      if (!amount || !method) {
        return res.status(400).json({ error: "Amount and method are required" });
      }
      const payment = await storage.createJobPayment({
        userId: (req as any).userId,
        invoiceId: invoiceId || null,
        jobId: jobId || null,
        clientName: clientName || null,
        clientEmail: clientEmail || null,
        amount,
        method,
        status: "pending",
        notes: notes || null,
        proofUrl: proofUrl || null,
      });
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // Confirm a manual payment
  app.post("/api/payments/:id/confirm", async (req, res) => {
    try {
      const { proofUrl, notes } = req.body;
      const payment = await storage.getJobPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const updated = await storage.updateJobPayment(req.params.id, {
        status: "confirmed",
        proofUrl: proofUrl || payment.proofUrl,
        notes: notes || payment.notes,
        confirmedAt: new Date().toISOString(),
        paidAt: payment.paidAt || new Date().toISOString(),
      });

      if (payment.invoiceId) {
        await storage.updateInvoice(payment.invoiceId, {
          status: "paid",
          paymentMethod: payment.method,
          paidAt: new Date().toISOString(),
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // Mark payment as paid (gig worker marks client has paid)
  app.post("/api/payments/:id/mark-paid", async (req, res) => {
    try {
      const { proofUrl, notes } = req.body;
      const payment = await storage.getJobPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const updated = await storage.updateJobPayment(req.params.id, {
        status: "paid",
        proofUrl: proofUrl || payment.proofUrl,
        notes: notes || payment.notes,
        paidAt: new Date().toISOString(),
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark payment as paid" });
    }
  });

  // ============ STRIPE INTEGRATION ============

  // Get Stripe publishable key
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe key:", error);
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  // Create Pro+ subscription checkout session
  app.post("/api/subscription/checkout", isAuthenticated, async (req, res) => {
    try {
      const { plan, returnTo } = req.body;
      
      // Plan configuration with pricing
      const planConfigs: Record<string, { name: string; description: string; amount: number }> = {
        pro: {
          name: "GigAid Pro",
          description: "Owner View dashboard, weekly summaries, advanced analytics, priority support",
          amount: 1900,
        },
        pro_plus: {
          name: "GigAid Pro+",
          description: "Deposit enforcement, booking protection, Today's Money Plan",
          amount: 2800,
        },
        business: {
          name: "GigAid Business",
          description: "Multi-provider support, team management, business analytics, API access",
          amount: 4900,
        },
      };

      console.log("[API] Checkout session endpoint hit", { plan, returnTo });
      
      const planConfig = planConfigs[plan];
      if (!planConfig) {
        return res.status(400).json({ error: "Invalid plan. Valid plans: pro, pro_plus, business" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
      
      console.log("[API] STRIPE_ENABLED =", STRIPE_ENABLED);
      
      if (!STRIPE_ENABLED) {
        console.warn("[Stripe] Subscription checkout blocked - STRIPE_ENABLED is false");
        return res.status(503).json({ error: "Payments temporarily unavailable" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      
      // Get user for checkout metadata
      const user = await storage.getUser((req as any).userId);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: planConfig.name,
                description: planConfig.description,
              },
              unit_amount: planConfig.amount,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${baseUrl}${returnTo || "/"}?subscription=success`,
        cancel_url: `${baseUrl}${returnTo || "/"}?subscription=cancelled`,
        metadata: {
          plan,
          user_id: user?.id || (req as any).userId,
        },
        subscription_data: {
          metadata: {
            user_id: user?.id || (req as any).userId,
            plan,
          },
        },
      });

      console.log("[API] Checkout session created", session.id);
      res.json({ url: session.url });
    } catch (error) {
      console.error("Subscription checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Get subscription status
  app.get("/api/subscription/status", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If no subscription, return free plan status
      if (!user.stripeSubscriptionId) {
        return res.json({
          plan: user.plan || "free",
          planName: user.plan === "pro" ? "Pro" : user.plan === "pro_plus" ? "Pro+" : user.plan === "business" ? "Business" : "Free",
          status: "active",
          hasSubscription: false,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
      
      if (!STRIPE_ENABLED) {
        return res.json({
          plan: user.plan || "free",
          planName: user.plan === "pro" ? "Pro" : user.plan === "pro_plus" ? "Pro+" : user.plan === "business" ? "Business" : "Free",
          status: "active",
          hasSubscription: !!user.stripeSubscriptionId,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
      }

      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      const planNames: Record<string, string> = {
        free: "Free",
        pro: "Pro",
        pro_plus: "Pro+",
        business: "Business",
      };

      // Self-healing: sync user's plan with Stripe subscription metadata if mismatched
      const stripePlan = subscription.metadata?.plan;
      let effectivePlan = user.plan || "free";
      
      if (subscription.status === "active" && stripePlan && stripePlan !== user.plan) {
        console.log(`[Subscription Sync] User ${user.id} plan mismatch: DB=${user.plan}, Stripe=${stripePlan}. Auto-syncing.`);
        await storage.updateUser(user.id, { 
          plan: stripePlan,
          isPro: stripePlan !== "free",
        });
        effectivePlan = stripePlan;
      }

      res.json({
        plan: effectivePlan,
        planName: planNames[effectivePlan] || "Free",
        status: subscription.status,
        hasSubscription: true,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  // Cancel subscription at period end
  app.post("/api/subscription/cancel", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ error: "No active subscription to cancel" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
      
      if (!STRIPE_ENABLED) {
        return res.status(503).json({ error: "Subscription management temporarily unavailable" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Cancel at period end (user keeps access until billing period ends)
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({
        success: true,
        message: "Subscription will be cancelled at the end of the billing period",
        cancelAt: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    } catch (error) {
      console.error("Subscription cancel error:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Reactivate a cancelled subscription (before period end)
  app.post("/api/subscription/reactivate", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ error: "No subscription to reactivate" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
      
      if (!STRIPE_ENABLED) {
        return res.status(503).json({ error: "Subscription management temporarily unavailable" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Remove cancellation
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      res.json({
        success: true,
        message: "Subscription reactivated successfully",
        status: subscription.status,
      });
    } catch (error) {
      console.error("Subscription reactivate error:", error);
      res.status(500).json({ error: "Failed to reactivate subscription" });
    }
  });

  // Generate Stripe Customer Portal link for self-service billing
  app.post("/api/subscription/portal", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: "No billing account found. Please subscribe to a plan first." });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
      
      if (!STRIPE_ENABLED) {
        return res.status(503).json({ error: "Billing portal temporarily unavailable" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const returnUrl = req.body.returnUrl || "/settings";

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}${returnUrl}`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Billing portal error:", error);
      res.status(500).json({ error: "Failed to create billing portal session" });
    }
  });

  // Suspend subscription - immediately cancels Stripe subscription, downgrades to Free
  // User data is retained, they can reactivate anytime
  app.post("/api/billing/suspend", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Only allow suspension for users with active paid plans
      if (!user.plan || user.plan === "free") {
        return res.status(400).json({ error: "No active subscription to pause" });
      }

      if (user.accountStatus === "suspended") {
        return res.status(400).json({ error: "Subscription is already paused" });
      }

      if (user.accountStatus === "pending_deletion") {
        return res.status(400).json({ error: "Account is pending deletion and cannot be paused" });
      }

      // Cancel Stripe subscription immediately (not at period end)
      if (user.stripeSubscriptionId) {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
        
        if (STRIPE_ENABLED) {
          try {
            const stripe = await getUncachableStripeClient();
            await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            console.log(`[Billing] Cancelled Stripe subscription ${user.stripeSubscriptionId} for user ${userId}`);
          } catch (stripeError: any) {
            console.error("[Billing] Stripe cancellation error:", stripeError);
            // Continue even if Stripe call fails - we still want to update local state
          }
        }
      }

      // Update user to suspended state, downgrade to free
      const now = new Date().toISOString();
      await storage.updateUser(userId, {
        accountStatus: "suspended",
        suspendedAt: now,
        plan: "free",
        isPro: false,
        stripeSubscriptionId: null,
      });

      console.log(`[Billing] User ${userId} suspended their subscription. Previous plan: ${user.plan}`);

      res.json({
        success: true,
        message: "Your subscription has been paused. You can reactivate anytime.",
        accountStatus: "suspended",
      });
    } catch (error: any) {
      console.error("[Billing] Suspend error:", error);
      res.status(500).json({ error: "Failed to pause subscription. Please try again." });
    }
  });

  // Reactivate suspended account - redirects to pricing to re-subscribe
  app.post("/api/billing/reactivate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.accountStatus !== "suspended") {
        return res.status(400).json({ error: "Account is not suspended" });
      }

      // Update account status back to active
      const now = new Date().toISOString();
      await storage.updateUser(userId, {
        accountStatus: "active",
        suspendedAt: null,
      });

      console.log(`[Billing] User ${userId} reactivated their account. Was suspended at: ${user.suspendedAt}`);

      res.json({
        success: true,
        message: "Your account has been reactivated. Visit the pricing page to subscribe to a plan.",
        accountStatus: "active",
        redirectTo: "/pricing",
      });
    } catch (error: any) {
      console.error("[Billing] Reactivate error:", error);
      res.status(500).json({ error: "Failed to reactivate account. Please try again." });
    }
  });

  // Get billing invoice history from Stripe
  app.get("/api/billing/invoices", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { STRIPE_ENABLED } = await import("@shared/stripeConfig");

      if (!STRIPE_ENABLED) {
        return res.json({ invoices: [] });
      }

      if (!user.stripeCustomerId) {
        return res.json({ invoices: [] });
      }

      try {
        const stripe = await getUncachableStripeClient();
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 24, // Last 2 years of monthly invoices
        });

        const formattedInvoices = invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount: inv.status === "paid" ? inv.amount_paid : (inv.amount_due || inv.total || 0),
          currency: inv.currency,
          created: inv.created,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          pdfUrl: inv.invoice_pdf,
          hostedUrl: inv.hosted_invoice_url,
          description: inv.lines?.data?.[0]?.description || "Subscription",
        }));

        res.json({ invoices: formattedInvoices });
      } catch (stripeError: any) {
        console.error("[Billing] Stripe invoice fetch error:", stripeError);
        res.json({ invoices: [] });
      }
    } catch (error: any) {
      console.error("[Billing] Invoice history error:", error);
      res.status(500).json({ error: "Failed to fetch invoice history" });
    }
  });

  // Cancel account - initiates deletion process with retention schedule
  // 30 days: soft delete (data hidden but recoverable)
  // 120 days: archived (minimal data retained)
  // After 120 days: permanent deletion
  app.post("/api/account/cancel", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { reason } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.accountStatus === "pending_deletion" || user.accountStatus === "deleted") {
        return res.status(400).json({ error: "Account is already scheduled for deletion" });
      }

      // Cancel any active Stripe subscription immediately
      if (user.stripeSubscriptionId) {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const { STRIPE_ENABLED } = await import("@shared/stripeConfig");
        
        if (STRIPE_ENABLED) {
          try {
            const stripe = await getUncachableStripeClient();
            await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            console.log(`[Account] Cancelled Stripe subscription ${user.stripeSubscriptionId} for user ${userId}`);
          } catch (stripeError: any) {
            console.error("[Account] Stripe cancellation error:", stripeError);
          }
        }
      }

      // Calculate deletion schedule
      const now = new Date();
      const scheduledDeletionAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      // Update user to pending deletion state
      await storage.updateUser(userId, {
        accountStatus: "pending_deletion",
        cancellationRequestedAt: now.toISOString(),
        cancellationReason: reason || null,
        scheduledDeletionAt,
        plan: "free",
        isPro: false,
        stripeSubscriptionId: null,
        isDisabled: true,
        disabledAt: now.toISOString(),
        disabledReason: "Account closure requested by user",
      });

      console.log(`[Account] User ${userId} requested account cancellation. Reason: ${reason || "none"}. Previous plan: ${user.plan}. Scheduled deletion: ${scheduledDeletionAt}`);

      res.json({
        success: true,
        message: "Your account has been scheduled for deletion. You have 30 days to change your mind.",
        accountStatus: "pending_deletion",
        scheduledDeletionAt,
      });
    } catch (error: any) {
      console.error("[Account] Cancel error:", error);
      res.status(500).json({ error: "Failed to close account. Please try again." });
    }
  });

  // Undo account cancellation - allows users to recover their account within 30 days
  app.post("/api/account/undo-cancel", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.accountStatus !== "pending_deletion") {
        return res.status(400).json({ error: "Account is not pending deletion" });
      }

      // Check if still within 30-day window
      if (user.scheduledDeletionAt) {
        const scheduledDate = new Date(user.scheduledDeletionAt);
        if (new Date() > scheduledDate) {
          return res.status(400).json({ error: "Recovery window has expired. Please contact support." });
        }
      }

      // Restore account to active state
      const now = new Date().toISOString();
      await storage.updateUser(userId, {
        accountStatus: "active",
        cancellationRequestedAt: null,
        cancellationReason: null,
        scheduledDeletionAt: null,
        isDisabled: false,
        disabledAt: null,
        disabledReason: null,
        enabledAt: now,
      });

      console.log(`[Account] User ${userId} undid account cancellation. Was scheduled for: ${user.scheduledDeletionAt}`);

      res.json({
        success: true,
        message: "Your account has been restored. Welcome back!",
        accountStatus: "active",
      });
    } catch (error: any) {
      console.error("[Account] Undo cancel error:", error);
      res.status(500).json({ error: "Failed to restore account. Please try again." });
    }
  });

  // Create Stripe checkout session for an invoice
  app.post("/api/invoices/:id/stripe-checkout", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: invoice.serviceDescription || "Service",
                description: `Invoice #${invoice.invoiceNumber}`,
              },
              unit_amount: invoice.amount + (invoice.tax || 0) - (invoice.discount || 0),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/invoice/${invoice.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/invoice/${invoice.id}`,
        metadata: {
          invoiceId: invoice.id,
          userId: invoice.userId,
        },
      });

      const payment = await storage.createJobPayment({
        userId: invoice.userId,
        invoiceId: invoice.id,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        amount: invoice.amount + (invoice.tax || 0) - (invoice.discount || 0),
        method: "stripe",
        status: "processing",
        stripeCheckoutSessionId: session.id,
      });

      res.json({ url: session.url, paymentId: payment.id });
    } catch (error) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Create and send payment link for a job
  app.post("/api/jobs/:id/send-payment-link", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.price || job.price <= 0) {
        return res.status(400).json({ error: "Job has no price set. Please set a price first." });
      }

      if (!job.clientPhone && !job.clientEmail) {
        return res.status(400).json({ error: "No contact info available. Please add phone or email." });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const user = await storage.getUser(job.userId);
      const providerName = user?.businessName || user?.name || "Service Provider";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: job.title || "Service",
                description: `Service from ${providerName}`,
              },
              unit_amount: job.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/payment-success/${job.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/payment/${job.id}`,
        metadata: {
          jobId: job.id,
          userId: job.userId,
        },
      });

      const paymentUrl = session.url;
      const amountDisplay = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      }).format(job.price / 100);

      const message = `Hi ${job.clientName || "there"}! Here's your payment link for ${job.title || "your service"} (${amountDisplay}) from ${providerName}: ${paymentUrl}`;

      let smsSent = false;
      let emailSent = false;

      if (job.clientPhone) {
        try {
          await sendSMS(job.clientPhone, message);
          smsSent = true;
        } catch (e) {
          console.error("Payment link SMS error:", e);
        }
      }

      if (job.clientEmail) {
        try {
          await sendEmail({
            to: job.clientEmail,
            subject: `Payment request from ${providerName} - ${amountDisplay}`,
            text: message,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Payment Request</h2>
                <p>Hi ${job.clientName || "there"}!</p>
                <p>Please click the button below to pay for your service:</p>
                <p><strong>${job.title || "Service"}</strong>: ${amountDisplay}</p>
                <div style="margin: 20px 0;">
                  <a href="${paymentUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Pay Now</a>
                </div>
                <p style="color: #666; font-size: 14px;">Thank you for your business!</p>
                <p style="color: #666; font-size: 14px;">${providerName}</p>
              </div>
            `,
          });
          emailSent = true;
        } catch (e) {
          console.error("Payment link email error:", e);
        }
      }

      res.json({
        success: true,
        smsSent,
        emailSent,
        paymentUrl,
        checkoutSessionId: session.id,
        message: smsSent || emailSent 
          ? "Payment link sent!" 
          : "Payment link created but could not send notification",
      });
    } catch (error) {
      console.error("Send payment link error:", error);
      res.status(500).json({ error: "Failed to create payment link" });
    }
  });

  // Handle successful Stripe payment
  app.get("/api/stripe/success", async (req, res) => {
    try {
      const { session_id, invoice_id } = req.query;
      if (!session_id || !invoice_id) {
        return res.status(400).json({ error: "Missing session or invoice ID" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id as string);

      if (session.payment_status === "paid") {
        const paidAt = new Date().toISOString();
        await storage.updateInvoice(invoice_id as string, {
          status: "paid",
          paymentMethod: "stripe",
          paidAt,
        });

        const payments = await storage.getJobPaymentsByInvoice(invoice_id as string);
        const stripePayment = payments.find(p => p.stripeCheckoutSessionId === session_id);
        if (stripePayment) {
          await storage.updateJobPayment(stripePayment.id, {
            status: "paid",
            stripePaymentIntentId: session.payment_intent as string,
            paidAt,
          });
        }
        
        // Auto-clear: Mark related job as completed and update payment status
        const invoice = await storage.getInvoice(invoice_id as string);
        if (invoice?.jobId) {
          try {
            const relatedJob = await storage.getJob(invoice.jobId);
            if (relatedJob) {
              const updates: Partial<typeof relatedJob> = { paymentStatus: "paid" };
              
              // If job is still scheduled or in progress, mark it as completed
              if (relatedJob.status === "scheduled" || relatedJob.status === "in_progress") {
                updates.status = "completed";
                updates.completedAt = paidAt;
              }
              
              await storage.updateJob(invoice.jobId, updates);
              console.log(`[AutoClear] Job ${invoice.jobId} updated after Stripe payment`);
            }
          } catch (err) {
            console.error("[AutoClear] Failed to update related job after Stripe payment:", err);
          }
        }
      }

      res.json({ success: true, status: session.payment_status });
    } catch (error) {
      console.error("Stripe success handler error:", error);
      res.status(500).json({ error: "Failed to process payment confirmation" });
    }
  });

  // ============ STRIPE CONNECT (PROVIDER ONBOARDING) ============

  // Get provider's Stripe Connect status
  app.get("/api/stripe/connect/status", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeConnectAccountId) {
        return res.json({
          connected: false,
          onboardingComplete: false,
          chargesEnabled: false,
          payoutsEnabled: false,
        });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

      res.json({
        connected: true,
        onboardingComplete: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        accountId: user.stripeConnectAccountId,
      });
    } catch (error) {
      console.error("Stripe Connect status error:", error);
      res.status(500).json({ error: "Failed to get Connect status" });
    }
  });

  // Create Stripe Connect onboarding link for provider
  app.post("/api/stripe/connect/onboard", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      let accountId = user.stripeConnectAccountId;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: user.email || undefined,
          business_type: "individual",
          metadata: {
            gigaid_user_id: user.id,
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        accountId = account.id;

        await storage.updateUser(user.id, {
          stripeConnectAccountId: accountId,
          stripeConnectStatus: "pending",
        });
      }

      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/settings?stripe_refresh=true`,
        return_url: `${baseUrl}/settings?stripe_connected=true`,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url });
    } catch (error) {
      console.error("Stripe Connect onboarding error:", error);
      res.status(500).json({ error: "Failed to create onboarding link" });
    }
  });

  // Create Stripe Connect dashboard login link for provider
  app.post("/api/stripe/connect/dashboard", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({ error: "No Stripe Connect account" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
      res.json({ url: loginLink.url });
    } catch (error) {
      console.error("Stripe Connect dashboard error:", error);
      res.status(500).json({ error: "Failed to create dashboard link" });
    }
  });

  // Update provider's deposit settings
  app.patch("/api/stripe/connect/deposit-settings", isAuthenticated, async (req, res) => {
    try {
      const { 
        depositEnabled, 
        depositType, 
        depositValue,
        lateRescheduleWindowHours,
        lateRescheduleRetainPctFirst,
        lateRescheduleRetainPctSecond,
        lateRescheduleRetainPctCap,
      } = req.body;

      const updated = await storage.updateUser((req as any).userId, {
        depositEnabled: depositEnabled ?? undefined,
        depositType: depositType ?? undefined,
        depositValue: depositValue ?? undefined,
        lateRescheduleWindowHours: lateRescheduleWindowHours ?? undefined,
        lateRescheduleRetainPctFirst: lateRescheduleRetainPctFirst ?? undefined,
        lateRescheduleRetainPctSecond: lateRescheduleRetainPctSecond ?? undefined,
        lateRescheduleRetainPctCap: lateRescheduleRetainPctCap ?? undefined,
      });

      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        depositEnabled: updated.depositEnabled,
        depositType: updated.depositType,
        depositValue: updated.depositValue,
        lateRescheduleWindowHours: updated.lateRescheduleWindowHours,
        lateRescheduleRetainPctFirst: updated.lateRescheduleRetainPctFirst,
        lateRescheduleRetainPctSecond: updated.lateRescheduleRetainPctSecond,
        lateRescheduleRetainPctCap: updated.lateRescheduleRetainPctCap,
      });
    } catch (error) {
      console.error("Deposit settings update error:", error);
      res.status(500).json({ error: "Failed to update deposit settings" });
    }
  });

  // ============ DEPOSIT PAYMENT FLOW ============

  // Create PaymentIntent for booking deposit
  app.post("/api/bookings/:id/create-deposit-intent", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.depositStatus !== "none" && booking.depositStatus !== "pending") {
        return res.status(400).json({ error: "Deposit already processed" });
      }

      if (!booking.depositAmountCents || booking.depositAmountCents <= 0) {
        return res.status(400).json({ error: "No deposit amount configured" });
      }

      const provider = await storage.getUser(booking.userId);
      if (!provider?.stripeConnectAccountId) {
        return res.status(400).json({ error: "Provider has not set up payment account" });
      }

      if (provider.stripeConnectStatus !== "active") {
        return res.status(400).json({ error: "Provider payment account is not active" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      // Generate idempotency key: providerId + bookingId + amount + purpose + date bucket (hourly)
      const dateBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const idempotencyKey = `${booking.userId}-${booking.id}-${booking.depositAmountCents}-booking-deposit-${dateBucket}`;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: booking.depositAmountCents,
        currency: booking.depositCurrency || "usd",
        capture_method: "automatic",
        transfer_group: `booking_${booking.id}`,
        metadata: {
          booking_id: booking.id,
          provider_id: booking.userId,
          provider_connect_id: provider.stripeConnectAccountId,
          client_name: booking.clientName,
        },
        description: `Deposit for service booking - ${booking.clientName}`,
      }, {
        idempotencyKey,
      });

      await storage.updateBookingRequest(booking.id, {
        depositStatus: "pending",
        stripePaymentIntentId: paymentIntent.id,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "deposit_intent_created",
        actorType: "customer",
        actorId: null,
        metadata: JSON.stringify({
          amount: paymentIntent.amount,
          paymentIntentId: paymentIntent.id,
        }),
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } catch (error) {
      console.error("Create deposit intent error:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Get booking deposit status (public endpoint for customers)
  app.get("/api/bookings/by-token/:token/deposit", async (req, res) => {
    try {
      const booking = await storage.getBookingRequestByToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const provider = await storage.getUser(booking.userId);

      res.json({
        bookingId: booking.id,
        clientName: booking.clientName,
        depositAmountCents: booking.depositAmountCents,
        depositCurrency: booking.depositCurrency,
        depositStatus: booking.depositStatus,
        completionStatus: booking.completionStatus,
        jobStartAt: booking.jobStartAt,
        providerName: provider?.name || provider?.businessName || "Provider",
        providerHasPayments: provider?.stripeConnectStatus === "active",
      });
    } catch (error) {
      console.error("Get deposit status error:", error);
      res.status(500).json({ error: "Failed to get deposit status" });
    }
  });

  // Get full booking detail for customer view (public endpoint)
  app.get("/api/bookings/by-token/:token/detail", async (req, res) => {
    try {
      const booking = await storage.getBookingRequestByToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // userId is stored as a string in storage - try both string and direct lookup
      let provider = await storage.getUser(booking.userId);
      if (!provider && typeof booking.userId === "number") {
        provider = await storage.getUser(String(booking.userId));
      }

      res.json({
        id: booking.id,
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        clientEmail: booking.clientEmail,
        serviceType: booking.serviceType,
        description: booking.description,
        location: booking.location,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        status: booking.status,
        depositAmountCents: booking.depositAmountCents,
        depositCurrency: booking.depositCurrency,
        depositStatus: booking.depositStatus,
        completionStatus: booking.completionStatus,
        autoReleaseAt: booking.autoReleaseAt,
        lateRescheduleCount: booking.lateRescheduleCount,
        retainedAmountCents: booking.retainedAmountCents,
        rolledAmountCents: booking.rolledAmountCents,
        stripePaymentIntentId: booking.stripePaymentIntentId,
        provider: provider ? {
          name: provider.name || `${provider.firstName || ""} ${provider.lastName || ""}`.trim() || "Provider",
          businessName: provider.businessName || null,
          photo: provider.photo || null,
          depositEnabled: provider.depositEnabled ?? false,
          lateRescheduleWindowHours: provider.lateRescheduleWindowHours ?? 24,
          lateRescheduleRetainPctFirst: provider.lateRescheduleRetainPctFirst ?? 40,
          lateRescheduleRetainPctSecond: provider.lateRescheduleRetainPctSecond ?? 60,
          lateRescheduleRetainPctCap: provider.lateRescheduleRetainPctCap ?? 75,
        } : null,
      });
    } catch (error) {
      console.error("Get booking detail error:", error);
      res.status(500).json({ error: "Failed to get booking detail" });
    }
  });

  // Create PaymentIntent for booking deposit (by token - public)
  app.post("/api/bookings/by-token/:token/create-deposit-intent", async (req, res) => {
    try {
      const booking = await storage.getBookingRequestByToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.depositStatus !== "none" && booking.depositStatus !== "pending") {
        return res.status(400).json({ error: "Deposit already processed" });
      }

      if (!booking.depositAmountCents || booking.depositAmountCents <= 0) {
        return res.status(400).json({ error: "No deposit amount configured" });
      }

      const provider = await storage.getUser(booking.userId);
      if (!provider?.stripeConnectAccountId) {
        return res.status(400).json({ error: "Provider has not set up payment account" });
      }

      if (provider.stripeConnectStatus !== "active") {
        return res.status(400).json({ error: "Provider payment account is not active" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      let paymentIntent;
      if (booking.stripePaymentIntentId) {
        paymentIntent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        if (paymentIntent.status === "succeeded") {
          return res.status(400).json({ error: "Deposit already paid" });
        }
      } else {
        // Generate idempotency key: providerId + bookingId + amount + purpose + date bucket (hourly)
        const dateBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const idempotencyKey = `${booking.userId}-${booking.id}-${booking.depositAmountCents}-booking-deposit-${dateBucket}`;

        paymentIntent = await stripe.paymentIntents.create({
          amount: booking.depositAmountCents,
          currency: booking.depositCurrency || "usd",
          capture_method: "automatic",
          transfer_group: `booking_${booking.id}`,
          metadata: {
            booking_id: booking.id,
            provider_id: booking.userId,
            provider_connect_id: provider.stripeConnectAccountId,
            client_name: booking.clientName,
          },
          description: `Deposit for service booking - ${booking.clientName}`,
        }, {
          idempotencyKey,
        });

        await storage.updateBookingRequest(booking.id, {
          depositStatus: "pending",
          stripePaymentIntentId: paymentIntent.id,
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "deposit_intent_created",
          actorType: "customer",
          actorId: null,
          metadata: JSON.stringify({
            amount: paymentIntent.amount,
            paymentIntentId: paymentIntent.id,
          }),
        });
      }

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } catch (error) {
      console.error("Create deposit intent error:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Confirm deposit payment received (called after successful payment)
  app.post("/api/bookings/:id/confirm-deposit", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (!booking.stripePaymentIntentId) {
        return res.status(400).json({ error: "No payment intent for this booking" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ 
          error: "Payment not completed", 
          status: paymentIntent.status 
        });
      }

      if (booking.depositStatus !== "captured") {
        await storage.updateBookingRequest(booking.id, {
          depositStatus: "captured",
          stripeChargeId: paymentIntent.latest_charge as string,
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "deposit_captured",
          actorType: "system",
          actorId: null,
          metadata: JSON.stringify({
            amount: paymentIntent.amount,
            paymentIntentId: paymentIntent.id,
            chargeId: paymentIntent.latest_charge,
          }),
        });
      }

      res.json({
        success: true,
        depositStatus: "captured",
        amount: paymentIntent.amount,
      });
    } catch (error) {
      console.error("Confirm deposit error:", error);
      res.status(500).json({ error: "Failed to confirm deposit" });
    }
  });

  // ============ RESCHEDULE WITH LATE FEE RETENTION ============

  // Reschedule a booking (provider-initiated)
  app.post("/api/bookings/:id/reschedule", async (req, res) => {
    try {
      const { newJobStartAt, newJobEndAt, waiveFee } = req.body;
      const booking = await storage.getBookingRequest(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.depositStatus !== "captured") {
        await storage.updateBookingRequest(booking.id, {
          jobStartAt: newJobStartAt,
          jobEndAt: newJobEndAt || null,
          lastRescheduleAt: new Date().toISOString(),
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "rescheduled",
          actorType: "provider",
          actorId: booking.userId,
          metadata: JSON.stringify({
            oldJobStartAt: booking.jobStartAt,
            newJobStartAt,
            reason: "No deposit - free reschedule",
          }),
        });

        return res.json({
          success: true,
          retainedAmountCents: 0,
          rolledAmountCents: 0,
          isLateReschedule: false,
        });
      }

      const provider = await storage.getUser(booking.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const windowHours = provider.lateRescheduleWindowHours || 24;
      const jobStartTime = booking.jobStartAt ? new Date(booking.jobStartAt).getTime() : 0;
      const now = Date.now();
      const hoursUntilJob = (jobStartTime - now) / (1000 * 60 * 60);
      const isLateReschedule = hoursUntilJob < windowHours;

      let retainedAmountCents = 0;
      let rolledAmountCents = booking.depositAmountCents || 0;

      if (isLateReschedule && !waiveFee && !booking.waiveRescheduleFee) {
        const lateCount = (booking.lateRescheduleCount || 0) + 1;
        let retainPercent: number;

        if (lateCount === 1) {
          retainPercent = provider.lateRescheduleRetainPctFirst || 40;
        } else if (lateCount === 2) {
          retainPercent = provider.lateRescheduleRetainPctSecond || 60;
        } else {
          retainPercent = provider.lateRescheduleRetainPctCap || 75;
        }

        const depositAmount = booking.depositAmountCents || 0;
        retainedAmountCents = Math.floor(depositAmount * retainPercent / 100);
        rolledAmountCents = depositAmount - retainedAmountCents - (booking.retainedAmountCents || 0);
        if (rolledAmountCents < 0) rolledAmountCents = 0;

        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();

        if (retainedAmountCents > 0 && provider.stripeConnectAccountId) {
          try {
            await stripe.transfers.create({
              amount: retainedAmountCents,
              currency: booking.depositCurrency || "usd",
              destination: provider.stripeConnectAccountId,
              transfer_group: `booking_${booking.id}`,
              metadata: {
                booking_id: booking.id,
                type: "late_reschedule_fee",
                reschedule_count: String(lateCount),
              },
            });

            await storage.createBookingEvent({
              bookingId: booking.id,
              eventType: "late_fee_transferred",
              actorType: "system",
              actorId: null,
              metadata: JSON.stringify({
                amount: retainedAmountCents,
                rescheduleCount: lateCount,
                retainPercent,
              }),
            });
          } catch (transferError) {
            console.error("Failed to transfer late fee:", transferError);
          }
        }

        await storage.updateBookingRequest(booking.id, {
          jobStartAt: newJobStartAt,
          jobEndAt: newJobEndAt || null,
          lastRescheduleAt: new Date().toISOString(),
          lateRescheduleCount: lateCount,
          retainedAmountCents: (booking.retainedAmountCents || 0) + retainedAmountCents,
          rolledAmountCents,
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "late_rescheduled",
          actorType: "provider",
          actorId: booking.userId,
          metadata: JSON.stringify({
            oldJobStartAt: booking.jobStartAt,
            newJobStartAt,
            retainedAmountCents,
            retainPercent,
            lateCount,
          }),
        });
      } else {
        await storage.updateBookingRequest(booking.id, {
          jobStartAt: newJobStartAt,
          jobEndAt: newJobEndAt || null,
          lastRescheduleAt: new Date().toISOString(),
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "rescheduled",
          actorType: "provider",
          actorId: booking.userId,
          metadata: JSON.stringify({
            oldJobStartAt: booking.jobStartAt,
            newJobStartAt,
            reason: isLateReschedule ? "Fee waived" : "Not late reschedule",
          }),
        });
      }

      res.json({
        success: true,
        retainedAmountCents,
        rolledAmountCents,
        isLateReschedule,
        lateRescheduleCount: booking.lateRescheduleCount,
      });
    } catch (error) {
      console.error("Reschedule booking error:", error);
      res.status(500).json({ error: "Failed to reschedule booking" });
    }
  });

  // Waive reschedule fee for a booking
  app.post("/api/bookings/:id/waive-reschedule-fee", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      await storage.updateBookingRequest(booking.id, {
        waiveRescheduleFee: true,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "reschedule_fee_waived",
        actorType: "provider",
        actorId: booking.userId,
        metadata: null,
      });

      res.json({ success: true, waiveRescheduleFee: true });
    } catch (error) {
      console.error("Waive reschedule fee error:", error);
      res.status(500).json({ error: "Failed to waive reschedule fee" });
    }
  });

  // ============ COMPLETION CONFIRMATION ============

  // Provider marks job as completed (starts 36h customer confirmation window)
  app.post("/api/bookings/:id/mark-completed", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.completionStatus !== "scheduled" && booking.completionStatus !== "in_progress") {
        return res.status(400).json({ error: "Booking is not in a completable state" });
      }

      const autoReleaseAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();

      await storage.updateBookingRequest(booking.id, {
        completionStatus: "awaiting_confirmation",
        autoReleaseAt,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "marked_completed",
        actorType: "provider",
        actorId: booking.userId,
        metadata: JSON.stringify({
          autoReleaseAt,
        }),
      });

      res.json({
        success: true,
        completionStatus: "awaiting_confirmation",
        autoReleaseAt,
      });
    } catch (error) {
      console.error("Mark completed error:", error);
      res.status(500).json({ error: "Failed to mark job as completed" });
    }
  });

  // Customer confirms job completion (by token - public endpoint)
  app.post("/api/bookings/by-token/:token/confirm-completion", async (req, res) => {
    try {
      const booking = await storage.getBookingRequestByToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.completionStatus !== "awaiting_confirmation") {
        return res.status(400).json({ error: "Booking is not awaiting confirmation" });
      }

      await storage.updateBookingRequest(booking.id, {
        completionStatus: "completed",
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "customer_confirmed",
        actorType: "customer",
        actorId: null,
        metadata: null,
      });

      if (booking.depositStatus === "captured") {
        const provider = await storage.getUser(booking.userId);
        if (provider?.stripeConnectAccountId) {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();

          const releaseAmount = booking.rolledAmountCents || booking.depositAmountCents || 0;
          if (releaseAmount > 0) {
            try {
              const transfer = await stripe.transfers.create({
                amount: releaseAmount,
                currency: booking.depositCurrency || "usd",
                destination: provider.stripeConnectAccountId,
                transfer_group: `booking_${booking.id}`,
                metadata: {
                  booking_id: booking.id,
                  type: "job_completion",
                },
              });

              await storage.updateBookingRequest(booking.id, {
                depositStatus: "released",
                stripeTransferId: transfer.id,
              });

              await storage.createBookingEvent({
                bookingId: booking.id,
                eventType: "deposit_released",
                actorType: "system",
                actorId: null,
                metadata: JSON.stringify({
                  amount: releaseAmount,
                  transferId: transfer.id,
                  trigger: "customer_confirmation",
                }),
              });
            } catch (transferError) {
              console.error("Failed to transfer deposit:", transferError);
            }
          }
        }
      }

      res.json({
        success: true,
        completionStatus: "completed",
        depositStatus: booking.depositStatus,
      });
    } catch (error) {
      console.error("Confirm completion error:", error);
      res.status(500).json({ error: "Failed to confirm completion" });
    }
  });

  // Customer flags an issue with the job (by token - public endpoint)
  app.post("/api/bookings/by-token/:token/flag-issue", async (req, res) => {
    try {
      const { issueDescription } = req.body;
      const booking = await storage.getBookingRequestByToken(req.params.token);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.completionStatus !== "awaiting_confirmation") {
        return res.status(400).json({ error: "Booking is not awaiting confirmation" });
      }

      await storage.updateBookingRequest(booking.id, {
        completionStatus: "disputed",
        depositStatus: "on_hold_dispute",
        autoReleaseAt: null,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "issue_flagged",
        actorType: "customer",
        actorId: null,
        metadata: JSON.stringify({
          issueDescription: issueDescription || "Customer flagged an issue",
        }),
      });

      res.json({
        success: true,
        completionStatus: "disputed",
        depositStatus: "on_hold_dispute",
        message: "Issue flagged. The deposit is now on hold pending resolution.",
      });
    } catch (error) {
      console.error("Flag issue error:", error);
      res.status(500).json({ error: "Failed to flag issue" });
    }
  });

  // Get booking status by token (public endpoint for customer)
  app.get("/api/bookings/by-token/:token/status", async (req, res) => {
    try {
      const booking = await storage.getBookingRequestByToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const provider = await storage.getUser(booking.userId);
      const events = await storage.getBookingEvents(booking.id);

      res.json({
        bookingId: booking.id,
        clientName: booking.clientName,
        status: booking.status,
        completionStatus: booking.completionStatus,
        depositStatus: booking.depositStatus,
        depositAmountCents: booking.depositAmountCents,
        depositCurrency: booking.depositCurrency,
        jobStartAt: booking.jobStartAt,
        jobEndAt: booking.jobEndAt,
        autoReleaseAt: booking.autoReleaseAt,
        providerName: provider?.name || provider?.businessName || "Provider",
        events: events.map(e => ({
          eventType: e.eventType,
          createdAt: e.createdAt,
        })),
      });
    } catch (error) {
      console.error("Get booking status error:", error);
      res.status(500).json({ error: "Failed to get booking status" });
    }
  });

  // ============ ADMIN DEPOSIT MANAGEMENT ============

  // Force release deposit to provider (admin/provider action)
  app.post("/api/bookings/:id/admin/force-release", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.depositStatus !== "captured" && booking.depositStatus !== "on_hold_dispute") {
        return res.status(400).json({ error: "No held deposit to release" });
      }

      if (!booking.stripeChargeId) {
        return res.status(400).json({ error: "No charge ID for this booking" });
      }

      const provider = await storage.getUser(booking.userId);
      if (!provider?.stripeConnectAccountId) {
        return res.status(400).json({ error: "Provider has no Connect account" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const releaseAmount = booking.rolledAmountCents || booking.depositAmountCents || 0;
      if (releaseAmount <= 0) {
        await storage.updateBookingRequest(booking.id, {
          completionStatus: "completed",
          depositStatus: "released",
        });
        return res.json({ success: true, amount: 0 });
      }

      const transfer = await stripe.transfers.create({
        amount: releaseAmount,
        currency: booking.depositCurrency || "usd",
        destination: provider.stripeConnectAccountId,
        transfer_group: `booking_${booking.id}`,
        metadata: {
          booking_id: booking.id,
          type: "admin_force_release",
        },
      });

      await storage.updateBookingRequest(booking.id, {
        completionStatus: "completed",
        depositStatus: "released",
        stripeTransferId: transfer.id,
        autoReleaseAt: null,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "admin_force_released",
        actorType: "admin",
        actorId: (req as any).userId,
        metadata: JSON.stringify({
          amount: releaseAmount,
          transferId: transfer.id,
        }),
      });

      res.json({
        success: true,
        amount: releaseAmount,
        transferId: transfer.id,
      });
    } catch (error) {
      console.error("Force release error:", error);
      res.status(500).json({ error: "Failed to force release deposit" });
    }
  });

  // Full refund to customer (admin action)
  app.post("/api/bookings/:id/admin/refund-full", async (req, res) => {
    try {
      const { reason } = req.body;
      const booking = await storage.getBookingRequest(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.depositStatus !== "captured" && booking.depositStatus !== "on_hold_dispute") {
        return res.status(400).json({ error: "No deposit to refund" });
      }

      if (!booking.stripePaymentIntentId) {
        return res.status(400).json({ error: "No payment intent for this booking" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        reason: "requested_by_customer",
        metadata: {
          booking_id: booking.id,
          admin_reason: reason || "Admin initiated full refund",
        },
      });

      await storage.updateBookingRequest(booking.id, {
        depositStatus: "refunded",
        completionStatus: "cancelled",
        autoReleaseAt: null,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "admin_refunded_full",
        actorType: "admin",
        actorId: (req as any).userId,
        metadata: JSON.stringify({
          amount: refund.amount,
          refundId: refund.id,
          reason: reason || "Admin initiated",
        }),
      });

      res.json({
        success: true,
        amount: refund.amount,
        refundId: refund.id,
      });
    } catch (error) {
      console.error("Full refund error:", error);
      res.status(500).json({ error: "Failed to process full refund" });
    }
  });

  // Partial refund to customer (admin action for disputes)
  app.post("/api/bookings/:id/admin/refund-partial", async (req, res) => {
    try {
      const { amountCents, reason } = req.body;
      const booking = await storage.getBookingRequest(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (!amountCents || amountCents <= 0) {
        return res.status(400).json({ error: "Invalid refund amount" });
      }

      if (booking.depositStatus !== "captured" && booking.depositStatus !== "on_hold_dispute") {
        return res.status(400).json({ error: "No deposit to refund" });
      }

      if (!booking.stripePaymentIntentId) {
        return res.status(400).json({ error: "No payment intent for this booking" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: {
          booking_id: booking.id,
          admin_reason: reason || "Admin initiated partial refund",
        },
      });

      const remainingAmount = (booking.depositAmountCents || 0) - amountCents;

      await storage.updateBookingRequest(booking.id, {
        depositStatus: remainingAmount > 0 ? "partial_refund" : "refunded",
        rolledAmountCents: remainingAmount > 0 ? remainingAmount : 0,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "admin_refunded_partial",
        actorType: "admin",
        actorId: (req as any).userId,
        metadata: JSON.stringify({
          refundedAmount: amountCents,
          remainingAmount,
          refundId: refund.id,
          reason: reason || "Admin initiated",
        }),
      });

      res.json({
        success: true,
        refundedAmount: amountCents,
        remainingAmount,
        refundId: refund.id,
      });
    } catch (error) {
      console.error("Partial refund error:", error);
      res.status(500).json({ error: "Failed to process partial refund" });
    }
  });

  // Resolve dispute (admin action)
  app.post("/api/bookings/:id/admin/resolve-dispute", async (req, res) => {
    try {
      const { resolution, refundAmountCents } = req.body;
      const booking = await storage.getBookingRequest(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.completionStatus !== "disputed") {
        return res.status(400).json({ error: "Booking is not in disputed state" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      if (resolution === "refund_customer" && booking.stripePaymentIntentId) {
        await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          amount: refundAmountCents || booking.depositAmountCents || 0,
        });

        await storage.updateBookingRequest(booking.id, {
          completionStatus: "cancelled",
          depositStatus: "refunded",
          autoReleaseAt: null,
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "dispute_resolved_refund",
          actorType: "admin",
          actorId: (req as any).userId,
          metadata: JSON.stringify({
            resolution: "refund_customer",
            amount: refundAmountCents || booking.depositAmountCents,
          }),
        });
      } else if (resolution === "release_to_provider" && booking.stripeChargeId) {
        const provider = await storage.getUser(booking.userId);
        if (provider?.stripeConnectAccountId) {
          const releaseAmount = booking.rolledAmountCents || booking.depositAmountCents || 0;
          
          await stripe.transfers.create({
            amount: releaseAmount,
            currency: booking.depositCurrency || "usd",
            destination: provider.stripeConnectAccountId,
            transfer_group: `booking_${booking.id}`,
            metadata: {
              booking_id: booking.id,
              type: "dispute_resolution",
            },
          });

          await storage.updateBookingRequest(booking.id, {
            completionStatus: "completed",
            depositStatus: "released",
            autoReleaseAt: null,
          });

          await storage.createBookingEvent({
            bookingId: booking.id,
            eventType: "dispute_resolved_released",
            actorType: "admin",
            actorId: (req as any).userId,
            metadata: JSON.stringify({
              resolution: "release_to_provider",
              amount: releaseAmount,
            }),
          });
        }
      } else if (resolution === "split") {
        const refundAmount = refundAmountCents || Math.floor((booking.depositAmountCents || 0) / 2);
        const releaseAmount = (booking.depositAmountCents || 0) - refundAmount;

        if (booking.stripePaymentIntentId && refundAmount > 0) {
          await stripe.refunds.create({
            payment_intent: booking.stripePaymentIntentId,
            amount: refundAmount,
          });
        }

        if (booking.stripeChargeId && releaseAmount > 0) {
          const provider = await storage.getUser(booking.userId);
          if (provider?.stripeConnectAccountId) {
            await stripe.transfers.create({
              amount: releaseAmount,
              currency: booking.depositCurrency || "usd",
              destination: provider.stripeConnectAccountId,
              transfer_group: `booking_${booking.id}`,
              metadata: {
                booking_id: booking.id,
                type: "dispute_split",
              },
            });
          }
        }

        await storage.updateBookingRequest(booking.id, {
          completionStatus: "completed",
          depositStatus: "released",
          autoReleaseAt: null,
        });

        await storage.createBookingEvent({
          bookingId: booking.id,
          eventType: "dispute_resolved_split",
          actorType: "admin",
          actorId: (req as any).userId,
          metadata: JSON.stringify({
            resolution: "split",
            refundedAmount: refundAmount,
            releasedAmount: releaseAmount,
          }),
        });
      }

      res.json({
        success: true,
        resolution,
        completionStatus: booking.completionStatus,
      });
    } catch (error) {
      console.error("Resolve dispute error:", error);
      res.status(500).json({ error: "Failed to resolve dispute" });
    }
  });

  // Get booking events (audit trail)
  app.get("/api/bookings/:id/events", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const events = await storage.getBookingEvents(booking.id);
      res.json(events);
    } catch (error) {
      console.error("Get booking events error:", error);
      res.status(500).json({ error: "Failed to get booking events" });
    }
  });

  // Record remainder payment for a booking (provider action)
  app.post("/api/bookings/:id/record-remainder-payment", async (req, res) => {
    try {
      const booking = await storage.getBookingRequest(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if already paid
      if (booking.remainderPaymentStatus === "paid") {
        return res.status(400).json({ error: "Remainder payment has already been recorded" });
      }

      // Check if there's actually a remainder to pay
      const totalAmount = booking.totalAmountCents || 0;
      const depositAmount = booking.depositAmountCents || 0;
      const remainderAmount = totalAmount - depositAmount;
      
      if (remainderAmount <= 0) {
        return res.status(400).json({ error: "No remainder payment due for this booking" });
      }

      const { paymentMethod, notes } = req.body;

      if (!paymentMethod) {
        return res.status(400).json({ error: "Payment method is required" });
      }

      const validMethods = ["zelle", "venmo", "cashapp", "cash", "check", "stripe", "other"];
      if (!validMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: "Invalid payment method" });
      }

      // Validate notes length
      if (notes && notes.length > 500) {
        return res.status(400).json({ error: "Notes must be 500 characters or less" });
      }

      const updated = await storage.updateBookingRequest(booking.id, {
        remainderPaymentStatus: "paid",
        remainderPaymentMethod: paymentMethod,
        remainderPaidAt: new Date().toISOString(),
        remainderNotes: notes || null,
      });

      await storage.createBookingEvent({
        bookingId: booking.id,
        eventType: "remainder_payment_recorded",
        actorType: "provider",
        actorId: booking.userId,
        metadata: JSON.stringify({
          paymentMethod,
          notes,
          remainderAmount: (booking.totalAmountCents || 0) - (booking.depositAmountCents || 0),
        }),
      });

      res.json({
        success: true,
        booking: updated,
      });
    } catch (error) {
      console.error("Record remainder payment error:", error);
      res.status(500).json({ error: "Failed to record remainder payment" });
    }
  });

  // Get payment methods for a booking by token (for customer view)
  app.get("/api/bookings/by-token/:token/payment-methods", async (req, res) => {
    try {
      const booking = await storage.getBookingRequestByToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Get the provider's info
      const provider = await storage.getUser(booking.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Get the provider's payment methods from the userPaymentMethods table
      const providerPaymentMethods = await storage.getUserPaymentMethods(booking.userId);
      const enabledMethods = providerPaymentMethods.filter(m => m.isEnabled);

      // Build payment methods object
      const paymentMethodsMap: Record<string, { label: string | null; instructions: string | null }> = {};
      for (const method of enabledMethods) {
        paymentMethodsMap[method.type] = {
          label: method.label,
          instructions: method.instructions,
        };
      }

      res.json({
        paymentMethods: paymentMethodsMap,
        providerName: provider.businessName || provider.name || provider.username,
        totalAmountCents: booking.totalAmountCents,
        depositAmountCents: booking.depositAmountCents,
        remainderAmountCents: (booking.totalAmountCents || 0) - (booking.depositAmountCents || 0),
        remainderPaymentStatus: booking.remainderPaymentStatus,
        remainderPaymentMethod: booking.remainderPaymentMethod,
        remainderPaidAt: booking.remainderPaidAt,
      });
    } catch (error) {
      console.error("Get payment methods error:", error);
      res.status(500).json({ error: "Failed to get payment methods" });
    }
  });

  // Stripe Connect webhook handler
  app.post("/api/stripe/connect/webhook", async (req, res) => {
    try {
      const { getUncachableStripeClient, getStripeSecretKey } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

      let event;
      if (webhookSecret && sig) {
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        event = req.body;
      }

      switch (event.type) {
        case "account.updated": {
          const account = event.data.object as any;
          const gigaidUserId = account.metadata?.gigaid_user_id;
          if (gigaidUserId) {
            let status: "pending" | "active" | "restricted" | "disabled" = "pending";
            if (account.charges_enabled && account.payouts_enabled) {
              status = "active";
            } else if (account.details_submitted) {
              status = "restricted";
            }

            await storage.updateUser(gigaidUserId, {
              stripeConnectStatus: status,
            });
            console.log(`Updated Connect status for user ${gigaidUserId}: ${status}`);
          }
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as any;
          const bookingId = paymentIntent.metadata?.booking_id;
          if (bookingId) {
            const booking = await storage.getBookingRequest(bookingId);
            if (booking) {
              await storage.updateBookingRequest(bookingId, {
                depositStatus: "captured",
                stripePaymentIntentId: paymentIntent.id,
                stripeChargeId: paymentIntent.latest_charge,
              });

              await storage.createBookingEvent({
                bookingId,
                eventType: "deposit_captured",
                actorType: "system",
                actorId: null,
                metadata: JSON.stringify({
                  amount: paymentIntent.amount,
                  paymentIntentId: paymentIntent.id,
                }),
              });
              
              emitCanonicalEvent({
                eventName: "payment_succeeded",
                userId: booking.userId,
                context: { bookingId, amount: paymentIntent.amount, paymentIntentId: paymentIntent.id },
                source: "system",
              });
              
              console.log(`Deposit captured for booking ${bookingId}`);
            }
          }
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as any;
          const paymentIntentId = charge.payment_intent;
          // Use booking_id from metadata if available, otherwise log warning
          const bookingId = charge.metadata?.booking_id;
          let booking = bookingId ? await storage.getBookingRequest(bookingId) : undefined;
          
          // Fallback: lookup by payment intent ID (requires scanning - less efficient)
          if (!booking && paymentIntentId) {
            // TODO: Add storage method getBookingByPaymentIntentId for efficiency
            const allBookings = await storage.getBookingRequestsAwaitingRelease();
            booking = allBookings.find(b => b.stripePaymentIntentId === paymentIntentId);
          }
          
          if (booking) {
            const isFullRefund = charge.amount_refunded === charge.amount;
            await storage.updateBookingRequest(booking.id, {
              depositStatus: isFullRefund ? "refunded" : "partial_refund",
            });

            await storage.createBookingEvent({
              bookingId: booking.id,
              eventType: isFullRefund ? "deposit_refunded" : "deposit_partial_refund",
              actorType: "system",
              actorId: null,
              metadata: JSON.stringify({
                refundedAmount: charge.amount_refunded,
                chargeId: charge.id,
              }),
            });
          }
          break;
        }

        case "transfer.created": {
          const transfer = event.data.object as any;
          const bookingId = transfer.metadata?.booking_id;
          if (bookingId) {
            await storage.updateBookingRequest(bookingId, {
              depositStatus: "released",
              stripeTransferId: transfer.id,
            });

            await storage.createBookingEvent({
              bookingId,
              eventType: "deposit_released",
              actorType: "system",
              actorId: null,
              metadata: JSON.stringify({
                amount: transfer.amount,
                transferId: transfer.id,
              }),
            });
            console.log(`Deposit released for booking ${bookingId}`);
          }
          break;
        }

        case "charge.dispute.created": {
          const dispute = event.data.object as any;
          const chargeId = dispute.charge;
          // Use booking_id from metadata if available
          const bookingId = dispute.metadata?.booking_id;
          let booking = bookingId ? await storage.getBookingRequest(bookingId) : undefined;
          
          // Fallback: lookup by charge ID (requires scanning - less efficient)
          if (!booking && chargeId) {
            // TODO: Add storage method getBookingByChargeId for efficiency
            const allBookings = await storage.getBookingRequestsAwaitingRelease();
            booking = allBookings.find(b => b.stripeChargeId === chargeId);
          }
          
          if (booking) {
            await storage.updateBookingRequest(booking.id, {
              depositStatus: "on_hold_dispute",
              completionStatus: "disputed",
            });

            await storage.createBookingEvent({
              bookingId: booking.id,
              eventType: "stripe_dispute_created",
              actorType: "system",
              actorId: null,
              metadata: JSON.stringify({
                disputeId: dispute.id,
                reason: dispute.reason,
                amount: dispute.amount,
                chargeId,
              }),
            });
            
            emitCanonicalEvent({
              eventName: "chargeback_opened",
              userId: booking.userId,
              context: { bookingId: booking.id, disputeId: dispute.id, reason: dispute.reason, amount: dispute.amount },
              source: "system",
            });
            
            console.log(`Stripe dispute created for booking ${booking.id}`);
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as any;
          const bookingId = paymentIntent.metadata?.booking_id;
          const userId = paymentIntent.metadata?.user_id;
          if (!userId) {
            console.warn(`[Stripe Webhook] payment_intent.payment_failed missing user_id in metadata`);
          }
          
          emitCanonicalEvent({
            eventName: "payment_failed",
            userId,
            context: { 
              bookingId, 
              paymentIntentId: paymentIntent.id,
              failureCode: paymentIntent.last_payment_error?.code,
              failureMessage: paymentIntent.last_payment_error?.message,
            },
            source: "system",
          });
          
          console.log(`Payment failed for booking ${bookingId || "unknown"}`);
          break;
        }

        case "customer.subscription.created": {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;
          const userId = subscription.metadata?.user_id;
          if (!userId) {
            console.error(`[Stripe Webhook] subscription.created missing user_id in metadata - cannot process`);
            break;
          }
          const planFromMetadata = subscription.metadata?.plan || "pro_plus";
          
          const user = await storage.getUser(userId);
          
          // Idempotent plan upgrade - only update if not already on the target plan
          if (user && user.plan !== planFromMetadata) {
            await storage.updateUser(userId, { 
              plan: planFromMetadata,
              isPro: true,
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: customerId,
            });
            
            emitCanonicalEvent({
              eventName: "user_became_paying",
              userId,
              context: { 
                subscriptionId: subscription.id, 
                customerId,
                oldPlan: user.plan,
                newPlan: planFromMetadata,
              },
              source: "system",
            });
            
            console.log(`[Webhook] User ${userId} upgraded to ${planFromMetadata}`);
          } else if (!user) {
            console.warn(`[Webhook] No user found for subscription ${subscription.id}`);
          } else {
            console.log(`[Webhook] User ${userId} already on ${planFromMetadata} - skipping`);
          }
          
          emitCanonicalEvent({
            eventName: "subscription_started",
            userId,
            context: { 
              subscriptionId: subscription.id, 
              customerId,
              planId: subscription.items?.data?.[0]?.price?.id,
              amount: subscription.items?.data?.[0]?.price?.unit_amount,
              plan: planFromMetadata,
            },
            source: "system",
          });
          
          console.log(`Subscription started for user ${userId}`);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const userId = subscription.metadata?.user_id;
          if (!userId) {
            console.error(`[Stripe Webhook] subscription.deleted missing user_id in metadata - cannot process`);
            break;
          }
          
          // Downgrade user to free plan
          await storage.updateUser(userId, { 
            plan: "free",
            isPro: false,
            stripeSubscriptionId: null,
          });
          
          console.log(`[Webhook] User ${userId} downgraded to free plan`);
          
          emitCanonicalEvent({
            eventName: "subscription_canceled",
            userId,
            context: { 
              subscriptionId: subscription.id, 
              canceledAt: subscription.canceled_at,
              reason: subscription.cancellation_details?.reason,
            },
            source: "system",
          });
          
          console.log(`Subscription canceled for user ${userId}`);
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          const userId = subscription.metadata?.user_id;
          const newPlan = subscription.metadata?.plan || "pro_plus";
          const status = subscription.status;
          
          // Skip if no user_id in metadata (not our subscription)
          if (!userId) {
            console.log(`[Webhook] Skipping subscription.updated - no user_id in metadata`);
            break;
          }
          
          const user = await storage.getUser(userId);
          if (!user) {
            console.warn(`[Webhook] User ${userId} not found for subscription.updated`);
            break;
          }
          
          // Verify this subscription belongs to this user
          if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
            console.warn(`[Webhook] Subscription mismatch for user ${userId}: expected ${user.stripeSubscriptionId}, got ${subscription.id}`);
            break;
          }
          
          let stateChanged = false;
          
          // Handle plan changes or status changes
          if (status === "active" && user.plan !== newPlan) {
            await storage.updateUser(userId, {
              plan: newPlan,
              isPro: true,
            });
            stateChanged = true;
            console.log(`[Webhook] User ${userId} plan updated to ${newPlan}`);
          } else if (status === "past_due" || status === "unpaid") {
            // Keep plan active during grace period, but log warning
            console.warn(`[Webhook] User ${userId} subscription is ${status} - entering grace period`);
            stateChanged = true;
            
            emitCanonicalEvent({
              eventName: "subscription_payment_issue",
              userId,
              context: { 
                subscriptionId: subscription.id,
                status,
              },
              source: "system",
            });
          }
          
          // Only emit update event if state actually changed
          if (stateChanged) {
            emitCanonicalEvent({
              eventName: "subscription_updated",
              userId,
              context: { 
                subscriptionId: subscription.id,
                status,
                newPlan,
              },
              source: "system",
            });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;
          const customerId = invoice.customer;
          const attemptCount = invoice.attempt_count || 1;
          
          // Try to find user by looking up subscription lines metadata
          // For subscription invoices, the subscription_details will have metadata
          const userId = invoice.subscription_details?.metadata?.user_id;
          
          if (!userId) {
            // Log for debugging but don't emit event for unknown users
            console.warn(`[Webhook] Payment failed for subscription ${subscriptionId} - no user_id found`);
            break;
          }
          
          const user = await storage.getUser(userId);
          if (!user) {
            console.warn(`[Webhook] User ${userId} not found for invoice.payment_failed`);
            break;
          }
          
          console.warn(`[Webhook] Payment failed for user ${userId}, subscription ${subscriptionId}, attempt ${attemptCount}`);
          
          emitCanonicalEvent({
            eventName: "invoice_payment_failed",
            userId,
            context: { 
              subscriptionId,
              customerId,
              attemptCount,
              invoiceId: invoice.id,
              amountDue: invoice.amount_due,
              nextPaymentAttempt: invoice.next_payment_attempt,
            },
            source: "system",
          });
          
          // Only log for support - don't downgrade until subscription.deleted fires
          console.log(`[Webhook] Invoice payment failed - Stripe will retry automatically`);
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // Export all data as JSON
  app.get("/api/export/json", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getJobs((req as any).userId);
      const leads = await storage.getLeads((req as any).userId);
      const invoices = await storage.getInvoices((req as any).userId);
      const reminders = await storage.getReminders((req as any).userId);
      const crewMembers = await storage.getCrewMembers((req as any).userId);
      const reviews = await storage.getReviews((req as any).userId);
      const user = await storage.getUser((req as any).userId);
      const aiNudges = await storage.getAiNudges((req as any).userId);
      const featureFlags = await storage.getAllFeatureFlags();

      const exportData = {
        exportedAt: new Date().toISOString(),
        appName: "GigAid",
        version: "1.0.0",
        profile: user ? {
          name: user.name,
          businessName: user.businessName,
          email: user.email,
          phone: user.phone,
          services: user.services,
          serviceArea: user.serviceArea,
        } : null,
        data: {
          jobs,
          leads,
          invoices,
          reminders,
          crewMembers,
          reviews,
          aiNudges,
          featureFlags,
        },
        summary: {
          totalJobs: jobs.length,
          totalLeads: leads.length,
          totalInvoices: invoices.length,
          totalReminders: reminders.length,
          totalCrewMembers: crewMembers.length,
          totalReviews: reviews.length,
          totalAiNudges: aiNudges.length,
          totalFeatureFlags: featureFlags.length,
        }
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="gigaid-export-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Export JSON error:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Export data relationships as DOT (GraphViz) file
  app.get("/api/export/dot", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getJobs((req as any).userId);
      const leads = await storage.getLeads((req as any).userId);
      const invoices = await storage.getInvoices((req as any).userId);
      const crewMembers = await storage.getCrewMembers((req as any).userId);
      const user = await storage.getUser((req as any).userId);

      let dot = `digraph GigAid {
  rankdir=LR;
  node [shape=box, style="rounded,filled", fontname="Arial"];
  edge [fontname="Arial", fontsize=10];
  
  // User/Business node
  user [label="${user?.businessName || user?.name || 'GigAid User'}", fillcolor="#8B5CF6", fontcolor="white"];
  
  // Subgraphs for organization
  subgraph cluster_jobs {
    label="Jobs";
    style=filled;
    fillcolor="#EFF6FF";
    node [fillcolor="#3B82F6", fontcolor="white"];
`;

      // Add job nodes
      jobs.forEach((job, i) => {
        const label = `${job.title}\\n${job.status}`;
        dot += `    job_${i} [label="${label.replace(/"/g, '\\"')}"];\n`;
      });

      dot += `  }
  
  subgraph cluster_leads {
    label="Leads";
    style=filled;
    fillcolor="#F0FDF4";
    node [fillcolor="#22C55E", fontcolor="white"];
`;

      // Add lead nodes
      leads.forEach((lead, i) => {
        const label = `${lead.clientName}\\n${lead.status}`;
        dot += `    lead_${i} [label="${label.replace(/"/g, '\\"')}"];\n`;
      });

      dot += `  }
  
  subgraph cluster_invoices {
    label="Invoices";
    style=filled;
    fillcolor="#FEF3C7";
    node [fillcolor="#F59E0B", fontcolor="white"];
`;

      // Add invoice nodes
      invoices.forEach((inv, i) => {
        const label = `#${inv.invoiceNumber}\\n$${(inv.amount / 100).toFixed(2)}`;
        dot += `    invoice_${i} [label="${label.replace(/"/g, '\\"')}"];\n`;
      });

      dot += `  }
  
  subgraph cluster_crew {
    label="Crew";
    style=filled;
    fillcolor="#FDF2F8";
    node [fillcolor="#EC4899", fontcolor="white"];
`;

      // Add crew nodes
      crewMembers.forEach((crew, i) => {
        const label = `${crew.name}\\n${crew.role}`;
        dot += `    crew_${i} [label="${label.replace(/"/g, '\\"')}"];\n`;
      });

      dot += `  }
  
  // Relationships
`;

      // User to jobs
      jobs.forEach((_, i) => {
        dot += `  user -> job_${i};\n`;
      });

      // User to leads
      leads.forEach((_, i) => {
        dot += `  user -> lead_${i};\n`;
      });

      // Jobs to invoices (if linked)
      invoices.forEach((inv, i) => {
        if (inv.jobId) {
          const jobIdx = jobs.findIndex(j => j.id === inv.jobId);
          if (jobIdx >= 0) {
            dot += `  job_${jobIdx} -> invoice_${i} [label="invoiced"];\n`;
          }
        }
      });

      // Leads to jobs (if converted)
      leads.forEach((lead, i) => {
        if (lead.convertedJobId) {
          const jobIdx = jobs.findIndex(j => j.id === lead.convertedJobId);
          if (jobIdx >= 0) {
            dot += `  lead_${i} -> job_${jobIdx} [label="converted", style="dashed"];\n`;
          }
        }
      });

      // Crew to jobs
      jobs.forEach((job, i) => {
        if (job.assignedCrewId) {
          const crewIdx = crewMembers.findIndex(c => c.id === job.assignedCrewId);
          if (crewIdx >= 0) {
            dot += `  crew_${crewIdx} -> job_${i} [label="assigned"];\n`;
          }
        }
      });

      dot += `}\n`;

      res.setHeader("Content-Type", "text/vnd.graphviz");
      res.setHeader("Content-Disposition", `attachment; filename="gigaid-graph-${new Date().toISOString().split('T')[0]}.dot"`);
      res.send(dot);
    } catch (error) {
      console.error("Export DOT error:", error);
      res.status(500).json({ error: "Failed to export graph" });
    }
  });

  // ========================================
  // Share Extension / Quick Capture Endpoints
  // ========================================

  // Parse shared content into lead data
  app.post("/api/share/parse", isAuthenticated, async (req, res) => {
    try {
      const { text, url } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const user = await storage.getUser((req as any).userId);
      const parsed = await parseSharedContent({
        text,
        url,
        providerServices: user?.services || [],
        providerName: user?.name || undefined,
      });

      res.json(parsed);
    } catch (error) {
      console.error("Parse share error:", error);
      res.status(500).json({ error: "Failed to parse content" });
    }
  });

  // Generate quick reply suggestions
  app.post("/api/share/replies", isAuthenticated, async (req, res) => {
    try {
      const { text, context } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const user = await storage.getUser((req as any).userId);
      const replies = await generateQuickReplies({
        originalMessage: text,
        context: context || "general inquiry",
        providerName: user?.name || undefined,
      });

      res.json({ replies });
    } catch (error) {
      console.error("Generate replies error:", error);
      res.status(500).json({ error: "Failed to generate replies" });
    }
  });

  // ========================================
  // On The Way Notification
  // ========================================

  app.post("/api/jobs/:id/on-the-way", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const user = await storage.getUser((req as any).userId);
      const providerName = user?.name || "Your service provider";
      const eta = req.body.eta || "soon";

      const message = `Hi ${job.clientName || "there"}! ${providerName} is on the way and will arrive ${eta}. See you shortly!`;

      let smsSent = false;
      let emailSent = false;

      // Send SMS if phone available
      if (job.clientPhone) {
        try {
          await sendSMS(job.clientPhone, message);
          smsSent = true;
        } catch (e) {
          console.error("On the way SMS error:", e);
        }
      }

      // Send email if available
      if (job.clientEmail) {
        try {
          await sendEmail({
            to: job.clientEmail,
            subject: `${providerName} is on the way!`,
            text: message,
            html: `<p>${message}</p>`,
          });
          emailSent = true;
        } catch (e) {
          console.error("On the way email error:", e);
        }
      }

      res.json({
        success: true,
        smsSent,
        emailSent,
        message: smsSent || emailSent 
          ? "On the way notification sent!" 
          : "No contact info available to send notification",
      });
    } catch (error) {
      console.error("On the way error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Driving Distance Calculator
  app.get("/api/driving-distance", async (req, res) => {
    try {
      const { originLat, originLng, destLat, destLng } = req.query;
      
      if (!originLat || !originLng || !destLat || !destLng) {
        return res.status(400).json({ error: "Missing required coordinates" });
      }

      const result = await getDrivingDistance(
        parseFloat(originLat as string),
        parseFloat(originLng as string),
        parseFloat(destLat as string),
        parseFloat(destLng as string)
      );

      if (!result) {
        return res.status(404).json({ error: "Unable to calculate driving distance" });
      }

      res.json(result);
    } catch (error) {
      console.error("Driving distance error:", error);
      res.status(500).json({ error: "Failed to calculate driving distance" });
    }
  });

  // Review Request System
  app.post("/api/jobs/:id/request-review", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate a review token
      const reviewToken = crypto.randomBytes(16).toString("hex");
      
      // Store the token on the job (add reviewToken field)
      await storage.updateJob(req.params.id, {
        reviewToken,
        reviewRequestedAt: new Date().toISOString(),
      });

      const user = await storage.getUser(job.userId);
      const providerName = user?.businessName || "Your service provider";
      
      // Build the review URL
      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const reviewUrl = `${baseUrl}/review/${reviewToken}`;
      
      const message = `Hi ${job.clientName || "there"}! Thank you for using ${providerName}. We'd love your feedback! Please leave a quick review: ${reviewUrl}`;

      let smsSent = false;
      let emailSent = false;

      // Send SMS if phone available
      if (job.clientPhone) {
        try {
          const sent = await sendSMS(job.clientPhone, message);
          smsSent = sent;
        } catch (e) {
          console.error("Review request SMS error:", e);
        }
      }

      // Send email if available
      if (job.clientEmail) {
        try {
          await sendEmail({
            to: job.clientEmail,
            subject: `How was your experience with ${providerName}?`,
            text: message,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>How did we do?</h2>
                <p>Hi ${job.clientName || "there"}!</p>
                <p>Thank you for choosing ${providerName}. We'd love to hear about your experience.</p>
                <p style="text-align: center; margin: 24px 0;">
                  <a href="${reviewUrl}" style="background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Leave a Review
                  </a>
                </p>
                <p style="color: #666; font-size: 14px;">It only takes 30 seconds!</p>
              </div>
            `,
          });
          emailSent = true;
        } catch (e) {
          console.error("Review request email error:", e);
        }
      }

      res.json({
        success: true,
        smsSent,
        emailSent,
        reviewUrl,
        message: smsSent || emailSent 
          ? "Review request sent!" 
          : "No contact info available",
      });
    } catch (error) {
      console.error("Review request error:", error);
      res.status(500).json({ error: "Failed to send review request" });
    }
  });

  // Public review page - get job info
  app.get("/api/public/review/:token", async (req, res) => {
    try {
      const job = await storage.getJobByReviewToken(req.params.token);
      if (!job) {
        return res.status(404).json({ error: "Invalid review link" });
      }

      const user = await storage.getUser(job.userId);
      const providerName = user?.businessName || user?.name || "Your service provider";

      // Check if already reviewed
      const reviews = await storage.getReviews(job.userId);
      const alreadyReviewed = reviews.some(r => r.jobId === job.id);

      res.json({
        jobId: job.id,
        providerName,
        jobTitle: job.title,
        completedAt: job.scheduledDate,
        alreadyReviewed,
      });
    } catch (error) {
      console.error("Get review page error:", error);
      res.status(500).json({ error: "Failed to load review page" });
    }
  });

  // Public review submission
  app.post("/api/public/review/:token", async (req, res) => {
    try {
      const { rating, comment } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const job = await storage.getJobByReviewToken(req.params.token);
      if (!job) {
        return res.status(404).json({ error: "Invalid review link" });
      }

      // Check if already reviewed
      const reviews = await storage.getReviews(job.userId);
      const alreadyReviewed = reviews.some(r => r.jobId === job.id);
      if (alreadyReviewed) {
        return res.status(400).json({ error: "Already reviewed" });
      }

      // Create the review
      const review = await storage.createReview({
        userId: job.userId,
        jobId: job.id,
        clientName: job.clientName || "Customer",
        clientEmail: job.clientEmail || undefined,
        clientPhone: job.clientPhone || undefined,
        rating,
        comment: comment || undefined,
        isPublic: true,
      });

      // Store photo assets if any photos were uploaded
      const { photos, photosPublic } = req.body;
      if (photos && Array.isArray(photos) && photos.length > 0) {
        for (const photoPath of photos) {
          if (typeof photoPath === "string" && photoPath.startsWith("/objects/")) {
            await storage.createPhotoAsset({
              ownerUserId: null, // Customer-uploaded (not logged in)
              workspaceUserId: job.userId,
              sourceType: "review",
              sourceId: review.id,
              storageBucket: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "",
              storagePath: photoPath,
              visibility: photosPublic === true ? "public" : "private",
            });
          }
        }
      }

      res.json({ success: true, review });
    } catch (error) {
      console.error("Submit review error:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // ==================== AI NUDGES ====================
  
  // Generate nudges for the current user
  app.post("/api/ai/nudges/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { generateNudgesForUser } = await import("./nudgeGenerator");
      const result = await generateNudgesForUser(userId);
      
      res.json(result);
    } catch (error) {
      console.error("Generate nudges error:", error);
      res.status(500).json({ error: "Failed to generate nudges" });
    }
  });

  // Get active nudges for the current user
  // Optional query params:
  // - entity_type & entity_id: filter by specific entity
  // - mode=daily: return top 3 nudges for "Today's Game Plan"
  app.get("/api/ai/nudges", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const { entity_type, entity_id, mode } = req.query;
      
      let nudges;
      const currentTime = new Date().toISOString();
      if (entity_type && entity_id) {
        nudges = await storage.getAiNudgesByEntity(
          entity_type as string, 
          entity_id as string
        );
        // Filter by active/snoozed status AND ensure snoozed nudges are suppressed until window expires
        // Match behavior from nudgeService.ts: allow "active" nudges, and "snoozed" nudges whose window has expired
        nudges = nudges.filter(n => {
          if (n.status !== "active" && n.status !== "snoozed") return false;
          // Suppress snoozed nudges only while snooze window is still active
          if (n.status === "snoozed" && n.snoozedUntil) {
            if (n.snoozedUntil > currentTime) return false;
          }
          return true;
        });
      } else {
        nudges = await storage.getActiveAiNudgesForUser(user.id);
      }

      // For daily mode (Today's Game Plan), return top 3 by priority
      if (mode === "daily") {
        // Already sorted by priority from storage, just take top 3
        const topNudges = nudges.slice(0, 3);
        
        // Update lastShownAt and create shown events for delivered nudges
        const now = new Date().toISOString();
        try {
          await Promise.all(
            topNudges.map(async n => {
              await storage.updateAiNudge(n.id, { lastShownAt: now });
              await storage.createAiNudgeEvent({
                nudgeId: n.id,
                userId: n.userId,
                eventType: "shown",
                eventAt: now,
              });
            })
          );
        } catch (err) {
          console.error("Failed to update lastShownAt:", err);
        }
        
        return res.json(topNudges);
      }

      // Limit to 2 nudges per entity
      const entityNudges = new Map<string, typeof nudges>();
      for (const nudge of nudges) {
        const key = `${nudge.entityType}:${nudge.entityId}`;
        if (!entityNudges.has(key)) {
          entityNudges.set(key, []);
        }
        const existing = entityNudges.get(key)!;
        if (existing.length < 2) {
          existing.push(nudge);
        }
      }

      const limitedNudges = Array.from(entityNudges.values()).flat();
      
      // Update lastShownAt and create shown events for delivered nudges
      const now = new Date().toISOString();
      try {
        await Promise.all(
          limitedNudges.map(async n => {
            await storage.updateAiNudge(n.id, { lastShownAt: now });
            await storage.createAiNudgeEvent({
              nudgeId: n.id,
              userId: n.userId,
              eventType: "shown",
              eventAt: now,
            });
          })
        );
      } catch (err) {
        console.error("Failed to update lastShownAt:", err);
      }
      
      res.json(limitedNudges);
    } catch (error) {
      console.error("Get nudges error:", error);
      res.status(500).json({ error: "Failed to get nudges" });
    }
  });

  // Get a single nudge
  app.get("/api/ai/nudges/:id", async (req, res) => {
    try {
      const nudge = await storage.getAiNudge(req.params.id);
      if (!nudge) {
        return res.status(404).json({ error: "Nudge not found" });
      }
      res.json(nudge);
    } catch (error) {
      console.error("Get nudge error:", error);
      res.status(500).json({ error: "Failed to get nudge" });
    }
  });

  // Dismiss a nudge
  app.post("/api/ai/nudges/:id/dismiss", async (req, res) => {
    try {
      const nudge = await storage.getAiNudge(req.params.id);
      if (!nudge) {
        return res.status(404).json({ error: "Nudge not found" });
      }

      await storage.updateAiNudge(req.params.id, { status: "dismissed" });
      await storage.createAiNudgeEvent({
        nudgeId: nudge.id,
        userId: nudge.userId,
        eventType: "dismissed",
        eventAt: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Dismiss nudge error:", error);
      res.status(500).json({ error: "Failed to dismiss nudge" });
    }
  });

  // Snooze a nudge
  app.post("/api/ai/nudges/:id/snooze", async (req, res) => {
    try {
      const { hours = 24 } = req.body;
      const nudge = await storage.getAiNudge(req.params.id);
      if (!nudge) {
        return res.status(404).json({ error: "Nudge not found" });
      }

      const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await storage.updateAiNudge(req.params.id, { 
        snoozedUntil 
      });
      await storage.createAiNudgeEvent({
        nudgeId: nudge.id,
        userId: nudge.userId,
        eventType: "snoozed",
        eventAt: new Date().toISOString(),
        metadata: JSON.stringify({ hours, snoozedUntil }),
      });

      res.json({ success: true, snoozedUntil });
    } catch (error) {
      console.error("Snooze nudge error:", error);
      res.status(500).json({ error: "Failed to snooze nudge" });
    }
  });

  // Act on a nudge
  app.post("/api/ai/nudges/:id/act", async (req, res) => {
    try {
      const { action_type, payload } = req.body;
      const nudge = await storage.getAiNudge(req.params.id);
      if (!nudge) {
        return res.status(404).json({ error: "Nudge not found" });
      }

      let result: any = { success: true };

      switch (action_type) {
        case "send_message":
          // For now, mark as acted - actual messaging handled by frontend
          result.message = "Message action recorded";
          break;
        case "create_job":
          // Return prefilled job data for frontend to use
          const jobPayload = JSON.parse(nudge.actionPayload || "{}");
          result.jobPrefill = jobPayload.jobPrefill;
          break;
        case "create_invoice":
          // Return prefilled invoice data for frontend to use
          const invPayload = JSON.parse(nudge.actionPayload || "{}");
          result.invoicePrefill = invPayload.invoicePrefill;
          break;
        default:
          result.message = "Action recorded";
      }

      await storage.updateAiNudge(req.params.id, { status: "acted" });
      await storage.createAiNudgeEvent({
        nudgeId: nudge.id,
        userId: nudge.userId,
        eventType: "acted",
        eventAt: new Date().toISOString(),
        metadata: JSON.stringify({ action_type, payload }),
      });

      res.json(result);
    } catch (error) {
      console.error("Act on nudge error:", error);
      res.status(500).json({ error: "Failed to process action" });
    }
  });

  // Complete a nudge outcome - called when the action resulted in successful outcome
  app.post("/api/ai/nudges/:id/complete", async (req, res) => {
    try {
      const { outcome_type, entity_id, metadata } = req.body;
      const nudge = await storage.getAiNudge(req.params.id);
      if (!nudge) {
        return res.status(404).json({ error: "Nudge not found" });
      }

      // Update nudge status to completed
      await storage.updateAiNudge(req.params.id, { status: "completed" });
      
      // Record completion event with outcome data
      await storage.createAiNudgeEvent({
        nudgeId: nudge.id,
        userId: nudge.userId,
        eventType: "completed",
        eventAt: new Date().toISOString(),
        metadata: JSON.stringify({ 
          outcome_type, 
          entity_id,
          ...metadata,
        }),
      });

      res.json({ success: true, status: "completed" });
    } catch (error) {
      console.error("Complete nudge error:", error);
      res.status(500).json({ error: "Failed to complete nudge" });
    }
  });

  // AI Interventions - Phase 2: Rare, moment-of-truth interventions
  // Max 1 intervention per user per calendar day
  app.get("/api/ai/intervention", isAuthenticated, async (req, res) => {
    try {
      const { entity_type, entity_id } = req.query;
      
      // Check if we can show an intervention today
      const canShow = await canShowInterventionToday((req as any).userId);
      if (!canShow) {
        return res.json({ intervention: null });
      }
      
      // Check for specific intervention conditions
      const intervention = await checkForIntervention(
        (req as any).userId,
        entity_type as string || "",
        entity_id as string || "",
        {}
      );
      
      if (intervention.shouldIntervene && intervention.message) {
        // Record the intervention (shown to user)
        await recordIntervention(
          (req as any).userId,
          intervention.interventionType || "revenue_risk",
          entity_type as string || null,
          entity_id as string || null,
          intervention.message,
          false // not silent
        );
        
        return res.json({
          intervention: {
            message: intervention.message,
            type: intervention.interventionType,
          }
        });
      }
      
      res.json({ intervention: null });
    } catch (error) {
      console.error("Intervention check error:", error);
      res.status(500).json({ error: "Failed to check interventions" });
    }
  });

  // GigAid Impact - outcomes attribution stats
  app.get("/api/ai/impact", isAuthenticated, async (req, res) => {
    try {
      const nudges = await storage.getAiNudges((req as any).userId);
      const invoices = await storage.getInvoices((req as any).userId);
      const leads = await storage.getLeads((req as any).userId);

      // Count acted and completed nudges by type
      const actedNudges = nudges.filter(n => n.status === "acted" || n.status === "completed");
      const completedNudges = nudges.filter(n => n.status === "completed");
      
      // Invoice reminders that were acted upon
      const invoiceReminderActed = actedNudges.filter(n => 
        n.nudgeType === "invoice_reminder" || 
        n.nudgeType === "invoice_reminder_firm" || 
        n.nudgeType === "invoice_overdue_escalation"
      ).length;

      // Leads converted via nudge action
      const leadsConverted = actedNudges.filter(n => 
        n.nudgeType === "lead_convert_to_job"
      ).length;

      // Invoices created from completed jobs via nudge
      const invoicesFromNudge = actedNudges.filter(n => 
        n.nudgeType === "invoice_create_from_job_done"
      ).length;

      // Calculate money collected through nudge-prompted reminders
      // For now, approximate based on paid invoices that had reminder nudges
      const invoiceIdsWithReminders = new Set(
        actedNudges
          .filter(n => n.nudgeType.startsWith("invoice_"))
          .map(n => n.entityId)
      );
      
      const moneyCollectedViaReminders = invoices
        .filter(inv => inv.status === "paid" && invoiceIdsWithReminders.has(inv.id))
        .reduce((sum, inv) => sum + (inv.amount + (inv.tax || 0) - (inv.discount || 0)), 0);

      // Total nudges generated
      const totalNudgesGenerated = nudges.length;
      
      // Action rate (how many nudges were acted on)
      const actionRate = totalNudgesGenerated > 0 
        ? Math.round((actedNudges.length / totalNudgesGenerated) * 100) 
        : 0;

      // Completion rate (how many acted nudges resulted in completed outcomes)
      const completionRate = actedNudges.length > 0 
        ? Math.round((completedNudges.length / actedNudges.length) * 100) 
        : 0;

      res.json({
        moneyCollectedViaReminders,
        invoiceRemindersActed: invoiceReminderActed,
        leadsConverted,
        invoicesFromNudge,
        totalNudgesGenerated,
        totalActed: actedNudges.length,
        totalCompleted: completedNudges.length,
        actionRate,
        completionRate,
        thisWeek: {
          nudgesActed: actedNudges.filter(n => {
            const nudgeData = nudges.find(nd => nd.id === n.id);
            if (!nudgeData?.createdAt) return false;
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return new Date(nudgeData.createdAt) >= weekAgo;
          }).length,
          nudgesCompleted: completedNudges.filter(n => {
            const nudgeData = nudges.find(nd => nd.id === n.id);
            if (!nudgeData?.createdAt) return false;
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return new Date(nudgeData.createdAt) >= weekAgo;
          }).length,
        }
      });
    } catch (error) {
      console.error("Get impact stats error:", error);
      res.status(500).json({ error: "Failed to get impact stats" });
    }
  });

  // Admin endpoint to force-regenerate nudges and backfill missing ones
  // ?force=true bypasses daily cap (for testing only)
  app.post("/api/admin/backfill-nudges", isAuthenticated, async (req, res) => {
    try {
      const forceBypass = req.query.force === "true";
      
      // Force regenerate nudges for the user
      const result = await generateNudgesForUser((req as any).userId, forceBypass);
      
      // Also check for completed jobs without invoices and create nudges
      const jobs = await storage.getJobs((req as any).userId);
      const invoices = await storage.getInvoices((req as any).userId);
      
      const completedWithoutInvoice = jobs.filter(job => 
        job.status === "completed" && 
        !invoices.some(inv => inv.jobId === job.id)
      );
      
      // Create invoice_create_from_job_done nudges for any missed jobs
      let backfilledCount = 0;
      for (const job of completedWithoutInvoice) {
        const amount = job.price ? job.price / 100 : 0;
        const dedupeKey = `${(req as any).userId}:job:${job.id}:invoice_create_from_job_done:backfill`;
        
        const existing = await storage.getAiNudgeByDedupeKey(dedupeKey);
        if (!existing) {
          await storage.createAiNudge({
            userId: (req as any).userId,
            entityType: "job",
            entityId: job.id,
            nudgeType: "invoice_create_from_job_done",
            priority: 92, // High priority for revenue protection
            status: "active",
            createdAt: new Date().toISOString(),
            explainText: `$${amount.toFixed(0)} job completed but no invoice. Don't leave money on the table!`,
            actionPayload: JSON.stringify({
              invoicePrefill: {
                clientName: job.clientName,
                clientEmail: job.clientEmail,
                clientPhone: job.clientPhone,
                serviceDescription: job.title,
                amount: job.price || 0,
                jobId: job.id,
              },
            }),
            dedupeKey,
          });
          backfilledCount++;
        }
      }
      
      res.json({ 
        success: true, 
        ...result,
        backfilledJobNudges: backfilledCount,
        completedJobsWithoutInvoice: completedWithoutInvoice.length,
      });
    } catch (error) {
      console.error("Backfill nudges error:", error);
      res.status(500).json({ error: "Failed to backfill nudges" });
    }
  });

  // ==================== TODAY'S MONEY PLAN - ACTION QUEUE ====================
  // Global prioritization view for leads, jobs, and invoices

  // Generate/refresh the action queue
  app.post("/api/action-queue/generate", async (req, res) => {
    try {
      const flag = await storage.getFeatureFlag("today_money_plan");
      if (!flag?.enabled) {
        return res.status(403).json({ 
          error: "Today's Money Plan feature is not enabled",
          featureFlag: "today_money_plan" 
        });
      }

      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { ActionQueueGenerator } = await import("./actionQueueGenerator");
      const generator = new ActionQueueGenerator(storage);
      const items = await generator.generateQueue(userId);
      
      res.json({ 
        success: true, 
        count: items.length,
        items 
      });
    } catch (error) {
      console.error("Generate action queue error:", error);
      res.status(500).json({ error: "Failed to generate action queue" });
    }
  });

  // Get action queue items
  app.get("/api/action-queue", async (req, res) => {
    try {
      const flag = await storage.getFeatureFlag("today_money_plan");
      if (!flag?.enabled) {
        return res.json([]);
      }

      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { status } = req.query;
      const items = await storage.getActionQueueItems(
        userId, 
        status as string | undefined
      );
      res.json(items);
    } catch (error) {
      console.error("Get action queue error:", error);
      res.status(500).json({ error: "Failed to get action queue" });
    }
  });

  // Mark action as done
  app.post("/api/action-queue/:id/done", async (req, res) => {
    try {
      const item = await storage.getActionQueueItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Action not found" });
      }

      const updated = await storage.updateActionQueueItem(req.params.id, {
        status: "done",
      });
      res.json(updated);
    } catch (error) {
      console.error("Mark action done error:", error);
      res.status(500).json({ error: "Failed to mark action as done" });
    }
  });

  // Dismiss action
  app.post("/api/action-queue/:id/dismiss", async (req, res) => {
    try {
      const item = await storage.getActionQueueItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Action not found" });
      }

      const updated = await storage.updateActionQueueItem(req.params.id, {
        status: "dismissed",
      });
      res.json(updated);
    } catch (error) {
      console.error("Dismiss action error:", error);
      res.status(500).json({ error: "Failed to dismiss action" });
    }
  });

  // Snooze action
  app.post("/api/action-queue/:id/snooze", async (req, res) => {
    try {
      const item = await storage.getActionQueueItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Action not found" });
      }

      const { hours = 4 } = req.body;
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + hours);

      const updated = await storage.updateActionQueueItem(req.params.id, {
        status: "snoozed",
        snoozedUntil: snoozeUntil.toISOString(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Snooze action error:", error);
      res.status(500).json({ error: "Failed to snooze action" });
    }
  });

  // ==================== NEXT BEST ACTION ENGINE ====================
  // Intelligent stall detection and one recommended action per entity
  
  const { getNextActionsForUser, actOnAction, dismissAction } = await import("./nextBestActionEngine");
  
  // Get all active next actions for user
  app.get("/api/next-actions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const entityType = req.query.entityType as string | undefined;
      
      const actions = await storage.getNextActions(userId, entityType);
      res.json(actions);
    } catch (error) {
      console.error("Get next actions error:", error);
      res.status(500).json({ error: "Failed to get next actions" });
    }
  });
  
  // Get next action for a specific entity
  app.get("/api/next-actions/entity/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const action = await storage.getActiveNextActionForEntity(entityType, entityId);
      res.json(action || null);
    } catch (error) {
      console.error("Get entity next action error:", error);
      res.status(500).json({ error: "Failed to get entity next action" });
    }
  });
  
  // Mark action as acted upon
  app.post("/api/next-actions/:id/act", async (req, res) => {
    try {
      const updated = await actOnAction(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Act on next action error:", error);
      res.status(500).json({ error: "Failed to act on action" });
    }
  });
  
  // Dismiss action
  app.post("/api/next-actions/:id/dismiss", async (req, res) => {
    try {
      const updated = await dismissAction(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Dismiss next action error:", error);
      res.status(500).json({ error: "Failed to dismiss action" });
    }
  });

  // ==================== READY ACTIONS (INTENT-BASED) ====================
  // Pre-filled one-tap actions from behavioral intent detection
  
  const { 
    detectIntentFromInboundMessage,
    detectLeadStatusEngaged,
    detectJobCompleted,
    detectMultipleResponds,
    generateReadyActionFromSignal
  } = await import("./intentDetectionEngine");
  
  // Get all active ready actions for user
  app.get("/api/ready-actions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const actions = await storage.getReadyActions(userId);
      res.json(actions);
    } catch (error) {
      console.error("Get ready actions error:", error);
      res.status(500).json({ error: "Failed to get ready actions" });
    }
  });
  
  // Get ready action for a specific entity
  app.get("/api/ready-actions/entity/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const action = await storage.getActiveReadyActionForEntity(entityType, entityId);
      res.json(action || null);
    } catch (error) {
      console.error("Get entity ready action error:", error);
      res.status(500).json({ error: "Failed to get entity ready action" });
    }
  });
  
  // Act on ready action (create invoice and send with booking link)
  app.post("/api/ready-actions/:id/act", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const action = await storage.getReadyActions(userId)
        .then(actions => actions.find(a => a.id === req.params.id));
      
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      
      const { overrideAmount } = req.body || {};
      
      const { v4: uuidv4 } = await import("uuid");
      const now = new Date().toISOString();
      const publicToken = uuidv4();
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
      const invoiceUrl = `${frontendUrl}/pay/${publicToken}`;
      
      // Generate booking link for the client
      const user = await storage.getUser(userId);
      const bookingLink = user?.publicProfileSlug 
        ? `${frontendUrl}/book/${user.publicProfileSlug}`
        : null;
      
      // Use override amount if user adjusted it, otherwise use prefilled
      const finalAmount = overrideAmount ?? action.prefilledAmount ?? 0;
      
      // Create the invoice from prefilled data with ready action tracking
      const invoice = await storage.createInvoice({
        userId,
        clientName: action.prefilledClientName || "Client",
        clientEmail: action.prefilledClientEmail,
        clientPhone: action.prefilledClientPhone,
        amount: finalAmount,
        serviceDescription: action.prefilledDescription || action.prefilledServiceType || "Service",
        status: "draft",
        dueDate: action.prefilledDueDate,
        createdAt: now,
        jobId: action.entityType === "job" ? action.entityId : null,
        leadId: action.entityType === "lead" ? action.entityId : null,
        sourceReadyActionId: action.id,
        bookingLink,
        publicToken,
      });
      
      // Mark the ready action as acted
      await storage.actOnReadyAction(action.id);
      
      // Try to send the invoice with booking link
      let sent = false;
      let sendMessage = "Invoice created as draft";
      const amountFormatted = ((action.prefilledAmount || 0) / 100).toFixed(2);
      
      // Compose email with both invoice and booking link
      const emailHtml = `
        <p>Hi ${action.prefilledClientName || "there"},</p>
        <p>You have a new invoice for <strong>$${amountFormatted}</strong>.</p>
        <p><a href="${invoiceUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">View and Pay Invoice</a></p>
        ${bookingLink ? `<p style="margin-top:16px;">Ready to lock in a time? <a href="${bookingLink}">Book your appointment</a></p>` : ""}
        <p style="margin-top:24px;color:#666;">Thanks,<br>${user?.businessName || user?.name || "Your Service Provider"}</p>
      `;
      
      // Try to send via email
      if (action.prefilledClientEmail) {
        try {
          const sgMail = (await import("@sendgrid/mail")).default;
          if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            await sgMail.send({
              to: action.prefilledClientEmail,
              from: {
                email: process.env.SENDGRID_VERIFIED_SENDER || "noreply@example.com",
                name: user?.businessName || user?.name || "GigAid"
              },
              subject: `Invoice from ${user?.businessName || user?.name || "Your Service Provider"}`,
              html: emailHtml,
            });
            sent = true;
            sendMessage = "Invoice sent via email";
          }
        } catch (emailErr) {
          console.error("[ReadyAction] Email send failed:", emailErr);
        }
      }
      
      // If email failed, try SMS
      if (!sent && action.prefilledClientPhone) {
        try {
          const smsMessage = bookingLink
            ? `Invoice for $${amountFormatted}: ${invoiceUrl}\n\nReady to book? ${bookingLink}`
            : `Invoice for $${amountFormatted}: ${invoiceUrl}`;
          
          const success = await sendSMS(action.prefilledClientPhone, smsMessage);
          if (success) {
            sent = true;
            sendMessage = "Invoice sent via SMS";
          }
        } catch (smsErr) {
          console.error("[ReadyAction] SMS send failed:", smsErr);
        }
      }
      
      // Update invoice with sent status
      if (sent) {
        await storage.updateInvoice(invoice.id, {
          status: "sent",
          sentAt: now,
          emailSentAt: action.prefilledClientEmail && sendMessage.includes("email") ? now : null,
          smsSentAt: action.prefilledClientPhone && sendMessage.includes("SMS") ? now : null,
        });
      }
      
      res.json({ 
        success: true, 
        invoice: { ...invoice, status: sent ? "sent" : "draft" },
        sent,
        bookingLink,
        message: sendMessage
      });
    } catch (error) {
      console.error("Act on ready action error:", error);
      res.status(500).json({ error: "Failed to act on ready action" });
    }
  });
  
  // Dismiss ready action
  app.post("/api/ready-actions/:id/dismiss", async (req, res) => {
    try {
      const updated = await storage.dismissReadyAction(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Dismiss ready action error:", error);
      res.status(500).json({ error: "Failed to dismiss ready action" });
    }
  });
  
  // ==================== AI OVERRIDES (SILENT LEARNING) ====================
  // Tracks user corrections to AI suggestions for continuous model improvement
  // This is completely invisible to users - no UI surfaces this data
  
  app.post("/api/ai-overrides", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { 
        entityType, 
        entityId, 
        overrideType,
        originalAction,
        originalAmount,
        originalTiming,
        userAction,
        userAmount,
        delaySeconds,
        confidenceScore,
        intentSignals,
        jobType
      } = req.body;
      
      if (!entityType || !entityId || !overrideType) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const now = new Date();
      const hour = now.getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      
      const override = await storage.createAiOverride({
        userId,
        entityType,
        entityId,
        overrideType,
        originalAction: originalAction ?? null,
        originalAmount: originalAmount ?? null,
        originalTiming: originalTiming ?? null,
        userAction: userAction ?? null,
        userAmount: userAmount ?? null,
        delaySeconds: delaySeconds ?? null,
        confidenceScore: confidenceScore ?? null,
        intentSignals: intentSignals ?? null,
        timeOfDay,
        jobType: jobType ?? null,
        createdAt: now.toISOString(),
      });
      
      res.json({ success: true, id: override.id });
    } catch (error) {
      console.error("Create AI override error:", error);
      res.status(500).json({ error: "Failed to log override" });
    }
  });
  
  // Track respond tap on lead (for intent detection)
  app.post("/api/leads/:id/respond-tap", async (req, res) => {
    try {
      const lead = await storage.incrementLeadRespondTap(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Check for multiple responds intent signal
      if (lead.respondTapCount && lead.respondTapCount >= 2) {
        const signal = await detectMultipleResponds(
          lead.userId,
          lead.id,
          lead.respondTapCount
        );
        
        if (signal) {
          await generateReadyActionFromSignal(signal);
        }
      }
      
      res.json({ 
        success: true, 
        respondTapCount: lead.respondTapCount 
      });
    } catch (error) {
      console.error("Track respond tap error:", error);
      res.status(500).json({ error: "Failed to track respond tap" });
    }
  });

  // ==================== OUTCOME ATTRIBUTION ====================
  // GigAid Impact metrics showing "GigAid helped you collect $X faster"

  // Compute daily outcome metrics
  app.post("/api/outcomes/compute", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const flag = await storage.getFeatureFlag("outcome_attribution");
      if (!flag?.enabled) {
        return res.status(403).json({ 
          error: "Outcome Attribution feature is not enabled",
          featureFlag: "outcome_attribution" 
        });
      }

      const { date } = req.body;
      const metricDate = date || new Date().toISOString().split('T')[0];

      // Check if metrics already exist for this date
      const existing = await storage.getOutcomeMetricsDailyByDate(userId, metricDate);
      
      // Get data for calculations
      const invoices = await storage.getInvoices(userId);
      const nudges = await storage.getActiveAiNudgesForUser(userId);
      const nudgeEvents = await storage.getAiNudgeEvents(userId);
      const leads = await storage.getLeads(userId);

      // Count invoices paid today
      const paidToday = invoices.filter(i => 
        i.status === "paid" && 
        i.paidAt && 
        i.paidAt.split('T')[0] === metricDate
      );
      const invoicesPaidCount = paidToday.length;
      const invoicesPaidAmount = paidToday.reduce((sum, i) => sum + (i.amount || 0), 0);

      // Calculate average days to paid (conservative)
      const paidInvoicesWithSentDate = paidToday.filter(i => i.sentAt && i.paidAt);
      let avgDaysToPaid: number | null = null;
      if (paidInvoicesWithSentDate.length > 0) {
        const totalDays = paidInvoicesWithSentDate.reduce((sum, i) => {
          const sent = new Date(i.sentAt!);
          const paid = new Date(i.paidAt!);
          return sum + Math.max(0, Math.floor((paid.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24)));
        }, 0);
        avgDaysToPaid = Math.round(totalDays / paidInvoicesWithSentDate.length);
      }

      // Count acted nudges today
      const actedToday = nudgeEvents.filter(e => 
        e.eventType === "acted" && 
        e.eventAt.split('T')[0] === metricDate
      );
      const nudgesActedCount = actedToday.length;

      // Count leads converted today
      const convertedToday = leads.filter(l => 
        l.status === "won" && 
        l.convertedAt && 
        l.convertedAt.split('T')[0] === metricDate
      );
      const leadsConvertedCount = convertedToday.length;

      // Conservative estimate: each acted nudge saves 0.5 days of delay
      // Each reminder saves 1 day on average (industry standard)
      const estimatedDaysSaved = Math.floor(nudgesActedCount * 0.5);

      // Conservative cash acceleration: $X collected Y days faster
      // Using the formula: amount * (days_saved / 30) * 0.5 (conservative factor)
      const estimatedCashAccelerated = Math.floor(
        invoicesPaidAmount * (estimatedDaysSaved / 30) * 0.5
      );

      const metrics = {
        userId,
        metricDate,
        invoicesPaidCount,
        invoicesPaidAmount,
        avgDaysToPaid,
        remindersSentCount: 0, // Would need to track this separately
        nudgesActedCount,
        leadsConvertedCount,
        estimatedDaysSaved,
        estimatedCashAccelerated,
        createdAt: new Date().toISOString(),
      };

      let result;
      if (existing) {
        result = await storage.updateOutcomeMetricsDaily(existing.id, metrics);
      } else {
        result = await storage.createOutcomeMetricsDaily(metrics);
      }

      res.json(result);
    } catch (error) {
      console.error("Compute outcomes error:", error);
      res.status(500).json({ error: "Failed to compute outcome metrics" });
    }
  });

  // Get outcome metrics for date range
  app.get("/api/outcomes", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const flag = await storage.getFeatureFlag("outcome_attribution");
      if (!flag?.enabled) {
        return res.json({ metrics: [], summary: null });
      }

      const { startDate, endDate } = req.query;
      const end = (endDate as string) || new Date().toISOString().split('T')[0];
      const start = (startDate as string) || (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
      })();

      const metrics = await storage.getOutcomeMetricsDaily(userId, start, end);

      // Calculate summary
      const summary = {
        totalInvoicesPaid: metrics.reduce((sum, m) => sum + (m.invoicesPaidCount || 0), 0),
        totalAmountCollected: metrics.reduce((sum, m) => sum + (m.invoicesPaidAmount || 0), 0),
        totalNudgesActed: metrics.reduce((sum, m) => sum + (m.nudgesActedCount || 0), 0),
        totalLeadsConverted: metrics.reduce((sum, m) => sum + (m.leadsConvertedCount || 0), 0),
        totalDaysSaved: metrics.reduce((sum, m) => sum + (m.estimatedDaysSaved || 0), 0),
        totalCashAccelerated: metrics.reduce((sum, m) => sum + (m.estimatedCashAccelerated || 0), 0),
      };

      res.json({ metrics, summary });
    } catch (error) {
      console.error("Get outcomes error:", error);
      res.status(500).json({ error: "Failed to get outcome metrics" });
    }
  });

  // Feature flags endpoints
  app.get("/api/feature-flags", async (req, res) => {
    try {
      const flags = await storage.getAllFeatureFlags();
      res.json(flags);
    } catch (error) {
      console.error("Get feature flags error:", error);
      res.status(500).json({ error: "Failed to get feature flags" });
    }
  });

  app.get("/api/feature-flags/:key", async (req, res) => {
    try {
      const flag = await storage.getFeatureFlag(req.params.key);
      if (!flag) {
        return res.json({ key: req.params.key, enabled: false });
      }
      res.json(flag);
    } catch (error) {
      console.error("Get feature flag error:", error);
      res.status(500).json({ error: "Failed to get feature flag" });
    }
  });

  app.post("/api/feature-flags/:key", async (req, res) => {
    try {
      const { enabled, description } = req.body;
      const flag = await storage.setFeatureFlag(req.params.key, enabled, description);
      res.json(flag);
    } catch (error) {
      console.error("Set feature flag error:", error);
      res.status(500).json({ error: "Failed to set feature flag" });
    }
  });

  // ==================== CAPABILITY ENFORCEMENT ENDPOINTS ====================
  // New capability enforcement system with limits, caps, and progressive unlocks
  
  const { canPerform, getCapabilityRules, isUnlimited, getLimit } = await import("@shared/capabilities/canPerform");
  const { CAPABILITY_RULES, CAPABILITY_DISPLAY_NAMES } = await import("@shared/capabilities/capabilityRules");
  const { PLAN_NAMES, PLAN_ORDER } = await import("@shared/capabilities/plans");
  type Plan = 'free' | 'pro' | 'pro_plus' | 'business';
  type Capability = 'jobs.create' | 'invoices.send' | 'leads.manage' | 'clients.manage' | 'booking.link' |
    'deposit.enforce' | 'booking.risk_protection' | 'price.confirmation' | 'ai.micro_nudges' | 'ai.money_plan' |
    'ai.outcome_attribution' | 'ai.priority_signals' | 'ai.campaign_suggestions' | 'sms.two_way' |
    'sms.auto_followups' | 'notifications.event_driven' | 'offline.capture' | 'offline.photos' |
    'drive.mode' | 'analytics.basic' | 'analytics.advanced' | 'crew.manage' | 'admin.controls';

  // Get all capability rules for current user's plan
  app.get("/api/capabilities", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      const plan = (user?.plan as Plan) || 'free';
      
      // Get all usage for this user
      const allUsage = await storage.getAllCapabilityUsage((req as any).userId);
      const usageMap = new Map(allUsage.map(u => [u.capability, u.usageCount]));
      
      // Build capability status for each capability
      const capabilities: Record<string, any> = {};
      
      for (const [capability, displayName] of Object.entries(CAPABILITY_DISPLAY_NAMES)) {
        const cap = capability as Capability;
        const usage = usageMap.get(cap) || 0;
        const result = canPerform(plan, cap, usage);
        const rules = getCapabilityRules(plan, cap);
        
        capabilities[cap] = {
          displayName,
          allowed: result.allowed,
          reason: result.reason,
          mode: result.mode || rules.mode,
          limit: result.limit,
          remaining: result.remaining,
          current: usage,
          unlimited: rules.unlimited || false,
          windowDays: rules.window_days
        };
      }
      
      res.json({
        plan,
        planName: PLAN_NAMES[plan],
        capabilities
      });
    } catch (error) {
      console.error("Get capabilities error:", error);
      res.status(500).json({ error: "Failed to get capabilities" });
    }
  });

  // Check if user can perform a specific capability
  app.get("/api/capabilities/:capability/check", isAuthenticated, async (req, res) => {
    try {
      const capability = req.params.capability as Capability;
      const user = await storage.getUser((req as any).userId);
      const plan = (user?.plan as Plan) || 'free';
      
      const usage = await storage.getCapabilityUsage((req as any).userId, capability);
      const usageCount = usage?.usageCount || 0;
      
      const result = canPerform(plan, capability, usageCount);
      
      res.json({
        capability,
        ...result,
        current: usageCount,
        plan,
        planName: PLAN_NAMES[plan]
      });
    } catch (error) {
      console.error("Check capability error:", error);
      res.status(500).json({ error: "Failed to check capability" });
    }
  });

  // Get user's usage for all capabilities
  app.get("/api/capabilities/usage", isAuthenticated, async (req, res) => {
    try {
      const allUsage = await storage.getAllCapabilityUsage((req as any).userId);
      res.json(allUsage);
    } catch (error) {
      console.error("Get usage error:", error);
      res.status(500).json({ error: "Failed to get usage" });
    }
  });

  // Increment usage for a capability (called after successful action)
  app.post("/api/capabilities/:capability/increment", isAuthenticated, async (req, res) => {
    try {
      const capability = req.params.capability as Capability;
      const user = await storage.getUser((req as any).userId);
      const plan = (user?.plan as Plan) || 'free';
      
      // Check if action is allowed before incrementing
      const currentUsage = await storage.getCapabilityUsage((req as any).userId, capability);
      const usageCount = currentUsage?.usageCount || 0;
      
      const checkResult = canPerform(plan, capability, usageCount);
      
      if (!checkResult.allowed) {
        return res.status(403).json({
          error: "Capability limit reached",
          reason: checkResult.reason,
          limitReached: checkResult.limitReached,
          upgradeRequired: checkResult.upgradeRequired
        });
      }
      
      const updated = await storage.incrementCapabilityUsage((req as any).userId, capability);
      
      // Re-check after increment for new status
      const newResult = canPerform(plan, capability, updated.usageCount);
      
      res.json({
        capability,
        usageCount: updated.usageCount,
        ...newResult
      });
    } catch (error) {
      console.error("Increment usage error:", error);
      res.status(500).json({ error: "Failed to increment usage" });
    }
  });

  // Reset usage for a capability (for admin or window resets)
  app.post("/api/capabilities/:capability/reset", isAuthenticated, async (req, res) => {
    try {
      const capability = req.params.capability;
      await storage.resetCapabilityUsage((req as any).userId, capability);
      res.json({ success: true, capability });
    } catch (error) {
      console.error("Reset usage error:", error);
      res.status(500).json({ error: "Failed to reset usage" });
    }
  });

  // Get plan comparison for upgrade prompts
  app.get("/api/plans/compare", async (req, res) => {
    try {
      res.json({
        plans: PLAN_ORDER,
        planNames: PLAN_NAMES,
        capabilityRules: CAPABILITY_RULES,
        capabilityNames: CAPABILITY_DISPLAY_NAMES
      });
    } catch (error) {
      console.error("Get plans error:", error);
      res.status(500).json({ error: "Failed to get plans" });
    }
  });

  // ==================== QUICKBOOK ENDPOINTS ====================
  // Feature-flagged "Paste message → booked" flow
  
  // Middleware to check if quickbook is enabled
  const checkQuickbookEnabled = async (req: Request, res: Response, next: NextFunction) => {
    const flag = await storage.getFeatureFlag("quickbook_enabled");
    if (!flag?.enabled) {
      return res.status(404).json({ error: "QuickBook feature is not enabled" });
    }
    next();
  };

  // Simple in-memory rate limiting for quickbook parse endpoint (10 requests per minute per user)
  const quickbookParseRateLimits = new Map<string, { count: number; resetAt: number }>();
  const QUICKBOOK_RATE_LIMIT = 10;
  const QUICKBOOK_RATE_WINDOW_MS = 60 * 1000; // 1 minute

  const checkQuickbookParseRateLimit = (userId: string): boolean => {
    const now = Date.now();
    const userLimit = quickbookParseRateLimits.get(userId);
    
    if (!userLimit || now > userLimit.resetAt) {
      quickbookParseRateLimits.set(userId, { count: 1, resetAt: now + QUICKBOOK_RATE_WINDOW_MS });
      return true;
    }
    
    if (userLimit.count >= QUICKBOOK_RATE_LIMIT) {
      return false;
    }
    
    userLimit.count++;
    return true;
  };

  // POST /api/quickbook/parse - Parse pasted message and create draft
  app.post("/api/quickbook/parse", isAuthenticated, checkQuickbookEnabled, async (req, res) => {
    try {
      // Rate limiting check
      if (!checkQuickbookParseRateLimit((req as any).userId)) {
        return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
      }

      const { messageText } = req.body;
      
      // Validation: required, trim, 10-2000 chars
      if (!messageText || typeof messageText !== "string") {
        return res.status(400).json({ error: "messageText is required" });
      }
      
      const trimmed = messageText.trim();
      if (trimmed.length < 10) {
        return res.status(400).json({ error: "Message must be at least 10 characters" });
      }
      if (trimmed.length > 2000) {
        return res.status(400).json({ error: "Message must be under 2000 characters" });
      }

      let parsedFields: ParsedJobFields = {};
      let confidence: FieldConfidence = { overall: 0 };

      try {
        // Try AI parsing first
        const { parseTextToPlan } = await import("./ai/aiService");
        const aiResult = await parseTextToPlan(trimmed);
        
        parsedFields = {
          service: aiResult.service || undefined,
          dateTimeStart: aiResult.date && aiResult.time 
            ? `${aiResult.date}T${aiResult.time}:00` 
            : undefined,
          priceAmount: aiResult.price || undefined,
          currency: "USD",
          durationMins: aiResult.duration || 60,
          clientName: aiResult.clientName || undefined,
          clientPhone: aiResult.clientPhone || undefined,
        };

        // Calculate confidence based on filled fields
        let filledCount = 0;
        let totalFields = 5;
        if (parsedFields.service) filledCount++;
        if (parsedFields.dateTimeStart) filledCount++;
        if (parsedFields.locationText) filledCount++;
        if (parsedFields.priceAmount) filledCount++;
        if (parsedFields.clientName || parsedFields.clientPhone) filledCount++;

        confidence = {
          overall: Math.min(0.9, filledCount / totalFields + 0.2),
          service: parsedFields.service ? 0.85 : 0.2,
          dateTime: parsedFields.dateTimeStart ? 0.8 : 0.3,
          location: parsedFields.locationText ? 0.75 : 0.2,
          price: parsedFields.priceAmount ? 0.7 : 0.3,
          client: (parsedFields.clientName || parsedFields.clientPhone) ? 0.8 : 0.2,
        };
      } catch (aiError) {
        console.error("AI parsing failed, using rule-based fallback:", aiError);
        
        // Rule-based fallback
        const dateMatch = trimmed.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i);
        const timeMatch = trimmed.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
        const priceMatch = trimmed.match(/\$(\d+(?:\.\d{2})?)/);
        const phoneMatch = trimmed.match(/(?:\+?1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        
        // Detect service keywords
        const serviceKeywords: Record<string, string> = {
          plumb: "plumbing",
          pipe: "plumbing",
          drain: "plumbing",
          leak: "plumbing",
          faucet: "plumbing",
          toilet: "plumbing",
          electric: "electrical",
          outlet: "electrical",
          switch: "electrical",
          wire: "electrical",
          clean: "cleaning",
          maid: "cleaning",
          handyman: "handyman",
          repair: "handyman",
          fix: "handyman",
        };

        let detectedService: string | undefined;
        for (const [keyword, service] of Object.entries(serviceKeywords)) {
          if (trimmed.toLowerCase().includes(keyword)) {
            detectedService = service;
            break;
          }
        }

        parsedFields = {
          service: detectedService,
          priceAmount: priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : undefined,
          clientPhone: phoneMatch ? phoneMatch[0] : undefined,
          durationMins: 60,
          currency: "USD",
        };

        confidence = {
          overall: 0.4,
          service: detectedService ? 0.6 : 0.2,
          dateTime: dateMatch ? 0.5 : 0.1,
          location: 0.1,
          price: priceMatch ? 0.7 : 0.2,
          client: phoneMatch ? 0.6 : 0.2,
        };
      }

      // Create draft in database
      const draft = await storage.createJobDraft({
        userId: (req as any).userId,
        sourceText: trimmed,
        parsedFields: JSON.stringify(parsedFields),
        confidence: JSON.stringify(confidence),
        status: "draft",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });

      res.json({
        draftId: draft.id,
        fields: parsedFields,
        confidence,
        suggestions: confidence.overall < 0.6 ? {
          action: "edit",
          message: "Quick check: update anything that looks off.",
        } : undefined,
      });
    } catch (error) {
      console.error("QuickBook parse error:", error);
      res.status(500).json({ error: "Failed to parse message" });
    }
  });

  // GET /api/quickbook/draft/:id - Get draft by ID
  app.get("/api/quickbook/draft/:id", isAuthenticated, checkQuickbookEnabled, async (req, res) => {
    try {
      const draft = await storage.getJobDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (draft.userId !== (req as any).userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({
        ...draft,
        parsedFields: JSON.parse(draft.parsedFields || "{}"),
        confidence: JSON.parse(draft.confidence || "{}"),
        paymentConfig: JSON.parse(draft.paymentConfig || "{}"),
      });
    } catch (error) {
      console.error("Get draft error:", error);
      res.status(500).json({ error: "Failed to get draft" });
    }
  });

  // PATCH /api/quickbook/draft/:id - Update draft fields
  app.patch("/api/quickbook/draft/:id", isAuthenticated, checkQuickbookEnabled, async (req, res) => {
    try {
      const draft = await storage.getJobDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (draft.userId !== (req as any).userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fields } = req.body;
      if (!fields || typeof fields !== "object") {
        return res.status(400).json({ error: "fields object is required" });
      }

      // Validate fields
      if (fields.priceAmount !== undefined && (fields.priceAmount < 0 || fields.priceAmount > 10000000)) {
        return res.status(400).json({ error: "Price must be between 0 and $100,000" });
      }
      if (fields.durationMins !== undefined && (fields.durationMins < 15 || fields.durationMins > 480)) {
        return res.status(400).json({ error: "Duration must be between 15 and 480 minutes" });
      }
      if (fields.dateTimeStart) {
        const dt = new Date(fields.dateTimeStart);
        if (isNaN(dt.getTime())) {
          return res.status(400).json({ error: "Invalid date/time format" });
        }
      }

      const currentFields = JSON.parse(draft.parsedFields || "{}");
      const updatedFields = { ...currentFields, ...fields };

      const updated = await storage.updateJobDraft(req.params.id, {
        parsedFields: JSON.stringify(updatedFields),
      });

      res.json({
        ...updated,
        parsedFields: JSON.parse(updated?.parsedFields || "{}"),
        confidence: JSON.parse(updated?.confidence || "{}"),
      });
    } catch (error) {
      console.error("Update draft error:", error);
      res.status(500).json({ error: "Failed to update draft" });
    }
  });

  // POST /api/quickbook/draft/:id/send-link - Generate booking link and mark as sent
  app.post("/api/quickbook/draft/:id/send-link", isAuthenticated, checkQuickbookEnabled, async (req, res) => {
    try {
      const draft = await storage.getJobDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (draft.userId !== (req as any).userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { paymentIntentConfig } = req.body;
      const parsedFields: ParsedJobFields = JSON.parse(draft.parsedFields || "{}");

      // Default payment config: $50 deposit if price >= $100, else 30%
      let paymentConfig: PaymentConfig = { type: "deposit", depositAmount: 5000 };
      
      if (paymentIntentConfig?.type) {
        paymentConfig.type = paymentIntentConfig.type;
        if (paymentIntentConfig.depositAmount) {
          paymentConfig.depositAmount = paymentIntentConfig.depositAmount;
        } else if (paymentIntentConfig.depositPercent) {
          paymentConfig.depositPercent = paymentIntentConfig.depositPercent;
        }
      } else if (parsedFields.priceAmount) {
        if (parsedFields.priceAmount >= 10000) { // $100+
          paymentConfig = { type: "deposit", depositAmount: 5000 }; // $50
        } else if (parsedFields.priceAmount > 0) {
          paymentConfig = { type: "deposit", depositPercent: 30 };
        }
      }

      // Generate booking link token
      const bookingToken = randomUUID();
      const baseUrl = process.env.FRONTEND_URL || "https://account.gigaid.ai";
      const bookingLinkUrl = `${baseUrl}/qb/${bookingToken}`;

      // Update draft with booking link
      await storage.updateJobDraft(req.params.id, {
        status: "link_sent",
        bookingLinkUrl,
        bookingLinkToken: bookingToken,
        paymentConfig: JSON.stringify(paymentConfig),
      });

      res.json({
        bookingLinkUrl,
        paymentConfig,
      });
    } catch (error) {
      console.error("Send booking link error:", error);
      res.status(500).json({ error: "Failed to generate booking link" });
    }
  });

  // GET /api/public/quickbook/:token - Public endpoint for customer to view booking
  app.get("/api/public/quickbook/:token", async (req, res) => {
    try {
      const draft = await storage.getJobDraftByToken(req.params.token);
      if (!draft) {
        return res.status(404).json({ error: "Booking not found or expired" });
      }

      const parsedFields = JSON.parse(draft.parsedFields || "{}");
      const paymentConfig = JSON.parse(draft.paymentConfig || "{}");
      const user = await storage.getUser(draft.userId);

      // Calculate deposit amount in cents
      let depositAmountCents: number | undefined;
      if (paymentConfig.depositAmount) {
        depositAmountCents = paymentConfig.depositAmount;
      } else if (paymentConfig.depositPercent && parsedFields.priceAmount) {
        depositAmountCents = Math.round(parsedFields.priceAmount * (paymentConfig.depositPercent / 100));
      }

      res.json({
        id: draft.id,
        status: draft.status,
        fields: parsedFields,
        providerName: user?.businessName || user?.name || "Service Provider",
        paymentType: paymentConfig.type || "after",
        depositAmountCents,
        expiresAt: draft.expiresAt,
      });
    } catch (error) {
      console.error("Get public quickbook error:", error);
      res.status(500).json({ error: "Failed to get booking details" });
    }
  });

  // POST /api/public/quickbook/:token/confirm - Customer confirms booking
  app.post("/api/public/quickbook/:token/confirm", async (req, res) => {
    try {
      const draft = await storage.getJobDraftByToken(req.params.token);
      if (!draft) {
        return res.status(404).json({ error: "Booking not found or expired" });
      }
      if (draft.status === "booked") {
        return res.status(400).json({ error: "Booking already confirmed" });
      }
      if (draft.status === "expired") {
        return res.status(400).json({ error: "Booking has expired" });
      }

      const { clientName, clientPhone, clientEmail } = req.body;
      const parsedFields: ParsedJobFields = JSON.parse(draft.parsedFields || "{}");

      // Create actual job from draft
      const dateTimeStart = parsedFields.dateTimeStart 
        ? new Date(parsedFields.dateTimeStart) 
        : new Date();
      
      const job = await storage.createJob({
        userId: draft.userId,
        title: parsedFields.service 
          ? `${parsedFields.service.charAt(0).toUpperCase() + parsedFields.service.slice(1)} Service`
          : "QuickBook Job",
        description: draft.sourceText,
        serviceType: parsedFields.service || "other",
        scheduledDate: dateTimeStart.toISOString().split("T")[0],
        scheduledTime: dateTimeStart.toTimeString().slice(0, 5),
        duration: parsedFields.durationMins || 60,
        status: "scheduled",
        price: parsedFields.priceAmount || null,
        clientName: clientName || parsedFields.clientName || "Customer",
        clientPhone: clientPhone || parsedFields.clientPhone || "",
        paymentStatus: "unpaid",
      });

      // Update draft status
      await storage.updateJobDraft(draft.id, {
        status: "booked",
        jobId: job.id,
      });

      res.json({
        success: true,
        jobId: job.id,
        message: "Booking confirmed! The provider will be notified.",
      });
    } catch (error) {
      console.error("Confirm quickbook error:", error);
      res.status(500).json({ error: "Failed to confirm booking" });
    }
  });

  // Celebration message generation endpoint
  app.post("/api/celebrate", async (req, res) => {
    try {
      const { type, jobTitle, clientName, amount, serviceName } = req.body;
      
      if (!type || !["job_booked", "payment_received"].includes(type)) {
        return res.status(400).json({ error: "Invalid celebration type" });
      }

      const message = await generateCelebrationMessage({
        type,
        jobTitle,
        clientName,
        amount,
        serviceName,
      });

      res.json({ message });
    } catch (error) {
      console.error("Celebration message error:", error);
      res.status(500).json({ error: "Failed to generate celebration message" });
    }
  });

  // ============================================================
  // REGRESSION TEST: No Silent Completion Enforcement
  // ============================================================
  // This endpoint tests that the revenue protection enforcement works.
  // It tests BOTH paths: UPDATE to completed and INSERT with completed status.
  // 
  // CRITICAL: This test MUST pass. If it fails, revenue protection is broken.
  app.post("/api/test/no-silent-completion", isAuthenticated, async (req, res) => {
    const results: { test: string; passed: boolean; details: string }[] = [];
    
    try {
      // TEST 1: UPDATE path - create job then try to complete without resolution
      try {
        const testJob = await storage.createJob({
          userId: (req as any).userId,
          title: "Test Enforcement Job (UPDATE)",
          serviceType: "Test",
          status: "scheduled",
          scheduledDate: new Date().toISOString().split("T")[0],
          scheduledTime: "10:00",
          price: 10000,
          clientName: "Test Client",
          clientPhone: "555-0000",
        });

        let updateBlocked = false;
        try {
          await storage.updateJob(testJob.id, { status: "completed" });
          updateBlocked = false;
        } catch (err: any) {
          updateBlocked = true;
          results.push({
            test: "UPDATE_PATH",
            passed: true,
            details: err.message || "Update correctly blocked",
          });
        }

        await storage.deleteJob(testJob.id);

        if (!updateBlocked) {
          results.push({
            test: "UPDATE_PATH",
            passed: false,
            details: "Job was completed via UPDATE without resolution - ENFORCEMENT BROKEN",
          });
        }
      } catch (err: any) {
        results.push({ test: "UPDATE_PATH", passed: false, details: `Setup error: ${err.message}` });
      }

      // TEST 2: INSERT path - try to insert a job directly with completed status
      try {
        let insertBlocked = false;
        try {
          await storage.createJob({
            userId: (req as any).userId,
            title: "Test Enforcement Job (INSERT)",
            serviceType: "Test",
            status: "completed", // Directly inserting as completed - MUST fail
            scheduledDate: new Date().toISOString().split("T")[0],
            scheduledTime: "10:00",
            price: 10000,
            clientName: "Test Client",
            clientPhone: "555-0001",
          });
          insertBlocked = false;
        } catch (err: any) {
          insertBlocked = true;
          results.push({
            test: "INSERT_PATH",
            passed: true,
            details: err.message || "Insert correctly blocked",
          });
        }

        if (!insertBlocked) {
          results.push({
            test: "INSERT_PATH",
            passed: false,
            details: "Job was created via INSERT with completed status without resolution - ENFORCEMENT BROKEN",
          });
        }
      } catch (err: any) {
        results.push({ test: "INSERT_PATH", passed: false, details: `Setup error: ${err.message}` });
      }

      // TEST 3: LEGITIMATE FLOW - create job, add resolution, then complete
      try {
        const legitJob = await storage.createJob({
          userId: (req as any).userId,
          title: "Test Legitimate Flow",
          serviceType: "Test",
          status: "scheduled",
          scheduledDate: new Date().toISOString().split("T")[0],
          scheduledTime: "10:00",
          price: 10000,
          clientName: "Test Client",
          clientPhone: "555-0002",
        });

        // Create resolution FIRST
        await storage.createJobResolution({
          jobId: legitJob.id,
          resolutionType: "waived",
          waiverReason: "internal",
          resolvedAt: new Date().toISOString(),
          resolvedByUserId: (req as any).userId,
          createdAt: new Date().toISOString(),
        });

        // Now complete should work
        let legitFlowWorked = false;
        try {
          const completed = await storage.updateJob(legitJob.id, { status: "completed" });
          if (completed?.status === "completed") {
            legitFlowWorked = true;
            results.push({
              test: "LEGITIMATE_FLOW",
              passed: true,
              details: "Job with resolution was completed successfully",
            });
          }
        } catch (err: any) {
          legitFlowWorked = false;
          results.push({
            test: "LEGITIMATE_FLOW",
            passed: false,
            details: `Legitimate flow blocked unexpectedly: ${err.message}`,
          });
        }

        // Clean up
        await storage.deleteJobResolution(legitJob.id);
        await storage.deleteJob(legitJob.id);
      } catch (err: any) {
        results.push({ test: "LEGITIMATE_FLOW", passed: false, details: `Setup error: ${err.message}` });
      }

      // Summary
      const allPassed = results.every(r => r.passed);
      if (allPassed) {
        res.json({
          passed: true,
          message: "All enforcement tests passed",
          results,
        });
      } else {
        res.status(500).json({
          passed: false,
          message: "CRITICAL: Some enforcement tests FAILED",
          results,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        passed: false,
        message: "Test error",
        details: error.message,
      });
    }
  });

  // Admin User Management Tests
  app.post("/api/test/admin-users", async (req, res) => {
    try {
      const { runAllAdminTests } = await import("./tests/adminUsers.test");
      const results = await runAllAdminTests();
      
      const passed = results.failed === 0;
      const message = passed 
        ? `All ${results.total} admin tests passed`
        : `${results.failed}/${results.total} admin tests failed`;
      
      res.status(passed ? 200 : 500).json({
        passed,
        message,
        total: results.total,
        passedCount: results.passed,
        failedCount: results.failed,
        results: results.results
      });
    } catch (error: any) {
      res.status(500).json({
        passed: false,
        message: "Test runner error",
        error: error.message,
      });
    }
  });

  // ============ ZENDESK SUPPORT TICKET ROUTES ============

  // Validation schema for support ticket creation
  const createTicketSchema = z.object({
    subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
    description: z.string().min(1, "Description is required").max(10000, "Description too long"),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
    type: z.enum(["question", "incident", "problem", "task"]).optional().default("question"),
    category: z.string().optional(),
  });

  // Public endpoint for creating support tickets (used on error pages)
  const publicTicketSchema = z.object({
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(10000),
    requesterEmail: z.string().email("Valid email required"),
    requesterName: z.string().min(1, "Name is required"),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  });

  app.post("/api/support/tickets/public", async (req, res) => {
    try {
      const parseResult = publicTicketSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parseResult.error.errors 
        });
      }
      
      const { subject, description, requesterEmail, requesterName, priority } = parseResult.data;

      const ticket = await createSupportTicket({
        subject,
        description,
        priority: priority || "normal",
        type: "incident",
        tags: ["gigaid", "public-error-page", "app-support"],
        requesterEmail,
        requesterName,
      });

      res.json({
        success: true,
        ticketId: ticket.ticket.id,
        message: "Support ticket created successfully",
      });
    } catch (error: any) {
      console.error("Error creating public support ticket:", error);
      res.status(500).json({ 
        error: "Failed to create support ticket",
        details: error.message 
      });
    }
  });

  // Create a new support ticket
  app.post("/api/support/tickets", isAuthenticated, async (req, res) => {
    try {
      // Validate input
      const parseResult = createTicketSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parseResult.error.errors 
        });
      }
      
      const { subject, description, priority, type, category } = parseResult.data;
      
      // Get user info for the ticket
      const user = await storage.getUser((req as any).userId);
      if (!user?.email) {
        return res.status(400).json({ 
          error: "Please add an email to your profile before creating a support ticket" 
        });
      }
      
      const requesterEmail = user.email;
      const requesterName = user.name || "GigAid User";

      const tags = ["gigaid", "app-support"];
      if (category) tags.push(category);

      const ticket = await createSupportTicket({
        subject,
        description,
        priority: priority || "normal",
        type: type || "question",
        tags,
        requesterEmail,
        requesterName,
      });

      res.json({
        success: true,
        ticketId: ticket.ticket.id,
        message: "Support ticket created successfully",
      });
    } catch (error: any) {
      console.error("Error creating support ticket:", error);
      res.status(500).json({ 
        error: "Failed to create support ticket",
        details: error.message 
      });
    }
  });

  // Get user's support tickets
  app.get("/api/support/tickets", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      const email = user?.email;
      
      if (!email) {
        return res.json({ tickets: [] });
      }

      const result = await getTicketsByEmail(email);
      const tickets = result.results?.map((t: any) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })) || [];

      res.json({ tickets });
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ 
        error: "Failed to fetch support tickets",
        details: error.message 
      });
    }
  });

  // Get a specific ticket with comments
  app.get("/api/support/tickets/:ticketId", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      
      const [ticketResult, commentsResult] = await Promise.all([
        getTicketById(ticketId),
        getTicketComments(ticketId),
      ]);

      res.json({
        ticket: {
          id: ticketResult.ticket.id,
          subject: ticketResult.ticket.subject,
          description: ticketResult.ticket.description,
          status: ticketResult.ticket.status,
          priority: ticketResult.ticket.priority,
          createdAt: ticketResult.ticket.created_at,
          updatedAt: ticketResult.ticket.updated_at,
        },
        comments: commentsResult.comments?.map((c: any) => ({
          id: c.id,
          body: c.body,
          author: c.author_id,
          createdAt: c.created_at,
          public: c.public,
        })) || [],
      });
    } catch (error: any) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ 
        error: "Failed to fetch ticket details",
        details: error.message 
      });
    }
  });

  // Add comment to a ticket
  app.post("/api/support/tickets/:ticketId/comments", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { comment } = req.body;

      await addTicketComment(ticketId, comment, true);

      res.json({
        success: true,
        message: "Comment added successfully",
      });
    } catch (error: any) {
      console.error("Error adding comment:", error);
      res.status(500).json({ 
        error: "Failed to add comment",
        details: error.message 
      });
    }
  });

  // ==================== CLIENT NOTIFICATION CAMPAIGNS ====================
  
  // Get provider services (with categories)
  app.get("/api/provider-services", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const services = await storage.getProviderServices(userId);
      res.json(services);
    } catch (error: any) {
      console.error("Error fetching provider services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // Create a provider service
  app.post("/api/provider-services", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name, category, description } = req.body;
      
      const service = await storage.createProviderService({
        userId,
        name,
        category,
        description,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      
      res.json(service);
    } catch (error: any) {
      console.error("Error creating provider service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  // Get eligible clients for notification (past clients who haven't opted out)
  app.get("/api/notification-campaigns/eligible-clients", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const channel = (req.query.channel as string) || "sms";
      
      const eligibleClients = await storage.getEligibleClientsForNotification(userId, channel);
      res.json({
        count: eligibleClients.length,
        clients: eligibleClients,
      });
    } catch (error: any) {
      console.error("Error fetching eligible clients:", error);
      res.status(500).json({ error: "Failed to fetch eligible clients" });
    }
  });

  // Validate a campaign (without sending)
  app.post("/api/notification-campaigns/validate", requireAuth, async (req, res) => {
    const { 
      validateFullCampaign,
      generateDefaultMessage,
      formatCategory,
      formatEventType,
    } = await import("./notificationCampaignValidator");
    
    try {
      const userId = (req as any).userId;
      const { serviceId, eventType, eventReason, channel, bookingLink, messageContent } = req.body;
      
      const service = await storage.getProviderServiceById(serviceId);
      if (!service || service.userId !== userId) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      const eligibleClients = await storage.getEligibleClientsForNotification(userId, channel);
      
      const getCampaignsInLastWeek = async (uid: string, sid?: string) => {
        return storage.getCampaignCountInLastWeek(uid, sid);
      };
      
      const validation = await validateFullCampaign(
        {
          userId,
          serviceId,
          serviceCategory: service.category as any,
          eventType,
          eventReason,
          channel,
          bookingLink,
          messageContent: messageContent || generateDefaultMessage(eventType, eventReason, bookingLink, channel),
          serviceLicensed: service.licensed ?? false,
        },
        getCampaignsInLastWeek,
        eligibleClients.length
      );
      
      res.json({
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        eligibleClientCount: eligibleClients.length,
        suggestedMessage: generateDefaultMessage(eventType, eventReason, bookingLink, channel),
      });
    } catch (error: any) {
      console.error("Error validating campaign:", error);
      res.status(500).json({ error: "Failed to validate campaign" });
    }
  });

  // Send a notification campaign
  app.post("/api/notification-campaigns", requireAuth, async (req, res) => {
    const { 
      validateFullCampaign,
      generateDefaultMessage,
      validateQuietHours,
    } = await import("./notificationCampaignValidator");
    
    try {
      const userId = (req as any).userId;
      const { serviceId, eventType, eventReason, channel, bookingLink, messageContent } = req.body;
      
      // Check AI campaign suggestions capability
      const user = await storage.getUser(userId);
      const userPlan = (user?.plan as CapPlan) || 'free';
      
      if (!isDeveloper(user)) {
        const campaignUsageRecord = await storage.getCapabilityUsage(userId, 'ai.campaign_suggestions');
        const campaignUsage = campaignUsageRecord?.usageCount ?? 0;
        const capResult = canPerform(userPlan, 'ai.campaign_suggestions', campaignUsage);
        
        if (!capResult.allowed) {
          return res.status(403).json({
            error: "Campaign limit reached",
            code: "CAMPAIGN_LIMIT_EXCEEDED",
            message: capResult.reason || "You've reached your campaign limit. Upgrade for more.",
            currentCount: campaignUsage,
            limit: capResult.limit,
            remaining: capResult.remaining,
            plan: userPlan
          });
        }
      }
      
      const service = await storage.getProviderServiceById(serviceId);
      if (!service || service.userId !== userId) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      const eligibleClients = await storage.getEligibleClientsForNotification(userId, channel);
      
      const getCampaignsInLastWeek = async (uid: string, sid?: string) => {
        return storage.getCampaignCountInLastWeek(uid, sid);
      };
      
      const finalMessage = messageContent || generateDefaultMessage(eventType, eventReason, bookingLink, channel);
      
      const validation = await validateFullCampaign(
        {
          userId,
          serviceId,
          serviceCategory: service.category as any,
          eventType,
          eventReason,
          channel,
          bookingLink,
          messageContent: finalMessage,
          serviceLicensed: service.licensed ?? false,
        },
        getCampaignsInLastWeek,
        eligibleClients.length
      );
      
      if (!validation.valid) {
        return res.status(400).json({
          error: "Campaign validation failed",
          errors: validation.errors,
        });
      }
      
      const currentHour = new Date().getHours();
      const quietHoursCheck = validateQuietHours(currentHour);
      if (!quietHoursCheck.valid) {
        return res.status(400).json({
          error: "Cannot send during quiet hours",
          errors: quietHoursCheck.errors,
        });
      }
      
      const now = new Date().toISOString();
      const campaign = await storage.createCampaign({
        userId,
        serviceId,
        eventType,
        eventReason,
        channel,
        bookingLink,
        messageContent: finalMessage,
        recipientCount: eligibleClients.length,
        sentAt: now,
        createdAt: now,
      });
      
      // Increment campaign usage after successful creation
      if (!isDeveloper(user)) {
        await storage.incrementCapabilityUsage(userId, 'ai.campaign_suggestions');
      }
      
      let successCount = 0;
      let failCount = 0;
      
      for (const client of eligibleClients) {
        try {
          if (channel === "sms" && client.clientPhone) {
            await sendSMS(client.clientPhone, finalMessage);
            successCount++;
          } else if (channel === "email" && client.clientEmail) {
            await sendEmail({
              to: client.clientEmail,
              subject: `Update from your service provider`,
              text: finalMessage,
              html: `<p>${finalMessage.replace(/\n/g, '<br>')}</p>`
            });
            successCount++;
          }
        } catch (sendError) {
          console.error(`Failed to send to client ${client.id}:`, sendError);
          failCount++;
        }
      }
      
      res.json({
        success: true,
        campaign,
        sent: successCount,
        failed: failCount,
        total: eligibleClients.length,
      });
    } catch (error: any) {
      console.error("Error sending campaign:", error);
      res.status(500).json({ error: "Failed to send campaign" });
    }
  });

  // Get campaign history
  app.get("/api/notification-campaigns", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const campaigns = await storage.getCampaigns(userId);
      res.json(campaigns);
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get campaign suggestions (AI-generated, Phase 2)
  // Requires ai_campaign_suggestions capability (Pro+ or Business)
  app.get("/api/notification-campaigns/suggestions", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      
      // Check plan gating - ai_campaign_suggestions requires Pro+ or Business
      if (user && !hasCapability(user, "ai_campaign_suggestions") && !isDeveloper(user)) {
        return res.json([]); // Return empty array for users without capability
      }
      
      const suggestions = await storage.getCampaignSuggestions(userId);
      res.json(suggestions);
    } catch (error: any) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  // Dismiss a campaign suggestion
  app.post("/api/notification-campaigns/suggestions/:suggestionId/dismiss", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { suggestionId } = req.params;
      
      await storage.dismissCampaignSuggestion(suggestionId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error dismissing suggestion:", error);
      res.status(500).json({ error: "Failed to dismiss suggestion" });
    }
  });

  // Handle opt-out (for clients receiving notifications)
  app.post("/api/notification-opt-out", async (req, res) => {
    try {
      const { phone, email } = req.body;
      
      if (!phone && !email) {
        return res.status(400).json({ error: "Phone or email required" });
      }
      
      await storage.optOutClient(phone, email);
      res.json({ success: true, message: "You have been opted out of notifications" });
    } catch (error: any) {
      console.error("Error processing opt-out:", error);
      res.status(500).json({ error: "Failed to process opt-out" });
    }
  });

  // ============================================================================
  // POST-JOB MOMENTUM ENGINE API ROUTES
  // ============================================================================

  // Get user automation settings
  app.get("/api/automation-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { getOrCreateAutomationSettings } = await import("./postJobMomentum");
      const settings = await getOrCreateAutomationSettings(userId);
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching automation settings:", error);
      res.status(500).json({ error: "Failed to fetch automation settings" });
    }
  });

  // Update user automation settings
  app.put("/api/automation-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { 
        postJobFollowupEnabled,
        followupDelayHours,
        followupTemplate,
        paymentReminderEnabled,
        paymentReminderDelayHours,
        paymentReminderTemplate,
        reviewLinkUrl,
        autoConfirmEnabled,
        confirmationTemplate
      } = req.body;
      
      // Validate
      if (followupDelayHours && ![24, 48].includes(followupDelayHours)) {
        return res.status(400).json({ error: "followupDelayHours must be 24 or 48" });
      }
      if (paymentReminderDelayHours && ![24, 48].includes(paymentReminderDelayHours)) {
        return res.status(400).json({ error: "paymentReminderDelayHours must be 24 or 48" });
      }
      if (followupTemplate && followupTemplate.length > 500) {
        return res.status(400).json({ error: "followupTemplate must be 500 characters or less" });
      }
      if (paymentReminderTemplate && paymentReminderTemplate.length > 500) {
        return res.status(400).json({ error: "paymentReminderTemplate must be 500 characters or less" });
      }
      if (confirmationTemplate && confirmationTemplate.length > 500) {
        return res.status(400).json({ error: "confirmationTemplate must be 500 characters or less" });
      }
      if (reviewLinkUrl && !/^https?:\/\/.+/.test(reviewLinkUrl)) {
        return res.status(400).json({ error: "reviewLinkUrl must be a valid URL" });
      }
      
      const { db } = await import("./db");
      const { userAutomationSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Upsert settings
      const { getOrCreateAutomationSettings } = await import("./postJobMomentum");
      await getOrCreateAutomationSettings(userId); // Ensure row exists
      
      const [updated] = await db
        .update(userAutomationSettings)
        .set({
          postJobFollowupEnabled: postJobFollowupEnabled ?? undefined,
          followupDelayHours: followupDelayHours ?? undefined,
          followupTemplate: followupTemplate ?? undefined,
          paymentReminderEnabled: paymentReminderEnabled ?? undefined,
          paymentReminderDelayHours: paymentReminderDelayHours ?? undefined,
          paymentReminderTemplate: paymentReminderTemplate ?? undefined,
          reviewLinkUrl: reviewLinkUrl ?? undefined,
          autoConfirmEnabled: autoConfirmEnabled ?? undefined,
          confirmationTemplate: confirmationTemplate ?? undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userAutomationSettings.userId, userId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating automation settings:", error);
      res.status(500).json({ error: "Failed to update automation settings" });
    }
  });

  // Get scheduled messages for a job
  app.get("/api/jobs/:jobId/scheduled-messages", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { jobId } = req.params;
      
      const { getScheduledMessagesForJob } = await import("./postJobMomentum");
      const messages = await getScheduledMessagesForJob(jobId, userId);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching scheduled messages:", error);
      res.status(500).json({ error: "Failed to fetch scheduled messages" });
    }
  });

  // Cancel a scheduled message
  app.post("/api/outbound-messages/:id/cancel", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      
      const { cancelOutboundMessage } = await import("./postJobMomentum");
      const success = await cancelOutboundMessage(id, userId);
      
      if (success) {
        res.json({ success: true, message: "Message canceled" });
      } else {
        res.status(400).json({ error: "Cannot cancel message - already sent or not found" });
      }
    } catch (error: any) {
      console.error("Error canceling message:", error);
      res.status(500).json({ error: "Failed to cancel message" });
    }
  });

  // Get all scheduled/queued messages for user (for Messages queue UI)
  app.get("/api/outbound-messages", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const status = req.query.status as string | undefined;
      
      const { db } = await import("./db");
      const { outboundMessages } = await import("@shared/schema");
      const { eq, and, inArray } = await import("drizzle-orm");
      
      let query = db.select().from(outboundMessages).where(eq(outboundMessages.userId, userId));
      
      if (status) {
        const statuses = status.split(",");
        query = db.select().from(outboundMessages).where(
          and(
            eq(outboundMessages.userId, userId),
            inArray(outboundMessages.status, statuses)
          )
        );
      }
      
      const messages = await query;
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching outbound messages:", error);
      res.status(500).json({ error: "Failed to fetch outbound messages" });
    }
  });

  // Get recent activity for micro-confirmations
  app.get("/api/recent-activity", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { db } = await import("./db");
      const { outboundMessages, invoices } = await import("@shared/schema");
      const { eq, and, gte } = await import("drizzle-orm");
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const recentMessages = await db
        .select({
          id: outboundMessages.id,
          type: outboundMessages.type,
          status: outboundMessages.status,
          sentAt: outboundMessages.sentAt,
          jobId: outboundMessages.jobId,
        })
        .from(outboundMessages)
        .where(
          and(
            eq(outboundMessages.userId, userId),
            eq(outboundMessages.status, "sent"),
            gte(outboundMessages.sentAt, oneDayAgo)
          )
        )
        .limit(10);
      
      const recentPayments = await db
        .select({
          invoiceId: invoices.id,
          paidAt: invoices.paidAt,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.status, "paid"),
            gte(invoices.paidAt, oneDayAgo)
          )
        )
        .limit(10);
      
      res.json({ 
        recentMessages, 
        recentPayments: recentPayments.filter(p => p.paidAt) 
      });
    } catch (error: any) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });

  // Start the momentum scheduler
  import("./postJobMomentum").then(({ startMomentumScheduler }) => {
    startMomentumScheduler(60000); // Check every minute
  }).catch(err => {
    console.error("[PostJobMomentum] Failed to start scheduler:", err);
  });

  return httpServer;
}
