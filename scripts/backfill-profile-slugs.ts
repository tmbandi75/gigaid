/**
 * One-time backfill: generate public_profile_slug for any user row that has NULL.
 *
 * Run with:
 *   npx tsx scripts/backfill-profile-slugs.ts
 *
 * Safe to run multiple times — only rows where public_profile_slug IS NULL are touched.
 *
 * This script was run once on 2026-04-30 to fix 11 rows that were blocking
 * `npm run db:push` (schema marks the column notNull() but rows had NULLs).
 */

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { isNull, eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { generateBookingSlug } from "../server/lib/bookingSlug";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

async function slugAlreadyTaken(slug: string, excludeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.publicProfileSlug, slug));
  return rows.some((r) => r.id !== excludeId);
}

async function findUniqueSlug(base: string, userId: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (await slugAlreadyTaken(candidate, userId)) {
    candidate = `${base}-${suffix}`;
    suffix++;
    if (suffix > 100) {
      candidate = `${base}-${Date.now().toString(36).slice(-4)}`;
      break;
    }
  }
  return candidate;
}

async function main() {
  console.log("Fetching users with null public_profile_slug...");

  const nullSlugUsers = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      businessName: schema.users.businessName,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(isNull(schema.users.publicProfileSlug));

  console.log(`Found ${nullSlugUsers.length} user(s) with null slugs.`);

  if (nullSlugUsers.length === 0) {
    console.log("Nothing to do — all users already have slugs.");
    await pool.end();
    return;
  }

  let updated = 0;
  for (const user of nullSlugUsers) {
    const base = generateBookingSlug({
      name: user.name,
      businessName: user.businessName,
      username: user.username,
      email: user.email,
    });
    const slug = await findUniqueSlug(base, user.id);

    await db
      .update(schema.users)
      .set({ publicProfileSlug: slug })
      .where(eq(schema.users.id, user.id));

    console.log(`  Updated user ${user.id} (${user.username}) → slug: "${slug}"`);
    updated++;
  }

  console.log(`\nDone. Backfilled ${updated} user(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
