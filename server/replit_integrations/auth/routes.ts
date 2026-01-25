import type { Express, Request, Response, NextFunction } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { verifyAppJwt } from "../../appJwt";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user - uses isAuthenticated middleware for consistent validation
  // This ensures JWT tokens and Replit sessions are validated with expiry checks
  app.get("/api/auth/user", 
    // Custom middleware that sets cache headers before isAuthenticated runs
    (req: Request, res: Response, next: NextFunction) => {
      // Completely prevent caching of auth responses - including ETags
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      res.removeHeader('ETag');
      res.set('Last-Modified', new Date(0).toUTCString());
      next();
    },
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).userId;
        
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        
        const user = await authStorage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Send with a timestamp to bust any remaining caches
        res.json({ ...user, _ts: Date.now() });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    }
  );
}
