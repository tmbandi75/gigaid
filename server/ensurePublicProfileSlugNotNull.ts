import { pool } from "./db";
import { logger } from "./lib/logger";

/**
 * Idempotent startup helper that converges `users.public_profile_slug` to
 * its declared `NOT NULL` shape (Task #323).
 *
 * Background
 * ----------
 * `shared/schema.ts` declares the column as `.notNull().default(...)`, but
 * historically the live column was nullable. The application-level DEFAULT
 * (Task #291) and friendly-slug helpers covered the normal path, but raw
 * SQL / ad-hoc seed scripts / future writers could still smuggle in NULL
 * slugs. Drizzle-kit `push` would refuse to add the constraint while NULL
 * rows existed, so two things have to happen, in order:
 *
 *   1. Backfill any pre-existing `NULL` slug rows using the same DEFAULT
 *      expression Postgres applies for new inserts
 *      (`'user-' || substring(gen_random_uuid()::text, 1, 8)`).
 *   2. `ALTER COLUMN ... SET NOT NULL`.
 *
 * Both statements are idempotent: the UPDATE is a no-op once there are no
 * NULL rows, and `SET NOT NULL` is a no-op when the column is already NOT
 * NULL. This lets the helper run safely on every server boot.
 *
 * The regression test in `tests/api/usersSlugUniqueIndex.test.ts` asserts
 * that a raw `INSERT ... VALUES (..., NULL)` is rejected with SQLSTATE
 * `23502` once this helper has run.
 */
export async function ensurePublicProfileSlugNotNull(): Promise<void> {
  try {
    const { rows: colInfo } = await pool.query<{ is_nullable: "YES" | "NO" }>(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'public_profile_slug'`,
    );

    if (colInfo.length === 0) {
      // Column doesn't exist yet (fresh DB, before db:push). Nothing to do —
      // db:push will create it as NOT NULL straight from the schema.
      return;
    }

    if (colInfo[0].is_nullable === "NO") {
      // Already converged. Skip the (cheap) UPDATE + ALTER round-trip.
      return;
    }

    const { rowCount: backfilled } = await pool.query(
      `UPDATE users
          SET public_profile_slug =
              'user-' || substring(gen_random_uuid()::text, 1, 8)
        WHERE public_profile_slug IS NULL`,
    );
    if (backfilled && backfilled > 0) {
      logger.info(
        `[EnsureSlugNotNull] Backfilled ${backfilled} NULL public_profile_slug row(s) before adding NOT NULL.`,
      );
    }

    await pool.query(
      `ALTER TABLE users
         ALTER COLUMN public_profile_slug SET NOT NULL`,
    );
    logger.info(
      "[EnsureSlugNotNull] users.public_profile_slug is now NOT NULL at the DB level.",
    );
  } catch (e) {
    logger.error(
      "[EnsureSlugNotNull] Failed to ensure NOT NULL on users.public_profile_slug:",
      e,
    );
    throw e;
  }
}
