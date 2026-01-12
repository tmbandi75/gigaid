import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
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
} from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { parseTextToPlan, suggestScheduleSlots, generateFollowUp } from "./ai/aiService";
import { parseSharedContent, generateQuickReplies } from "./ai/shareParser";
import { getOpenAI } from "./ai/openaiClient";
import { sendSMS } from "./twilio";
import { sendEmail } from "./sendgrid";
import { geocodeAddress } from "./geocode";
import { computeDepositState, calculateDepositAmount, getCancellationOutcome, formatDepositDisplay } from "./depositHelper";
import { embedDepositMetadata, extractDepositMetadata, DepositMetadata, DerivedDepositState } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const defaultUserId = "demo-user";

  registerObjectStorageRoutes(app);

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

  app.get("/api/owner/metrics", async (req, res) => {
    try {
      const user = await storage.getUser(defaultUserId);
      const isPro = user?.isPro ?? false;

      if (!isPro) {
        return res.json({ isPro: false });
      }

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
      const validated = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validated);
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
      const updates = insertJobSchema.partial().parse(req.body);
      const job = await storage.updateJob(req.params.id, updates);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update job" });
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

      const confirmUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://gigaid.com"}/confirm/${confirmToken}`;
      
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
      const baseUrl = process.env.FRONTEND_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
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
      const invoice = await storage.getInvoiceByPublicToken(req.params.token);
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
      const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`;
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
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(",")[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : "http://localhost:5000";
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

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(",")[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : "http://localhost:5000";
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
      
      res.json({
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        photo: user.photo,
        businessName: user.businessName,
        services: user.services || [],
        bio: user.bio,
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
        reviews: user.showReviewsOnBooking !== false ? reviews.slice(0, 5) : [],
        showReviews: user.showReviewsOnBooking !== false,
        availability: user.availability,
        slotDuration: user.slotDuration,
        depositEnabled: user.depositEnabled || false,
        depositType: user.depositType || "percent",
        depositValue: user.depositValue || 0,
        lateRescheduleWindowHours: user.lateRescheduleWindowHours || 24,
        lateRescheduleRetainPctFirst: user.lateRescheduleRetainPctFirst || 40,
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
      } = req.body;
      
      const user = await storage.updateUser(defaultUserId, {
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
      });
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
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
      const user = await storage.updateUser(defaultUserId, {
        onboardingStep: step,
        onboardingCompleted: completed,
      });
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

      const bookingUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://gigaid.com"}/book/${user.publicProfileSlug}`;
      
      const message = `Here's your GigAid booking link! Share it with your next customer: ${bookingUrl}`;

      await sendSMS(phoneNumber, message);

      res.json({ success: true, message: "Booking link sent to your phone!" });
    } catch (error) {
      console.error("Failed to send booking link:", error);
      res.status(500).json({ error: "Failed to send booking link" });
    }
  });

  // Invoice sharing
  app.get("/api/public/invoice/:shareLink", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByShareLink(req.params.shareLink);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        serviceDescription: invoice.serviceDescription,
        amount: invoice.amount,
        tax: invoice.tax,
        discount: invoice.discount,
        status: invoice.status,
        createdAt: invoice.createdAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
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
        success_url: `${req.protocol}://${req.get("host")}/invoice/${invoice.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/invoice/${invoice.id}`,
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
        success_url: `${req.protocol}://${req.get("host")}/payment-success/${job.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/payment/${job.id}`,
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

      const baseUrl = `${req.protocol}://${req.get("host")}`;
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
            console.log(`Stripe dispute created for booking ${booking.id}`);
          }
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
        },
        summary: {
          totalJobs: jobs.length,
          totalLeads: leads.length,
          totalInvoices: invoices.length,
          totalReminders: reminders.length,
          totalCrewMembers: crewMembers.length,
          totalReviews: reviews.length,
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
      const baseUrl = process.env.FRONTEND_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
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
  app.get("/api/ai/nudges", async (req, res) => {
    try {
      const user = await storage.getUser("demo-user");
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { entity_type, entity_id } = req.query;
      
      let nudges;
      if (entity_type && entity_id) {
        nudges = await storage.getAiNudgesByEntity(
          entity_type as string, 
          entity_id as string
        );
        nudges = nudges.filter(n => n.status === "active");
      } else {
        nudges = await storage.getActiveAiNudgesForUser(user.id);
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

  return httpServer;
}
