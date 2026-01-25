import type { Express, Request, Response } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { verifyAppJwt } from "../../appJwt";

// Helper to get user ID from either Replit session or JWT Bearer token
function getUserIdFromRequest(req: Request): string | null {
  // First, check for JWT Bearer token (mobile auth)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAppJwt(token);
    if (payload?.sub) {
      return payload.sub;
    }
  }
  
  // Fall back to Replit Auth session
  const user = (req as any).user;
  return user?.claims?.sub || null;
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user - supports both Replit session and JWT Bearer token
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
