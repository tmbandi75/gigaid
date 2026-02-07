import { Router, Request, Response } from "express";
import type { IStorage } from "./storage";
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

  app.use("/api/test", router);
}
