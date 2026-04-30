-- Task #323: enforce NOT NULL on users.public_profile_slug at the SQL layer.
--
-- shared/schema.ts already declared this column as
--     text("public_profile_slug").notNull().default(sql`'user-' || substring(gen_random_uuid()::text, 1, 8)`)
-- but the live column was still nullable, so any code path that bypassed
-- Drizzle (raw SQL, future writers, ad-hoc seed scripts) could insert NULL.
--
-- Two steps, in order:
--   1. Backfill any leftover NULL slugs using the same DEFAULT expression
--      Postgres applies for new inserts. The expression is volatile, so
--      gen_random_uuid() is evaluated per row -> each backfilled slug is
--      independently random and unique.
--   2. Apply SET NOT NULL.
--
-- Both statements are idempotent, mirroring the runtime convergence helper
-- `server/ensurePublicProfileSlugNotNull.ts` that runs on every server boot
-- (the project syncs the live schema via `drizzle-kit push`, not
-- `drizzle-kit migrate`, so this file is committed primarily for audit /
-- replay, not for an automated migrator).

UPDATE "users"
   SET "public_profile_slug" =
       'user-' || substring(gen_random_uuid()::text, 1, 8)
 WHERE "public_profile_slug" IS NULL;

ALTER TABLE "users"
  ALTER COLUMN "public_profile_slug" SET NOT NULL;
