process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || "test-secret-admin-status-spec";
process.env.ADMIN_EMAILS = "  Admin@Example.com , other@example.com ";
process.env.ADMIN_USER_IDS = "non-existent-bootstrap-user";

jest.mock("../../server/db", () => {
  const limit = jest.fn(() => Promise.resolve([]));
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  return {
    db: { select },
    pool: { query: jest.fn() },
  };
});

jest.mock("../../server/storage", () => ({
  storage: { getUser: jest.fn() },
}));

// openid-client is ESM-only; replitAuth imports it at module top but only uses
// it inside setupAuth (never called in tests).
jest.mock("openid-client", () => ({ discovery: jest.fn() }), { virtual: true });
jest.mock("openid-client/passport", () => ({ Strategy: class {} }), { virtual: true });

import express from "express";
import passport from "passport";
import request from "supertest";
import { signAppJwt } from "../../server/appJwt";
import { isAdminUser } from "../../server/copilot/adminMiddleware";
import { handleAdminStatus } from "../../server/copilot/adminStatusHandler";
import { isAuthenticated } from "../../server/replit_integrations/auth";
import { storage } from "../../server/storage";

const ADMIN_EMAIL = "admin@example.com";

function buildApp(opts: { authedSession?: { sub: string } } = {}) {
  const app = express();
  app.use(express.json());
  app.use(passport.initialize());

  if (opts.authedSession) {
    const sub = opts.authedSession.sub;
    app.use((req, _res, next) => {
      (req as any).user = {
        claims: { sub },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      (req as any).isAuthenticated = () => true;
      next();
    });
  }

  app.get("/api/admin/status", isAuthenticated, handleAdminStatus);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  (storage.getUser as jest.Mock).mockResolvedValue(undefined);
});

describe("isAdminUser email allowlist", () => {
  it("matches an exact lowercase ADMIN_EMAILS entry", () => {
    expect(isAdminUser(undefined, ADMIN_EMAIL)).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isAdminUser(undefined, "AdMiN@Example.COM")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isAdminUser(undefined, "  admin@example.com  ")).toBe(true);
  });

  it("rejects emails not in ADMIN_EMAILS", () => {
    expect(isAdminUser(undefined, "stranger@example.com")).toBe(false);
  });

  it("rejects empty / undefined credentials", () => {
    expect(isAdminUser(undefined, undefined)).toBe(false);
    expect(isAdminUser("", "")).toBe(false);
  });

  it("rejects a non-allowlisted userId with no email", () => {
    expect(isAdminUser("some-random-user", undefined)).toBe(false);
  });
});

describe("GET /api/admin/status gating", () => {
  it("returns isAdmin true for a Bearer JWT whose email_normalized is in ADMIN_EMAILS", async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({ id: "user-jwt-admin", email: ADMIN_EMAIL });
    const token = signAppJwt({
      sub: "user-jwt-admin",
      provider: "firebase",
      email_normalized: ADMIN_EMAIL,
    });

    const res = await request(buildApp())
      .get("/api/admin/status")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isAdmin: true, role: "super_admin" });
  });

  it("returns isAdmin true for a session user whose email is looked up from the users table", async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({ id: "user-session-admin", email: ADMIN_EMAIL });

    const res = await request(
      buildApp({ authedSession: { sub: "user-session-admin" } }),
    ).get("/api/admin/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isAdmin: true, role: "super_admin" });
    expect(storage.getUser).toHaveBeenCalledWith("user-session-admin");
  });

  it("returns isAdmin false for a signed-in user with no allowlist match and no DB admin row", async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({ id: "user-not-admin", email: "stranger@example.com" });

    const res = await request(
      buildApp({ authedSession: { sub: "user-not-admin" } }),
    ).get("/api/admin/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isAdmin: false });
  });

  it("returns isAdmin true when the email matches only after case + whitespace normalization", async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({ id: "user-mixed-case", email: "  AdMiN@Example.COM  " });
    const token = signAppJwt({
      sub: "user-mixed-case",
      provider: "firebase",
      email_normalized: "  AdMiN@Example.COM  ",
    });

    const res = await request(buildApp())
      .get("/api/admin/status")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isAdmin: true, role: "super_admin" });
  });

  it("returns 401 when neither a Bearer token nor a session is present", async () => {
    const res = await request(buildApp()).get("/api/admin/status");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed Bearer token", async () => {
    const res = await request(buildApp())
      .get("/api/admin/status")
      .set("Authorization", "Bearer not-a-real-jwt");
    expect(res.status).toBe(401);
  });
});
