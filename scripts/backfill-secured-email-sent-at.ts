/**
 * One-time backfill: set secured_email_sent_at for users who already
 * received the "your account is secured" welcome email before the
 * column existed (Task #269 introduced the column; this backfill
 * closes the historical double-send gap for rows where
 * firebase_uid IS NOT NULL but secured_email_sent_at IS NULL).
 *
 * Run with:
 *   npx tsx scripts/backfill-secured-email-sent-at.ts
 *
 * Safe to run multiple times — only rows where firebase_uid IS NOT NULL
 * and secured_email_sent_at IS NULL are touched. No emails are sent.
 *
 * The historical timestamp written is the user's existing updated_at
 * value when present (best approximation of "when the link happened"),
 * falling back to NOW() for rows without an updated_at.
 */

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

async function main() {
  console.log(
    "Backfilling secured_email_sent_at for Firebase-linked users with NULL value...",
  );

  const result = await db.execute(sql`
    UPDATE users
       SET secured_email_sent_at = COALESCE(updated_at, NOW()::text)
     WHERE firebase_uid IS NOT NULL
       AND secured_email_sent_at IS NULL
    RETURNING id
  `);

  const updated = result.rowCount ?? 0;
  console.log(`Done. Backfilled ${updated} user(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
