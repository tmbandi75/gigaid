import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { verifyAppJwt } from "../../appJwt";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "session",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log("[Auth] /api/login requested, hostname:", req.hostname);
    try {
      ensureStrategy(req.hostname);
      console.log("[Auth] Strategy ensured for:", req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, (err: any) => {
        if (err) {
          console.error("[Auth] Passport authenticate error:", err);
        }
        next(err);
      });
    } catch (error) {
      console.error("[Auth] Error in /api/login:", error);
      next(error);
    }
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // POST logout endpoint for deterministic client-side logout
  // Returns JSON acknowledgment only after all logout operations complete
  app.post("/api/auth/logout", async (req, res) => {
    const startTime = Date.now();
    console.log("[Auth] POST /api/auth/logout - starting deterministic logout, timestamp:", startTime);
    
    try {
      // Step 1: Await passport logout completion
      await new Promise<void>((resolve) => {
        req.logout((err) => {
          if (err) {
            console.error("[Auth] Passport logout error:", err);
          }
          console.log("[Auth] Passport logout complete, timestamp:", Date.now());
          resolve();
        });
      });
      
      // Step 2: Await session destruction
      if (req.session) {
        await new Promise<void>((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              console.error("[Auth] Session destroy error:", err);
            }
            console.log("[Auth] Session destroyed, timestamp:", Date.now());
            resolve();
          });
        });
      }
      
      // Step 3: Clear session cookie with EXACT same options as getSession() config
      // MUST match: secure: true, sameSite: "none" to properly clear the cookie
      const cookieOptions = {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
      };
      
      res.clearCookie("connect.sid", cookieOptions);
      console.log("[Auth] Cleared connect.sid cookie with options:", cookieOptions);
      
      // Also clear any other potential session cookies
      const cookieNames = Object.keys(req.cookies || {});
      for (const name of cookieNames) {
        if (name.includes("session") || name.includes("sid")) {
          res.clearCookie(name, cookieOptions);
          console.log("[Auth] Cleared additional cookie:", name);
        }
      }
      
      const endTime = Date.now();
      console.log("[Auth] POST /api/auth/logout - complete, duration:", endTime - startTime, "ms");
      
      res.json({ success: true, timestamp: endTime });
      
    } catch (error) {
      console.error("[Auth] Logout error:", error);
      res.status(500).json({ success: false, error: "Logout failed" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // First, check for JWT Bearer token (mobile/Firebase auth)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAppJwt(token);
    if (payload?.sub) {
      // Valid JWT - set userId and proceed
      (req as any).userId = payload.sub;
      return next();
    }
    // Invalid JWT - don't fall through to session auth, just reject
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fall back to Replit Auth session
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Set userId on request for downstream handlers
  const userId = user?.claims?.sub;
  if (userId) {
    (req as any).userId = userId;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
