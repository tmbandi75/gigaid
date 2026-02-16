import { Router, Request, Response } from "express";
import { adminMiddleware, type AdminRequest } from "../copilot/adminMiddleware";
import { runRevenueDriftCheck } from "../revenue/driftDetector";
import { logger } from "../lib/logger";

const router = Router();

router.post("/reconcile", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const endDate = req.body.endDate || new Date().toISOString();
    const startDate = req.body.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const adminReq = req as AdminRequest;
    const triggeredBy = `admin:${adminReq.adminUserId || "unknown"}`;

    logger.info(`[RevenueReconcile] Admin ${triggeredBy} triggered drift check: ${startDate} - ${endDate}`);

    const result = await runRevenueDriftCheck(startDate, endDate, triggeredBy);

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    logger.error("[RevenueReconcile] Drift check failed:", err);
    return res.status(500).json({ error: "Drift check failed", message: err.message });
  }
});

export default router;
