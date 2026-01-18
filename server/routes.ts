import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto, { randomUUID } from "crypto";
import { storage } from "./storage";
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
import leadEmailRoutes from "./leadEmailRoutes";
import { startCopilotScheduler } from "./copilot/engine";
import { emitCanonicalEvent } from "./copilot/canonicalEvents";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const defaultUserId = "demo-user";

  registerObjectStorageRoutes(app);
  
  app.use("/api/admin/cockpit", cockpitRoutes);
  app.use("/api/admin/users", adminUsersRoutes);
  app.use("/api", leadEmailRoutes);
  
  startCopilotScheduler();

  app.get("/api/profile", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
      if (!user) {
        return res.json({
          id: defaultUserId,
          name: "Gig Worker",
          email: "gig@example.com",
          phone: null,
          photo: null,
        });
      }
      res.json({
        id: user.id,
        name: user.name || "Gig Worker",
        email: user.email || "gig@example.com",
        phone: user.phone,
        photo: user.photo,
        businessName: user.businessName,
        bio: user.bio,
        services: user.services,
        serviceArea: user.serviceArea,
        availability: user.availability,
        slotDuration: user.slotDuration,
        publicProfileEnabled: user.publicProfileEnabled,
        publicProfileSlug: user.publicProfileSlug,
        notifyBySms: user.notifyBySms,
        notifyByEmail: user.notifyByEmail,
        showReviewsOnBooking: user.showReviewsOnBooking,
        publicEstimationEnabled: user.publicEstimationEnabled,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/profile", async (req, res) => {
    try {
      const { name, email, phone, photo, businessName, bio, serviceArea } = req.body;
      let user = await storage.getUser(defaultUserId);
      
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
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (photo !== undefined) updates.photo = photo;
      if (businessName !== undefined) updates.businessName = businessName;
      if (bio !== undefined) updates.bio = bio;
      if (serviceArea !== undefined) updates.serviceArea = serviceArea;
      
      const updatedUser = await storage.updateUser(defaultUserId, updates);
      
      res.json({
        id: updatedUser?.id || defaultUserId,
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

  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const summary = await storage.getDashboardSummary(defaultUserId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  app.get("/api/dashboard/game-plan", async (req, res) => {
    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [jobs, leads, invoices, reminders] = await Promise.all([
        storage.getJobs(defaultUserId),
        storage.getLeads(defaultUserId),
        storage.getInvoices(defaultUserId),
        storage.getReminders(defaultUserId),
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

  app.get("/api/owner/metrics", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
      const isPro = user?.isPro ?? true; // Owner View now available to all users

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const jobs = await storage.getJobs(defaultUserId);
      const leads = await storage.getLeads(defaultUserId);
      const invoices = await storage.getInvoices(defaultUserId);

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
      const jobPayments = await storage.getJobPayments(defaultUserId);
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

  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getJobs(defaultUserId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
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

  app.post("/api/jobs", async (req, res) => {
    try {
      // Extract leadId from body (not part of job schema)
      const { leadId, ...jobData } = req.body;
      
      const validated = insertJobSchema.parse(jobData);
      
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
      
      emitCanonicalEvent({
        eventName: "booking_created",
        userId: job.userId,
        context: { jobId: job.id, serviceType: job.serviceType, price: job.price, leadId },
        source: "web",
      });
      
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

  app.patch("/api/jobs/:id", async (req, res) => {
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
      }
      
      const job = await storage.updateJob(req.params.id, updates);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
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
      const jobs = await storage.getJobs(defaultUserId);
      const job = jobs.find(j => j.clientConfirmToken === req.params.token);
      
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

  app.post("/api/jobs/:id/photos", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { photos } = req.body;
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

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads(defaultUserId);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
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

  app.post("/api/leads", async (req, res) => {
    try {
      // Auto-add userId if not provided
      const dataWithUser = {
        ...req.body,
        userId: req.body.userId || defaultUserId,
      };
      const validated = insertLeadSchema.parse(dataWithUser);
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

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const updates = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, updates);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
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

  // Convert lead to job
  app.post("/api/leads/:id/convert", async (req, res) => {
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
  app.get("/api/leads/follow-up-needed", async (req, res) => {
    try {
      const leads = await storage.getLeads(defaultUserId);
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
  app.post("/api/leads/:id/follow-up-response", async (req, res) => {
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
  app.get("/api/price-confirmations", async (req, res) => {
    try {
      const confirmations = await storage.getPriceConfirmationsByUser(defaultUserId);
      res.json(confirmations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price confirmations" });
    }
  });

  app.get("/api/price-confirmations/:id", async (req, res) => {
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

  app.get("/api/leads/:leadId/price-confirmations", async (req, res) => {
    try {
      const confirmations = await storage.getPriceConfirmationsByLead(req.params.leadId);
      res.json(confirmations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price confirmations" });
    }
  });

  app.get("/api/leads/:leadId/active-price-confirmation", async (req, res) => {
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
        userId: defaultUserId,
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

  app.patch("/api/price-confirmations/:id", async (req, res) => {
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

  app.delete("/api/price-confirmations/:id", async (req, res) => {
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
  app.post("/api/price-confirmations/:id/send", async (req, res) => {
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
      
      const provider = await storage.getUser(defaultUserId);
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

      // Create Stripe PaymentIntent
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
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

  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices(defaultUserId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
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

  app.post("/api/invoices", async (req, res) => {
    try {
      const validated = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(validated);
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
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invoice" });
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

  app.post("/api/ai/schedule-suggestions", async (req, res) => {
    try {
      const validated = scheduleSuggestionsSchema.parse(req.body);
      const jobs = await storage.getJobs(defaultUserId);
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

  app.post("/api/ai/follow-up", async (req, res) => {
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
  app.post("/api/sms/send", async (req, res) => {
    try {
      const { to, message, clientName, relatedJobId, relatedLeadId } = req.body;
      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }
      const success = await sendSMS(to, message);
      if (success) {
        // Log the outgoing message to the database
        await storage.createSmsMessage({
          userId: defaultUserId,
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
      } else {
        // No previous conversation found - try to identify sender from jobs/leads/invoices
        console.log(`[SMS Webhook] No previous conversation found for ${From}, attempting to identify sender...`);
        
        // Use efficient phone lookup to find client info
        const clientInfo = await storage.findClientByPhone(defaultUserId, From);
        
        if (clientInfo) {
          console.log(`[SMS Webhook] Matched to client: ${clientInfo.clientName}`);
        }
        
        // Store the message with whatever info we found
        await storage.createSmsMessage({
          userId: defaultUserId,
          clientPhone: From,
          clientName: clientInfo?.clientName || "Unknown Sender",
          direction: "inbound",
          body: Body,
          twilioSid: MessageSid,
          relatedJobId: clientInfo?.relatedJobId || null,
          relatedLeadId: clientInfo?.relatedLeadId || null,
          isRead: false,
        });
        console.log(`[SMS Webhook] Incoming from ${From} (${clientInfo?.clientName || 'Unknown'}) stored for default user`);
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
  app.get("/api/sms/messages", async (req, res) => {
    try {
      const messages = await storage.getSmsMessages(defaultUserId);
      res.json(messages);
    } catch (error) {
      console.error("SMS messages fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/sms/conversations", async (req, res) => {
    try {
      const messages = await storage.getSmsMessages(defaultUserId);
      
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

  app.get("/api/sms/conversation/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const messages = await storage.getSmsMessagesByPhone(defaultUserId, phone);
      
      // Mark messages as read
      await storage.markSmsMessagesAsRead(defaultUserId, phone);
      
      res.json(messages);
    } catch (error) {
      console.error("SMS conversation fetch error:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/sms/unread-count", async (req, res) => {
    try {
      const count = await storage.getUnreadSmsCount(defaultUserId);
      res.json({ count });
    } catch (error) {
      console.error("Unread count fetch error:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Reminders Endpoints
  app.get("/api/reminders", async (req, res) => {
    try {
      const reminders = await storage.getReminders(defaultUserId);
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.get("/api/reminders/:id", async (req, res) => {
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

  app.post("/api/reminders", async (req, res) => {
    try {
      const validated = insertReminderSchema.parse({
        ...req.body,
        userId: defaultUserId,
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

  app.patch("/api/reminders/:id", async (req, res) => {
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

  app.delete("/api/reminders/:id", async (req, res) => {
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
  app.get("/api/crew", async (req, res) => {
    try {
      const crew = await storage.getCrewMembers(defaultUserId);
      res.json(crew);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  });

  app.post("/api/crew", async (req, res) => {
    try {
      const validated = insertCrewMemberSchema.parse({
        ...req.body,
        userId: defaultUserId,
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

  app.patch("/api/crew/:id", async (req, res) => {
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

  app.delete("/api/crew/:id", async (req, res) => {
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
  app.get("/api/crew/:crewMemberId/invites", async (req, res) => {
    try {
      const allInvites = await storage.getCrewInvites(defaultUserId);
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
  app.get("/api/crew-invites", async (req, res) => {
    try {
      const invites = await storage.getCrewInvites(defaultUserId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew invites" });
    }
  });

  // Get crew invites for a specific job
  app.get("/api/jobs/:jobId/crew-invites", async (req, res) => {
    try {
      const invites = await storage.getCrewInvitesByJob(req.params.jobId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew invites" });
    }
  });

  // Create a new crew invite and optionally send notifications
  app.post("/api/crew-invites", async (req, res) => {
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
        userId: defaultUserId,
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
      const owner = await storage.getUser(defaultUserId);
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
  app.post("/api/crew-invites/:id/revoke", async (req, res) => {
    try {
      const invite = await storage.getCrewInvite(req.params.id);
      if (!invite || invite.userId !== defaultUserId) {
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
  app.post("/api/crew-invites/:id/resend", async (req, res) => {
    try {
      const { sendSms: sendSmsNotification, sendEmailNotification } = req.body;
      const invite = await storage.getCrewInvite(req.params.id);
      if (!invite || invite.userId !== defaultUserId) {
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
  app.get("/api/jobs/:jobId/crew-messages", async (req, res) => {
    try {
      const messages = await storage.getCrewMessages(req.params.jobId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send message from owner to crew
  app.post("/api/jobs/:jobId/crew-messages", async (req, res) => {
    try {
      const { crewMemberId, message } = req.body;
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }

      const newMessage = await storage.createCrewMessage({
        userId: defaultUserId,
        jobId: req.params.jobId,
        crewMemberId,
        message: message.trim(),
        isFromCrew: false,
      });

      // Notify crew member
      const crewMember = await storage.getCrewMember(crewMemberId);
      const job = await storage.getJob(req.params.jobId);
      const owner = await storage.getUser(defaultUserId);

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
  app.get("/api/referrals", async (req, res) => {
    try {
      const referrals = await storage.getReferrals(defaultUserId);
      const user = await storage.getUser(defaultUserId);
      res.json({
        referralCode: user?.referralCode || "",
        referrals,
        totalRewards: referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  });

  app.post("/api/referrals", async (req, res) => {
    try {
      const { email, phone } = req.body;
      const referral = await storage.createReferral({
        referrerId: defaultUserId,
        referredEmail: email || null,
        referredPhone: phone || null,
        referredUserId: null,
      });
      res.status(201).json(referral);
    } catch (error) {
      res.status(500).json({ error: "Failed to create referral" });
    }
  });

  // Booking Requests (Public)
  app.get("/api/booking-requests", async (req, res) => {
    try {
      const requests = await storage.getBookingRequests(defaultUserId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking requests" });
    }
  });

  app.post("/api/public/book/:slug", async (req, res) => {
    try {
      const user = await storage.getUserByPublicSlug(req.params.slug);
      if (!user || !user.publicProfileEnabled) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const validated = insertBookingRequestSchema.parse({
        ...req.body,
        userId: user.id,
      });
      
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
      });

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

      res.status(201).json(request);
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
  app.get("/api/voice-notes", async (req, res) => {
    try {
      const notes = await storage.getVoiceNotes(defaultUserId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice notes" });
    }
  });

  app.post("/api/voice-notes", async (req, res) => {
    try {
      const validated = insertVoiceNoteSchema.parse({
        ...req.body,
        userId: defaultUserId,
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

  app.patch("/api/voice-notes/:id", async (req, res) => {
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

  app.delete("/api/voice-notes/:id", async (req, res) => {
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
  app.get("/api/reviews", async (req, res) => {
    try {
      const reviews = await storage.getReviews(defaultUserId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const validated = insertReviewSchema.parse({
        ...req.body,
        userId: defaultUserId,
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

  app.post("/api/reviews/:id/respond", async (req, res) => {
    try {
      const { response } = req.body;
      const review = await storage.getReview(req.params.id);
      if (!review || review.userId !== defaultUserId) {
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

  // Public Profile Endpoints
  app.get("/api/public/profile/:slug", async (req, res) => {
    try {
      const user = await storage.getUserByPublicSlug(req.params.slug);
      if (!user || !user.publicProfileEnabled) {
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
  app.patch("/api/settings", async (req, res) => {
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
      } = req.body;
      
      // Check if this is the first time enabling public profile (booking link created)
      const existingUser = await storage.getUser(defaultUserId);
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
      };
      
      // Track first time booking link creation
      if (publicProfileEnabled && publicProfileSlug && 
          existingUser && !existingUser.bookingLinkCreatedAt) {
        updates.bookingLinkCreatedAt = new Date().toISOString();
        emitCanonicalEvent({
          eventName: "booking_link_created",
          userId: defaultUserId,
          context: { slug: publicProfileSlug },
          source: "web",
        });
      }
      
      const user = await storage.updateUser(defaultUserId, updates);
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });
  
  // Track when user shares their booking link
  app.post("/api/track/booking-link-shared", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
      if (user && !user.bookingLinkSharedAt) {
        await storage.updateUser(defaultUserId, {
          bookingLinkSharedAt: new Date().toISOString(),
        });
        emitCanonicalEvent({
          eventName: "booking_link_shared",
          userId: defaultUserId,
          context: { method: req.body.method || "unknown" },
          source: "web",
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track share" });
    }
  });

  // Get available time slots for a date (public)
  app.get("/api/public/available-slots/:slug/:date", async (req, res) => {
    try {
      const user = await storage.getUserByPublicSlug(req.params.slug);
      if (!user || !user.publicProfileEnabled) {
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
      
      const user = await storage.getUserByPublicSlug(req.params.slug);
      if (!user || !user.publicProfileEnabled) {
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
      if (!user || !user.publicProfileEnabled) {
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
  app.get("/api/estimation-requests", async (req, res) => {
    try {
      const requests = await storage.getPendingEstimationRequests(defaultUserId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching estimation requests:", error);
      res.status(500).json({ error: "Failed to fetch estimation requests" });
    }
  });

  // Get all estimation requests (provider)
  app.get("/api/estimation-requests/all", async (req, res) => {
    try {
      const requests = await storage.getEstimationRequests(defaultUserId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching estimation requests:", error);
      res.status(500).json({ error: "Failed to fetch estimation requests" });
    }
  });

  // Review and send estimate (provider)
  app.post("/api/estimation-requests/:id/review", async (req, res) => {
    try {
      const { id } = req.params;
      const { providerEstimateLow, providerEstimateHigh, providerNotes } = req.body;

      const request = await storage.getEstimationRequest(id);
      if (!request || request.providerId !== defaultUserId) {
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
  app.post("/api/estimation-requests/:id/send", async (req, res) => {
    try {
      const { id } = req.params;
      const request = await storage.getEstimationRequest(id);
      
      if (!request || request.providerId !== defaultUserId) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (!request.providerEstimateLow || !request.providerEstimateHigh) {
        return res.status(400).json({ error: "Estimate not reviewed yet" });
      }

      const user = await storage.getUser(defaultUserId);
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
  app.get("/api/onboarding", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
      res.json({
        completed: user?.onboardingCompleted || false,
        step: user?.onboardingStep || 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch onboarding status" });
    }
  });

  app.patch("/api/onboarding", async (req, res) => {
    try {
      const { step, completed } = req.body;
      const previousUser = await storage.getUser(defaultUserId);
      const previousStep = previousUser?.onboardingStep || 0;
      
      const user = await storage.updateUser(defaultUserId, {
        onboardingStep: step,
        onboardingCompleted: completed,
      });
      
      if (step !== undefined && step > previousStep) {
        emitCanonicalEvent({
          eventName: "onboarding_step_completed",
          userId: defaultUserId,
          context: { step, previousStep, completed },
          source: "web",
        });
      }
      
      res.json({
        completed: user?.onboardingCompleted || false,
        step: user?.onboardingStep || 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update onboarding" });
    }
  });

  app.post("/api/onboarding/send-booking-link", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const user = await storage.getUser(defaultUserId);
      if (!user?.publicProfileSlug) {
        return res.status(400).json({ error: "Booking link not set up yet" });
      }

      const bookingUrl = `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/book/${user.publicProfileSlug}`;
      
      const message = `Here's your GigAid booking link! Share it with your next customer: ${bookingUrl}`;

      await sendSMS(phoneNumber, message);
      
      emitCanonicalEvent({
        eventName: "booking_link_shared",
        userId: defaultUserId,
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
  app.get("/api/ai/booking-insights", async (req, res) => {
    try {
      const jobs = await storage.getJobs(defaultUserId);
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
  app.post("/api/ai/feature-nudge", async (req, res) => {
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
  app.post("/api/ai/build-services", async (req, res) => {
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
  app.post("/api/ai/generate-negotiation-reply", async (req, res) => {
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
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const methods = await storage.getUserPaymentMethods(defaultUserId);
      res.json(methods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // Create/add a new payment method
  app.post("/api/payment-methods", async (req, res) => {
    try {
      const { type, label, instructions, isEnabled } = req.body;
      if (!type) {
        return res.status(400).json({ error: "Payment type is required" });
      }
      const method = await storage.createUserPaymentMethod({
        userId: defaultUserId,
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
  app.patch("/api/payment-methods/:id", async (req, res) => {
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
  app.delete("/api/payment-methods/:id", async (req, res) => {
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
  app.post("/api/payment-methods/bulk-update", async (req, res) => {
    try {
      const { methods } = req.body;
      if (!Array.isArray(methods)) {
        return res.status(400).json({ error: "Methods array is required" });
      }

      const existingMethods = await storage.getUserPaymentMethods(defaultUserId);
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
            userId: defaultUserId,
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
      res.status(500).json({ error: "Failed to update payment methods" });
    }
  });

  // ============ JOB PAYMENTS API ============

  // Get all payments for user
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getJobPayments(defaultUserId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Get payments for a specific invoice
  app.get("/api/invoices/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getJobPaymentsByInvoice(req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice payments" });
    }
  });

  // Create a payment record (for manual payments)
  app.post("/api/payments", async (req, res) => {
    try {
      const { invoiceId, jobId, clientName, clientEmail, amount, method, notes, proofUrl } = req.body;
      if (!amount || !method) {
        return res.status(400).json({ error: "Amount and method are required" });
      }
      const payment = await storage.createJobPayment({
        userId: defaultUserId,
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
        await storage.updateInvoice(invoice_id as string, {
          status: "paid",
          paymentMethod: "stripe",
          paidAt: new Date().toISOString(),
        });

        const payments = await storage.getJobPaymentsByInvoice(invoice_id as string);
        const stripePayment = payments.find(p => p.stripeCheckoutSessionId === session_id);
        if (stripePayment) {
          await storage.updateJobPayment(stripePayment.id, {
            status: "paid",
            stripePaymentIntentId: session.payment_intent as string,
            paidAt: new Date().toISOString(),
          });
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
  app.get("/api/stripe/connect/status", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
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
  app.post("/api/stripe/connect/onboard", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
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
  app.post("/api/stripe/connect/dashboard", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
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
  app.patch("/api/stripe/connect/deposit-settings", async (req, res) => {
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

      const updated = await storage.updateUser(defaultUserId, {
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
        actorId: defaultUserId,
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
        actorId: defaultUserId,
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
        actorId: defaultUserId,
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
          actorId: defaultUserId,
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
            actorId: defaultUserId,
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
          actorId: defaultUserId,
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
          const allBookings = await storage.getBookingRequests(defaultUserId);
          const booking = allBookings.find(b => b.stripePaymentIntentId === paymentIntentId);
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
          const allBookings = await storage.getBookingRequests(defaultUserId);
          const booking = allBookings.find(b => b.stripeChargeId === chargeId);
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
          const userId = paymentIntent.metadata?.user_id || defaultUserId;
          
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
          const userId = subscription.metadata?.user_id || defaultUserId;
          
          const user = await storage.getUser(userId);
          if (user && !user.isPro) {
            await storage.updateUser(userId, { isPro: true });
            
            emitCanonicalEvent({
              eventName: "user_became_paying",
              userId,
              context: { subscriptionId: subscription.id, customerId },
              source: "system",
            });
          }
          
          emitCanonicalEvent({
            eventName: "subscription_started",
            userId,
            context: { 
              subscriptionId: subscription.id, 
              customerId,
              planId: subscription.items?.data?.[0]?.price?.id,
              amount: subscription.items?.data?.[0]?.price?.unit_amount,
            },
            source: "system",
          });
          
          console.log(`Subscription started for user ${userId}`);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const userId = subscription.metadata?.user_id || defaultUserId;
          
          await storage.updateUser(userId, { isPro: false });
          
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
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // Export all data as JSON
  app.get("/api/export/json", async (req, res) => {
    try {
      const jobs = await storage.getJobs(defaultUserId);
      const leads = await storage.getLeads(defaultUserId);
      const invoices = await storage.getInvoices(defaultUserId);
      const reminders = await storage.getReminders(defaultUserId);
      const crewMembers = await storage.getCrewMembers(defaultUserId);
      const reviews = await storage.getReviews(defaultUserId);
      const user = await storage.getUser(defaultUserId);
      const aiNudges = await storage.getAiNudges(defaultUserId);
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
  app.get("/api/export/dot", async (req, res) => {
    try {
      const jobs = await storage.getJobs(defaultUserId);
      const leads = await storage.getLeads(defaultUserId);
      const invoices = await storage.getInvoices(defaultUserId);
      const crewMembers = await storage.getCrewMembers(defaultUserId);
      const user = await storage.getUser(defaultUserId);

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
  app.post("/api/share/parse", async (req, res) => {
    try {
      const { text, url } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const user = await storage.getUser(defaultUserId);
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
  app.post("/api/share/replies", async (req, res) => {
    try {
      const { text, context } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const user = await storage.getUser(defaultUserId);
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

  app.post("/api/jobs/:id/on-the-way", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const user = await storage.getUser(defaultUserId);
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
  app.post("/api/ai/nudges/generate", async (req, res) => {
    try {
      const user = await storage.getUser("demo-user");
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { generateNudgesForUser } = await import("./nudgeGenerator");
      const result = await generateNudgesForUser(user.id);
      
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
  app.get("/api/ai/nudges", async (req, res) => {
    try {
      const user = await storage.getUser("demo-user");
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
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

  // GigAid Impact - outcomes attribution stats
  app.get("/api/ai/impact", async (req, res) => {
    try {
      const nudges = await storage.getAiNudges(defaultUserId);
      const invoices = await storage.getInvoices(defaultUserId);
      const leads = await storage.getLeads(defaultUserId);

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
  app.post("/api/admin/backfill-nudges", async (req, res) => {
    try {
      const forceBypass = req.query.force === "true";
      
      // Force regenerate nudges for the user
      const result = await generateNudgesForUser(defaultUserId, forceBypass);
      
      // Also check for completed jobs without invoices and create nudges
      const jobs = await storage.getJobs(defaultUserId);
      const invoices = await storage.getInvoices(defaultUserId);
      
      const completedWithoutInvoice = jobs.filter(job => 
        job.status === "completed" && 
        !invoices.some(inv => inv.jobId === job.id)
      );
      
      // Create invoice_create_from_job_done nudges for any missed jobs
      let backfilledCount = 0;
      for (const job of completedWithoutInvoice) {
        const amount = job.price ? job.price / 100 : 0;
        const dedupeKey = `${defaultUserId}:job:${job.id}:invoice_create_from_job_done:backfill`;
        
        const existing = await storage.getAiNudgeByDedupeKey(dedupeKey);
        if (!existing) {
          await storage.createAiNudge({
            userId: defaultUserId,
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

      const { ActionQueueGenerator } = await import("./actionQueueGenerator");
      const generator = new ActionQueueGenerator(storage);
      const items = await generator.generateQueue("demo-user");
      
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

      const { status } = req.query;
      const items = await storage.getActionQueueItems(
        "demo-user", 
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

  // ==================== OUTCOME ATTRIBUTION ====================
  // GigAid Impact metrics showing "GigAid helped you collect $X faster"

  // Compute daily outcome metrics
  app.post("/api/outcomes/compute", async (req, res) => {
    try {
      const flag = await storage.getFeatureFlag("outcome_attribution");
      if (!flag?.enabled) {
        return res.status(403).json({ 
          error: "Outcome Attribution feature is not enabled",
          featureFlag: "outcome_attribution" 
        });
      }

      const { date } = req.body;
      const metricDate = date || new Date().toISOString().split('T')[0];
      const userId = "demo-user";

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
  app.get("/api/outcomes", async (req, res) => {
    try {
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

      const metrics = await storage.getOutcomeMetricsDaily("demo-user", start, end);

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
  app.post("/api/quickbook/parse", checkQuickbookEnabled, async (req, res) => {
    try {
      // Rate limiting check
      if (!checkQuickbookParseRateLimit(defaultUserId)) {
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
        userId: defaultUserId,
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
  app.get("/api/quickbook/draft/:id", checkQuickbookEnabled, async (req, res) => {
    try {
      const draft = await storage.getJobDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (draft.userId !== defaultUserId) {
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
  app.patch("/api/quickbook/draft/:id", checkQuickbookEnabled, async (req, res) => {
    try {
      const draft = await storage.getJobDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (draft.userId !== defaultUserId) {
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
  app.post("/api/quickbook/draft/:id/send-link", checkQuickbookEnabled, async (req, res) => {
    try {
      const draft = await storage.getJobDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (draft.userId !== defaultUserId) {
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
  app.post("/api/test/no-silent-completion", async (req, res) => {
    const results: { test: string; passed: boolean; details: string }[] = [];
    
    try {
      // TEST 1: UPDATE path - create job then try to complete without resolution
      try {
        const testJob = await storage.createJob({
          userId: defaultUserId,
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
            userId: defaultUserId,
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
          userId: defaultUserId,
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
          resolvedByUserId: defaultUserId,
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

  // Create a new support ticket
  app.post("/api/support/tickets", async (req, res) => {
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
      const user = await storage.getUser(defaultUserId);
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
  app.get("/api/support/tickets", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
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

  return httpServer;
}
