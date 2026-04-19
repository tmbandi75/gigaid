import { pool } from "./db";
import { logger } from "./lib/logger";

/**
 * Passport / express-session use connect-pg-simple, which needs its own row shape
 * (sid, sess, expire). The app's "sessions" table is unrelated (API tokens per user).
 */
export async function ensureExpressSessionTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
  } catch (e) {
    logger.error("[Auth] Could not ensure connect-pg-simple session table:", e);
    throw e;
  }
}
