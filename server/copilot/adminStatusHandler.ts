import type { Request, Response } from "express";
import { eq, or, type SQL } from "drizzle-orm";
import { admins } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { verifyAppJwt } from "../appJwt";
import { logger } from "../lib/logger";
import { isAdminUser } from "./adminMiddleware";

export async function handleAdminStatus(req: Request, res: Response): Promise<void> {
  let userId: string | null = null;
  let userEmail: string | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyAppJwt(token);
    if (payload?.sub) {
      userId = payload.sub;
      userEmail = payload.email_normalized || null;
    }
  }

  if (!userId) {
    const user = req.user as any;
    userId = user?.claims?.sub || null;
  }

  if (userId && !userEmail) {
    const dbUser = await storage.getUser(userId);
    userEmail = dbUser?.email || null;
  }

  logger.debug("[AdminStatus] Checking admin for user");

  if (!userId && !userEmail) {
    logger.debug("[AdminStatus] No userId or email found, returning false");
    res.json({ isAdmin: false });
    return;
  }

  const isAdmin = isAdminUser(userId || undefined, userEmail || undefined);
  logger.debug("[AdminStatus] Bootstrap admin check: isAdmin=", isAdmin);

  if (isAdmin) {
    res.json({ isAdmin: true, role: "super_admin" });
    return;
  }

  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(admins.userId, userId));
  if (userEmail) conditions.push(eq(admins.email, userEmail));

  if (conditions.length > 0) {
    const [dbAdmin] = await db
      .select()
      .from(admins)
      .where(or(...conditions))
      .limit(1);

    if (dbAdmin && dbAdmin.isActive) {
      res.json({ isAdmin: true, role: dbAdmin.role });
      return;
    }
  }

  res.json({ isAdmin: false });
}
