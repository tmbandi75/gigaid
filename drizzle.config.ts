import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // The "session" table is owned by connect-pg-simple (express-session store)
  // and is created at runtime by server/ensureExpressSessionTable.ts. It is
  // intentionally not in shared/schema.ts. Excluding it here prevents
  // drizzle-kit from offering to drop it or — more dangerously — heuristically
  // proposing to rename it into a brand-new app table (e.g. asking whether
  // duplicate_phone_alerts is a rename of session).
  tablesFilter: ["!session"],
});
