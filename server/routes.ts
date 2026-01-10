import type { Express } from "express";
import { createServer, type Server } from "http";
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
} from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { parseTextToPlan, suggestScheduleSlots, generateFollowUp } from "./ai/aiService";
import { sendSMS } from "./twilio";
import { sendEmail } from "./sendgrid";

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
      const validated = insertLeadSchema.parse(req.body);
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
      const invoice = await storage.updateInvoice(req.params.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
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
      const request = await storage.createBookingRequest(validated);

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
      
      const preferredDateTime = request.preferredDate && request.preferredTime
        ? `on ${formattedDate} at ${request.preferredTime}`
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

  return httpServer;
}
