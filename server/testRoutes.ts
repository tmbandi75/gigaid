import { Router, Request, Response } from "express";
import type { IStorage } from "./storage";
import { signAppJwt } from "./appJwt";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const router = Router();

function requireTestAuth(req: Request, res: Response, next: () => void) {
  if (process.env.NODE_ENV === "production") {
    const adminKey = process.env.GIGAID_ADMIN_API_KEY;
    if (!adminKey) {
      return res.status(503).json({ error: "Admin API key not configured" });
    }
    const providedKey = req.headers["x-admin-api-key"] as string;
    if (providedKey !== adminKey) {
      return res.status(403).json({ error: "Invalid admin API key" });
    }
  }

  next();
}

export function registerTestRoutes(app: any, storage: IStorage) {
  router.use(requireTestAuth);

  router.post("/create-user", async (req: Request, res: Response) => {
    try {
      const { id, name, email, plan } = req.body;
      if (!id || !name || !email) {
        return res.status(400).json({ error: "Missing required fields: id, name, email" });
      }

      let existing = await storage.getUserByUsername(id);
      if (existing) {
        if (plan && existing.plan !== plan) {
          await storage.updateUser(existing.id, { plan });
        }
        return res.json({ success: true, action: "verified", userId: existing.id, plan: plan || existing.plan });
      }

      const user = await storage.createUser({
        username: id,
        password: "smoke-test-" + Date.now(),
      });

      await storage.updateUser(user.id, { name, email, plan: plan || "free" });

      return res.json({ success: true, action: "created", userId: user.id, plan });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/delete-user", async (req: Request, res: Response) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Missing required field: id" });
      }

      const existing = await storage.getUserByUsername(id) || await storage.getUser(id);
      if (!existing) {
        return res.json({ success: true, action: "not_found" });
      }

      return res.json({ success: true, action: "cleanup_skipped", note: "User exists but deletion skipped for safety" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/set-plan", async (req: Request, res: Response) => {
    try {
      const { userId, plan } = req.body;
      if (!userId || !plan) {
        return res.status(400).json({ error: "Missing required fields: userId, plan" });
      }

      const validPlans = ["free", "pro", "pro_plus", "business"];
      if (!validPlans.includes(plan)) {
        return res.status(400).json({ error: `Invalid plan: ${plan}` });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUser(user.id, { plan, isPro: plan !== "free" });
      return res.json({ success: true, userId: user.id, plan });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/set-slug", async (req: Request, res: Response) => {
    try {
      const { userId, slug } = req.body;
      if (!userId || !slug) {
        return res.status(400).json({ error: "Missing required fields: userId, slug" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUser(user.id, { publicProfileSlug: slug, publicProfileEnabled: true });
      return res.json({ success: true, userId: user.id, slug });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/set-referral-code", async (req: Request, res: Response) => {
    try {
      const { userId, referralCode } = req.body;
      if (!userId || !referralCode) {
        return res.status(400).json({ error: "Missing required fields: userId, referralCode" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUser(user.id, { referralCode });
      return res.json({ success: true, userId: user.id, referralCode });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get("/growth-leads", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { growthLeads } = await import("@shared/schema");
      const leads = await db.select().from(growthLeads).limit(100);
      return res.json(leads);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get("/smoke-report", async (_req: Request, res: Response) => {
    try {
      const reportPath = path.resolve("tests/monetization/reports/latest.json");
      if (!fs.existsSync(reportPath)) {
        return res.status(404).json({ error: "No smoke test report found. Run: npm run test:monetization" });
      }
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/reset-data", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { db } = await import("./db");
      const schema = await import("@shared/schema");

      const tables = [
        schema.jobs,
        schema.leads,
        schema.invoices,
        schema.smsMessages,
        schema.bookingRequests,
        schema.capabilityUsage,
        schema.followUpLogs,
        schema.aiNudges,
        schema.voiceNotes,
        schema.reminders,
        schema.readyActions,
        schema.aiOverrides,
      ];

      const results: Record<string, number> = {};
      for (const table of tables) {
        const deleted = await db.delete(table).where(eq(table.userId, user.id)).returning();
        const tableName = Object.keys(schema).find(k => (schema as any)[k] === table) || "unknown";
        results[tableName] = deleted.length;
      }

      return res.json({ success: true, userId: user.id, deleted: results });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/create-auth-token", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const token = signAppJwt({ sub: user.id, provider: "replit" });
      return res.json({ token });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/seed-job", async (req: Request, res: Response) => {
    try {
      const { userId, title, clientName, status, scheduledDate, scheduledTime, price, serviceType, location } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const job = await storage.createJob({
        userId: user.id,
        title: title || "Test Job",
        clientName: clientName || "Test Client",
        status: status || "scheduled",
        scheduledDate: scheduledDate || new Date().toISOString().split("T")[0],
        scheduledTime: scheduledTime || "10:00",
        price: price || 5000,
        serviceType: serviceType || "General",
        location: location || "Test Location",
      });

      return res.json(job);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/seed-lead", async (req: Request, res: Response) => {
    try {
      const { userId, clientName, clientPhone, clientEmail, serviceType, status, source } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const lead = await storage.createLead({
        userId: user.id,
        clientName: clientName || "Test Lead",
        clientPhone: clientPhone || "+15551234567",
        clientEmail: clientEmail || "lead@test.com",
        serviceType: serviceType || "General",
        status: status || "new",
        source: source || "manual",
      });

      return res.json(lead);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/seed-invoice", async (req: Request, res: Response) => {
    try {
      const { userId, invoiceNumber, clientName, clientEmail, clientPhone, amount, status, serviceDescription, publicToken } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing required field: userId" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const invoice = await storage.createInvoice({
        userId: user.id,
        invoiceNumber: invoiceNumber || `TEST-${Date.now()}`,
        clientName: clientName || "Test Client",
        clientEmail: clientEmail || "client@test.com",
        clientPhone: clientPhone || "+15551234567",
        amount: amount || 10000,
        status: status || "draft",
        serviceDescription: serviceDescription || "Test Service",
        publicToken: publicToken || `pub_${Date.now()}`,
      });

      return res.json(invoice);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/set-referral-code", async (req: Request, res: Response) => {
    try {
      const { userId, referralCode } = req.body;
      if (!userId || !referralCode) {
        return res.status(400).json({ error: "Missing required fields: userId, referralCode" });
      }
      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      await storage.updateUser(user.id, { referralCode });
      return res.json({ success: true, referralCode });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get("/growth-leads", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const schema = await import("@shared/schema");
      const leads = await db.select().from(schema.growthLeads).limit(100);
      return res.json(leads);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/set-usage", async (req: Request, res: Response) => {
    try {
      const { userId, capability, count } = req.body;
      if (!userId || !capability || count === undefined) {
        return res.status(400).json({ error: "Missing required fields: userId, capability, count" });
      }

      const user = await storage.getUserByUsername(userId) || await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { db } = await import("./db");
      const schema = await import("@shared/schema");

      await db.delete(schema.capabilityUsage)
        .where(
          eq(schema.capabilityUsage.userId, user.id)
        );

      for (let i = 0; i < count; i++) {
        await storage.incrementCapabilityUsage(user.id, capability);
      }

      return res.json({ success: true, usage: count });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/test", router);
}
