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
      const { name, email, phone, photo, businessName, bio } = req.body;
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
      const invoice = await storage.updateInvoice(req.params.id, {
        status: "paid",
        paymentMethod: paymentMethod || "other",
        paidAt: new Date().toISOString(),
      });
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark invoice as paid" });
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
        reviews: reviews.slice(0, 5),
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

  return httpServer;
}
