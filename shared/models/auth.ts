import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// connect-pg-simple store (Passport / express-session). Table name is the
// library default "session" — distinct from the app's API token table `sessions`
// in shared/schema.ts. Exported under this name so Drizzle schema and TypeScript
// never collide with app `sessions`.
export const expressSessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
