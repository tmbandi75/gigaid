import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, insertLeadSchema, insertInvoiceSchema } from "@shared/schema";
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
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/profile", async (req, res) => {
    try {
      const { name, email, phone, photo } = req.body;
      let user = await storage.getUser(defaultUserId);
      
      if (!user) {
        user = await storage.createUser({
          username: "demo",
          password: "demo123",
        });
      }
      
      const updatedUser = await storage.updateUser(defaultUserId, {
        name,
        email,
        phone,
        photo,
      });
      
      res.json({
        id: updatedUser?.id || defaultUserId,
        name: updatedUser?.name || name,
        email: updatedUser?.email || email,
        phone: updatedUser?.phone || phone,
        photo: updatedUser?.photo || photo,
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

  return httpServer;
}
