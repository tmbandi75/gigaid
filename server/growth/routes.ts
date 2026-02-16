import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createGrowthLead, bookCall, convertLead, getLeads, getLeadById, updateLeadNotes, updateCallOutcome } from "../lib/growth/leadService";
import { trackAttribution, getAttributionForUser } from "../lib/growth/attributionService";
import { trackReferralClick, linkReferralSignup, ensureUserReferralCode, getReferralsForUser } from "../lib/growth/referralService";
import { applyReferralReward, getRewardsForUser } from "../lib/growth/rewardService";
import { createOutreachItem, updateOutreachItem, getOutreachItems, deleteOutreachItem } from "../lib/growth/outreachService";
import { trackServerEvent } from "../lib/growth/analytics";
import { adminMiddleware } from "../copilot/adminMiddleware";
import { db } from "../db";
import { growthLeads, onboardingCalls, acquisitionAttribution, growthReferrals, referralRewards, outreachQueue, users } from "@shared/schema";
import { eq, sql, desc, and, gte, count } from "drizzle-orm";
import { storage } from "../storage";
import { logger } from "../lib/logger";

async function requireFeatureFlag(flagKey: string, req: Request, res: Response): Promise<boolean> {
  try {
    const flag = await storage.getFeatureFlag(flagKey);
    if (!flag || !flag.enabled) {
      res.status(403).json({ error: `Feature '${flagKey}' is not enabled` });
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

const createLeadSchema = z.object({
  name: z.string().min(1),
  businessName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  serviceCategory: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  referrerCode: z.string().optional(),
  notes: z.string().optional(),
});

const bookCallSchema = z.object({
  leadId: z.string().min(1),
  scheduledAt: z.string().min(1),
});

const convertLeadSchema = z.object({
  leadId: z.string().min(1),
  userId: z.string().optional(),
});

const attributionSchema = z.object({
  landingPath: z.string().optional(),
  source: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  referrerCode: z.string().optional(),
});

const outreachCreateSchema = z.object({
  platform: z.string().min(1),
  profileUrl: z.string().min(1),
  handleName: z.string().optional(),
  city: z.string().optional(),
  assignedToUserId: z.string().optional(),
  notes: z.string().optional(),
  nextFollowupAt: z.string().optional(),
});

const outreachUpdateSchema = z.object({
  status: z.string().optional(),
  assignedToUserId: z.string().optional(),
  lastContactedAt: z.string().optional(),
  nextFollowupAt: z.string().optional(),
  notes: z.string().optional(),
  handleName: z.string().optional(),
  city: z.string().optional(),
});

export function registerGrowthRoutes(app: Express, requireAuth: (req: Request, res: Response, next: Function) => void) {
  app.post("/api/growth/lead", async (req: Request, res: Response) => {
    try {
      if (!(await requireFeatureFlag("growth_phase2_enabled", req, res))) return;

      const parsed = createLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const lead = await createGrowthLead(parsed.data);
      res.status(201).json(lead);
    } catch (err: any) {
      logger.error("[Growth] Failed to create lead:", err);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.post("/api/growth/book-call", async (req: Request, res: Response) => {
    try {
      const parsed = bookCallSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const call = await bookCall(parsed.data.leadId, parsed.data.scheduledAt);

      const leadForEvent = await getLeadById(parsed.data.leadId);
      trackServerEvent("growth_call_booked", parsed.data.leadId, {
        lead_id: parsed.data.leadId,
        scheduled_at: parsed.data.scheduledAt,
        source: leadForEvent?.source || "book_call",
        trigger_surface: "free_setup_page",
        landing_path: "/free-setup",
        utm_campaign: leadForEvent?.utmCampaign || null,
        referrer_user_id: leadForEvent?.referrerUserId || null,
        plan: null,
      });

      res.status(201).json(call);
    } catch (err: any) {
      if (err.message === "Lead not found") {
        return res.status(404).json({ error: "Lead not found" });
      }
      logger.error("[Growth] Failed to book call:", err);
      res.status(500).json({ error: "Failed to book call" });
    }
  });

  app.post("/api/admin/growth/convert", adminMiddleware, async (req: Request, res: Response) => {
    try {

      const parsed = convertLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const result = await convertLead(parsed.data.leadId, parsed.data.userId);

      const convertLead_ = await getLeadById(parsed.data.leadId);
      let convertPlan: string | null = null;
      if (parsed.data.userId) {
        const [convertUser] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, parsed.data.userId)).limit(1);
        if (convertUser) convertPlan = convertUser.plan;
      }
      trackServerEvent("growth_user_converted", parsed.data.userId || parsed.data.leadId, {
        lead_id: parsed.data.leadId,
        user_id: parsed.data.userId,
        source: convertLead_?.source || "admin_convert",
        trigger_surface: "admin",
        landing_path: null,
        utm_campaign: convertLead_?.utmCampaign || null,
        referrer_user_id: convertLead_?.referrerUserId || null,
        plan: convertPlan,
      });

      res.json(result);
    } catch (err: any) {
      if (err.message === "Lead not found") {
        return res.status(404).json({ error: "Lead not found" });
      }
      if (err.message === "Lead already converted") {
        return res.status(409).json({ error: "Lead already converted" });
      }
      logger.error("[Growth] Failed to convert lead:", err);
      res.status(500).json({ error: "Failed to convert lead" });
    }
  });

  app.post("/api/attribution/track", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await requireFeatureFlag("attribution_enabled", req, res))) return;

      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const parsed = attributionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const result = await trackAttribution({ userId, ...parsed.data });

      let attrPlan: string | null = null;
      const [attrUser] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
      if (attrUser) attrPlan = attrUser.plan;

      trackServerEvent("acquisition_touch_recorded", userId, {
        source: parsed.data.source,
        landing_path: parsed.data.landingPath,
        utm_campaign: parsed.data.utmCampaign,
        referrer_code: parsed.data.referrerCode,
        referrer_user_id: (result as any)?.referrerUserId || null,
        trigger_surface: "attribution_track",
        plan: attrPlan,
      });

      res.json(result);
    } catch (err: any) {
      logger.error("[Attribution] Failed to track:", err);
      res.status(500).json({ error: "Failed to track attribution" });
    }
  });

  app.get("/api/attribution/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const attr = await getAttributionForUser(userId);
      res.json(attr || {});
    } catch (err: any) {
      logger.error("[Attribution] Failed to get:", err);
      res.status(500).json({ error: "Failed to get attribution" });
    }
  });

  app.post("/api/referral/click", async (req: Request, res: Response) => {
    try {
      if (!(await requireFeatureFlag("referrals_enabled", req, res))) return;

      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Missing referral code" });

      await trackReferralClick(code);
      res.json({ tracked: true });
    } catch (err: any) {
      logger.error("[Referral] Failed to track click:", err);
      res.status(500).json({ error: "Failed to track referral click" });
    }
  });

  app.get("/api/referral/code", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const code = await ensureUserReferralCode(userId);
      res.json({ code });
    } catch (err: any) {
      logger.error("[Referral] Failed to get code:", err);
      res.status(500).json({ error: "Failed to get referral code" });
    }
  });

  app.get("/api/referral/mine", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const referrals = await getReferralsForUser(userId);
      res.json(referrals);
    } catch (err: any) {
      logger.error("[Referral] Failed to get referrals:", err);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  // ====== Admin Growth Endpoints ======

  app.get("/api/admin/growth/overview", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString();

      const [leadsCount] = await db
        .select({ count: count() })
        .from(growthLeads)
        .where(gte(growthLeads.createdAt, sinceStr));

      const [bookedCount] = await db
        .select({ count: count() })
        .from(onboardingCalls)
        .where(gte(onboardingCalls.createdAt, sinceStr));

      const [convertedCount] = await db
        .select({ count: count() })
        .from(growthLeads)
        .where(and(eq(growthLeads.status, "converted"), gte(growthLeads.createdAt, sinceStr)));

      const [referralCount] = await db
        .select({ count: count() })
        .from(growthReferrals)
        .where(gte(growthReferrals.createdAt, sinceStr));

      const [usersCreatedCount] = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, sinceStr));

      const [activatedCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(
          gte(users.createdAt, sinceStr),
          sql`${users.activationCompletedAt} IS NOT NULL`
        ));

      const [paidCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(
          gte(users.createdAt, sinceStr),
          sql`${users.firstPaymentReceivedAt} IS NOT NULL`
        ));

      const [referralSourcedCount] = await db
        .select({ count: count() })
        .from(acquisitionAttribution)
        .where(and(
          gte(acquisitionAttribution.createdAt, sinceStr),
          sql`${acquisitionAttribution.referrerUserId} IS NOT NULL`
        ));

      const totalUsers = Number(usersCreatedCount?.count) || 0;
      const totalActivated = Number(activatedCount?.count) || 0;
      const totalPaid = Number(paidCount?.count) || 0;
      const totalReferralSourced = Number(referralSourcedCount?.count) || 0;
      const activationRate = totalUsers > 0 ? Math.round((totalActivated / totalUsers) * 100) : 0;
      const paidConversionRate = totalUsers > 0 ? Math.round((totalPaid / totalUsers) * 100) : 0;
      const referralContribution = totalUsers > 0 ? Math.round((totalReferralSourced / totalUsers) * 100) : 0;

      const topSources = await db
        .select({ source: growthLeads.source, count: count() })
        .from(growthLeads)
        .where(gte(growthLeads.createdAt, sinceStr))
        .groupBy(growthLeads.source)
        .orderBy(desc(count()))
        .limit(10);

      const topCampaigns = await db
        .select({ campaign: growthLeads.utmCampaign, count: count() })
        .from(growthLeads)
        .where(and(gte(growthLeads.createdAt, sinceStr), sql`${growthLeads.utmCampaign} IS NOT NULL`))
        .groupBy(growthLeads.utmCampaign)
        .orderBy(desc(count()))
        .limit(10);

      res.json({
        period: days,
        leads: leadsCount?.count || 0,
        callsBooked: bookedCount?.count || 0,
        conversions: convertedCount?.count || 0,
        referrals: referralCount?.count || 0,
        activationRate,
        paidConversionRate,
        referralContribution,
        topSources,
        topCampaigns,
      });
    } catch (err: any) {
      logger.error("[AdminGrowth] Overview error:", err);
      res.status(500).json({ error: "Failed to get growth overview" });
    }
  });

  app.get("/api/admin/growth/leads", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const source = req.query.source as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const leads = await getLeads({ status, source, limit, offset });
      res.json(leads);
    } catch (err: any) {
      logger.error("[AdminGrowth] Leads error:", err);
      res.status(500).json({ error: "Failed to get leads" });
    }
  });

  app.get("/api/admin/growth/leads/:id", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const lead = await getLeadById(req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const calls = await db
        .select()
        .from(onboardingCalls)
        .where(eq(onboardingCalls.leadId, lead.id));

      res.json({ ...lead, calls });
    } catch (err: any) {
      logger.error("[AdminGrowth] Lead detail error:", err);
      res.status(500).json({ error: "Failed to get lead" });
    }
  });

  app.patch("/api/admin/growth/leads/:id/notes", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      const updated = await updateLeadNotes(req.params.id, notes || "");
      res.json(updated);
    } catch (err: any) {
      logger.error("[AdminGrowth] Notes update error:", err);
      res.status(500).json({ error: "Failed to update notes" });
    }
  });

  app.patch("/api/admin/growth/calls/:id/outcome", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { outcome, completedAt } = req.body;
      if (!outcome) return res.status(400).json({ error: "Missing outcome" });

      const updated = await updateCallOutcome(req.params.id, outcome, completedAt);

      if (outcome === "completed") {
        const callLead = updated?.leadId ? await getLeadById(updated.leadId) : null;
        trackServerEvent("growth_call_completed", req.params.id, {
          call_id: req.params.id,
          outcome,
          completed_at: completedAt,
          trigger_surface: "admin",
          source: callLead?.source || null,
          landing_path: null,
          utm_campaign: callLead?.utmCampaign || null,
          referrer_user_id: callLead?.referrerUserId || null,
          plan: null,
        });
      }

      res.json(updated);
    } catch (err: any) {
      if (err.message === "Call not found") {
        return res.status(404).json({ error: "Call not found" });
      }
      logger.error("[AdminGrowth] Call outcome error:", err);
      res.status(500).json({ error: "Failed to update call outcome" });
    }
  });

  // ====== Outreach Queue (Admin) ======

  app.get("/api/admin/growth/outreach", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const items = await getOutreachItems({
        status: req.query.status as string | undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json(items);
    } catch (err: any) {
      logger.error("[AdminGrowth] Outreach error:", err);
      res.status(500).json({ error: "Failed to get outreach items" });
    }
  });

  app.post("/api/admin/growth/outreach", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const parsed = outreachCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const item = await createOutreachItem(parsed.data);
      res.status(201).json(item);
    } catch (err: any) {
      logger.error("[AdminGrowth] Outreach create error:", err);
      res.status(500).json({ error: "Failed to create outreach item" });
    }
  });

  app.patch("/api/admin/growth/outreach/:id", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const parsed = outreachUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const updated = await updateOutreachItem(req.params.id, parsed.data);
      res.json(updated);
    } catch (err: any) {
      if (err.message === "Outreach item not found") {
        return res.status(404).json({ error: "Outreach item not found" });
      }
      logger.error("[AdminGrowth] Outreach update error:", err);
      res.status(500).json({ error: "Failed to update outreach item" });
    }
  });

  app.delete("/api/admin/growth/outreach/:id", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const deleted = await deleteOutreachItem(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Outreach item not found" });
      res.json({ deleted: true });
    } catch (err: any) {
      logger.error("[AdminGrowth] Outreach delete error:", err);
      res.status(500).json({ error: "Failed to delete outreach item" });
    }
  });

  // ====== Referral Rewards ======

  app.get("/api/referral/rewards", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const rewards = await getRewardsForUser(userId);
      res.json(rewards);
    } catch (err: any) {
      logger.error("[Referral] Failed to get rewards:", err);
      res.status(500).json({ error: "Failed to get rewards" });
    }
  });

  app.post("/api/admin/growth/reward", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { referrerId, referredId } = req.body;
      if (!referrerId || !referredId) {
        return res.status(400).json({ error: "Missing referrerId or referredId" });
      }

      const result = await applyReferralReward(referrerId, referredId);
      if (!result.success) {
        return res.status(409).json({ error: result.reason });
      }
      res.json(result);
    } catch (err: any) {
      logger.error("[AdminGrowth] Failed to apply reward:", err);
      res.status(500).json({ error: "Failed to apply reward" });
    }
  });

  // ====== Channel Performance (Admin) ======

  app.get("/api/admin/growth/channels", adminMiddleware, async (req: Request, res: Response) => {
    try {
      const campaigns = await db.execute(sql`
        SELECT 
          aa.utm_campaign,
          aa.utm_source,
          COUNT(DISTINCT aa.user_id) as signups,
          COUNT(DISTINCT CASE WHEN u.activation_completed_at IS NOT NULL THEN aa.user_id END) as activated,
          COUNT(DISTINCT CASE WHEN u.first_payment_received_at IS NOT NULL THEN aa.user_id END) as paid
        FROM acquisition_attribution aa
        LEFT JOIN users u ON u.id = aa.user_id
        WHERE aa.utm_campaign IS NOT NULL
        GROUP BY aa.utm_campaign, aa.utm_source
        ORDER BY signups DESC
        LIMIT 50
      `);

      res.json(campaigns.rows || []);
    } catch (err: any) {
      logger.error("[AdminGrowth] Channels error:", err);
      res.status(500).json({ error: "Failed to get channel data" });
    }
  });
}
