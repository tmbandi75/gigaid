import { Request, Response, NextFunction } from "express";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "demo-user").split(",").map(s => s.trim());
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);

export function isAdminUser(userId: string | undefined, userEmail: string | undefined): boolean {
  if (!userId && !userEmail) return false;
  if (userId && ADMIN_USER_IDS.includes(userId)) return true;
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) return true;
  return false;
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId || "demo-user";
  const userEmail = (req as any).userEmail;
  
  if (isAdminUser(userId, userEmail)) {
    next();
  } else {
    res.status(403).json({ error: "Admin access required" });
  }
}

export function getAdminUserIds(): string[] {
  return ADMIN_USER_IDS;
}
