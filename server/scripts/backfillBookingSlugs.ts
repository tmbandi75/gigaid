/**
 * One-shot backfill: assign a booking-link slug to every user whose
 * `users.public_profile_slug` is currently NULL.
 *
 * Why this exists
 * ---------------
 * The `users_public_profile_slug_unique_idx` partial unique index allows
 * multiple rows to share NULL by design (we only enforce uniqueness on real
 * slugs). Pre-existing rows with NULL keep working everywhere except the
 * public booking URL — those accounts can't receive bookings via a public
 * link until they have a slug. This sweep gives every such account a
 * generated slug using the exact same derivation as new signups
 * (`generateBookingSlug` + collision-safe `writeUserSlugWithRetry`).
 *
 * Idempotency
 * -----------
 * The query only selects rows where `public_profile_slug IS NULL`. After
 * the first successful run those rows have non-NULL slugs and are excluded,
 * so re-running is a no-op. The end-of-run summary prints the residual
 * NULL count, which should be zero.
 *
 * Verification query (run after the script):
 *   SELECT COUNT(*) FROM users WHERE public_profile_slug IS NULL;
 * Expected: 0.
 *
 * How to run
 * ----------
 *   tsx server/scripts/backfillBookingSlugs.ts          # actually writes
 *   tsx server/scripts/backfillBookingSlugs.ts --dry-run # preview only
 */
import { eq, isNull, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { users } from "@shared/schema";
import {
  generateBookingSlug,
  writeUserSlugWithRetry,
} from "../lib/bookingSlug";

const DRY_RUN = process.argv.includes("--dry-run");

async function slugExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.publicProfileSlug, slug));
  return rows.length > 0;
}

/**
 * Mirrors `DbStorage.computeBaseSlugForNewUser`: prefer a name-derived
 * slug, fall back to the `user-<id-prefix>` placeholder when no name
 * fields are usable. We replicate it here (rather than exporting the
 * private method) so this script and signup stay in lockstep without
 * widening the storage surface area.
 */
function baseSlugForExistingUser(u: {
  id: string;
  name: string | null;
  businessName: string | null;
  username: string | null;
  email: string | null;
}): string {
  const fallback = `user-${u.id.slice(0, 8).toLowerCase()}`;
  const baseSlug = generateBookingSlug({
    name: u.name,
    businessName: u.businessName,
    username: u.username,
    email: u.email,
  });
  return !baseSlug || baseSlug === "pro" ? fallback : baseSlug;
}

async function main() {
  console.log(
    `\n🔧 Booking-slug backfill starting${DRY_RUN ? " (DRY RUN)" : ""}...\n`,
  );

  const candidates = await db
    .select({
      id: users.id,
      name: users.name,
      businessName: users.businessName,
      username: users.username,
      email: users.email,
    })
    .from(users)
    .where(isNull(users.publicProfileSlug));

  console.log(`  Found ${candidates.length} user(s) with NULL slug.\n`);

  if (candidates.length === 0) {
    console.log("  ✅ Nothing to do — every user already has a slug.\n");
    await pool.end();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of candidates) {
    const baseSlug = baseSlugForExistingUser(u);

    try {
      if (DRY_RUN) {
        console.log(`  [dry-run] ${u.id} → "${baseSlug}" (base, pre-collision)`);
        updated++;
        continue;
      }

      const { slug, result } = await writeUserSlugWithRetry(
        baseSlug,
        async (candidate) => {
          // Only flip the slug for rows that are *still* NULL. If a
          // concurrent writer (signup, claim flow, settings save) raced
          // ahead and assigned a slug, we leave that one in place rather
          // than clobber it. The returned row count tells us whether we
          // actually wrote (1) vs. were beaten to it (0).
          const rows = await db
            .update(users)
            .set({ publicProfileSlug: candidate })
            .where(
              sql`${users.id} = ${u.id} AND ${users.publicProfileSlug} IS NULL`,
            )
            .returning({ id: users.id });
          return rows;
        },
        { checkExists: slugExists },
      );

      // Empty `result` means a concurrent writer beat us to it — that's
      // a benign skip, not a failure, and the slug we passed in was *not*
      // actually written. Report it accordingly so the summary counts
      // reflect what really happened in the DB.
      if (result.length === 0) {
        skipped++;
        console.log(
          `  ⏭️  ${u.id} — already assigned by a concurrent writer (no change)`,
        );
      } else {
        updated++;
        console.log(`  ✅ ${u.id} → "${slug}"`);
      }
    } catch (err) {
      failed++;
      console.error(`  ❌ ${u.id} — ${(err as Error).message}`);
    }
  }

  console.log("\n========================================");
  console.log(
    `  SUMMARY: ${updated} updated, ${skipped} skipped (raced), ${failed} failed${DRY_RUN ? " (DRY RUN — no writes)" : ""}`,
  );
  console.log("========================================\n");

  if (!DRY_RUN) {
    const remaining = await db
      .select({ id: users.id })
      .from(users)
      .where(isNull(users.publicProfileSlug));
    console.log(`  Post-run NULL slug count: ${remaining.length}`);
    if (remaining.length === 0) {
      console.log("  ✅ Every user now has a booking-link slug.\n");
    } else {
      console.log(
        `  ⚠️  ${remaining.length} row(s) still NULL. Re-run, or inspect failures above.\n`,
      );
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n💥 Unhandled error:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
